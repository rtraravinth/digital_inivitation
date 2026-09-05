"""Time-ordered identifiers.

Random UUID4 primary keys scatter inserts across a B-tree and make "newest
first" need a separate index. These are UUIDv7-shaped: 48 bits of Unix
milliseconds, then randomness, so keys sort by creation time and index
locality comes for free. They are still valid UUIDs to every client.
"""

from __future__ import annotations

import os
import time
import uuid
from contextvars import ContextVar

#: The current request's id, for the logger. Empty outside a request.
request_id_var: ContextVar[str] = ContextVar("request_id", default="")


def new_id() -> uuid.UUID:
    """A UUIDv7."""
    timestamp_ms = int(time.time() * 1000)
    payload = bytearray(os.urandom(16))

    payload[0:6] = timestamp_ms.to_bytes(6, "big")
    # Version 7 in the high nibble of byte 6, RFC 4122 variant in byte 8.
    payload[6] = 0x70 | (payload[6] & 0x0F)
    payload[8] = 0x80 | (payload[8] & 0x3F)

    return uuid.UUID(bytes=bytes(payload))


def new_request_id() -> str:
    return new_id().hex
