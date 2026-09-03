# FACET Backend API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete FastAPI + PostgreSQL backend that owns every feature the FACET UI currently keeps in `localStorage`.

**Architecture:** Three layers, one direction of dependency. `api/v1/` routers parse and authorize HTTP and nothing else; `services/` hold business logic and own the SQLAlchemy `AsyncSession`; `models/` are declarative SQLAlchemy 2.0 and know nothing about HTTP. `core/` (config, security, errors, logging) knows nothing about the domain. Ordered value lists live in JSONB validated by Pydantic; assets are real rows with bytes behind them.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0 async + asyncpg, Alembic, Pydantic v2 + pydantic-settings, argon2-cffi, PyJWT, pyotp, Pillow, pytest + pytest-asyncio + httpx.

**Spec:** `docs/superpowers/specs/2026-09-03-facet-backend-design.md`

## Global Constraints

- Python 3.12; PostgreSQL 18 is what is installed locally (any 14+ works).
- All database access is async. No sync driver anywhere — a sync driver blocks the event loop on every query.
- Every error response uses exactly one envelope: `{"error": {"code", "message", "details", "request_id"}}`. No route returns a bare string or a raw `{"detail": ...}`.
- `services/` must never import from `api/`. `models/` must never import from `schemas/`.
- Ownership is resolved in `api/deps.py` only. A row belonging to another user returns **404, never 403** — a 403 confirms the row exists.
- Uploaded mime types are sniffed from bytes, never trusted from the client.
- Analytics are counted from real events. No generated, simulated or placeholder figures anywhere — an empty result is an empty result.
- Enum values must match the TypeScript literals in `src/lib/types.ts` exactly: themes `editorial|index|poster|links|ledger|dossier|broadsheet`; grounds `light|dark|paper`; fonts `archivo|fraunces|space-grotesk`; statuses `live|draft|empty`; block kinds `link|venture|contact|booking|testimonial|gallery|numbers|document`; roleNav `tabs|rail|scroll|lens`; density `airy|standard|dense`; scale `compact|default|display`; plans `free|pro`; notification keys `booking|weekly|brokenLink|mention|product`; privacy keys `indexable|showContact|countVisits|badge`.
- Asset limits mirror `src/lib/assets.ts`: images downscaled to 1400px long edge, image target ~420KB, other attachments capped at 800KB.
- Every task ends with tests passing and a commit.

---

## File Structure

| Path | Responsibility |
|---|---|
| `backend/pyproject.toml` | Dependencies, pytest and ruff config |
| `backend/.env.example` | Every setting with a safe default documented |
| `backend/app/main.py` | App factory, lifespan, CORS, middleware, exception handlers |
| `backend/app/core/config.py` | `Settings` via pydantic-settings, cached accessor |
| `backend/app/core/errors.py` | `AppError` hierarchy + the handlers that render the envelope |
| `backend/app/core/logging.py` | Structured JSON logging, request-id context var |
| `backend/app/core/security.py` | argon2 hashing, JWT encode/decode, token opaque-secret helpers |
| `backend/app/core/ids.py` | UUID7-ish sortable id generation |
| `backend/app/db/base.py` | `Base`, naming convention, `TimestampMixin` |
| `backend/app/db/session.py` | Engine, `async_sessionmaker`, `get_session` dependency |
| `backend/app/models/*.py` | One module per aggregate |
| `backend/app/schemas/*.py` | Pydantic request/response models, one module per aggregate |
| `backend/app/services/*.py` | Business logic, one module per aggregate |
| `backend/app/services/storage.py` | `put`/`open`/`delete`/`url_for` over local disk |
| `backend/app/api/deps.py` | `get_current_user`, `get_owned_portfolio`, pagination |
| `backend/app/api/router.py` | Mounts every v1 router under `/api/v1` |
| `backend/app/api/v1/*.py` | One router per group |
| `backend/app/cli.py` | `seed`, `create-user` dev commands |
| `backend/alembic/` | Migration environment and versions |
| `backend/tests/conftest.py` | Test database, migrated with Alembic; per-test transaction |
| `backend/tests/factories.py` | `make_user`, `make_portfolio`, `auth_headers` |
| `backend/tests/test_*.py` | One module per router group |

---

### Task 1: Project scaffold, config, error envelope, app factory

**Files:**
- Create: `backend/pyproject.toml`, `backend/.env.example`, `backend/.gitignore`
- Create: `backend/app/__init__.py`, `backend/app/main.py`
- Create: `backend/app/core/__init__.py`, `backend/app/core/config.py`, `backend/app/core/errors.py`, `backend/app/core/logging.py`, `backend/app/core/ids.py`
- Test: `backend/tests/test_app.py`, `backend/tests/conftest.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `get_settings() -> Settings` with fields `database_url: str`, `test_database_url: str`, `jwt_secret: str`, `jwt_algorithm: str = "HS256"`, `access_token_ttl_minutes: int = 15`, `refresh_token_ttl_days: int = 30`, `cors_origins: list[str]`, `media_root: Path`, `public_base_url: str`, `env: Literal["dev","test","prod"]`.
  - `class AppError(Exception)` with `__init__(self, message: str, *, code: str | None = None, details: dict | None = None)` and class attrs `status_code: int`, `default_code: str`.
  - Subclasses `Unauthenticated` (401), `PermissionDenied` (403), `NotFound` (404), `Conflict` (409), `PayloadTooLarge` (413), `UnsupportedMedia` (415), `ValidationFailed` (422), `RateLimited` (429).
  - `install_error_handlers(app: FastAPI) -> None`.
  - `create_app() -> FastAPI` and module-level `app`.
  - `new_id() -> uuid.UUID`, `request_id_var: ContextVar[str]`.

- [ ] **Step 1: Write `pyproject.toml` with the dependency set**

```toml
[project]
name = "facet-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115",
  "uvicorn[standard]>=0.32",
  "sqlalchemy[asyncio]>=2.0.36",
  "asyncpg>=0.30",
  "alembic>=1.14",
  "pydantic>=2.9",
  "pydantic-settings>=2.6",
  "argon2-cffi>=23.1",
  "pyjwt>=2.10",
  "pyotp>=2.9",
  "pillow>=11.0",
  "python-multipart>=0.0.17",
  "typer>=0.15",
]

[project.optional-dependencies]
dev = ["pytest>=8.3", "pytest-asyncio>=0.24", "httpx>=0.28", "ruff>=0.8"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]

[tool.ruff]
line-length = 100
target-version = "py312"
```

- [ ] **Step 2: Write the failing test**

```python
# backend/tests/test_app.py
async def test_health_returns_ok(client):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


async def test_unknown_route_uses_the_error_envelope(client):
    r = await client.get("/api/v1/nope")
    assert r.status_code == 404
    body = r.json()
    assert set(body["error"]) == {"code", "message", "details", "request_id"}
    assert body["error"]["code"] == "not_found"
    assert r.headers["X-Request-ID"] == body["error"]["request_id"]


async def test_app_error_subclass_sets_status_and_code(client):
    from app.core.errors import Conflict
    err = Conflict("taken", details={"slug": "rohan"})
    assert err.status_code == 409
    assert err.code == "conflict"
    assert err.details == {"slug": "rohan"}
```

A `conftest.py` with only the app-level fixture, no database yet:

```python
# backend/tests/conftest.py
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import create_app


@pytest.fixture
async def client():
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_app.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.main'`

- [ ] **Step 4: Implement config, ids and logging**

`core/config.py` uses `SettingsConfigDict(env_file=".env", env_prefix="FACET_", extra="ignore")` and `@lru_cache` on `get_settings()`. `core/ids.py` returns time-ordered UUIDs so primary keys sort by creation. `core/logging.py` installs a `logging.Formatter` subclass emitting JSON with the request id pulled from `request_id_var`.

- [ ] **Step 5: Implement the error hierarchy**

```python
# backend/app/core/errors.py (shape — fill every subclass)
class AppError(Exception):
    status_code = 500
    default_code = "internal_error"

    def __init__(self, message, *, code=None, details=None):
        super().__init__(message)
        self.message = message
        self.code = code or self.default_code
        self.details = details or {}


class Conflict(AppError):
    status_code = 409
    default_code = "conflict"
```

`install_error_handlers` registers, in this order: `AppError`, `RequestValidationError` (422, code `validation_failed`, `details={"fields": [...]}` from `exc.errors()` with `loc` joined by `.`), `StarletteHTTPException` (maps 404 to code `not_found`, 405 to `method_not_allowed`), `sqlalchemy.exc.IntegrityError` (409, code `constraint_violation`, logs the original), and `Exception` (500, code `internal_error`, message `"Something went wrong."` — the original is logged with the request id and never returned).

- [ ] **Step 6: Implement the app factory**

