# FACET Frontend API Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Next.js frontend off `localStorage` and onto the FACET API, without changing how any page reads its data.

**Architecture:** `store.tsx` and `account.ts` keep their `useSyncExternalStore` shape — only `commit()` and the initial read change. A new typed client in `src/lib/api.ts` owns the access token, the refresh-and-retry, and error translation. The published page becomes a server component that fetches the public endpoint, so it is genuinely server-rendered and genuinely indexable.

**Tech Stack:** Next.js 16.3.2, React 19.2.8, TypeScript 5, Tailwind 4. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-03-facet-backend-design.md`

**Depends on:** `docs/superpowers/plans/2026-09-03-facet-backend-api.md` — complete, 193 tests passing.

## Global Constraints

- **Do not move the stores to `setState`-in-`useEffect`.** The React Compiler lint rule rejects it and `CLAUDE.md` says so explicitly. The external-store shape stays; the load fires on first `subscribe()`.
- **A failed save must never be silent.** The `storageError` banner already exists in the editor and on `/account`; it becomes `syncError` and keeps that job.
- **Analytics stay real.** `/stats` shows an empty state when there is nothing, never a generated figure.
- **The body must never scroll horizontally**, and there is **zero border radius** anywhere — the Modernist system in `globals.css` is unchanged by this work.
- Build with the existing `.btn` / `.tag` / `.input` / `.nav` / `.table` classes. Take every colour from a token.
- **Stop the dev server before `npm run build`** — they share `.next` and contend.
- The API is camelCase on the wire, so response bodies drop into the existing types with no key mapping.
- Verification for every task: `npm run lint` and `npm run build` both clean, plus the stated manual check. The frontend has no test runner and this plan does not add one — say so rather than implying coverage that does not exist.

## File Structure

| Path | Change | Responsibility |
|---|---|---|
| `src/lib/api.ts` | create | Typed fetch client, token handling, one refresh-and-retry, `ApiError` |
| `src/lib/session.tsx` | create | External store for the signed-in user; `useSession()` |
| `src/lib/store.tsx` | modify | Same shape; `commit()` becomes optimistic + API + rollback |
| `src/lib/account.ts` | modify | The same treatment |
| `src/lib/analytics.ts` | modify | Post events, read the summary endpoint |
| `src/lib/assets.ts` | modify | Multipart upload; returns the asset row |
| `src/lib/types.ts` | modify | `Asset` gains `id`/`url`, `dataUrl` optional; `normalize()` backfills |
| `src/app/signin/page.tsx` | create | Sign in / register |
| `src/components/SignIn.tsx` | create | The form, in the Modernist system |
| `src/components/AuthGuard.tsx` | create | Redirects to `/signin` when signed out |
| `src/app/p/[...slug]/page.tsx` | modify | Server component fetching `GET /public/p/{slug}` |
| `src/components/account/panels.tsx` | modify | Delete `ServerNotice` from password/two-step/sessions; wire them |
| `CLAUDE.md` | modify | Rewrite "Storage is the constraint" and "Known gaps" |

---

### Task 1: The API client

**Files:**
- Create: `src/lib/api.ts`
- Create: `.env.local.example`

**Interfaces:**
- Produces:
  - `class ApiError extends Error` with `status: number`, `code: string`, `details: Record<string, unknown>`, `requestId: string`.
  - `api.get<T>(path)`, `api.post<T>(path, body?)`, `api.patch<T>(path, body?)`, `api.put<T>(path, body?)`, `api.del(path)`, `api.upload<T>(path, form)`.
  - `setAccessToken(token: string | null)`, `getAccessToken(): string | null`.
  - `onUnauthenticated(handler: () => void)` — called when a refresh fails, so the session store can clear itself.
  - `API_BASE` from `process.env.NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:8000`.

- [ ] **Step 1: Write the client**

Every request sends `credentials: "include"` (the refresh token is an httpOnly cookie) and, when held, `Authorization: Bearer`. On a 401 with code `token_expired` or `session_revoked`, it calls `POST /auth/refresh` **once**, stores the new access token and replays the original request. A second failure clears the token and fires `onUnauthenticated`.

Concurrent 401s must share one refresh, not fire N of them — hold a module-level `refreshInFlight: Promise<boolean> | null` and await it.

```ts
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
    readonly requestId = "",
  ) {
    super(message);
  }
}
```

Non-2xx bodies always parse as `{error: {code, message, details, request_id}}`; a body that does not (a proxy error page, a network failure) becomes `new ApiError(status, "network_error", "Could not reach the server.")`.

- [ ] **Step 2: Write `.env.local.example`**

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- [ ] **Step 3: Verify**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts .env.local.example
git commit -m "feat(web): typed API client with refresh-and-retry"
```

