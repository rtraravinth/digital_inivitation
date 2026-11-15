"""Uploads in Cloudflare R2: the same behaviour as on disk, through a bucket.

The S3 client is faked — a dict behind the four calls ``R2Storage`` makes,
raising botocore's own ``ClientError`` the way R2 does — so the tests need
no network and no account.
"""

from __future__ import annotations

import io

import pytest
from botocore.exceptions import ClientError
from PIL import Image
from pydantic import ValidationError

from app.core.config import Settings
from app.services.storage import R2Storage


class FakeS3:
    def __init__(self) -> None:
        self.objects: dict[tuple[str, str], bytes] = {}

    @staticmethod
    def _missing(operation: str, code: str = "NoSuchKey") -> ClientError:
        return ClientError({"Error": {"Code": code, "Message": "missing"}}, operation)

    def put_object(self, *, Bucket: str, Key: str, Body: bytes) -> dict:
        self.objects[(Bucket, Key)] = bytes(Body)
        return {}

    def get_object(self, *, Bucket: str, Key: str) -> dict:
        if (Bucket, Key) not in self.objects:
            raise self._missing("GetObject")
        return {"Body": io.BytesIO(self.objects[(Bucket, Key)])}

    def head_object(self, *, Bucket: str, Key: str) -> dict:
        if (Bucket, Key) not in self.objects:
            # HEAD has no body, so R2 reports a bare 404.
            raise self._missing("HeadObject", "404")
        return {}

    def delete_object(self, *, Bucket: str, Key: str) -> dict:
        self.objects.pop((Bucket, Key), None)
        return {}


@pytest.fixture
def bucket(monkeypatch) -> FakeS3:
    """Every storage lookup in the app answers with an R2 bucket."""
    fake = FakeS3()
    storage = R2Storage(fake, "facet-media")
    for module in ("app.api.v1.assets", "app.services.asset", "app.api.v1.account"):
        monkeypatch.setattr(f"{module}.get_storage", lambda: storage)
    return fake


def png_bytes(width: int = 400, height: int = 300) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), (120, 90, 60)).save(buffer, format="PNG")
    return buffer.getvalue()


async def upload(client, data: bytes, name: str = "photo.png") -> dict:
    response = await client.post(
        "/api/v1/assets", files={"file": (name, data, "image/png")}, data={"kind": "image"}
    )
    assert response.status_code == 201, response.text
    return response.json()


# ── the class on its own ──────────────────────────────────────────────────


def test_put_exists_read_delete_round_trip():
    storage = R2Storage(FakeS3(), "b")
    assert storage.exists("u/ab/abc.jpg") is False
    storage.put("u/ab/abc.jpg", b"bytes")
    assert storage.exists("u/ab/abc.jpg") is True
    assert b"".join(storage.chunks("u/ab/abc.jpg")) == b"bytes"
    assert storage.open("u/ab/abc.jpg").read() == b"bytes"
    assert storage.path_for("u/ab/abc.jpg") is None
    storage.delete("u/ab/abc.jpg")
    assert storage.exists("u/ab/abc.jpg") is False
    assert storage.chunks("u/ab/abc.jpg") is None


def test_deleting_a_missing_key_succeeds():
    R2Storage(FakeS3(), "b").delete("u/ab/never.jpg")


@pytest.mark.parametrize("key", ["", "/abs/key.jpg", "u/../other/key.jpg"])
def test_a_key_that_could_escape_its_prefix_is_refused(key):
    with pytest.raises(ValueError, match="bad storage key"):
        R2Storage(FakeS3(), "b").put(key, b"x")


def test_an_error_that_is_not_a_missing_key_is_raised():
    class Denied(FakeS3):
        def head_object(self, **_):
            raise ClientError({"Error": {"Code": "AccessDenied"}}, "HeadObject")

    with pytest.raises(ClientError):
        R2Storage(Denied(), "b").exists("u/ab/abc.jpg")


# ── through the API ───────────────────────────────────────────────────────


async def test_an_upload_lands_in_the_bucket_and_is_served_back(auth_client, bucket):
    asset = await upload(auth_client, png_bytes())
    assert len(bucket.objects) == 1

    response = await auth_client.get(f"/api/v1/assets/{asset['id']}")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
    assert response.headers["etag"]
    assert int(response.headers["content-length"]) == len(response.content)
    # The bucket is private; the API's own headers still guard every upload.
    assert "sandbox" in response.headers["content-security-policy"]
    assert response.headers["x-content-type-options"] == "nosniff"
    assert Image.open(io.BytesIO(response.content)).size == (400, 300)


async def test_a_hostile_file_name_cannot_break_the_streamed_disposition(auth_client, bucket):
    asset = await upload(auth_client, png_bytes(40, 30), name='a"; filename="evil.html.png')
    disposition = (await auth_client.get(f"/api/v1/assets/{asset['id']}")).headers[
        "content-disposition"
    ]
    assert disposition.startswith("inline; filename*=utf-8''")
    assert '"' not in disposition


async def test_a_row_whose_object_is_gone_answers_404(auth_client, bucket):
    asset = await upload(auth_client, png_bytes())
    bucket.objects.clear()

    response = await auth_client.get(f"/api/v1/assets/{asset['id']}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "asset_missing"


async def test_deleting_the_asset_removes_the_object(auth_client, bucket):
    asset = await upload(auth_client, png_bytes())
    assert (await auth_client.delete(f"/api/v1/assets/{asset['id']}")).status_code == 204
    assert bucket.objects == {}


# ── settings ──────────────────────────────────────────────────────────────


def test_r2_storage_without_its_settings_refuses_to_start():
    with pytest.raises(ValidationError, match="FACET_R2_BUCKET"):
        Settings(
            # Not the developer's own .env, which may hold real R2 values.
            _env_file=None,
            storage="r2",
            r2_endpoint="https://acct.r2.cloudflarestorage.com",
            r2_access_key_id="id",
            r2_secret_access_key="secret",
        )


def test_r2_storage_needs_an_https_endpoint():
    with pytest.raises(ValidationError, match="https"):
        Settings(
            # Not the developer's own .env, which may hold real R2 values.
            _env_file=None,
            storage="r2",
            r2_endpoint="http://acct.r2.cloudflarestorage.com",
            r2_bucket="b",
            r2_access_key_id="id",
            r2_secret_access_key="secret",
        )
