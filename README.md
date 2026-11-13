# FACET

A multi-role portfolio builder. One page per portfolio: a header, then as many
sections as you need, each with the same four fields — title, description,
tags, links. Keep a full page for everything you do, and short ones for the
rooms where only part of it matters.

Two pieces:

- **`/`** — the Next.js app: the editor, the builder, the theme gallery, stats
  and account.
- **`backend/`** — a FastAPI service on PostgreSQL that owns the data. See
  [`backend/README.md`](backend/README.md).

## Running it

You need Python 3.12+, Node 20+, and a PostgreSQL you can create databases on.

**1. The API**

```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"     # macOS/Linux: .venv/bin/python
cp .env.example .env                                 # then edit it
createdb facet
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m uvicorn app.main:app --reload
```

Docs at <http://localhost:8000/docs>.

**2. The app**

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

Open <http://localhost:3000>, create an account, and you are in. To start with
the demo content instead of an empty page:

```bash
cd backend
.venv/Scripts/python -m app.cli seed --email you@example.com
```

**Stop the dev server before `npm run build`** — they share `.next` and
contend, and a build against a live dev server takes minutes instead of
seconds. If the UI looks unimplemented or your changes are not appearing,
check for an orphaned server first: Next silently starts on 3001 while the
browser keeps hitting a stale one on 3000.

## Checks

```bash
npm run lint
npm run build
cd backend && .venv/Scripts/python -m pytest && .venv/Scripts/python -m ruff check app tests
```

## What is real, and what is not

Real: accounts, sign-in through Firebase Authentication (Google, GitHub,
email and password, email link, phone), the signed-in device list and its
revoke buttons, portfolios,
sections, uploads, publishing, all four privacy switches, view and click
analytics, and export/import.

Not real, and labelled as such on screen: **billing**, **custom domains** and
**email notifications**. Each needs a third-party service this project has not
chosen, so each renders a notice saying the setting is stored and enforces
nothing. If you add one of those backends, delete its notice in the same
change.

## Deploying

The app is a Next.js frontend, a FastAPI backend and a PostgreSQL database.
The `Dockerfile` packs the first two into one container behind one address,
and `render.yaml` describes that container and its database for
[Render](https://render.com):

1. In Render, choose **New → Blueprint** and pick this repository.
2. Approve the two resources it lists (`facet`, `facet-db`) and wait for the
   first deploy.
3. Before the first deploy, fill in the Firebase values it asks for
   (`FACET_FIREBASE_PROJECT_ID` and the four `NEXT_PUBLIC_FIREBASE_*`, from
   Firebase → Project settings → Your apps) and add the `…onrender.com`
   host under Firebase → Authentication → Settings → Authorised domains.
4. Open the service's `…onrender.com` address and sign in. If you set
   `FACET_DEMO_EMAIL`, signing in with that (verified) address claims the
   demo account and its five seeded portfolios.

Every push to the deployed branch redeploys. The blueprint uses Render's free
plan, which sleeps when idle and does not keep uploaded pictures or the
database for long; `render.yaml` says what to change before relying on it.

To run the same container anywhere else:

```bash
docker build -t facet --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=… \
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=… \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID=… \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID=… .
```

```bash
docker run -p 3000:3000 -e FACET_ENV=prod -e FACET_JWT_SECRET=<long random string> -e FACET_DATABASE_URL=postgresql://user:password@host:5432/facet -e FACET_FIREBASE_PROJECT_ID=… facet
```