`create_app()` configures logging, builds `FastAPI(title="FACET API", version="1", docs_url="/docs")`, adds a `RequestIDMiddleware` that sets `request_id_var` and the `X-Request-ID` response header, adds `CORSMiddleware(allow_origins=settings.cors_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])`, calls `install_error_handlers`, registers `GET /health`, and mounts nothing else yet.

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_app.py -v`
Expected: 3 passed

- [ ] **Step 8: Commit**

```bash
git add backend/
git commit -m "feat(backend): scaffold FastAPI app with config, logging and one error envelope"
```

---

### Task 2: Database layer, base model, Alembic, and the test database

**Files:**
- Create: `backend/app/db/__init__.py`, `backend/app/db/base.py`, `backend/app/db/session.py`
- Create: `backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/script.py.mako`
- Modify: `backend/tests/conftest.py`
- Test: `backend/tests/test_db.py`

**Interfaces:**
- Consumes: `get_settings` from Task 1.
- Produces:
  - `Base` — `DeclarativeBase` with a naming convention (`ix_`/`uq_`/`ck_`/`fk_`/`pk_`) so Alembic generates stable, nameable constraints.
  - `TimestampMixin` — `created_at`/`updated_at`, `DateTime(timezone=True)`, `server_default=func.now()`, `onupdate=func.now()`.
  - `UUIDPrimaryKeyMixin` — `id: Mapped[uuid.UUID]` default `new_id`.
  - `get_engine()`, `get_sessionmaker()`, and `async def get_session() -> AsyncIterator[AsyncSession]` — the FastAPI dependency, which commits on clean exit and rolls back on exception.
  - Test fixtures `db_session` and a `client` that overrides `get_session` with the test session.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_db.py
from sqlalchemy import text


async def test_test_database_is_reachable_and_migrated(db_session):
    result = await db_session.execute(text("select 1"))
    assert result.scalar_one() == 1


async def test_alembic_is_at_head(db_session):
    row = await db_session.execute(text("select version_num from alembic_version"))
    assert row.scalar_one()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_db.py -v`
Expected: FAIL — fixture `db_session` not found

- [ ] **Step 3: Implement `db/base.py` and `db/session.py`**

The engine is created with `create_async_engine(url, pool_pre_ping=True)`. `get_session` yields from `async_sessionmaker(expire_on_commit=False)`.

- [ ] **Step 4: Wire Alembic for async + autogenerate**

`alembic/env.py` imports `app.models` (so every table is registered on `Base.metadata`), reads the URL from `get_settings().database_url`, and runs migrations through `connection.run_sync` inside `asyncio.run`. Set `compare_type=True` and `render_as_batch=False`.

- [ ] **Step 5: Implement the test-database fixtures**

`conftest.py` gains a session-scoped fixture that creates the database named in `test_database_url` if absent (connect to `postgres`, `CREATE DATABASE`), runs `alembic upgrade head` against it, and drops it at the end. Per test: open a connection, begin a transaction, bind an `AsyncSession` to it, yield, then roll back — so tests never see each other's rows. `client` overrides `app.dependency_overrides[get_session]` to yield that same session.

- [ ] **Step 6: Create the empty initial migration and run the tests**

Run: `cd backend && python -m alembic revision -m "initial" && python -m pytest tests/ -v`
Expected: all passed

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat(backend): async SQLAlchemy engine, Alembic, and a migrated test database"
```

---

### Task 3: Security core — password hashing and JWTs

**Files:**
- Create: `backend/app/core/security.py`
- Test: `backend/tests/test_security.py`

**Interfaces:**
- Consumes: `get_settings`.
- Produces:
  - `hash_password(plain: str) -> str` (argon2id)
  - `verify_password(plain: str, hashed: str) -> bool` — returns `False` on a malformed hash, never raises
  - `needs_rehash(hashed: str) -> bool`
  - `create_access_token(subject: str, *, session_id: str) -> str`
  - `decode_access_token(token: str) -> AccessClaims` — raises `Unauthenticated` on expiry, bad signature, or wrong `typ`
  - `class AccessClaims(BaseModel)` with `sub: str`, `sid: str`, `exp: int`
  - `new_refresh_token() -> tuple[str, str]` — `(plaintext, sha256_hex)`; only the hash is stored
  - `hash_token(plaintext: str) -> str`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_security.py
import pytest

from app.core.errors import Unauthenticated
from app.core import security as sec


def test_hash_then_verify_roundtrips():
    h = sec.hash_password("correct horse")
    assert h != "correct horse"
    assert sec.verify_password("correct horse", h)
    assert not sec.verify_password("wrong", h)


def test_verify_password_is_false_on_garbage_not_an_exception():
    assert sec.verify_password("x", "not-a-hash") is False


def test_access_token_roundtrips_subject_and_session():
    token = sec.create_access_token("user-1", session_id="sess-1")
    claims = sec.decode_access_token(token)
    assert claims.sub == "user-1"
    assert claims.sid == "sess-1"


def test_decode_rejects_a_tampered_token():
    token = sec.create_access_token("user-1", session_id="sess-1")
    with pytest.raises(Unauthenticated):
        sec.decode_access_token(token[:-2] + "xy")


def test_refresh_token_returns_plaintext_and_a_matching_hash():
    plain, hashed = sec.new_refresh_token()
    assert plain != hashed
    assert sec.hash_token(plain) == hashed
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_security.py -v`
Expected: FAIL — `AttributeError: module 'app.core.security' has no attribute 'hash_password'`

- [ ] **Step 3: Implement `security.py`**

Use `argon2.PasswordHasher()` at defaults. JWTs carry `sub`, `sid`, `typ: "access"`, `iat`, `exp`. Refresh tokens are opaque `secrets.token_urlsafe(48)` hashed with `hashlib.sha256` — not JWTs, because they must be revocable by deleting a row.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_security.py -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/security.py backend/tests/test_security.py
git commit -m "feat(backend): argon2 password hashing and JWT access tokens"
```

---

### Task 4: User, account and session models + first real migration

**Files:**
- Create: `backend/app/models/__init__.py`, `backend/app/models/user.py`, `backend/app/models/account.py`, `backend/app/models/auth_session.py`, `backend/app/models/asset.py`
- Create: `backend/alembic/versions/<hash>_users_and_accounts.py` (autogenerated)
- Test: `backend/tests/test_models_user.py`

**Interfaces:**
- Consumes: `Base`, mixins.
- Produces:
  - `User` — `email` (unique, stored lowercase), `password_hash`, `is_active`, relationships `profile`, `settings`, `sessions`, `portfolios`, `assets`. `cascade="all, delete-orphan"` on all of them so `DELETE /account` is one statement.
  - `AccountProfile` — `user_id` unique FK, `name`, `handle` (unique, nullable), `current`, `about`, `tags: list[str]` JSONB, `links: list[dict]` JSONB, `portrait_asset_id` FK nullable.
  - `AccountSettings` — `plan`, `custom_domain`, `notifications` JSONB, `privacy` JSONB, `phone`, `two_step_secret`, `two_step_enabled`, `google_linked`, `password_changed_at`.
  - `AuthSession` — `user_id`, `refresh_token_hash` (unique), `device`, `user_agent`, `ip`, `last_seen_at`, `revoked_at`. Index on `(user_id, revoked_at)`.
  - `RecoveryCode` — `user_id`, `code_hash`, `used_at`.
  - `Asset` — `user_id`, `kind`, `original_name`, `mime`, `byte_size`, `width`, `height`, `sha256`, `storage_key`. Index on `(user_id, sha256)`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_models_user.py
from app.models import AccountProfile, AccountSettings, User


async def test_user_with_profile_and_settings_persists(db_session):
    user = User(email="a@example.com", password_hash="x")
    user.profile = AccountProfile(name="A", handle="a", tags=["Founder"], links=[])
    user.settings = AccountSettings(
        plan="free",
        notifications={"booking": True, "weekly": True, "brokenLink": True,
                       "mention": False, "product": False},
        privacy={"indexable": True, "showContact": True,
                 "countVisits": True, "badge": True},
    )
    db_session.add(user)
    await db_session.flush()
    assert user.id is not None
    assert user.profile.tags == ["Founder"]
    assert user.settings.privacy["indexable"] is True


async def test_deleting_a_user_cascades_to_its_profile(db_session):
    user = User(email="b@example.com", password_hash="x")
    user.profile = AccountProfile(name="B")
    db_session.add(user)
    await db_session.flush()
    await db_session.delete(user)
    await db_session.flush()
    assert await db_session.get(AccountProfile, user.profile.id) is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_models_user.py -v`
Expected: FAIL — `ImportError: cannot import name 'AccountProfile'`

- [ ] **Step 3: Implement the models**

`models/__init__.py` re-exports every model so Alembic's autogenerate and the test fixtures import one module. Use `Mapped[...]`/`mapped_column` throughout and `JSONB` from `sqlalchemy.dialects.postgresql`.

- [ ] **Step 4: Autogenerate and inspect the migration**

Run: `cd backend && python -m alembic revision --autogenerate -m "users and accounts"`
Read the generated file. Confirm it creates every table with the intended constraint names and no spurious drops.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/ -v`
Expected: all passed

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat(backend): user, account, session and asset models"
```

---

### Task 5: Register, login, refresh, logout

