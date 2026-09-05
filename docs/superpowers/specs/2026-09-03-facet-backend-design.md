# FACET backend — design

Date: 2026-09-03
Status: approved

## Purpose

FACET is a multi-role portfolio builder whose only backend today is
`localStorage`. Every portfolio, upload and view count lives in one browser,
uploads are squeezed into a ~5MB origin budget as data URIs, and half of
`/account` renders a notice saying the feature it describes needs a server
that does not exist.

This design replaces that with a FastAPI service on PostgreSQL and rewires the
Next.js frontend to it. When it ships:

- Portfolios follow the user, not the browser.
- Uploads are real files with real dimensions, not base64 crammed under a quota.
- Analytics are per-page and durable rather than per-device.
- Sign-in, sessions on other devices, two-step and recovery codes stop being
  decorative. Billing, custom-domain DNS and outbound email stay decorative,
  because they need third parties this project has not chosen.

## Non-goals

- No payment processor, no DNS/host automation, no mail service. The three
  `/account` groups that need them keep their `ServerNotice`.
- No object storage. Assets go to local disk behind a storage interface that
  S3 can implement later.
- No containers. Local PostgreSQL and a `.env` file.
- No multi-tenant/team features. One user owns their own portfolios.

## Decisions

**Async SQLAlchemy 2.0 + asyncpg.** FastAPI is async; a sync driver would
block the event loop on every query.

**Services, not repositories.** Routers do HTTP (parse, authorize, respond),
services hold business logic and own the SQLAlchemy session, models are
declarative. A repository layer between service and model earns nothing at
this size and doubles the files to read.

**Value lists stay JSONB.** `tags`, `links`, `numbers`, `dates`, `quote`,
`layout`, `notifications` and `privacy` are stored as JSONB and validated by
Pydantic on the way in and out. They are ordered lists always read with their
parent and never queried across rows; five more tables with their own CRUD
would buy nothing. `image`, `file` and `portrait` are the exception — they
become foreign keys to `assets`, because an asset is a real row with bytes
behind it and a lifecycle of its own.

**Analytics are append-only events, aggregated in SQL.** `page_views` and
`link_clicks` are event rows, not counters. Counters cannot answer "last 30
days", cannot be corrected, and lose the referrer. This preserves the existing
project rule that analytics are counted, never invented.

**Privacy is enforced server-side.** `GET /public/p/{slug}` applies all four
privacy switches before serialising. With `showContact` off the header links
are absent from the response body, not hidden by CSS.

**Access token in memory, refresh token in an httpOnly cookie.** A refresh
token in `localStorage` is readable by any injected script. The cookie is
`httpOnly`, `SameSite=Lax`, and CORS is configured with an explicit origin and
credentials rather than a wildcard.

**The frontend keeps `useSyncExternalStore`.** `store.tsx` and `account.ts`
retain their external-store shape. Their `commit()` becomes optimistic local
update, then an API call, then rollback on failure, reusing the error banner
that already exists so a failed save is still never silent. Moving to
`setState`-in-`useEffect` is not an option: the React Compiler lint rule
rejects it, and the project instructions say so explicitly.

## Architecture

```
backend/
  pyproject.toml  alembic.ini  .env.example  README.md
  alembic/env.py  alembic/versions/
  app/
    main.py                 app factory, lifespan, CORS, middleware, handlers
    cli.py                  seed / create-user dev commands
    core/     config.py  security.py  errors.py  logging.py  ids.py
    db/       base.py  session.py
    models/   user.py  auth_session.py  account.py  portfolio.py
              section.py  asset.py  analytics.py
    schemas/  common.py  auth.py  account.py  portfolio.py  section.py
              asset.py  analytics.py  publish.py  transfer.py
    services/ auth.py  account.py  portfolio.py  section.py  asset.py
              analytics.py  transfer.py  storage.py
    api/      deps.py  router.py
              v1/  auth.py  account.py  portfolios.py  sections.py
                   assets.py  publish.py  analytics.py  transfer.py
  tests/      conftest.py  factories.py  test_<router>.py
```

