"""Moving a whole account's portfolios in and out.

Import runs inside one transaction. A half-applied import is worse than a
rejected one: the user cannot tell what landed, and re-running it would
duplicate whatever did.
"""

from __future__ import annotations

import base64
import binascii
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ValidationFailed
from app.models import Asset, Portfolio, PortfolioHeader, Section, User
from app.models.enums import (
    DEFAULT_ACCENT,
    DEFAULT_TAB,
    FONTS,
    GROUNDS,
    STATUSES,
    TAB_MAX_LENGTH,
    THEMES,
)
from app.models.portfolio import default_layout
from app.schemas.asset import asset_out
from app.schemas.transfer import ImportResultOut
from app.services.asset import AssetService

DATA_URI = re.compile(r"^data:(?P<mime>[\w.+/-]+)?;base64,(?P<payload>.+)$", re.DOTALL)
SLUG_SAFE = re.compile(r"[^a-z0-9/-]+")


class TransferService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ── export ──────────────────────────────────────────────────────────

    async def export(self, user: User) -> list[dict[str, Any]]:
        portfolios = await self.session.scalars(
            select(Portfolio)
            .where(Portfolio.user_id == user.id)
            .order_by(Portfolio.created_at.desc())
        )

        return [self._portfolio_to_dict(portfolio) for portfolio in portfolios]

    def _portfolio_to_dict(self, portfolio: Portfolio) -> dict[str, Any]:
        header = portfolio.header
        return {
            "id": str(portfolio.id),
            "name": portfolio.name,
            "slug": portfolio.slug,
            "status": portfolio.status,
            "summary": portfolio.summary,
            "theme": portfolio.theme,
            "accent": portfolio.accent,
            "ground": portfolio.ground,
            "font": portfolio.font,
            "layout": dict(portfolio.layout or default_layout()),
            "header": {
                "name": header.name,
                "current": header.current,
                "description": header.description,
                "tags": list(header.tags or []),
                "links": list(header.links or []),
                "numbers": list(header.numbers or []),
                "dates": list(header.dates or []),
                "portrait": _asset_dict(header.portrait),
            },
            "sections": [
                {
                    "id": str(section.id),
                    "title": section.title,
                    "description": section.description,
                    "tab": section.tab,
                    "links": list(section.links or []),
                    "quote": section.quote,
                    "hidden": section.hidden,
                    "image": _asset_dict(section.image),
                    "file": _asset_dict(section.file),
                }
                for section in portfolio.sections
            ],
        }

    # ── import ──────────────────────────────────────────────────────────

    async def import_(
        self, user: User, payload: list[Any], mode: str
    ) -> ImportResultOut:
        if not all(isinstance(item, dict) for item in payload):
            raise ValidationFailed(
                "That file is not a FACET export.", code="invalid_import_payload"
            )

        if mode == "replace":
            existing = await self.session.scalars(
                select(Portfolio).where(Portfolio.user_id == user.id)
            )
            for portfolio in existing:
                await self.session.delete(portfolio)
            await self.session.flush()

        taken = set(
            (
                await self.session.scalars(select(Portfolio.slug))
            ).all()
        )

        renamed: dict[str, str] = {}
        imported = 0

        for raw in payload:
            wanted = _clean_slug(str(raw.get("slug") or "")) or f"page-{imported + 1}"
            slug = _free_slug(wanted, taken)
            if slug != wanted:
                renamed[wanted] = slug
            taken.add(slug)

            await self._create_from_dict(user, raw, slug)
            imported += 1

        await self.session.flush()
        return ImportResultOut(imported=imported, renamed=renamed)

    async def _create_from_dict(
        self, user: User, raw: dict[str, Any], slug: str
    ) -> Portfolio:
        header_raw = raw.get("header") or {}
        sections_raw = [s for s in (raw.get("sections") or []) if isinstance(s, dict)]

        portfolio = Portfolio(
            user_id=user.id,
            # Ids in the payload are never reused: importing your own export
            # twice must not collide with what is already stored.
            name=str(raw.get("name") or "Untitled")[:200],
            slug=slug,
            status=_one_of(raw.get("status"), STATUSES, "draft"),
            summary=str(raw.get("summary") or "")[:2000],
            theme=_one_of(raw.get("theme"), THEMES, "editorial"),
            accent=str(raw.get("accent") or DEFAULT_ACCENT)[:32],
            ground=_one_of(raw.get("ground"), GROUNDS, "light"),
            font=_one_of(raw.get("font"), FONTS, "archivo"),
            layout={**default_layout(), **(raw.get("layout") or {})},
        )

        portfolio.header = PortfolioHeader(
            name=str(header_raw.get("name") or "")[:200],
            current=str(header_raw.get("current") or ""),
            description=str(header_raw.get("description") or ""),
            tags=list(header_raw.get("tags") or []),
            links=list(header_raw.get("links") or []),
            numbers=_page_list(header_raw, sections_raw, "numbers"),
            dates=_page_list(header_raw, sections_raw, "dates"),
            portrait_asset_id=await self._restore_asset(user, header_raw.get("portrait")),
        )

        portfolio.sections = [
            Section(
                position=index,
                title=str(section.get("title") or ""),
                description=str(section.get("description") or ""),
                tab=_tab_of(section),
                links=list(section.get("links") or []),
                quote=section.get("quote"),
                hidden=bool(section.get("hidden")),
                image_asset_id=await self._restore_asset(user, section.get("image")),
                file_asset_id=await self._restore_asset(user, section.get("file")),
            )
            for index, section in enumerate(sections_raw)
        ]

        self.session.add(portfolio)
        await self.session.flush()
        return portfolio

    async def _restore_asset(self, user: User, raw: Any):
        """Reattach an asset from an export.

        Three shapes turn up here: a row this account already owns (keep the
        id), a legacy ``dataUrl`` from the localStorage build (decode it into
        a real file), or nothing.
        """
        if not isinstance(raw, dict):
            return None

        asset_id = raw.get("id")
        if asset_id:
            owned = await self.session.scalar(
                select(Asset).where(Asset.id == asset_id, Asset.user_id == user.id)
            )
            if owned is not None:
                return owned.id

        data_url = raw.get("dataUrl")
        if not isinstance(data_url, str):
            return None

        match = DATA_URI.match(data_url.strip())
        if match is None:
            return None

        try:
            payload = base64.b64decode(match.group("payload"), validate=True)
        except (binascii.Error, ValueError):
            # A corrupt attachment must not fail the whole import.
            return None

        mime = match.group("mime") or "application/octet-stream"
        name = str(raw.get("name") or "import")

        kind = "image" if mime.startswith("image/") else "file"
        try:
            asset = await AssetService(self.session).upload(
                user, _MemoryUpload(name, mime, payload), kind
            )
        except AppError:
            # One unreadable attachment must not fail the whole import: the
            # section it belonged to is still worth keeping.
            return None
        return asset.id


