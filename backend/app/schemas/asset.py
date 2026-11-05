"""Asset serialisation.

Two URL forms on purpose. An owner reading their own editor gets a signed
route; a published page gets the public one, which is cacheable and needs no
signature at all. Nothing else about the row differs.

The owner's URL is signed rather than merely authenticated because the thing
that fetches it is an ``<img>``, and an ``<img>`` cannot send an
``Authorization`` header — the access token lives in memory in the frontend's
API client and never reaches the markup.
"""

from __future__ import annotations

import uuid

from app.core.security import create_asset_token
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

    url = (
        f"{PUBLIC_ASSET_PREFIX}/{asset.id}"
        if public
        else f"{OWNER_ASSET_PREFIX}/{asset.id}?t={create_asset_token(str(asset.id))}"
    )
    return AssetOut(
        id=asset.id,
        name=asset.original_name,
        mime=asset.mime,
        size=asset.byte_size,
        width=asset.width,
        height=asset.height,
        url=url,
    )
