"""Uploads.

The client's ``Content-Type`` is a hint, never a fact: the type is decided by
looking at the bytes. Images are re-encoded rather than stored as received,
which normalises format, strips metadata (including GPS coordinates a phone
photo carries) and bounds the size. Anything not on the allowlist is refused.
"""

from __future__ import annotations

import hashlib
import io
import xml.etree.ElementTree as ElementTree
from dataclasses import dataclass

from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound, PayloadTooLarge, UnsupportedMedia
from app.models import AccountProfile, Asset, PortfolioHeader, Section, User
from app.models.enums import AssetKind
from app.services.storage import build_key, get_storage

#: Mirrors src/lib/assets.ts. There they were a storage ceiling; here they are
#: a sanity bound, because the bytes no longer have to fit in localStorage.
IMAGE_MAX_DIM = 1400
IMAGE_TARGET_BYTES = 420 * 1024
FILE_MAX_BYTES = 800 * 1024

#: Refused before anything is buffered, so a client cannot exhaust memory by
#: streaming an endless body.
UPLOAD_HARD_CAP = 15 * 1024 * 1024

JPEG_QUALITY_STEPS = (82, 72, 60, 48, 36, 25)

#: Every column that can point at an upload. An asset reachable from none
#: of these is unreachable, full stop — there is no other reference.
ASSET_REFERENCES = (
    AccountProfile.portrait_asset_id,
    PortfolioHeader.portrait_asset_id,
    Section.image_asset_id,
    Section.file_asset_id,
)

#: Non-image types worth attaching to a section — a PDF one-pager, mostly.
FILE_SIGNATURES: tuple[tuple[bytes, str, str], ...] = (
    (b"%PDF-", "application/pdf", ".pdf"),
    (b"PK\x03\x04", "application/zip", ".zip"),
    (b"\x89PNG\r\n\x1a\n", "image/png", ".png"),
    (b"\xff\xd8\xff", "image/jpeg", ".jpg"),
    (b"GIF87a", "image/gif", ".gif"),
    (b"GIF89a", "image/gif", ".gif"),
)

#: Office formats are zip containers, so the signature alone cannot tell them
#: apart; the declared type breaks the tie once the container is confirmed.
ZIP_SUBTYPES = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
}

TEXT_TYPES = {
    "text/plain": ".txt",
    "text/csv": ".csv",
    "text/markdown": ".md",
    "application/json": ".json",
}


@dataclass(frozen=True)
class ProcessedUpload:
    data: bytes
    mime: str
    extension: str
    width: int | None
    height: int | None


def format_bytes(count: int) -> str:
    if count < 1024:
        return f"{count} B"
    if count < 1024 * 1024:
        return f"{round(count / 1024)} KB"
    return f"{count / (1024 * 1024):.1f} MB"


