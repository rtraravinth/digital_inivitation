"""Upload, serve and delete files."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, File, Form, UploadFile, status
from fastapi.responses import FileResponse, Response

from app.api.deps import CurrentUser, SessionDep
from app.core.errors import NotFound
from app.models import Asset
from app.models.enums import AssetKind
from app.schemas.asset import AssetOut, asset_out
from app.schemas.common import ERROR_RESPONSES
from app.services.asset import AssetService
from app.services.storage import get_storage

router = APIRouter(prefix="/assets", tags=["assets"], responses=ERROR_RESPONSES)


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


@router.get("/{asset_id}", summary="Read one of your uploads")
async def read_asset(asset_id: uuid.UUID, session: SessionDep, user: CurrentUser) -> Response:
    asset = await AssetService(session).get_owned(user, asset_id)
    return serve(asset)


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