---

### Task 2: The session store and sign-in

**Files:**
- Create: `src/lib/session.tsx`, `src/components/SignIn.tsx`, `src/components/AuthGuard.tsx`, `src/app/signin/page.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: Task 1.
- Produces: `useSession() -> {user, status, error, signIn, register, signOut, completeTwoStep}` where `status` is `"loading" | "in" | "out"`.

- [ ] **Step 1: Write the session store**

Same external-store shape as `store.tsx`: module-level state, a `Set` of listeners, `useSyncExternalStore`. On first `subscribe()` it calls `POST /auth/refresh` once — that is how a returning visitor with a live cookie is signed straight back in, and it is why the access token never needs to touch `localStorage`.

- [ ] **Step 2: Write the sign-in form**

Email, password, and a register/sign-in toggle. `ApiError.code` drives the message: `invalid_credentials` under the form, `email_taken` under the email field, `validation_failed` mapped by `details.fields[].field`.

A `202` response means two-step: swap to a six-digit code field, keep the `challenge`, and post it to `/auth/login/two-step`. The field accepts a recovery code too — say so under it.

- [ ] **Step 3: Write the guard and apply it**

`AuthGuard` renders children when `status === "in"`, a skeleton while `"loading"`, and redirects to `/signin` when `"out"`. Wrap `/`, `/editor/[id]`, `/builder/[id]`, `/blocks/[id]`, `/themes/[id]`, `/stats`, `/print` and `/account`. **Not** `/p/[...slug]` — that is public and must stay public.

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run build`
Then, with the API running: register at `/signin`, confirm you land on `/`, reload and confirm you stay signed in.

- [ ] **Step 5: Commit**

```bash
git add src/lib/session.tsx src/components/SignIn.tsx src/components/AuthGuard.tsx src/app/signin src/app/layout.tsx
git commit -m "feat(web): session store, sign-in and route guard"
```

---

### Task 3: Assets become real uploads

**Files:**
- Modify: `src/lib/types.ts`, `src/lib/assets.ts`, `src/components/UploadButton.tsx`

**Interfaces:**
- Consumes: Task 1.
- Produces: `Asset` becomes `{id?: string; url?: string; name: string; mime: string; size: number; dataUrl?: string}`.

- [ ] **Step 1: Widen the `Asset` type and backfill in `normalize()`**

`dataUrl` becomes optional so portfolios stored before this change still render; `url` is what new data carries. Everywhere that renders an asset uses `asset.url ?? asset.dataUrl`. Grep for `dataUrl` and change every reading site — `themes.tsx`, `Editor.tsx`, `SectionExtras.tsx`, `panels.tsx`.

- [ ] **Step 2: Replace the client-side downscaling with an upload**

`readImageAsset` and `readFileAsset` become `uploadImage(file)` and `uploadFile(file)`, posting `FormData` to `/assets`. The browser no longer resizes anything — the server does it, better, and strips EXIF while it is there. Keep `formatBytes`; it is still used in the UI.

Map `ApiError` to the messages the upload button already shows: `payload_too_large` and `unsupported_media` both have a human `message` from the API, so show it verbatim.

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build`
Then upload a large photo in the editor and confirm it appears, and that a 5MB PNG now succeeds where it used to fail.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/assets.ts src/components/UploadButton.tsx
git commit -m "feat(web): upload assets to the API instead of encoding data URIs"
```

---

### Task 4: The portfolio store

**Files:**
- Modify: `src/lib/store.tsx`
- Modify: `src/components/PortfolioList.tsx`, `src/components/CreatePortfolioDialog.tsx` (loading and error states)

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `usePortfolios()` keeps its current shape and gains `syncError: string | null` (replacing `storageError`) and keeps `ready`.

- [ ] **Step 1: Replace the module-level bootstrap**

`state` starts `[]`, not `SEED_PORTFOLIOS`. `getServerSnapshot()` returns a stable empty array. On first `subscribe()`, call `GET /portfolios?` and then hydrate; `ready` flips true when that resolves.

The list endpoint returns summaries without sections. `getPortfolio(id)` therefore fetches `GET /portfolios/{id}` on demand and caches it into `state`. Consumers that need sections already call `getPortfolio`.

