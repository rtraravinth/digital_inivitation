"""Where uploaded bytes live.

One narrow interface — ``put``, ``open``, ``delete``, ``exists``, ``chunks``
— with two implementations: the local disk under ``FACET_MEDIA_ROOT``, and a
Cloudflare R2 bucket over its S3 API (``FACET_STORAGE=r2``). Every call is
blocking; callers on the event loop run them in a thread (``asyncio.to_thread``
or Starlette's threadpool) so a slow bucket never stalls other requests.
Keys are namespaced per user and named by content hash:

    <user_id>/<first two hex of sha256>/<sha256><extension>

Per user, because dedupe must never let one account's delete take away
another account's bytes. By hash, because the same file uploaded twice should
occupy one blob, and the two-character shard keeps directories small.
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import Iterator
from functools import lru_cache
from pathlib import Path
from typing import Any, BinaryIO, Protocol

from app.core.config import get_settings

#: How much of a stored file is read per chunk when it is streamed.
CHUNK = 64 * 1024


class Storage(Protocol):
    def put(self, key: str, data: bytes) -> None: ...

    def open(self, key: str) -> BinaryIO: ...

    def delete(self, key: str) -> None: ...

    def exists(self, key: str) -> bool: ...

    def path_for(self, key: str) -> Path | None: ...

    def chunks(self, key: str) -> Iterator[bytes] | None: ...


def build_key(user_id: uuid.UUID, digest: str, extension: str) -> str:
    return f"{user_id}/{digest[:2]}/{digest}{extension}"


class LocalDiskStorage:
    def __init__(self, root: Path) -> None:
        self.root = root

    def _resolve(self, key: str) -> Path:
        target = (self.root / key).resolve()
        # A key is built by this module, never by a client — but a traversal
        # here would be catastrophic, so it is checked rather than trusted.
        if not target.is_relative_to(self.root.resolve()):
            raise ValueError(f"key escapes the media root: {key!r}")
        return target

    def put(self, key: str, data: bytes) -> None:
        target = self._resolve(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        # Write beside, then move: a reader can never see a half-written file.
        staging = target.with_suffix(target.suffix + ".part")
        staging.write_bytes(data)
        staging.replace(target)

    def open(self, key: str) -> BinaryIO:
        return self._resolve(key).open("rb")

    def delete(self, key: str) -> None:
        target = self._resolve(key)
        target.unlink(missing_ok=True)

        # Tidy the shard and user directories if they are now empty.
        for directory in (target.parent, target.parent.parent):
            try:
                directory.rmdir()
            except OSError:
                break

    def exists(self, key: str) -> bool:
        return self._resolve(key).is_file()

    def path_for(self, key: str) -> Path | None:
        target = self._resolve(key)
        return target if target.is_file() else None

    def chunks(self, key: str) -> Iterator[bytes] | None:
        path = self.path_for(key)
        if path is None:
            return None

        def read() -> Iterator[bytes]:
            with path.open("rb") as f:
                while block := f.read(CHUNK):
                    yield block

        return read()

    def clear(self) -> None:  # pragma: no cover - test convenience
        shutil.rmtree(self.root, ignore_errors=True)


class R2Storage:
    """Uploads in a Cloudflare R2 bucket, through its S3-compatible API.

    The bucket stays private: every image is still served by the API
    (``serve()`` in api/v1/assets.py), which signs an owner's URLs, hides a
    draft's pictures and sends the sandbox headers. ``client`` is a boto3 S3
    client; tests hand in a fake with the same four methods.
    """

    def __init__(self, client: Any, bucket: str) -> None:
        self.client = client
        self.bucket = bucket

    @staticmethod
    def _check(key: str) -> str:
        # Keys are built by this module, never by a client; refuse anything
        # that could address outside the per-user prefix all the same.
        if not key or key.startswith("/") or ".." in key.split("/"):
            raise ValueError(f"bad storage key: {key!r}")
        return key

    @staticmethod
    def _missing(error: Exception) -> bool:
        code = str(getattr(error, "response", {}).get("Error", {}).get("Code", ""))
        return code in {"404", "NoSuchKey", "NotFound"}

    def put(self, key: str, data: bytes) -> None:
        # One request either stores the whole object or nothing, so a reader
        # never sees a half-written file.
        self.client.put_object(Bucket=self.bucket, Key=self._check(key), Body=data)

    def open(self, key: str) -> BinaryIO:
        return self.client.get_object(Bucket=self.bucket, Key=self._check(key))["Body"]

    def delete(self, key: str) -> None:
        # Deleting a key that is not there succeeds, as on disk.
        self.client.delete_object(Bucket=self.bucket, Key=self._check(key))

    def exists(self, key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=self._check(key))
        except Exception as error:
            if self._missing(error):
                return False
            raise
        return True

    def path_for(self, key: str) -> Path | None:
        return None  # Nothing on a local disk to hand to a FileResponse.

    def chunks(self, key: str) -> Iterator[bytes] | None:
        try:
            body = self.client.get_object(Bucket=self.bucket, Key=self._check(key))["Body"]
        except Exception as error:
            if self._missing(error):
                return None
            raise

        def read() -> Iterator[bytes]:
            try:
                while block := body.read(CHUNK):
                    yield block
            finally:
                body.close()

        return read()


def r2_client(endpoint: str, access_key_id: str, secret_access_key: str) -> Any:
    """A boto3 S3 client for R2. Imported here so a disk-only deployment
    never loads boto3."""
    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key_id,
        aws_secret_access_key=secret_access_key,
        # R2 has one region, "auto".
        region_name="auto",
        config=Config(
            signature_version="s3v4",
            retries={"max_attempts": 3, "mode": "standard"},
            # Newer boto3 adds checksum headers by default; ask for them only
            # when an operation requires one, which every S3-compatible store
            # accepts.
            request_checksum_calculation="when_required",
            response_checksum_validation="when_required",
        ),
    )


@lru_cache
def _cached_storage(root: str) -> LocalDiskStorage:
    storage = LocalDiskStorage(Path(root))
    storage.root.mkdir(parents=True, exist_ok=True)
    return storage


@lru_cache
def _cached_r2(endpoint: str, bucket: str, access_key_id: str, secret: str) -> R2Storage:
    return R2Storage(r2_client(endpoint, access_key_id, secret), bucket)


def get_storage() -> Storage:
    settings = get_settings()
    if settings.storage == "r2":
        return _cached_r2(
            settings.r2_endpoint,
            settings.r2_bucket,
            settings.r2_access_key_id,
            settings.r2_secret_access_key.get_secret_value(),
        )
    return _cached_storage(str(settings.media_root))
