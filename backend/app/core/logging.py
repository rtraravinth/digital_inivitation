"""Structured JSON logging, with the request id attached to every line.

One line per event, machine-readable, and always carrying the id the client
was handed in ``X-Request-ID`` — so a user reporting "it said request 01ab…"
is one grep away from the traceback.
"""

from __future__ import annotations

import json
import logging
import sys
from typing import Any

from app.core.ids import request_id_var

_BUILTIN_RECORD_FIELDS = frozenset(
    logging.LogRecord("", 0, "", 0, "", None, None).__dict__
) | {"message", "asctime", "taskName"}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname.lower(),
            "logger": record.name,
            "message": record.getMessage(),
        }

        request_id = request_id_var.get()
        if request_id:
            payload["request_id"] = request_id

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        # Anything passed as extra={...} rides along.
        for key, value in record.__dict__.items():
            if key not in _BUILTIN_RECORD_FIELDS and not key.startswith("_"):
                payload[key] = value

        return json.dumps(payload, default=str)


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())

    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level)

    # Uvicorn installs its own coloured handlers; route them through ours so
    # there is one format in the log, not three.
    for name in ("uvicorn", "uvicorn.access", "uvicorn.error"):
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers[:] = []
        uvicorn_logger.propagate = True
