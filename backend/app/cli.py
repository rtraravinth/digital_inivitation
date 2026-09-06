"""Development commands.

    python -m app.cli create-user --email you@example.com --password "..."
    python -m app.cli seed --email you@example.com
    python -m app.cli routes

``seed`` loads ``app/seed_data.json``, which is dumped from the frontend's
own ``src/lib/seed.ts`` by ``scripts/dump_seed.mjs`` — the content is not
maintained twice. It goes in through the same import path a user's upload
would, so the seed cannot drift from the schema the API accepts.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import typer
from pydantic import ValidationError
from sqlalchemy import select

from app.core.errors import AppError
from app.core.security import hash_password
from app.db.session import dispose_engine, get_sessionmaker
from app.models import AccountProfile, AccountSettings, User
from app.schemas.auth import RegisterRequest
from app.services.account import assert_handle_available
from app.services.transfer import TransferService

app = typer.Typer(help="FACET backend development commands.", no_args_is_help=True)

SEED_FILE = Path(__file__).resolve().parent / "seed_data.json"


def _run(coro):
    async def wrapper():
        try:
            return await coro
        finally:
            await dispose_engine()

    return asyncio.run(wrapper())


async def _create_user(email: str, password: str, name: str, handle: str) -> str:
    async with get_sessionmaker()() as session:
        email = email.strip().lower()
        if await session.scalar(select(User).where(User.email == email)):
            raise typer.BadParameter(f"{email} already has an account.")

        # The same check registration makes, and for the same reason: the
        # handle is the front of every address the account will publish, so
        # two accounts cannot hold one.
        try:
            await assert_handle_available(session, handle)
        except AppError as exc:
            raise typer.BadParameter(exc.message) from exc

        user = User(email=email, password_hash=hash_password(password))
        user.profile = AccountProfile(name=name, handle=handle, tags=[], links=[])
        user.settings = AccountSettings()
        session.add(user)
        await session.commit()
        return str(user.id)


@app.command("create-user")
def create_user(
    email: str = typer.Option(..., help="Sign-in address"),
    password: str = typer.Option(..., help="At least 12 characters"),
    handle: str = typer.Option(..., help="The account's address: facet.page/<handle>/<slug>"),
    name: str = typer.Option("", help="Display name"),
) -> None:
    """Create an account without going through the API."""
    if len(password) < 12:
        raise typer.BadParameter("Use at least 12 characters.")

    # Validate exactly as the API does, or this can mint an account that
    # cannot sign in — a reserved TLD like .test gets past a naive check and
    # is then refused at login. Registration requires a handle, so this must
    # send one: without it every invocation failed validation, and an account
    # with no handle has no address to publish under.
    try:
        request = RegisterRequest(email=email, password=password, name=name, handle=handle)
    except ValidationError as exc:
        error = exc.errors()[0]
        field = ".".join(str(part) for part in error["loc"]) or "input"
        raise typer.BadParameter(f"{field}: {error['msg']}") from exc

    user_id = _run(_create_user(str(request.email), password, name, request.handle))
    typer.echo(f"created {request.email} ({user_id}) at {request.handle}/")


async def _seed(email: str, mode: str) -> int:
    if not SEED_FILE.is_file():
        raise typer.BadParameter(
            f"{SEED_FILE.name} is missing. Run: node backend/scripts/dump_seed.mjs"
        )

    payload = json.loads(SEED_FILE.read_text(encoding="utf-8"))

    async with get_sessionmaker()() as session:
        user = await session.scalar(select(User).where(User.email == email.strip().lower()))
        if user is None:
            raise typer.BadParameter(f"No account for {email}. Run create-user first.")

        result = await TransferService(session).import_(user, payload, mode)
        await session.commit()
        return result.imported


@app.command()
def seed(
    email: str = typer.Option(..., help="The account to load the seed into"),
    replace: bool = typer.Option(
        False, "--replace", help="Delete that account's portfolios first"
    ),
) -> None:
    """Load the five seeded portfolios from src/lib/seed.ts."""
    count = _run(_seed(email, "replace" if replace else "merge"))
    typer.echo(f"imported {count} portfolios for {email}")


@app.command()
def routes() -> None:
    """List every route, so the API surface can be checked at a glance.

    Read off the OpenAPI schema rather than walking ``app.routes``: this
    FastAPI version nests included routers inside a wrapper object, so a flat
    walk shows only the handful of routes declared on the app itself.
    """
    from app.main import create_app

    schema = create_app().openapi()
    for path, operations in sorted(schema["paths"].items()):
        for method in sorted(operations):
            typer.echo(f"{method.upper():7} {path}")

    typer.echo(f"\n{sum(len(ops) for ops in schema['paths'].values())} operations")


if __name__ == "__main__":
    app()
