# FACET API

The backend for the FACET portfolio builder: FastAPI on PostgreSQL, replacing
the `localStorage`-only storage the frontend shipped with.

## Running it

Prerequisites: Python 3.12+ and a PostgreSQL you can create databases on.

```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"     # macOS/Linux: .venv/bin/python

cp .env.example .env                                 # then edit it
createdb facet                                       # or: psql -c "CREATE DATABASE facet"

.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m uvicorn app.main:app --reload
```

Interactive docs at <http://localhost:8000/docs>, liveness at `/health`.

Set `FACET_JWT_SECRET` to something random before any real use — changing it
later signs everybody out:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

## Tests

```bash
.venv/Scripts/python -m pytest
.venv/Scripts/python -m ruff check app tests
```

The suite creates the database named in `FACET_TEST_DATABASE_URL`, migrates it
with the same Alembic migrations production runs, and drops it at the end.
Each test runs inside a transaction that is rolled back, so tests never see
each other's rows. Uploads go to a temporary directory, never your `media/`.

## Development commands

```bash
.venv/Scripts/python -m app.cli create-user --email you@example.com --password "..."
.venv/Scripts/python -m app.cli seed --email you@example.com
.venv/Scripts/python -m app.cli routes
```

`seed` loads the five demo portfolios. Their content is not maintained here —
`app/seed_data.json` is dumped from the frontend's own `src/lib/seed.ts`:

```bash
node scripts/dump_seed.mjs
```

Re-run that whenever `seed.ts` changes.

## How it is laid out

Three layers, one direction of dependency.

| Path | What lives here |
|---|---|
| `app/api/v1/` | Routers. Parse, authorize, respond. No business logic. |
| `app/services/` | Business logic. Owns the `AsyncSession`. Never imports from `app/api/`. |
| `app/models/` | SQLAlchemy tables. Knows nothing about HTTP. |
| `app/schemas/` | Pydantic request/response models, camelCase on the wire. |
| `app/core/` | Config, errors, logging, security. Knows nothing about the domain. |
| `app/db/` | Engine, session, declarative base. |

Two rules worth stating because they are easy to break:

- **Ownership is decided in `app/api/deps.py`, nowhere else.** A router asks
  for the portfolio it is about and gets the caller's row or a 404. Another
  user's row is **404, never 403** — a 403 confirms the row exists.
- **Every error is one envelope.** Branch on `code`; `message` is written to
  be shown to a person.

```json
{"error": {"code": "slug_taken",
           "message": "That address is already in use.",
           "details": {"slug": "rohan"},
           "request_id": "01a0..."}}
```

Every response carries `X-Request-ID`, and it is the same id the logs use.

## Things worth knowing

**Two kinds of token.** Access tokens are short-lived JWTs sent as
`Authorization: Bearer`. Refresh tokens are opaque random strings stored as a
hash on `auth_sessions`, returned **only** as an httpOnly cookie, and rotated
on every use. Presenting an already-rotated token is treated as a leak: every
session for that user is revoked. Revoking a session takes effect immediately,
because the session row is checked on every request rather than trusting the
access token's lifetime.

**Slugs are global and nested.** The address is `facet.page/<slug>` with
nothing in front, so two accounts cannot both hold `rohan`; and `rohan/investors`
is a normal slug, because the published route is a catch-all.

**Uploads are sniffed, not trusted.** The declared `Content-Type` is a hint.
Images are re-encoded as JPEG at up to 1400px, which also strips EXIF — a
phone photo's GPS coordinates do not end up on a public page. Identical bytes
from one user share a single file on disk.

**Analytics are counted, never invented.** `page_views` and `link_clicks` are
append-only events aggregated in SQL. When nothing has happened the summary is
empty. Recording answers 202 whether or not it counted, so a visitor never
sees an analytics decision — including the owner's "count visits" switch
being off, which means no row is written at all.

**An owner's asset URL carries its own signature.** `GET /api/v1/assets/{id}`
accepts either `?t=` — the token `asset_out()` signed the id with — or a bearer
token. The browser fetches these from `<img src>`, which cannot send an
`Authorization` header. `FACET_ASSET_URL_TTL_MINUTES` sets how long one lasts.

**Privacy is enforced here, not in the page.** `GET /api/v1/public/p/{slug}`
applies all four switches: `showContact` off removes header links from the
response body, `indexable` off sets `X-Robots-Tag: noindex`, hidden sections
never serialise, and an asset is publicly readable only while a live page
references it.

## Deliberately not implemented

Three `/account` groups need third-party services this project has not chosen.
Their settings are stored and change nothing, and both the API docs and the UI
say so plainly:

- **Billing** — needs a payment processor.
- **Custom domains** — needs DNS and a host.
- **Email notifications** — needs a mail service.

Two-step verification is *not* on that list: TOTP needs nobody else, so it is
genuinely implemented, along with single-use recovery codes.

If you add one of these backends, delete the corresponding `<ServerNotice>`
from the frontend in the same change. A stale notice is a defect.

## Storage

Uploads go to `FACET_MEDIA_ROOT` (default `backend/media/`) behind the
interface in `app/services/storage.py` — `put`, `open`, `delete`, `exists`.
S3 can implement that interface without a service noticing. Files on a local
disk do not survive a redeploy on an ephemeral filesystem.