- [ ] **Step 2: Make `commit()` optimistic with rollback**

Every action applies its change locally, notifies listeners, then calls the API. On `ApiError`, restore the previous state, set `syncError` to `error.message`, and notify again. This keeps the editor's typing latency at zero while never lying about what was saved.

Map each existing action to its endpoint:

| Action | Call |
|---|---|
| `createPortfolio` | `POST /portfolios` with `startFrom` |
| `updatePortfolio` | `PATCH /portfolios/{id}` |
| `deletePortfolio` | `DELETE /portfolios/{id}` |
| `updateSection` | `PATCH /portfolios/{pid}/sections/{sid}` |
| `addSection` / `addBlock` | `POST /portfolios/{pid}/sections` |
| `deleteSection` | `DELETE /portfolios/{pid}/sections/{sid}` |
| `moveSection` | `POST /portfolios/{pid}/sections/{sid}/move` |
| `toggleSectionHidden` | `PATCH .../sections/{sid}` with `hidden` |
| `exportAll` | `GET /export` |
| `importAll` | `POST /import` |
| `resetToSeed` | remove — see Step 3 |

- [ ] **Step 3: Debounce the text fields**

`updateSection` fires on every keystroke today, which was free against `localStorage` and is not free against an API. Debounce the network call by 500ms per section while applying the local change immediately. A pending write must flush on unmount and before navigation, or the last thing typed is lost.

- [ ] **Step 4: Delete `resetToSeed` and its button**

Seeding is a server-side dev command now (`python -m app.cli seed`). A button that silently replaced a user's real portfolios with demo content is not something to keep once the data is real. Remove it from `panels.tsx` too.

- [ ] **Step 5: Verify**

Run: `npm run lint && npm run build`
Then: create a portfolio, edit a section, reload, and confirm it persisted. Stop the API and confirm an edit shows the error banner rather than appearing to save.

- [ ] **Step 6: Commit**

```bash
git add src/lib/store.tsx src/components/PortfolioList.tsx src/components/CreatePortfolioDialog.tsx
git commit -m "feat(web): back the portfolio store with the API"
```

---

### Task 5: The account store

**Files:**
- Modify: `src/lib/account.ts`, `src/components/account/panels.tsx`, `src/components/Account.tsx`

**Interfaces:**
- Consumes: Task 4.
- Produces: `useAccount()` keeps its shape; `updateAccount(recipe)` is replaced by targeted calls, because the API has one endpoint per group rather than one blob write.

- [ ] **Step 1: Load from `GET /account` and split the writes**

`updateProfile`, `updateSecurity`, `setPlan`, `setDomain`, `updateNotifications`, `updatePrivacy` — each optimistic with rollback, exactly as in Task 4.

- [ ] **Step 2: Wire the three groups that are now real**

- **Password** — `POST /auth/password`, with current and new. On success say that other devices were signed out, because they were.
- **Two-step** — `POST /auth/two-step/enable` returns a secret and an `otpauth://` URI. Render the URI as a QR code with the existing `src/lib/qr.ts` encoder — it is already there for `/stats`, and the CSP still rules out a CDN. Then `POST /auth/two-step/verify`.
- **Sessions** — `GET /auth/sessions` for the list, `DELETE /auth/sessions/{id}` per row, `DELETE /auth/sessions` for "sign out everywhere". The current device is labelled and cannot be revoked from its own row.

- [ ] **Step 3: Delete the notices that are now false, and keep the three that are not**