Each unit has one job. `core/` knows nothing about the domain. `models/`
knows nothing about HTTP. `services/` never imports from `api/`. `api/v1/`
routers never touch a model attribute they did not get through a service.

## Data model

- `users` — email (unique, lowercased), password_hash (argon2id), is_active,
  timestamps.
- `account_profiles` — 1-1 with users: name, handle (unique), current, about,
  tags, links, portrait_asset_id.
- `account_settings` — 1-1 with users: plan, custom_domain, notifications,
  privacy, phone, two_step_secret, two_step_enabled, google_linked,
  password_changed_at.
- `auth_sessions` — refresh-token hash, device label, user agent, ip,
  created_at, last_seen_at, revoked_at. This table is what makes the
  "other devices" list and its revoke button real.
- `recovery_codes` — argon2 hash per code, used_at. Single use.
- `portfolios` — user_id, name, slug (unique), status, summary, meta, theme,
  accent, ground, font, layout, published_at.
- `portfolio_headers` — 1-1 with portfolios.
- `sections` — portfolio_id, position, title, description, tags, links,
  numbers, dates, quote, hidden, kind, image_asset_id, file_asset_id.
- `assets` — user_id, kind, original_name, mime, byte_size, width, height,
  sha256, storage_key.
- `page_views` — portfolio_id, source, referrer_host, dedupe_key, occurred_at.
- `link_clicks` — portfolio_id, section_id, target_url, occurred_at.

Positions are integers, normalised to a dense 0..n-1 sequence inside the
transaction on every write, so a reorder can never leave gaps or duplicates.

## API surface (`/api/v1`)

| Group | Endpoints |
|---|---|
| auth | `POST register`, `POST login`, `POST refresh`, `POST logout`, `GET sessions`, `DELETE sessions/{id}`, `DELETE sessions`, `POST password`, `POST two-step/enable`, `POST two-step/verify`, `POST two-step/disable`, `POST recovery-codes` |
| account | `GET me`, `PATCH me`, `PATCH account/profile`, `PATCH account/security`, `PATCH account/plan`, `PATCH account/domain`, `PATCH account/notifications`, `PATCH account/privacy`, `DELETE account` |
| portfolios | `GET /portfolios`, `POST /portfolios`, `GET /portfolios/{id}`, `PATCH /portfolios/{id}`, `DELETE /portfolios/{id}`, `PATCH /portfolios/{id}/header`, `POST /portfolios/{id}/publish`, `POST /portfolios/{id}/unpublish`, `GET /portfolios/slug-available` |
| sections | `POST /portfolios/{pid}/sections`, `PATCH /portfolios/{pid}/sections/{sid}`, `DELETE /portfolios/{pid}/sections/{sid}`, `POST /portfolios/{pid}/sections/{sid}/move`, `PUT /portfolios/{pid}/sections/order` |
| assets | `POST /assets`, `GET /assets/{id}`, `DELETE /assets/{id}` |
| public | `GET /public/p/{slug}`, `GET /public/assets/{id}`, `POST /public/p/{slug}/views`, `POST /public/p/{slug}/clicks` |
| analytics | `GET /analytics/summary`, `DELETE /analytics` |
| transfer | `GET /export`, `POST /import` |

`POST /portfolios` accepts `start_from` of `blank`, `copy` (with a source id)
or `founder`, matching the three options in the existing create dialog.

`GET /export` emits the same JSON array shape the current UI exports, so an
export taken before this change still imports after it.

## Uploads

`POST /assets` takes multipart. The mime type is sniffed from the bytes, not
read from the client. Images are downscaled to 1400px on the long edge and
re-encoded as JPEG (SVG passes through); other attachments are capped. The
same limits as `lib/assets.ts` apply as an upper bound, but they are no longer
a storage ceiling — they are a sanity check. `sha256` deduplicates identical
uploads to one file on disk. `storage.py` exposes `put`, `open`, `delete` and
`url_for`; the local-disk implementation is the only one today.

