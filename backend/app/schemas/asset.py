"""Asset serialisation.

Two URL forms on purpose. An owner reading their own editor gets the
authenticated route; a published page gets the public one, which is cacheable
and does not require a token. Nothing else about the row differs.
"""

from __future__ import annotations

import uuid

from app.models import Asset
from app.schemas.common import CamelModel

OWNER_ASSET_PREFIX = "/api/v1/assets"
PUBLIC_ASSET_PREFIX = "/api/v1/public/assets"


class AssetOut(CamelModel):
    id: uuid.UUID
    name: str
    mime: str
    size: int
    width: int | None = None
    height: int | None = None
    url: str


def asset_out(asset: Asset | None, *, public: bool = False) -> AssetOut | None:
    if asset is None:
        return None

    prefix = PUBLIC_ASSET_PREFIX if public else OWNER_ASSET_PREFIX
    return AssetOut(
        id=asset.id,
        name=asset.original_name,
        mime=asset.mime,
        size=asset.byte_size,
        width=asset.width,
        height=asset.height,
        url=f"{prefix}/{asset.id}",
    )