class AssetService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.storage = get_storage()

    async def upload(self, user: User, upload: UploadFile, kind: AssetKind) -> Asset:
        raw = await self._read_capped(upload)
        if not raw:
            raise UnsupportedMedia("That file is empty.", code="empty_upload")

        processed = (
            self._process_image(raw)
            if kind == "image"
            else self._process_file(raw, upload.content_type)
        )

        digest = hashlib.sha256(processed.data).hexdigest()
        key = build_key(user.id, digest, processed.extension)

        # Identical bytes from the same user share one blob. Scoped per user
        # so one account's delete can never remove another's file.
        if not self.storage.exists(key):
            self.storage.put(key, processed.data)

        asset = Asset(
            user_id=user.id,
            kind=kind,
            original_name=(upload.filename or "upload")[:255],
            mime=processed.mime,
            byte_size=len(processed.data),
            width=processed.width,
            height=processed.height,
            sha256=digest,
            storage_key=key,
        )
        self.session.add(asset)
        await self.session.flush()
        return asset

    async def _read_capped(self, upload: UploadFile) -> bytes:
        buffer = bytearray()
        while chunk := await upload.read(64 * 1024):
            buffer.extend(chunk)
            if len(buffer) > UPLOAD_HARD_CAP:
                raise PayloadTooLarge(
                    f"That file is over the {format_bytes(UPLOAD_HARD_CAP)} upload limit.",
                    details={"limit": UPLOAD_HARD_CAP},
                )
        return bytes(buffer)

    # ── images ──────────────────────────────────────────────────────────

    def _process_image(self, raw: bytes) -> ProcessedUpload:
        if _looks_like_svg(raw):
            return self._process_svg(raw)

        try:
            with Image.open(io.BytesIO(raw)) as probe:
                probe.verify()
            image = Image.open(io.BytesIO(raw))
        except (UnidentifiedImageError, OSError) as exc:
            # A shell script named .png reaches exactly here.
            raise UnsupportedMedia(
                "That file is not an image we can read.", code="unsupported_media"
            ) from exc

        # A phone photo carries its rotation in EXIF; bake it in before the
        # orientation tag is dropped by the re-encode.
        image = ImageOps.exif_transpose(image)
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")

        image.thumbnail((IMAGE_MAX_DIM, IMAGE_MAX_DIM), Image.LANCZOS)

        encoded = b""
        for quality in JPEG_QUALITY_STEPS:
            buffer = io.BytesIO()
            image.save(buffer, format="JPEG", quality=quality, optimize=True, progressive=True)
            encoded = buffer.getvalue()
            if len(encoded) <= IMAGE_TARGET_BYTES:
                break

        return ProcessedUpload(
            data=encoded,
            mime="image/jpeg",
            extension=".jpg",
            width=image.width,
            height=image.height,
        )

    def _process_svg(self, raw: bytes) -> ProcessedUpload:
        try:
            # Parsed, not merely sniffed: a file claiming to be SVG that is
            # not well-formed XML has no business being served back.
            ElementTree.fromstring(raw.decode("utf-8", errors="strict"))
        except (ElementTree.ParseError, UnicodeDecodeError) as exc:
            raise UnsupportedMedia("That SVG could not be parsed.") from exc

        if len(raw) > FILE_MAX_BYTES:
            raise PayloadTooLarge(
                f"That SVG is {format_bytes(len(raw))} — "
                f"the limit is {format_bytes(FILE_MAX_BYTES)}.",
                details={"limit": FILE_MAX_BYTES},
            )

        return ProcessedUpload(
            data=raw, mime="image/svg+xml", extension=".svg", width=None, height=None
        )

    # ── other attachments ───────────────────────────────────────────────

    def _process_file(self, raw: bytes, declared: str | None) -> ProcessedUpload:
        mime, extension = self._sniff(raw, declared)

        if len(raw) > FILE_MAX_BYTES:
            raise PayloadTooLarge(
                f"{format_bytes(len(raw))} is over the "
                f"{format_bytes(FILE_MAX_BYTES)} limit for attachments.",
                details={"limit": FILE_MAX_BYTES},
            )

        return ProcessedUpload(
            data=raw, mime=mime, extension=extension, width=None, height=None
        )

    def _sniff(self, raw: bytes, declared: str | None) -> tuple[str, str]:
        for signature, mime, extension in FILE_SIGNATURES:
            if raw.startswith(signature):
                if mime == "application/zip" and declared in ZIP_SUBTYPES:
                    return declared, ZIP_SUBTYPES[declared]
                return mime, extension

        if _looks_like_svg(raw):
            return "image/svg+xml", ".svg"

        # No signature: accept it only if it really is text, and only for a
        # text type the client declared.
        if declared in TEXT_TYPES and _is_utf8_text(raw):
            return declared, TEXT_TYPES[declared]

        raise UnsupportedMedia(
            "That file type is not supported.",
            code="unsupported_media",
            details={"declared": declared or ""},
        )

    # ── reads and deletes ───────────────────────────────────────────────

    async def get_owned(self, user: User, asset_id) -> Asset:
        asset = await self.session.scalar(
            select(Asset).where(Asset.id == asset_id, Asset.user_id == user.id)
        )
        if asset is None:
            raise NotFound("That upload does not exist.", code="asset_not_found")
        return asset

    async def delete(self, user: User, asset_id) -> None:
        await self._drop(await self.get_owned(user, asset_id))

    async def release(self, asset_id) -> None:
        """Drop an upload that has just lost its last reference.

        Called with the id a row *used* to hold, after the row has been
        pointed somewhere else. Replacing a portrait or clearing a section
        image would otherwise leave the old row and its bytes behind with
        nothing able to reach them: the API has a delete endpoint, but the
        editor has no "manage uploads" screen to call it from.

        Only ever an id that was attached, never a sweep of everything
        unreferenced — an upload lives unattached between ``POST /assets``
        and the PATCH that attaches it, and a sweep would collect it there.
        """
        if asset_id is None:
            return

        # The caller has just reassigned the column; autoflush is off, so the
        # reference check below would still see the old value without this.
        await self.session.flush()

        for column in ASSET_REFERENCES:
            if await self.session.scalar(select(column).where(column == asset_id).limit(1)):
                return

        asset = await self.session.get(Asset, asset_id)
        if asset is not None:
            await self._drop(asset)

    async def _drop(self, asset: Asset) -> None:
        key = asset.storage_key

        await self.session.delete(asset)
        await self.session.flush()

        # Only remove the blob once nothing else points at it — two rows can
        # share a key after the same file is uploaded twice.
        still_used = await self.session.scalar(
            select(Asset.id).where(Asset.storage_key == key).limit(1)
        )
        if still_used is None:
            self.storage.delete(key)


def _looks_like_svg(raw: bytes) -> bool:
    head = raw[:1024].lstrip()
    return (head.startswith(b"<?xml") and b"<svg" in raw[:4096]) or head.startswith(b"<svg")


def _is_utf8_text(raw: bytes) -> bool:
    if b"\x00" in raw[:4096]:
        return False
    try:
        raw.decode("utf-8")
    except UnicodeDecodeError:
        return False
    return True