## Error handling

A single `AppError` base carries `status_code`, `code`, `message` and
`details`. Subclasses: `Unauthenticated`, `PermissionDenied`, `NotFound`,
`Conflict`, `PayloadTooLarge`, `UnsupportedMedia`, `RateLimited`.

Handlers are registered for `AppError`, `RequestValidationError`,
`StarletteHTTPException`, `IntegrityError` and a catch-all for unhandled
exceptions that logs with the request id and returns a generic message —
internal detail never reaches a client. Every error response is one envelope:

```json
{"error": {"code": "slug_taken",
           "message": "That address is already in use.",
           "details": {"slug": "rohan"},
           "request_id": "01JB..."}}
```

Request-ID middleware assigns an id, puts it in a context var for the logger
and echoes it as `X-Request-ID`. Logging is structured JSON.

Ownership is resolved once in `api/deps.py`: a router asks for the portfolio
it is about and gets either the caller's portfolio or a 404 — never another
user's row, and never a 403 that confirms the row exists.

## Testing

pytest + pytest-asyncio + httpx `AsyncClient` over `ASGITransport`, so tests
exercise the real app with no network. A session-scoped fixture creates a
throwaway database and migrates it with Alembic — the same migrations
production runs, so a broken migration fails the suite. Each test runs in a
transaction that is rolled back afterwards.

Coverage per router group: the happy path, unauthenticated access,
another user's row, invalid payloads, and the conflict case where one exists.

## Frontend rewiring

- `src/lib/api.ts` — new. Typed fetch client, base URL from
  `NEXT_PUBLIC_API_URL`, bearer header, one silent refresh-and-retry on 401,
  errors surfaced as the API's `code`/`message`.
- `src/lib/store.tsx` — same external-store shape. Initial state empty, a
  one-shot load on first `subscribe()`, `commit()` optimistic with rollback.
- `src/lib/account.ts` — the same treatment.
- `src/lib/analytics.ts` — `recordView`/`recordClick` post events; the Stats
  page reads the aggregate endpoint. The empty state stays; figures are never
  generated.
- `src/lib/assets.ts` — uploads multipart and returns the asset row. `Asset`
  gains `id` and `url`; `dataUrl` becomes optional so data stored before this
  change still renders. `normalize()` in `types.ts` backfills it.
- `src/app/p/[...slug]/page.tsx` — a server component fetching
  `GET /public/p/{slug}`. The published page becomes real SSR and is actually
  indexable, which is what the `indexable` privacy switch has been promising.
- New sign-in route and a guard on the authenticated pages.
- `ServerNotice` is deleted from the password, two-step and sessions groups in
  the same change that makes them real, and `CLAUDE.md`'s "Known gaps" and
  "Storage is the constraint" sections are rewritten to match. Leaving a
  stale notice, or a stale doc, is a defect.

## Phases

1. Backend foundation: config, db, errors, logging, models, migrations, auth,
   and the tests for all of it.
2. Remaining routers: portfolios, sections, assets, public/publish,
   analytics, account, transfer — with tests.
3. Frontend rewiring: API client, stores, assets, published SSR, sign-in.
4. Documentation: `CLAUDE.md`, `backend/README.md`, notice cleanup.

## Risks

- **The frontend rewiring is the risky half.** Every page reads one of the two
  stores. Keeping the external-store shape confines the change to `commit()`
  and the initial load, but hydration now depends on a network call that can
  fail, so every consumer needs a real loading and error state rather than the
  synchronous read it has today.
- **Slugs are globally unique.** Two users cannot both hold `rohan`. That is
  inherent to `facet.page/<slug>` and needs the 409 to be legible in the UI.
- **Assets on local disk do not survive a redeploy** on an ephemeral
  filesystem. The storage interface exists so S3 can replace it without
  touching a service.
