"""Upload, serve and delete files."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, File, Form, Query, Request, UploadFile, status
from fastapi.responses import FileResponse, Response

from app.api.deps import CurrentUser, SessionDep, get_caller
from app.api.route import TransactionRoute
from app.core.errors import NotFound
from app.core.security import decode_asset_token
from app.models import Asset
from app.models.enums import AssetKind
from app.schemas.asset import AssetOut, asset_out
from app.schemas.common import ERROR_RESPONSES
from app.services.asset import AssetService
from app.services.storage import get_storage

router = APIRouter(
    prefix="/assets",
    tags=["assets"],
    responses=ERROR_RESPONSES,
    route_class=TransactionRoute,
)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=AssetOut,
    summary="Upload an image or an attachment",
    description=(
        "Multipart. The type is decided from the bytes, not the declared "
        "Content-Type. Images are re-encoded as JPEG at up to 1400px on the "
        "long edge, which also strips EXIF metadata."
    ),
)
async def upload_asset(
    session: SessionDep,
    user: CurrentUser,
    file: UploadFile = File(description="The file to store"),
    kind: AssetKind = Form(default="image", description="image or file"),
) -> AssetOut:
    asset = await AssetService(session).upload(user, file, kind)
    return asset_out(asset)


@router.get(
    "/{asset_id}",
    summary="Read one of your uploads",
    description=(
        "Either a signed URL — the `t` this asset was serialised with — or a "
        "bearer token. The signature exists because an `<img>` cannot send an "
        "Authorization header."
    ),
)
async def read_asset(
    asset_id: uuid.UUID,
    session: SessionDep,
    request: Request,
    t: str | None = Query(default=None, description="The signature from the asset's url"),
) -> Response:
    return serve(await _readable(session, request, asset_id, t))


async def _readable(
    session: SessionDep, request: Request, asset_id: uuid.UUID, token: str | None
) -> Asset:
    """The asset, if this request may have it. Raises otherwise.

    A signature names one asset, so it is checked against the id in the path
    before anything is loaded: a token for someone else's upload is a 404
    here, the same answer ownership gives.
    """
    if token is None:
        caller = await get_caller(request, session)
        return await AssetService(session).get_owned(caller.user, asset_id)

    if decode_asset_token(token) != str(asset_id):
        raise NotFound("That upload does not exist.", code="asset_not_found")

    asset = await session.get(Asset, asset_id)
    if asset is None:
        raise NotFound("That upload does not exist.", code="asset_not_found")
    return asset


@router.delete(
    "/{asset_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete an upload"
)
async def delete_asset(asset_id: uuid.UUID, session: SessionDep, user: CurrentUser) -> None:
    await AssetService(session).delete(user, asset_id)


def serve(asset: Asset, *, public: bool = False) -> Response:
    """Stream the bytes with a content hash as the ETag.

    The blob at a key never changes — the key *is* the hash — so it can be
    cached hard and revalidated for free.
    """
    path = get_storage().path_for(asset.storage_key)
    if path is None:
        # The row outlived its file. Say "gone", not "server error".
        raise NotFound("That upload is no longer stored.", code="asset_missing")

    cache = "public, max-age=31536000, immutable" if public else "private, max-age=300"
    return FileResponse(
        path,
        media_type=asset.mime,
        headers={
            "ETag": f'"{asset.sha256}"',
            "Cache-Control": cache,
            "Content-Disposition": f'inline; filename="{asset.original_name}"',
        },
    )