**Files:**
- Create: `backend/app/schemas/common.py`, `backend/app/schemas/auth.py`, `backend/app/schemas/account.py`
- Create: `backend/app/services/auth.py`, `backend/app/services/account.py`
- Create: `backend/app/api/__init__.py`, `backend/app/api/deps.py`, `backend/app/api/router.py`, `backend/app/api/v1/__init__.py`, `backend/app/api/v1/auth.py`
- Modify: `backend/app/main.py` (mount `api_router`)
- Modify: `backend/tests/conftest.py` (add `registered_user`, `auth_client` fixtures)
- Create: `backend/tests/factories.py`
- Test: `backend/tests/test_auth.py`

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces:
  - `AuthService(session)` with `register(email, password, name, device_info) -> tuple[User, TokenPair]`, `login(email, password, device_info) -> tuple[User, TokenPair]`, `refresh(plaintext, device_info) -> TokenPair`, `logout(plaintext) -> None`.
  - `class TokenPair(BaseModel)`: `access_token: str`, `refresh_token: str`, `token_type: Literal["bearer"]`, `expires_in: int`.
  - `class DeviceInfo(BaseModel)`: `device: str`, `user_agent: str | None`, `ip: str | None` — built by a `device_info` dependency reading `User-Agent` and the client host.
  - `get_current_user(...) -> User` in `deps.py` — reads the `Authorization: Bearer` header, decodes, loads the user **and asserts the session row is not revoked**, else `Unauthenticated`.
  - Cookie name constant `REFRESH_COOKIE = "facet_refresh"`.
  - `AccountService(session).defaults_for_new_user()` seeding `notifications` and `privacy` with the same values as `defaultAccount()` in `src/lib/types.ts`.

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_auth.py
async def test_register_returns_a_token_and_creates_the_account(client):
    r = await client.post("/api/v1/auth/register", json={
        "email": "New@Example.com", "password": "correct horse battery",
        "name": "Rohan Mehta",
    })
    assert r.status_code == 201
    body = r.json()
    assert body["token"]["access_token"]
    assert body["user"]["email"] == "new@example.com"   # lowercased
    assert client.cookies.get("facet_refresh")          # httpOnly refresh cookie set


async def test_register_rejects_a_duplicate_email_with_409(client):
    payload = {"email": "dup@example.com", "password": "correct horse battery", "name": "D"}
    assert (await client.post("/api/v1/auth/register", json=payload)).status_code == 201
    r = await client.post("/api/v1/auth/register", json=payload)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "email_taken"


async def test_register_rejects_a_short_password_with_422(client):
    r = await client.post("/api/v1/auth/register", json={
        "email": "x@example.com", "password": "short", "name": "X"})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_failed"