Remove `<ServerNotice>` from the password, two-step and sessions groups. **Keep** it on billing, custom domain and email notifications — those still enforce nothing, and the API's own docs say so. Leaving a stale notice is a defect; removing a true one is worse.

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run build`
Then: change a password and confirm a second browser is signed out; enable two-step, scan the QR with an authenticator, sign out and back in with a code.

- [ ] **Step 5: Commit**

```bash
git add src/lib/account.ts src/components/account src/components/Account.tsx
git commit -m "feat(web): back /account with the API and make password, two-step and sessions real"
```

---

### Task 6: Analytics

**Files:**
- Modify: `src/lib/analytics.ts`, `src/components/Stats.tsx`

**Interfaces:**
- Consumes: Task 5.
- Produces: `recordView(slug)`, `recordClick(slug, sectionId, url)`, `useAnalytics()` returning the same `{views, clicks, sources}` shape plus `loading`.

- [ ] **Step 1: Post events instead of counting locally**

`recordView` generates a per-load `dedupeKey` (`crypto.randomUUID()`, held in the module so a StrictMode double-mount reuses it) and posts to `/public/p/{slug}/views` with `document.referrer`. Failures are swallowed — a visitor must never see an analytics error.

- [ ] **Step 2: Read the summary**

`/stats` calls `GET /analytics/summary?days=30`. Keep the empty state exactly as it is. Keep the on-screen note honest: it currently says figures reflect this browser only, which stops being true — change it to say they are counted across every visitor, and drop the sentence about the browser.

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build`
Then open a published page in a private window and confirm the view appears on `/stats`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/analytics.ts src/components/Stats.tsx
git commit -m "feat(web): record and read analytics through the API"
```

---

### Task 7: The published page becomes server-rendered

**Files:**
- Modify: `src/app/p/[...slug]/page.tsx`
- Modify: `src/components/published/PublishedPage.tsx`, `src/components/published/themes.tsx`

**Interfaces:**
- Consumes: Task 6.
- Produces: the page is an async server component; `PublishedPage` takes the fetched portfolio as a prop instead of reading the store.

- [ ] **Step 1: Fetch on the server**

`await fetch(`${API}/api/v1/public/p/${slug.join("/")}`, {cache: "no-store"})`. A 404 calls `notFound()`. The slug is a catch-all, so `slug.join("/")` is what reconstructs `rohan/investors`.

- [ ] **Step 2: Replace `usePublishedPrivacy`**

The privacy switches now arrive in the payload (`noindex`, `badge`, `showContact`) and the server has already applied them — `header.links` is empty when contact is hidden, and hidden sections are absent. Delete the hook and read the props. This removes the last reason for the published page to touch the account store.

- [ ] **Step 3: Emit real metadata**

Export `generateMetadata`, setting the title from the header name and `robots: {index: false, follow: false}` when `noindex`. This is the point of the whole task: the `indexable` switch has been promising something the client-rendered page could not deliver.

- [ ] **Step 4: Keep the client bits client**

View and click recording, and the section-detail `?section=` view, stay in a small client component nested inside the server one.

- [ ] **Step 5: Verify**

Run: `npm run lint && npm run build`
Then: `curl` a published page and confirm the content is in the HTML source, not just in a script tag. Turn `indexable` off and confirm the meta robots tag appears.

- [ ] **Step 6: Commit**

```bash
git add "src/app/p/[...slug]/page.tsx" src/components/published
git commit -m "feat(web): server-render the published page from the public endpoint"
```

---

### Task 8: Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: Rewrite the sections that are now wrong**

- **"Storage is the constraint"** — replace it. localStorage is no longer the backend and the ~5MB budget no longer applies. Describe the API, where the client lives, and what `commit()` does now.
- **"Known gaps"** — "No server" and "Half of `/account` describes a server that does not exist" are both false now. Replace with what is still true: billing, custom domains and email notifications remain notice-only; the published page still has no signed-out-vs-owner distinction; reordering is still buttons, not drag; the gallery still has seven themes, not twelve.
- Add the backend to **"Running it"**, including that it must be up for the frontend to load anything.

- [ ] **Step 2: Verify**

Re-read `CLAUDE.md` against the code. Every claim it makes should be checkable, and none should describe the localStorage build.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: describe the API-backed build"
```

---

## Self-Review

**Spec coverage:** Every bullet of the spec's "Frontend rewiring" section maps to a task — `api.ts` (1), stores (4, 5), `analytics.ts` (6), `assets.ts` (3), published SSR (7), sign-in (2), notice and doc cleanup (5, 8).

**Placeholder scan:** No TBDs. Each task names its files, its endpoints and its manual check. The absence of a frontend test runner is stated rather than papered over.

**Type consistency:** `ApiError`, `setAccessToken`, `onUnauthenticated`, `useSession`, `syncError` and the widened `Asset` are each defined once and referenced by the same name afterwards. The endpoint table matches the backend plan's surface exactly.

**Three things this plan changes that the spec did not call out**, each because building the backend surfaced them:

1. **Debouncing** (Task 4, Step 3). Per-keystroke writes were free against `localStorage`; against an API they are not.
2. **`resetToSeed` is deleted, not ported** (Task 4, Step 4). Replacing real portfolios with demo content is not a button to keep once the data is real.
3. **`updateAccount(recipe)` is replaced rather than kept** (Task 5). The API has one endpoint per settings group, and a single blob write would have to guess which one changed.
