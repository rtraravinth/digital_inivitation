"""Test harness.

The suite runs against a real PostgreSQL database created for the run and
dropped after it, migrated with the same Alembic migrations production runs —
so a broken migration fails the suite rather than surfacing on deploy.

Each test gets a connection with an open transaction that is rolled back at
the end, so tests never see each other's rows and none of them need cleanup.

Everything one-time is a *synchronous* fixture on purpose. pytest-asyncio
gives every test its own event loop, and an asyncpg connection belongs to the
loop that opened it — so anything shared across tests must not be loop-bound.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from pathlib import Path
from urllib.parse import urlsplit

import psycopg
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from tests.factories import *  # noqa: F403 - fixture registration

TEST_PASSWORD = "correct horse battery"


def _split_database_url(url: str) -> tuple[str, str]:
    """Return (server_url, database_name) from a SQLAlchemy URL."""
    parts = urlsplit(url)
    database = parts.path.lstrip("/")
    server = url[: -(len(database) + 1)]
    return server, database


def _psycopg_url(server_url: str) -> str:
    """The maintenance connection, in libpq form."""
    return f"{server_url}/postgres".replace("postgresql+asyncpg://", "postgresql://")


@pytest.fixture(scope="session")
def media_root(tmp_path_factory) -> Path:
    """Uploads land in a throwaway directory, never a developer's media dir."""
    return tmp_path_factory.mktemp("facet-media")


@pytest.fixture(scope="session", autouse=True)
def settings_env(media_root: Path):
    """Point the app at the test database before anything reads Settings."""
    from app.core.config import get_settings

    test_url = get_settings().test_database_url

    os.environ["FACET_ENV"] = "test"
    os.environ["FACET_DATABASE_URL"] = test_url
    os.environ["FACET_ALEMBIC_URL"] = test_url
    os.environ["FACET_MEDIA_ROOT"] = str(media_root)
    os.environ["FACET_JWT_SECRET"] = "test-secret-not-used-anywhere-else"

    get_settings.cache_clear()
    yield get_settings()
    get_settings.cache_clear()


@pytest.fixture(scope="session", autouse=True)
def database(settings_env):
    server_url, database_name = _split_database_url(settings_env.test_database_url)
    maintenance = _psycopg_url(server_url)

    _recreate_database(maintenance, database_name)
    _run_migrations()

    yield

    _drop_database(maintenance, database_name)


def _recreate_database(maintenance_url: str, name: str) -> None:
    with psycopg.connect(maintenance_url, autocommit=True) as connection:
        connection.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
        connection.execute(f'CREATE DATABASE "{name}"')


def _drop_database(maintenance_url: str, name: str) -> None:
    with psycopg.connect(maintenance_url, autocommit=True) as connection:
        connection.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')


def _run_migrations() -> None:
    from alembic.config import Config

    from alembic import command

    backend_dir = Path(__file__).resolve().parents[1]
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "alembic"))
    command.upgrade(config, "head")


@pytest.fixture
async def engine(database, settings_env):
    """One engine per test, on that test's own event loop."""
    engine = create_async_engine(settings_env.database_url, poolclass=NullPool)
    yield engine
    await engine.dispose()


@pytest.fixture
async def db_session(engine) -> AsyncIterator[AsyncSession]:
    connection = await engine.connect()
    transaction = await connection.begin()
    maker = async_sessionmaker(bind=connection, expire_on_commit=False, autoflush=False)
    session = maker()

    try:
        yield session
    finally:
        await session.close()
        await transaction.rollback()
        await connection.close()


@pytest.fixture
async def app(db_session: AsyncSession, media_root: Path):
    """The real application, with the request session swapped for the test one.

    ``get_session`` normally commits per request. Here every request joins the
    test's open transaction instead, so the rollback at the end really does
    undo everything a test did.
    """
    from app.db.session import get_session
    from app.main import create_app

    application = create_app()

    async def override() -> AsyncIterator[AsyncSession]:
        # flush, not commit: the outer transaction owns the commit.
        yield db_session
        await db_session.flush()

    application.dependency_overrides[get_session] = override
    return application


@pytest.fixture
async def client(app) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"User-Agent": "Mozilla/5.0 (Macintosh) Chrome/131.0"},
    ) as test_client:
        yield test_client