async def test_login_with_the_wrong_password_is_401_and_does_not_say_which_field(client, registered_user):
    r = await client.post("/api/v1/auth/login", json={
        "email": registered_user.email, "password": "nope"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "invalid_credentials"
    assert "password" not in r.json()["error"]["message"].lower()


async def test_login_for_an_unknown_email_is_also_401_invalid_credentials(client):
    r = await client.post("/api/v1/auth/login", json={
        "email": "ghost@example.com", "password": "correct horse battery"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "invalid_credentials"


async def test_refresh_rotates_the_token_and_the_old_one_stops_working(client, registered_user):
    first = client.cookies.get("facet_refresh")
    r = await client.post("/api/v1/auth/refresh")
    assert r.status_code == 200
    assert client.cookies.get("facet_refresh") != first

    client.cookies.set("facet_refresh", first)
    reused = await client.post("/api/v1/auth/refresh")
    assert reused.status_code == 401
    assert reused.json()["error"]["code"] == "invalid_refresh_token"


async def test_a_protected_route_rejects_a_missing_token(client):
    r = await client.get("/api/v1/me")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthenticated"


async def test_logout_revokes_the_session_so_the_access_token_stops_working(auth_client):
    assert (await auth_client.get("/api/v1/me")).status_code == 200
    assert (await auth_client.post("/api/v1/auth/logout")).status_code == 204
    assert (await auth_client.get("/api/v1/me")).status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_auth.py -v`
Expected: FAIL — 404 from every route, `registered_user` fixture missing

- [ ] **Step 3: Implement the schemas**

`schemas/common.py` holds `ORMModel` (`model_config = ConfigDict(from_attributes=True)`) and the `ErrorEnvelope` used only for OpenAPI documentation. `RegisterRequest.password` is `Field(min_length=12, max_length=200)`; `email` is `EmailStr` normalised to lowercase by a validator.

- [ ] **Step 4: Implement `AuthService`**

`register` checks the email, hashes the password, creates `User` + `AccountProfile` + `AccountSettings` (defaults from `AccountService`), then opens a session row. `login` fetches by email and calls `verify_password`; **on an unknown email it still runs a dummy verify** so the response time does not leak whether the address exists, then raises `Unauthenticated("Those details do not match an account.", code="invalid_credentials")`. `refresh` looks the row up by token hash, rejects a revoked or expired row (`code="invalid_refresh_token"`), and **rotates**: revoke the old row, insert a new one. A hash that matches an already-revoked row means the token leaked — revoke every session for that user and log it.

- [ ] **Step 5: Implement the router, `deps.py`, and mount it**

The refresh token goes out **only** as an httpOnly cookie (`secure=settings.env == "prod"`, `samesite="lax"`, `path="/api/v1/auth"`), never in the JSON body. `GET /api/v1/me` lands here as the smallest protected route the tests need.

- [ ] **Step 6: Implement the fixtures**

`registered_user` posts to `/auth/register` and returns the ORM `User`; `auth_client` is an `AsyncClient` with the `Authorization` header already set.

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_auth.py -v`
Expected: 8 passed

- [ ] **Step 8: Commit**

```bash
git add backend/
git commit -m "feat(backend): register, login, refresh rotation and logout"
```

---

### Task 6: Sessions on other devices, and changing a password

**Files:**
- Modify: `backend/app/services/auth.py`, `backend/app/api/v1/auth.py`, `backend/app/schemas/auth.py`
- Test: `backend/tests/test_auth_sessions.py`

**Interfaces:**
- Consumes: Task 5.
- Produces: `AuthService.list_sessions(user, current_session_id) -> list[SessionOut]`, `.revoke_session(user, session_id)`, `.revoke_other_sessions(user, keep_id) -> int`, `.change_password(user, current, new, keep_session_id)`.
- `SessionOut` fields: `id`, `device`, `place`, `when`, `current` — matching `SessionRecord` in `src/lib/types.ts` so the Account panel renders it unchanged. `place` is derived from the stored ip (`"This device"` when it matches the caller, else the ip), `when` is an ISO timestamp the UI formats.

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_auth_sessions.py
async def test_sessions_lists_the_current_one_marked_current(auth_client):
    r = await auth_client.get("/api/v1/auth/sessions")
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["current"] is True


async def test_a_second_login_appears_as_a_second_session(auth_client, second_login):
    rows = (await auth_client.get("/api/v1/auth/sessions")).json()
    assert len(rows) == 2
    assert [x["current"] for x in rows].count(True) == 1


async def test_revoking_the_other_session_kills_its_access_token(auth_client, second_login):
    others = [s for s in (await auth_client.get("/api/v1/auth/sessions")).json()
              if not s["current"]]
    r = await auth_client.delete(f"/api/v1/auth/sessions/{others[0]['id']}")
    assert r.status_code == 204
    assert (await second_login.get("/api/v1/me")).status_code == 401
    assert (await auth_client.get("/api/v1/me")).status_code == 200


async def test_revoking_another_users_session_is_404_not_403(auth_client, other_users_session_id):
    r = await auth_client.delete(f"/api/v1/auth/sessions/{other_users_session_id}")
    assert r.status_code == 404


async def test_changing_the_password_requires_the_current_one(auth_client):
    r = await auth_client.post("/api/v1/auth/password", json={
        "current_password": "wrong", "new_password": "a brand new passphrase"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "invalid_credentials"


async def test_changing_the_password_revokes_other_sessions_but_not_this_one(
    auth_client, second_login
):
    r = await auth_client.post("/api/v1/auth/password", json={
        "current_password": "correct horse battery",
        "new_password": "a brand new passphrase"})
    assert r.status_code == 204
    assert (await auth_client.get("/api/v1/me")).status_code == 200
    assert (await second_login.get("/api/v1/me")).status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_auth_sessions.py -v`
Expected: FAIL — 404 on `/auth/sessions`

- [ ] **Step 3: Add the `second_login` and `other_users_session_id` fixtures**

`second_login` registers nothing — it logs the same user in again from a different `User-Agent` and returns a client bound to that second access token.

- [ ] **Step 4: Implement the service methods and routes**

`change_password` verifies the current password, writes the new hash, sets `password_changed_at = now()`, and revokes every session except the caller's — a password change that leaves other devices signed in is a security bug.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_auth_sessions.py -v`
Expected: 6 passed

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat(backend): list and revoke device sessions, change password"
```

---

### Task 7: Two-step (TOTP) and recovery codes

**Files:**
- Modify: `backend/app/services/auth.py`, `backend/app/api/v1/auth.py`, `backend/app/schemas/auth.py`
- Create: `backend/app/models/recovery_code.py` (or extend `account.py`)
- Test: `backend/tests/test_two_step.py`

**Interfaces:**
- Consumes: Task 6.
- Produces: `AuthService.begin_two_step(user) -> TwoStepSetup` (`secret`, `otpauth_uri`), `.confirm_two_step(user, code)`, `.disable_two_step(user, code)`, `.issue_recovery_codes(user) -> list[str]`, `.consume_recovery_code(user, code) -> bool`.
- `login` gains a two-step branch: when `two_step_enabled`, it returns **202** with `{"two_step_required": true, "challenge": "<short-lived JWT, typ=challenge>"}` and no session; `POST /auth/login/two-step` with `{challenge, code}` completes it. `code` accepts either a 6-digit TOTP or a recovery code.

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_two_step.py
import pyotp


async def test_enabling_two_step_needs_a_valid_code_to_confirm(auth_client):
    setup = (await auth_client.post("/api/v1/auth/two-step/enable")).json()
    assert setup["secret"]
    assert setup["otpauth_uri"].startswith("otpauth://totp/")

    bad = await auth_client.post("/api/v1/auth/two-step/verify", json={"code": "000000"})
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "invalid_two_step_code"

    good = await auth_client.post("/api/v1/auth/two-step/verify",
                                  json={"code": pyotp.TOTP(setup["secret"]).now()})
    assert good.status_code == 204


async def test_login_with_two_step_on_returns_202_and_a_challenge(client, two_step_user):
    r = await client.post("/api/v1/auth/login", json={
        "email": two_step_user.email, "password": "correct horse battery"})
    assert r.status_code == 202
    assert r.json()["two_step_required"] is True
    assert client.cookies.get("facet_refresh") is None   # no session until the code


async def test_completing_the_challenge_issues_the_token(client, two_step_user, totp_secret):
    challenge = (await client.post("/api/v1/auth/login", json={
        "email": two_step_user.email,
        "password": "correct horse battery"})).json()["challenge"]
    r = await client.post("/api/v1/auth/login/two-step", json={
        "challenge": challenge, "code": pyotp.TOTP(totp_secret).now()})
    assert r.status_code == 200
    assert r.json()["token"]["access_token"]


async def test_a_recovery_code_works_once_and_then_does_not(client, two_step_user, auth_client):
    codes = (await auth_client.post("/api/v1/auth/recovery-codes")).json()["codes"]
    assert len(codes) == 10

    async def attempt(code):
        challenge = (await client.post("/api/v1/auth/login", json={
            "email": two_step_user.email,
            "password": "correct horse battery"})).json()["challenge"]
        return await client.post("/api/v1/auth/login/two-step",
                                 json={"challenge": challenge, "code": code})

    assert (await attempt(codes[0])).status_code == 200
    assert (await attempt(codes[0])).status_code == 422


async def test_recovery_codes_are_never_readable_after_they_are_issued(auth_client, db_session):
    from sqlalchemy import select
    from app.models import RecoveryCode
    codes = (await auth_client.post("/api/v1/auth/recovery-codes")).json()["codes"]
    rows = (await db_session.execute(select(RecoveryCode))).scalars().all()
    assert all(r.code_hash not in codes for r in rows)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_two_step.py -v`
Expected: FAIL — 404 on `/auth/two-step/enable`

- [ ] **Step 3: Implement TOTP and recovery codes**

`pyotp.random_base32()` for the secret, stored only after a code confirms it — an unconfirmed secret must not lock anyone out. `TOTP.verify(code, valid_window=1)` tolerates one step of clock skew. Recovery codes use the same alphabet as `generateRecoveryCodes()` in `src/lib/account.ts` (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, `XXXX-XXXX`), are returned once in plaintext, and are stored as argon2 hashes.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_two_step.py -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat(backend): TOTP two-step and single-use recovery codes"
```

---

### Task 8: Account profile and settings

**Files:**
- Create: `backend/app/api/v1/account.py`
- Modify: `backend/app/services/account.py`, `backend/app/schemas/account.py`, `backend/app/api/router.py`
- Test: `backend/tests/test_account.py`

**Interfaces:**
- Consumes: Tasks 5–7.
- Produces: `AccountService` with `get(user) -> AccountOut`, `update_profile`, `update_security`, `set_plan`, `set_domain`, `update_notifications`, `update_privacy`, `delete_account(user)`.
- `AccountOut` mirrors `AccountSettings` in `src/lib/types.ts` exactly: `{profile, security, plan, customDomain, notifications, privacy}`. **All response models use `alias_generator=to_camel` with `populate_by_name=True`** so the frontend needs no key mapping — `customDomain`, not `custom_domain`. Apply this to every schema in the project from here on.
- `security` never includes `two_step_secret` or any hash. It exposes `email`, `phone`, `passwordChanged` (ISO), `twoStep`, `google`, `recoveryCodesRemaining: int`.

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_account.py
async def test_get_account_returns_the_ui_shape_in_camel_case(auth_client):
    body = (await auth_client.get("/api/v1/account")).json()
    assert set(body) == {"profile", "security", "plan", "customDomain",
                         "notifications", "privacy"}
    assert set(body["notifications"]) == {"booking", "weekly", "brokenLink",
                                          "mention", "product"}
    assert set(body["privacy"]) == {"indexable", "showContact",
                                    "countVisits", "badge"}


async def test_account_never_leaks_the_two_step_secret_or_a_hash(auth_client):
    body = (await auth_client.get("/api/v1/account")).json()
    blob = str(body).lower()
    assert "secret" not in blob
    assert "hash" not in blob
    assert "$argon2" not in blob


async def test_patch_privacy_persists_one_key_without_clearing_the_others(auth_client):
    r = await auth_client.patch("/api/v1/account/privacy", json={"indexable": False})
    assert r.status_code == 200
    body = r.json()
    assert body["privacy"]["indexable"] is False
    assert body["privacy"]["badge"] is True


async def test_patch_privacy_rejects_an_unknown_key(auth_client):
    r = await auth_client.patch("/api/v1/account/privacy", json={"nonsense": True})
    assert r.status_code == 422


async def test_handle_is_unique_across_users(auth_client, other_auth_client):
    assert (await auth_client.patch("/api/v1/account/profile",
                                    json={"handle": "rohan"})).status_code == 200
    r = await other_auth_client.patch("/api/v1/account/profile", json={"handle": "rohan"})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "handle_taken"


async def test_setting_the_plan_to_an_unknown_value_is_422(auth_client):
    r = await auth_client.patch("/api/v1/account/plan", json={"plan": "enterprise"})
    assert r.status_code == 422


async def test_delete_account_removes_the_user_and_everything_under_it(auth_client, db_session):
    from sqlalchemy import func, select
    from app.models import Portfolio, User
    await auth_client.post("/api/v1/portfolios", json={"name": "P", "slug": "p",
                                                       "startFrom": {"kind": "blank"}})
    r = await auth_client.delete("/api/v1/account")
    assert r.status_code == 204
    assert (await db_session.execute(select(func.count()).select_from(User))).scalar_one() == 1
    assert (await db_session.execute(
        select(func.count()).select_from(Portfolio))).scalar_one() == 0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_account.py -v`
Expected: FAIL — 404 on `/api/v1/account`

- [ ] **Step 3: Implement the camelCase base model**

In `schemas/common.py`:

```python
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True,
                              from_attributes=True)
```

Every schema in the project inherits from `CamelModel`. Routers return with `response_model_by_alias=True` (the default).

- [ ] **Step 4: Implement the service and router**

`update_notifications` and `update_privacy` take a partial dict typed as a Pydantic model with all-optional bool fields, so an unknown key is a 422 from validation and a partial update merges rather than replaces. `delete_account` relies on the cascades from Task 4 and also deletes the user's asset files from disk.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_account.py -v`
Expected: 7 passed (the `delete_account` test needs Task 9; mark it `xfail` here and remove the marker in Task 9)

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat(backend): account profile, plan, domain, notification and privacy settings"
```

---

### Task 9: Portfolios

**Files:**
- Create: `backend/app/models/portfolio.py`, `backend/app/schemas/portfolio.py`, `backend/app/services/portfolio.py`, `backend/app/api/v1/portfolios.py`
- Modify: `backend/app/api/deps.py` (add `get_owned_portfolio`), `backend/app/models/__init__.py`, `backend/app/api/router.py`
- Create: `backend/alembic/versions/<hash>_portfolios.py`
- Test: `backend/tests/test_portfolios.py`

**Interfaces:**
- Consumes: Task 8.
- Produces:
  - `Portfolio`, `PortfolioHeader`, `Section` models (Section defined here, its router in Task 10).
  - `PortfolioService` with `list_for(user)`, `create(user, name, slug, start_from)`, `get(user, id)`, `update(portfolio, patch)`, `delete(portfolio)`, `update_header(portfolio, patch)`, `publish(portfolio)`, `unpublish(portfolio)`, `slug_available(slug, exclude_id=None)`.
  - `get_owned_portfolio(portfolio_id, user, session) -> Portfolio` — the single ownership gate. Raises `NotFound` for a missing **or** foreign row.
  - `SLUG_PATTERN = r"^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$"`, enforced by a Pydantic `Field(pattern=...)`.
  - `FOUNDER_TEMPLATE` — the same three sections as `store.tsx`.
  - `meta` is computed on read (`"N sections · <relative time>"`), not stored, so it can never go stale.

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_portfolios.py
async def test_create_blank_portfolio_starts_with_one_empty_section(auth_client):
    r = await auth_client.post("/api/v1/portfolios", json={
        "name": "Rohan Mehta", "slug": "rohan", "startFrom": {"kind": "blank"}})
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "empty"
    assert body["theme"] == "editorial"
    assert body["layout"] == {"roleNav": "tabs", "grid": 2, "density": "standard",
                              "scale": "default", "tracking": "-0.015em"}
    assert len(body["sections"]) == 1
    assert body["sections"][0]["title"] == ""


async def test_create_founder_portfolio_seeds_three_titled_sections(auth_client):
    r = await auth_client.post("/api/v1/portfolios", json={
        "name": "F", "slug": "founder-x", "startFrom": {"kind": "founder"}})
    titles = [s["title"] for s in r.json()["sections"]]
    assert titles == ["The company", "What I did before", "How to work with me"]


async def test_create_copy_duplicates_sections_with_new_ids(auth_client):
    src = (await auth_client.post("/api/v1/portfolios", json={
        "name": "F", "slug": "src-x", "startFrom": {"kind": "founder"}})).json()
    copy = (await auth_client.post("/api/v1/portfolios", json={
        "name": "Copy", "slug": "copy-x",
        "startFrom": {"kind": "copy", "id": src["id"]}})).json()
    assert [s["title"] for s in copy["sections"]] == [s["title"] for s in src["sections"]]
    assert {s["id"] for s in copy["sections"]}.isdisjoint({s["id"] for s in src["sections"]})


async def test_a_taken_slug_is_409_even_across_users(auth_client, other_auth_client):
    await auth_client.post("/api/v1/portfolios", json={
        "name": "A", "slug": "shared-slug", "startFrom": {"kind": "blank"}})
    r = await other_auth_client.post("/api/v1/portfolios", json={
        "name": "B", "slug": "shared-slug", "startFrom": {"kind": "blank"}})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "slug_taken"
    assert r.json()["error"]["details"] == {"slug": "shared-slug"}


async def test_an_invalid_slug_is_422(auth_client):
    r = await auth_client.post("/api/v1/portfolios", json={
        "name": "A", "slug": "Not A Slug!", "startFrom": {"kind": "blank"}})
    assert r.status_code == 422


async def test_slug_available_reports_both_answers(auth_client):
    await auth_client.post("/api/v1/portfolios", json={
        "name": "A", "slug": "taken-slug", "startFrom": {"kind": "blank"}})
    assert (await auth_client.get(
        "/api/v1/portfolios/slug-available?slug=taken-slug")).json()["available"] is False
    assert (await auth_client.get(
        "/api/v1/portfolios/slug-available?slug=free-slug")).json()["available"] is True


async def test_list_only_returns_my_portfolios(auth_client, other_auth_client):
    await auth_client.post("/api/v1/portfolios", json={
        "name": "Mine", "slug": "mine-x", "startFrom": {"kind": "blank"}})
    await other_auth_client.post("/api/v1/portfolios", json={
        "name": "Theirs", "slug": "theirs-x", "startFrom": {"kind": "blank"}})
    rows = (await auth_client.get("/api/v1/portfolios")).json()
    assert [p["name"] for p in rows] == ["Mine"]


async def test_reading_another_users_portfolio_is_404_not_403(auth_client, other_auth_client):
    theirs = (await other_auth_client.post("/api/v1/portfolios", json={
        "name": "T", "slug": "theirs-y", "startFrom": {"kind": "blank"}})).json()
    r = await auth_client.get(f"/api/v1/portfolios/{theirs['id']}")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


async def test_patch_updates_theme_accent_and_layout(auth_client, portfolio):
    r = await auth_client.patch(f"/api/v1/portfolios/{portfolio['id']}", json={
        "theme": "dossier", "accent": "#1d4ed8",
        "layout": {"roleNav": "lens", "grid": 3, "density": "dense",
                   "scale": "display", "tracking": "-0.02em"}})
    assert r.status_code == 200
    assert r.json()["theme"] == "dossier"
    assert r.json()["layout"]["grid"] == 3


async def test_patch_rejects_an_unknown_theme(auth_client, portfolio):
    r = await auth_client.patch(f"/api/v1/portfolios/{portfolio['id']}",
                                json={"theme": "vaporwave"})
    assert r.status_code == 422


async def test_patch_header_stores_tags_and_links(auth_client, portfolio):
    r = await auth_client.patch(f"/api/v1/portfolios/{portfolio['id']}/header", json={
        "name": "Rohan Mehta", "current": "Founder",
        "tags": ["Founder", "Adviser"],
        "links": [{"id": "l1", "label": "Email", "url": "rohan@northwell.in"}]})
    assert r.status_code == 200
    assert r.json()["header"]["tags"] == ["Founder", "Adviser"]
    assert r.json()["header"]["links"][0]["label"] == "Email"


async def test_publish_sets_status_live_and_unpublish_sets_draft(auth_client, portfolio):
    up = await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/publish")
    assert up.json()["status"] == "live"
    assert up.json()["publishedAt"] is not None
    down = await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/unpublish")
    assert down.json()["status"] == "draft"


async def test_delete_removes_it_from_the_list(auth_client, portfolio):
    assert (await auth_client.delete(
        f"/api/v1/portfolios/{portfolio['id']}")).status_code == 204
    assert (await auth_client.get("/api/v1/portfolios")).json() == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_portfolios.py -v`
Expected: FAIL — 404 on `/api/v1/portfolios`

- [ ] **Step 3: Implement the models and migration**

`Portfolio.slug` is unique across the whole table. `layout` is JSONB validated by a `Layout` schema whose defaults equal `defaultLayout()`. Add the `portfolio` fixture to `conftest.py` (a blank portfolio, returned as the response JSON).

Run: `cd backend && python -m alembic revision --autogenerate -m "portfolios"`

- [ ] **Step 4: Implement the service, `get_owned_portfolio`, and the router**

Register `GET /portfolios/slug-available` **before** `GET /portfolios/{portfolio_id}` or the literal path will be captured as a UUID and 422.

- [ ] **Step 5: Run tests to verify they pass, and un-xfail the Task 8 test**

Run: `cd backend && python -m pytest tests/ -v`
Expected: all passed

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat(backend): portfolio CRUD, slug availability, publish and unpublish"
```

---

### Task 10: Sections

**Files:**
- Create: `backend/app/schemas/section.py`, `backend/app/services/section.py`, `backend/app/api/v1/sections.py`
- Modify: `backend/app/api/router.py`
- Test: `backend/tests/test_sections.py`

**Interfaces:**
- Consumes: Task 9.
- Produces: `SectionService` with `add(portfolio, kind=None)`, `update(portfolio, section_id, patch)`, `delete(portfolio, section_id)`, `move(portfolio, section_id, delta)`, `reorder(portfolio, ids)`, plus private `_normalise_positions(portfolio)`.
- `KIND_TITLE` — the same starting titles as `store.tsx`: `link: ""`, `venture: "A business you run"`, `contact: "How to reach you"`, `booking: "Book a time"`, `testimonial: "What a client said"`, `gallery: "Photographs"`, `numbers: "By the numbers"`, `document: "A document to download"`.

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_sections.py
async def test_adding_a_block_seeds_the_kinds_title(auth_client, portfolio):
    r = await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/sections",
                               json={"kind": "venture"})
    assert r.status_code == 201
    assert r.json()["kind"] == "venture"
    assert r.json()["title"] == "A business you run"


async def test_adding_a_plain_section_has_an_empty_title(auth_client, portfolio):
    r = await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/sections", json={})
    assert r.json()["title"] == ""
    assert r.json()["kind"] == "link"


async def test_an_unknown_kind_is_422(auth_client, portfolio):
    r = await auth_client.post(f"/api/v1/portfolios/{portfolio['id']}/sections",
                               json={"kind": "podcast"})
    assert r.status_code == 422


async def test_patch_stores_every_optional_extra(auth_client, portfolio):
    sid = portfolio["sections"][0]["id"]
    r = await auth_client.patch(
        f"/api/v1/portfolios/{portfolio['id']}/sections/{sid}", json={
            "title": "Northwell Kitchens",
            "description": "Cloud kitchens in three cities.",
            "tags": ["Food", "Ops"],
            "links": [{"id": "l1", "label": "Site", "url": "northwell.in"}],
            "numbers": [{"id": "n1", "label": "Cities", "value": "3"}],
            "dates": [{"id": "d1", "year": "2021", "text": "Founded"}],
            "quote": {"text": "They shipped fast.", "attribution": "A client"},
            "hidden": True})
    assert r.status_code == 200
    s = r.json()
    assert s["numbers"][0]["value"] == "3"
    assert s["dates"][0]["year"] == "2021"
    assert s["quote"]["attribution"] == "A client"
    assert s["hidden"] is True


async def test_clearing_the_quote_with_null_works(auth_client, portfolio):
    sid = portfolio["sections"][0]["id"]
    await auth_client.patch(f"/api/v1/portfolios/{portfolio['id']}/sections/{sid}",
                            json={"quote": {"text": "x", "attribution": "y"}})
    r = await auth_client.patch(f"/api/v1/portfolios/{portfolio['id']}/sections/{sid}",
                                json={"quote": None})
    assert r.json()["quote"] is None


async def test_move_reorders_and_clamps_at_the_ends(auth_client, three_sections):
    pid, ids = three_sections
    r = await auth_client.post(
        f"/api/v1/portfolios/{pid}/sections/{ids[2]}/move", json={"delta": -1})
    assert [s["id"] for s in r.json()["sections"]] == [ids[0], ids[2], ids[1]]

    r = await auth_client.post(
        f"/api/v1/portfolios/{pid}/sections/{ids[0]}/move", json={"delta": -1})
    assert r.status_code == 200
    assert [s["id"] for s in r.json()["sections"]] == [ids[0], ids[2], ids[1]]


async def test_reorder_accepts_a_full_id_list(auth_client, three_sections):
    pid, ids = three_sections
    r = await auth_client.put(f"/api/v1/portfolios/{pid}/sections/order",
                              json={"ids": [ids[2], ids[0], ids[1]]})
    assert [s["id"] for s in r.json()["sections"]] == [ids[2], ids[0], ids[1]]


async def test_reorder_rejects_a_partial_list(auth_client, three_sections):
    pid, ids = three_sections
    r = await auth_client.put(f"/api/v1/portfolios/{pid}/sections/order",
                              json={"ids": [ids[0]]})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "section_order_mismatch"


async def test_delete_leaves_positions_dense(auth_client, three_sections, db_session):
    from sqlalchemy import select
    from app.models import Section
    pid, ids = three_sections
    await auth_client.delete(f"/api/v1/portfolios/{pid}/sections/{ids[0]}")
    rows = (await db_session.execute(
        select(Section).where(Section.portfolio_id == pid)
        .order_by(Section.position))).scalars().all()
    assert [r.position for r in rows] == [0, 1]


async def test_touching_a_section_of_another_users_portfolio_is_404(
    auth_client, other_auth_client
):
    theirs = (await other_auth_client.post("/api/v1/portfolios", json={
        "name": "T", "slug": "theirs-z", "startFrom": {"kind": "blank"}})).json()
    sid = theirs["sections"][0]["id"]
    r = await auth_client.patch(
        f"/api/v1/portfolios/{theirs['id']}/sections/{sid}", json={"title": "hijack"})
    assert r.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_sections.py -v`
Expected: FAIL — 404 on the sections routes

- [ ] **Step 3: Add the `three_sections` fixture and implement the service**

Every mutation calls `_normalise_positions` inside the same transaction, so positions are always a dense `0..n-1`. `move` clamps rather than erroring at the ends — the UI's up/down buttons at a list boundary are not a client error. `reorder` requires the id set to match exactly, or `Conflict(code="section_order_mismatch")` at 422.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_sections.py -v`
Expected: 10 passed

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat(backend): section create, patch, delete, move and reorder"
```

---

### Task 11: Assets — real uploads

**Files:**
- Create: `backend/app/services/storage.py`, `backend/app/services/asset.py`, `backend/app/schemas/asset.py`, `backend/app/api/v1/assets.py`
- Modify: `backend/app/api/router.py`, `backend/app/schemas/section.py` (accept `imageAssetId` / `fileAssetId`)
- Test: `backend/tests/test_assets.py`

**Interfaces:**
- Consumes: Task 10.
- Produces:
  - `Storage` protocol: `put(key: str, data: bytes) -> None`, `open(key) -> BinaryIO`, `delete(key) -> None`, `url_for(key) -> str`. `LocalDiskStorage(root)` implements it, sharding by the first two hex characters of the sha256.
  - `AssetService.upload(user, upload: UploadFile, kind) -> Asset` and `.delete(user, asset_id)`.
  - `AssetOut`: `id`, `name`, `mime`, `size`, `width`, `height`, `url`.
  - Constants `IMAGE_MAX_DIM = 1400`, `IMAGE_TARGET_BYTES = 420 * 1024`, `FILE_MAX_BYTES = 800 * 1024`, `UPLOAD_HARD_CAP = 15 * 1024 * 1024`.

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_assets.py
import io

from PIL import Image


def png_bytes(w=2400, h=1200):
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (120, 120, 120)).save(buf, format="PNG")
    return buf.getvalue()


async def test_uploading_a_large_image_downscales_and_reencodes_it(auth_client):
    r = await auth_client.post(
        "/api/v1/assets",
        files={"file": ("wide.png", png_bytes(), "image/png")},
        data={"kind": "image"})
    assert r.status_code == 201
    a = r.json()
    assert a["mime"] == "image/jpeg"        # re-encoded
    assert max(a["width"], a["height"]) == 1400
    assert a["size"] < 420 * 1024
    assert a["url"].startswith("/api/v1/")


async def test_the_stored_bytes_are_served_back(auth_client):
    a = (await auth_client.post("/api/v1/assets",
                                files={"file": ("x.png", png_bytes(400, 400), "image/png")},
                                data={"kind": "image"})).json()
    r = await auth_client.get(f"/api/v1/assets/{a['id']}")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/jpeg"
    assert Image.open(io.BytesIO(r.content)).size == (400, 400)


async def test_the_mime_is_sniffed_not_trusted(auth_client):
    r = await auth_client.post(
        "/api/v1/assets",
        files={"file": ("evil.png", b"#!/bin/sh\nrm -rf /", "image/png")},
        data={"kind": "image"})
    assert r.status_code == 415
    assert r.json()["error"]["code"] == "unsupported_media"


async def test_an_oversized_attachment_is_413(auth_client):
    r = await auth_client.post(
        "/api/v1/assets",
        files={"file": ("big.pdf", b"%PDF-1.4" + b"0" * (900 * 1024), "application/pdf")},
        data={"kind": "file"})
    assert r.status_code == 413
    assert r.json()["error"]["code"] == "payload_too_large"


async def test_uploading_the_same_bytes_twice_reuses_one_file(auth_client, db_session):
    from sqlalchemy import func, select
    from app.models import Asset
    payload = png_bytes(300, 300)
    first = (await auth_client.post("/api/v1/assets",
             files={"file": ("a.png", payload, "image/png")}, data={"kind": "image"})).json()
    second = (await auth_client.post("/api/v1/assets",
              files={"file": ("b.png", payload, "image/png")}, data={"kind": "image"})).json()
    assert first["id"] != second["id"]
    keys = (await db_session.execute(select(Asset.storage_key).distinct())).scalars().all()
    assert len(keys) == 1


async def test_attaching_an_asset_to_a_section_returns_it_nested(auth_client, portfolio):
    a = (await auth_client.post("/api/v1/assets",
                                files={"file": ("p.png", png_bytes(500, 500), "image/png")},
                                data={"kind": "image"})).json()
    sid = portfolio["sections"][0]["id"]
    r = await auth_client.patch(f"/api/v1/portfolios/{portfolio['id']}/sections/{sid}",
                                json={"imageAssetId": a["id"]})
    assert r.status_code == 200
    assert r.json()["image"]["url"] == a["url"]


async def test_attaching_another_users_asset_is_404(auth_client, other_auth_client, portfolio):
    theirs = (await other_auth_client.post(
        "/api/v1/assets", files={"file": ("t.png", png_bytes(200, 200), "image/png")},
        data={"kind": "image"})).json()
    sid = portfolio["sections"][0]["id"]
    r = await auth_client.patch(f"/api/v1/portfolios/{portfolio['id']}/sections/{sid}",
                                json={"imageAssetId": theirs["id"]})
    assert r.status_code == 404


async def test_reading_another_users_asset_directly_is_404(auth_client, other_auth_client):
    theirs = (await other_auth_client.post(
        "/api/v1/assets", files={"file": ("t.png", png_bytes(200, 200), "image/png")},
        data={"kind": "image"})).json()
    assert (await auth_client.get(f"/api/v1/assets/{theirs['id']}")).status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_assets.py -v`
Expected: FAIL — 404 on `/api/v1/assets`

- [ ] **Step 3: Point `media_root` at `tmp_path` for tests**

Override `get_settings` in `conftest.py` so uploads land in a per-run temporary directory and never touch a developer's media folder.

- [ ] **Step 4: Implement storage and the asset service**

Read the upload in chunks and abort at `UPLOAD_HARD_CAP` before buffering — a client must not be able to exhaust memory by streaming. Verify images by opening with Pillow (`Image.open(...).verify()`), then reopen, `ImageOps.exif_transpose` (so a phone photo is not sideways), convert to RGB, `thumbnail((1400, 1400))`, and step JPEG quality down through `[82, 72, 60, 48, 36, 25]` until the result fits `IMAGE_TARGET_BYTES`. SVG passes through after an XML parse. Non-images are sniffed against an allowlist (`application/pdf`, plain text, common docs) and capped at `FILE_MAX_BYTES`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_assets.py -v`
Expected: 8 passed

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat(backend): real asset uploads with server-side image processing"
```

---

### Task 12: The published page and its privacy switches

**Files:**
- Create: `backend/app/schemas/publish.py`, `backend/app/api/v1/publish.py`
- Modify: `backend/app/services/portfolio.py`, `backend/app/api/router.py`
- Test: `backend/tests/test_publish.py`

**Interfaces:**
- Consumes: Tasks 9–11.
- Produces: `PortfolioService.get_public(slug) -> PublicPortfolioOut` applying: unpublished → `NotFound`; `indexable=False` → served but with `"noindex": true` in the payload and an `X-Robots-Tag: noindex` header; `showContact=False` → `header.links` emptied; `badge=False` → `"badge": false`; hidden sections dropped **always**.
- `GET /public/assets/{id}` — no auth, but only serves an asset referenced by a **published** portfolio. Long `Cache-Control` plus an `ETag` from the sha256.

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_publish.py
async def test_an_unpublished_page_is_404(client, portfolio):
    r = await client.get(f"/api/v1/public/p/{portfolio['slug']}")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "page_not_found"


async def test_a_published_page_is_readable_without_a_token(client, published):
    r = await client.get(f"/api/v1/public/p/{published['slug']}")
    assert r.status_code == 200
    assert r.json()["theme"] == "editorial"
    assert "sections" in r.json()


async def test_hidden_sections_never_reach_the_published_payload(
    auth_client, client, published
):
    sid = published["sections"][0]["id"]
    await auth_client.patch(
        f"/api/v1/portfolios/{published['id']}/sections/{sid}", json={"hidden": True})
    body = (await client.get(f"/api/v1/public/p/{published['slug']}")).json()
    assert all(s["id"] != sid for s in body["sections"])


async def test_show_contact_off_removes_the_header_links_from_the_body(
    auth_client, client, published
):
    await auth_client.patch(f"/api/v1/portfolios/{published['id']}/header", json={
        "links": [{"id": "l1", "label": "Email", "url": "rohan@northwell.in"}]})
    assert (await client.get(
        f"/api/v1/public/p/{published['slug']}")).json()["header"]["links"]

    await auth_client.patch("/api/v1/account/privacy", json={"showContact": False})
    body = (await client.get(f"/api/v1/public/p/{published['slug']}")).json()
    assert body["header"]["links"] == []


async def test_indexable_off_sets_noindex_and_the_header(auth_client, client, published):
    await auth_client.patch("/api/v1/account/privacy", json={"indexable": False})
    r = await client.get(f"/api/v1/public/p/{published['slug']}")
    assert r.status_code == 200
    assert r.json()["noindex"] is True
    assert "noindex" in r.headers["x-robots-tag"]


async def test_badge_off_is_reported_to_the_page(auth_client, client, published):
    await auth_client.patch("/api/v1/account/privacy", json={"badge": False})
    assert (await client.get(
        f"/api/v1/public/p/{published['slug']}")).json()["badge"] is False


async def test_a_published_asset_is_public_and_cacheable(auth_client, client, published):
    import io
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (300, 300), (10, 10, 10)).save(buf, format="PNG")
    a = (await auth_client.post("/api/v1/assets",
         files={"file": ("h.png", buf.getvalue(), "image/png")},
         data={"kind": "image"})).json()
    await auth_client.patch(f"/api/v1/portfolios/{published['id']}/header",
                            json={"portraitAssetId": a["id"]})
    r = await client.get(f"/api/v1/public/assets/{a['id']}")
    assert r.status_code == 200
    assert r.headers["etag"]
    assert "max-age" in r.headers["cache-control"]


async def test_an_unpublished_assets_public_url_is_404(auth_client, client):
    import io
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (100, 100)).save(buf, format="PNG")
    a = (await auth_client.post("/api/v1/assets",
         files={"file": ("x.png", buf.getvalue(), "image/png")},
         data={"kind": "image"})).json()
    assert (await client.get(f"/api/v1/public/assets/{a['id']}")).status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_publish.py -v`
Expected: FAIL — 404 on `/api/v1/public/p/...`

- [ ] **Step 3: Add the `published` fixture and implement**

`published` is a portfolio created and then published. The public read is one query with `selectinload` on header, sections and their assets — the published page must not issue a query per section.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_publish.py -v`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat(backend): public published-page endpoint with server-enforced privacy"
```

---

### Task 13: Analytics

**Files:**
- Create: `backend/app/models/analytics.py`, `backend/app/schemas/analytics.py`, `backend/app/services/analytics.py`, `backend/app/api/v1/analytics.py`
- Modify: `backend/app/api/v1/publish.py` (the record endpoints), `backend/app/api/router.py`, `backend/app/models/__init__.py`
- Create: `backend/alembic/versions/<hash>_analytics.py`
- Test: `backend/tests/test_analytics.py`

**Interfaces:**
- Consumes: Task 12.
- Produces:
  - `AnalyticsService.record_view(slug, referrer, dedupe_key)`, `.record_click(slug, section_id, url)`, `.summary(user, days=30) -> SummaryOut`, `.reset(user)`.
  - `source_from_referrer(referrer: str) -> str` — the same buckets as `src/lib/analytics.ts`: `WhatsApp`, `LinkedIn`, `X`, `Email`, `Direct`, else the bare hostname.
  - `SummaryOut`: `{views: dict[str,int], clicks: dict[str, dict[str,int]], sources: dict[str, dict[str,int]], totals: {views:int, clicks:int}}` — keyed by slug, the shape `Stats.tsx` already consumes.
  - Recording honours `countVisits`: when the owner has it off, the event is **not** written.

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_analytics.py
import pytest

from app.services.analytics import source_from_referrer


@pytest.mark.parametrize("referrer,expected", [
    ("", "Direct"),
    ("https://www.linkedin.com/feed", "LinkedIn"),
    ("https://l.instagram.com/", "l.instagram.com"),
    ("https://api.whatsapp.com/send", "WhatsApp"),
    ("https://t.co/abc", "X"),
    ("https://x.com/someone", "X"),
    ("https://mail.google.com/", "Email"),
    ("http://localhost:3000/", "Direct"),
    ("not a url", "Direct"),
])
def test_referrer_buckets_match_the_frontends(referrer, expected):
    assert source_from_referrer(referrer) == expected


async def test_a_view_is_counted_and_attributed(client, auth_client, published):
    r = await client.post(f"/api/v1/public/p/{published['slug']}/views",
                          json={"referrer": "https://www.linkedin.com/feed",
                                "dedupeKey": "load-1"})
    assert r.status_code == 202
    s = (await auth_client.get("/api/v1/analytics/summary")).json()
    assert s["views"][published["slug"]] == 1
    assert s["sources"][published["slug"]]["LinkedIn"] == 1


async def test_the_same_dedupe_key_does_not_count_twice(client, auth_client, published):
    for _ in range(3):
        await client.post(f"/api/v1/public/p/{published['slug']}/views",
                          json={"referrer": "", "dedupeKey": "one-load"})
    s = (await auth_client.get("/api/v1/analytics/summary")).json()
    assert s["views"][published["slug"]] == 1


async def test_clicks_are_counted_per_section(client, auth_client, published):
    sid = published["sections"][0]["id"]
    await client.post(f"/api/v1/public/p/{published['slug']}/clicks",
                      json={"sectionId": sid, "url": "https://northwell.in"})
    await client.post(f"/api/v1/public/p/{published['slug']}/clicks",
                      json={"sectionId": sid, "url": "https://northwell.in"})
    s = (await auth_client.get("/api/v1/analytics/summary")).json()
    assert s["clicks"][published["slug"]][sid] == 2
    assert s["totals"]["clicks"] == 2


async def test_count_visits_off_records_nothing(auth_client, client, published):
    await auth_client.patch("/api/v1/account/privacy", json={"countVisits": False})
    await client.post(f"/api/v1/public/p/{published['slug']}/views",
                      json={"referrer": "", "dedupeKey": "k"})
    s = (await auth_client.get("/api/v1/analytics/summary")).json()
    assert s["views"] == {}


async def test_an_empty_summary_is_empty_never_invented(auth_client, published):
    s = (await auth_client.get("/api/v1/analytics/summary")).json()
    assert s == {"views": {}, "clicks": {}, "sources": {},
                 "totals": {"views": 0, "clicks": 0}}


async def test_the_range_window_excludes_older_events(auth_client, client, published, db_session):
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import update
    from app.models import PageView
    await client.post(f"/api/v1/public/p/{published['slug']}/views",
                      json={"referrer": "", "dedupeKey": "old"})
    await db_session.execute(update(PageView).values(
        occurred_at=datetime.now(timezone.utc) - timedelta(days=90)))
    s = (await auth_client.get("/api/v1/analytics/summary?days=30")).json()
    assert s["views"] == {}
    s = (await auth_client.get("/api/v1/analytics/summary?days=365")).json()
    assert s["views"][published["slug"]] == 1


async def test_i_only_see_my_own_analytics(auth_client, other_auth_client, client, published):
    await client.post(f"/api/v1/public/p/{published['slug']}/views",
                      json={"referrer": "", "dedupeKey": "k"})
    assert (await other_auth_client.get("/api/v1/analytics/summary")).json()["views"] == {}


async def test_reset_clears_my_events(auth_client, client, published):
    await client.post(f"/api/v1/public/p/{published['slug']}/views",
                      json={"referrer": "", "dedupeKey": "k"})
    assert (await auth_client.delete("/api/v1/analytics")).status_code == 204
    assert (await auth_client.get("/api/v1/analytics/summary")).json()["views"] == {}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_analytics.py -v`
Expected: FAIL — `ModuleNotFoundError: app.services.analytics`

- [ ] **Step 3: Implement the models and migration**

`page_views` has a unique index on `(portfolio_id, dedupe_key)` so a repeated key is a no-op insert (`ON CONFLICT DO NOTHING`) — this is the server-side equivalent of the `recordedThisLoad` guard, and it also stops a refresh loop inflating a count. Recording returns **202** either way; a visitor must never see an analytics failure.

Run: `cd backend && python -m alembic revision --autogenerate -m "analytics"`

- [ ] **Step 4: Implement the aggregation**

`summary` is two `GROUP BY` queries joined to the caller's portfolios — not a Python loop over event rows.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_analytics.py -v`
Expected: 17 passed (9 parametrised + 8)

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat(backend): view and click events with SQL-aggregated summaries"
```

---

### Task 14: Export and import

**Files:**
- Create: `backend/app/schemas/transfer.py`, `backend/app/services/transfer.py`, `backend/app/api/v1/transfer.py`
- Modify: `backend/app/api/router.py`
- Test: `backend/tests/test_transfer.py`

**Interfaces:**
- Consumes: Task 13.
- Produces: `TransferService.export(user) -> list[dict]` and `.import_(user, payload, mode) -> int` where `mode` is `replace` or `merge`.
- The export array is shaped exactly like the current UI's `exportAll()` so a file exported from the localStorage build imports here. Assets are exported as `{"id", "name", "mime", "size", "url"}`; a legacy `dataUrl` on import is decoded, re-processed through `AssetService`, and stored as a real file.

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_transfer.py
async def test_export_then_import_replace_roundtrips(auth_client):
    await auth_client.post("/api/v1/portfolios", json={
        "name": "F", "slug": "round-trip", "startFrom": {"kind": "founder"}})
    exported = (await auth_client.get("/api/v1/export")).json()
    assert isinstance(exported, list) and len(exported) == 1

    r = await auth_client.post("/api/v1/import",
                               json={"mode": "replace", "portfolios": exported})
    assert r.status_code == 200
    assert r.json()["imported"] == 1
    again = (await auth_client.get("/api/v1/export")).json()
    assert [s["title"] for s in again[0]["sections"]] == \
           [s["title"] for s in exported[0]["sections"]]


async def test_import_replace_removes_what_was_there(auth_client):
    await auth_client.post("/api/v1/portfolios", json={
        "name": "Old", "slug": "old-one", "startFrom": {"kind": "blank"}})
    r = await auth_client.post("/api/v1/import",
                               json={"mode": "replace", "portfolios": []})
    assert r.json()["imported"] == 0
    assert (await auth_client.get("/api/v1/portfolios")).json() == []


async def test_import_merge_keeps_both_and_renames_a_clashing_slug(auth_client):
    first = (await auth_client.post("/api/v1/portfolios", json={
        "name": "Keep", "slug": "keep-me", "startFrom": {"kind": "blank"}})).json()
    exported = (await auth_client.get("/api/v1/export")).json()
    r = await auth_client.post("/api/v1/import",
                               json={"mode": "merge", "portfolios": exported})
    assert r.json()["imported"] == 1
    slugs = sorted(p["slug"] for p in (await auth_client.get("/api/v1/portfolios")).json())
    assert slugs[0] == "keep-me"
    assert slugs[1].startswith("keep-me-")
    assert first["id"] in [p["id"] for p in (await auth_client.get("/api/v1/portfolios")).json()]


async def test_a_legacy_export_with_a_data_uri_becomes_a_real_asset(auth_client):
    import base64, io
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (250, 250), (5, 5, 5)).save(buf, format="PNG")
    data_url = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    legacy = [{
        "id": "old-1", "name": "Legacy", "slug": "legacy-x", "status": "draft",
        "summary": "", "meta": "", "theme": "editorial", "accent": "#ec3013",
        "ground": "light", "font": "archivo",
        "layout": {"roleNav": "tabs", "grid": 2, "density": "standard",
                   "scale": "default", "tracking": "-0.015em"},
        "header": {"name": "L", "current": "", "description": "", "tags": [],
                   "links": [], "portrait": None},
        "sections": [{
            "id": "s1", "title": "With an image", "description": "", "tags": [],
            "links": [], "numbers": [], "dates": [], "quote": None,
            "hidden": False, "kind": "gallery",
            "image": {"name": "old.png", "mime": "image/png",
                      "dataUrl": data_url, "size": len(data_url)},
            "file": None}],
    }]
    r = await auth_client.post("/api/v1/import",
                               json={"mode": "merge", "portfolios": legacy})
    assert r.status_code == 200
    imported = [p for p in (await auth_client.get("/api/v1/portfolios")).json()
                if p["slug"] == "legacy-x"][0]
    image = imported["sections"][0]["image"]
    assert image["url"].startswith("/api/v1/")
    assert "dataUrl" not in image


async def test_import_rejects_a_payload_that_is_not_a_portfolio_list(auth_client):
    r = await auth_client.post("/api/v1/import",
                               json={"mode": "replace", "portfolios": {"nope": 1}})
    assert r.status_code == 422


async def test_import_never_touches_another_users_data(auth_client, other_auth_client):
    theirs = (await other_auth_client.post("/api/v1/portfolios", json={
        "name": "T", "slug": "theirs-keep", "startFrom": {"kind": "blank"}})).json()
    await auth_client.post("/api/v1/import", json={"mode": "replace", "portfolios": []})
    still = (await other_auth_client.get("/api/v1/portfolios")).json()
    assert [p["id"] for p in still] == [theirs["id"]]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_transfer.py -v`
Expected: FAIL — 404 on `/api/v1/export`

- [ ] **Step 3: Implement the service**

Import runs in one transaction: a partial import is worse than a rejected one. On `merge`, a clashing slug gets `-2`, `-3`, … appended rather than failing the whole file. Ids in the payload are **not** trusted — new ids are minted, so importing your own export twice cannot collide.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_transfer.py -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat(backend): export and import, including legacy data-URI assets"
```

---

### Task 15: Dev CLI, README, and a full-suite green run

**Files:**
- Create: `backend/app/cli.py`, `backend/README.md`
- Modify: `backend/app/main.py` (mount `/api/v1` docs description), `backend/.env.example`
- Test: `backend/tests/test_cli.py`

**Interfaces:**
- Consumes: everything.
- Produces: `python -m app.cli create-user --email --password`, `python -m app.cli seed --email` (loads the five portfolios from `src/lib/seed.ts` translated to a Python literal in `app/seed_data.py`), `python -m app.cli reset-db`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_cli.py
async def test_seed_loads_five_portfolios_for_a_user(auth_client, seed_cli):
    await seed_cli()
    rows = (await auth_client.get("/api/v1/portfolios")).json()
    assert len(rows) == 5
    assert all(p["sections"] for p in rows)
    assert len({p["slug"] for p in rows}) == 5
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_cli.py -v`
Expected: FAIL — `ModuleNotFoundError: app.cli`

- [ ] **Step 3: Translate the seed data and implement the CLI**

Read `src/lib/seed.ts` and port the five portfolios verbatim into `app/seed_data.py` as a list of dicts matching the import payload shape, then have `seed` call `TransferService.import_`. Reusing the import path means the seed cannot drift from the schema.

- [ ] **Step 4: Write `backend/README.md`**

Cover: prerequisites, `python -m venv .venv`, install, `createdb facet`, the `.env` keys, `alembic upgrade head`, `uvicorn app.main:app --reload`, `pytest`, and where `/docs` is. State plainly that billing, custom-domain DNS and outbound email are deliberately not implemented.

- [ ] **Step 5: Run the whole suite and the linter**

Run: `cd backend && python -m pytest -v && python -m ruff check app tests`
Expected: every test passes, no lint errors

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat(backend): dev CLI with seed data, and the backend README"
```

---

## Self-Review

**Spec coverage:** Purpose → Tasks 1–15. Async SQLAlchemy → Task 2. Services-not-repositories → the file structure, enforced by the Global Constraints. JSONB value lists → Tasks 4, 9, 10. Analytics as events → Task 13. Server-side privacy → Task 12. Access/refresh token split → Tasks 3, 5. Data model → Tasks 4, 9, 13. Every API row of the spec's table → Tasks 5–14. Uploads → Task 11. Error handling → Task 1, exercised in every later task. Testing → Task 2 fixtures plus a test module per task. Phases 1–2 → Tasks 1–15. Phase 3 (frontend) → the companion plan. Phase 4 (docs) → Task 15 for `backend/README.md`; `CLAUDE.md` belongs to the frontend plan, since that is the change that makes its "Known gaps" section wrong.

**Placeholder scan:** No TBDs. Every code step shows the test code or the exact shape to implement. "Add appropriate error handling" appears nowhere — error cases are named endpoint by endpoint with their status and `code`.

**Type consistency:** `TokenPair`, `DeviceInfo`, `AccessClaims`, `SessionOut`, `AccountOut`, `AssetOut`, `SummaryOut`, `PublicPortfolioOut`, `CamelModel` are each defined once and referenced by the same name afterwards. `get_owned_portfolio` is named identically in Tasks 9–13. `IMAGE_MAX_DIM` / `IMAGE_TARGET_BYTES` / `FILE_MAX_BYTES` match `src/lib/assets.ts`. `KIND_TITLE` and `FOUNDER_TEMPLATE` match `src/lib/store.tsx`. `source_from_referrer` buckets match `src/lib/analytics.ts`.

**One correction found and applied:** Task 8's `delete_account` test creates a portfolio, which does not exist until Task 9. Task 8 Step 5 now marks it `xfail` and Task 9 Step 5 removes the marker.
