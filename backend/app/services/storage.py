"""Where uploaded bytes live.

One narrow interface — ``put``, ``open``, ``delete``, ``exists`` — so the
local-disk implementation can be swapped for S3 without a service noticing.
Keys are namespaced per user and named by content hash:

    <user_id>/<first two hex of sha256>/<sha256><extension>

Per user, because dedupe must never let one account's delete take away
another account's bytes. By hash, because the same file uploaded twice should
occupy one blob, and the two-character shard keeps directories small.
"""

from __future__ import annotations

import shutil
import uuid
from functools import lru_cache
from pathlib import Path
from typing import BinaryIO, Protocol

from app.core.config import get_settings


class Storage(Protocol):
    def put(self, key: str, data: bytes) -> None: ...

    def open(self, key: str) -> BinaryIO: ...

    def delete(self, key: str) -> None: ...

    def exists(self, key: str) -> bool: ...

    def path_for(self, key: str) -> Path | None: ...


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

    def clear(self) -> None:  # pragma: no cover - test convenience
        shutil.rmtree(self.root, ignore_errors=True)


@lru_cache
def _cached_storage(root: str) -> LocalDiskStorage:
    storage = LocalDiskStorage(Path(root))
    storage.root.mkdir(parents=True, exist_ok=True)
    return storage


def get_storage() -> Storage:
    return _cached_storage(str(get_settings().media_root))