class _MemoryUpload:
    """The slice of ``UploadFile`` that ``AssetService`` actually uses."""

    def __init__(self, filename: str, content_type: str, data: bytes) -> None:
        self.filename = filename
        self.content_type = content_type
        self._data = data
        self._offset = 0

    async def read(self, size: int = -1) -> bytes:
        if self._offset >= len(self._data):
            return b""
        end = len(self._data) if size < 0 else min(len(self._data), self._offset + size)
        chunk = self._data[self._offset : end]
        self._offset = end
        return chunk


def _tab_of(section: dict[str, Any]) -> str:
    """The section's tab, or the first of the tags an older export wrote.

    Tags used to be a list, and the page filtered on all of them. Only the
    first can survive as a tab, which is what the tab row showed first.
    """
    tab = str(section.get("tab") or "").strip()
    if tab:
        return tab[:TAB_MAX_LENGTH]
    for tag in section.get("tags") or []:
        if isinstance(tag, str) and tag.strip():
            return tag.strip()[:TAB_MAX_LENGTH]
    return DEFAULT_TAB


def _page_list(
    header_raw: dict[str, Any], sections_raw: list[dict[str, Any]], field: str
) -> list[Any]:
    """The page's numbers, or its timeline, wherever the export put them.

    They used to be written on each section and gathered up for display. An
    export from that build has them there and nowhere else, so it is read the
    same way the page read it: every section's, in order.
    """
    on_header = header_raw.get(field)
    if on_header:
        return list(on_header)
    return [entry for section in sections_raw for entry in (section.get(field) or [])]


def _asset_dict(asset: Asset | None) -> dict[str, Any] | None:
    out = asset_out(asset)
    return out.model_dump(by_alias=True, mode="json") if out else None


def _one_of(value: Any, allowed: tuple[str, ...], fallback: str) -> str:
    # An unknown value means data from a build that offered something we have
    # since dropped. Fall back rather than refuse the import.
    return value if isinstance(value, str) and value in allowed else fallback


def _clean_slug(value: str) -> str:
    cleaned = SLUG_SAFE.sub("-", value.strip().lower()).strip("-/")
    # Collapse any empty segment a substitution may have left behind.
    cleaned = "/".join(part for part in cleaned.split("/") if part)
    return cleaned[:112]


def _free_slug(wanted: str, taken: set[str]) -> str:
    if wanted not in taken:
        return wanted
    suffix = 2
    while f"{wanted}-{suffix}" in taken:
        suffix += 1
    return f"{wanted}-{suffix}"
