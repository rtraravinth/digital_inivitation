# Publishing the Resume on Its Own — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the resume its own published state and public address, and
make "published" the only way to a resume PDF.

**Architecture:**
- **Backend:**
  - A `resume_status` column sits beside `status`.
  - Publish and unpublish routes for the resume.
  - The freeze applies under either status.
  - A public resume endpoint returns only what prints, with only the
    contact details the owner ticked.
- **Frontend:**
  - A server-rendered `/p/<sub>/<slug>/resume` route.
  - The owner's print route is gated on the resume being live.
  - The builder loses its download and gains a watermark.
  - The editor's Publish opens a dialog with Page and Resume ticks.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, pydantic 2, pytest; Next.js
16 (app router, server components), React 19, TypeScript.

**Spec:** `docs/superpowers/specs/2026-11-15-publish-resume-design.md`

## Global Constraints

- **Resume status:** `resume_status` is `"draft"` or `"live"`, not null,
  server default `"draft"`. Every existing row is `draft`.
- **Wire names:** `resumeStatus`, and in the resume JSON
  `publicContact: {email, phone, location, website}`, all booleans,
  default `true`.
- **Resume-only fields:** `publicContact` joins `RESUME_ONLY_FIELDS`, so
  it can change while the resume is live.
- **409 code:** every refused write answers `portfolio_published`, the
  existing code.
- **Unticked contact details:** the public API leaves them out. An
  unticked one is sent as `""`, never as the value.
- **Header links on the public resume:** they follow the `website` tick.
- **Search engines:** the public resume always sets `robots: noindex,
  nofollow`.
- **Imports:** an import lands with `resumeStatus: "draft"` unless
  `trusted`.
- **Old app-host addresses:** a resume address on the app's host
  (`/p/<sub>/<slug>/resume`) 308-redirects to the subdomain, as the page
  does.
- **Building links:** every visitor-facing resume link is built by
  `resumeUrl()` in `src/lib/slug.ts`. Never hand-write `/p/` into one.
- **Unused exports:** knip fails on an unused export, so export only what
  another module imports.
- **Backend tests:** run with `FACET_DOMAIN_CNAME_TARGET=` set to empty.
  The local `.env` breaks `test_no_root_domain_means_no_records`.
- **Commits:** do not commit or push unless the user asks. "Commit" steps
  below mean "stage and stop" until the user says otherwise.

## Review Focus

1. **A resume published while the page stays a draft.** The page address
   must still 404, and the resume address must answer.
2. **Unpublishing the page while the resume stays live.** Editing must
   stay frozen, and the editor must still show the lock.
3. **A portrait on a resume-only portfolio.** It must load on the public
   resume, and must 404 once the resume is unpublished or the photo is
   switched off.
4. **The owner unticks phone while the resume is live.** The PUT must
   succeed (it is a resume-only field), and the next public read must
   carry `phone: ""`.
5. **`updatePortfolio` in the same batch as a status change.** A patch
   must never be sent while either status is live, so it unpublishes
   both first and republishes after.

---

### Task 1: Resume status, its routes, and the freeze (backend)

**Files:**
- Create: `backend/alembic/versions/d7a2c9e4f150_resume_status.py`
  (`down_revision = "c3e8a5f1b7d2"`)
- Modify:
  - `backend/app/models/portfolio.py`: `resume_status` column plus a
    check constraint `resume_status_is_known`.
  - `backend/app/models/enums.py`: `RESUME_STATUSES = ("live", "draft")`.
  - `backend/app/schemas/portfolio.py`: `PortfolioOut.resume_status:
    Literal["live", "draft"]`, and the same on `PortfolioSummaryOut`.
  - `backend/app/services/portfolio.py`: `publish_resume()`,
    `unpublish_resume()`, and `update_resume()` guarded on
    `is_frozen()`.
  - `backend/app/api/deps.py`: `get_editable_portfolio` refuses when
    `is_frozen(portfolio)`.
  - `backend/app/api/v1/portfolios.py`: two routes.
  - `backend/app/services/transfer.py`: `resume_status` on import.
- Test: `backend/tests/test_publish_resume.py` (new).

**Interfaces:**
- Produces:
  - `def is_frozen(portfolio: Portfolio) -> bool` in
    `app/services/portfolio.py`. True when `status == "live"` or
    `resume_status == "live"`.
  - `POST /api/v1/portfolios/{id}/resume/publish` and
    `POST /api/v1/portfolios/{id}/resume/unpublish`. Both take
    `OwnedPortfolio` and return `PortfolioOut`.

- [ ] **Step 1: Write failing tests** in `tests/test_publish_resume.py`:
  - `test_a_new_portfolio_has_a_draft_resume`:
    `GET /portfolios/{id}` gives `resumeStatus == "draft"`.
  - `test_publishing_the_resume_leaves_the_page_a_draft`: after
    `POST …/resume/publish`, `resumeStatus == "live"`, `status != "live"`,
    and `GET /public/p/{TEST_SUBDOMAIN}/{slug}` is 404.
  - `test_a_live_resume_freezes_sections`: with the resume live,
    `PATCH …/sections/{sid}` with `{"title": "x"}` answers 409 with code
    `portfolio_published`.
  - `test_a_live_resume_still_takes_resume_only_fields`: with the resume
    live, `PUT …/resume` with `{"style": {...}}` is 200. A changed
    `skills` is 409.
  - `test_unpublishing_the_page_keeps_a_live_resume_frozen`: publish
    both, unpublish the page, then the `PATCH` above is still 409.
  - `test_an_import_lands_with_a_draft_resume`: import a payload with
    `"resumeStatus": "live"`; the result has `resumeStatus == "draft"`.
- [ ] **Step 2: Run them.**
  `cd backend && FACET_DOMAIN_CNAME_TARGET= .venv/bin/python -m pytest tests/test_publish_resume.py -q`
  Expected: failures (`resumeStatus` missing; routes 404 or 405).
- [ ] **Step 3: Implement.**
  - **Migration:** `op.add_column` with
    `server_default=sa.text("'draft'")`, plus the check constraint. Name
    it through the metadata convention, as `a1d4f7c9e2b6` did. The
    downgrade drops both.
  - **Service:** `publish_resume` and `unpublish_resume` mirror
    `publish` and `unpublish`, setting `resume_status` and calling
    `_touch()`.
  - **`update_resume`:** swap its `portfolio.status == "live"` check for
    `is_frozen(portfolio)`.
  - **`get_editable_portfolio`:** same swap. Its message becomes
    "Unpublish this page and resume before you edit them."
  - **Transfer:** read `resumeStatus` only when `trusted`; otherwise use
    `"draft"`.
- [ ] **Step 4: Run the new file and the full suite.**
  `FACET_DOMAIN_CNAME_TARGET= .venv/bin/python -m pytest -q`
  Expected: all pass.
- [ ] **Step 5: Run the migration round trip** on a scratch database
  (create `facet_migcheck`, then upgrade head, `alembic check`, downgrade
  base, upgrade head, then drop it).
  Expected: one head, "No new upgrade operations detected."
- [ ] **Step 6: Stage.**

### Task 2: Public contact ticks and the public resume endpoint (backend)

**Files:**
- Modify:
  - `backend/app/schemas/resume.py`: add `PublicContact` and
    `Resume.public_contact`, add it to `RESUME_ONLY_FIELDS`, and add
    `PublicResumeOut`.
  - `backend/app/api/v1/publish.py`: two GET routes, and widen
    `_is_on_a_published_page` to cover the portrait.
  - `backend/app/services/ats.py`: no change; reuse `prints_on_resume()`
    and `LISTS`.
- Test: `backend/tests/test_publish_resume.py`.

**Interfaces:**
- Consumes: `is_frozen` (Task 1), and `prints_on_resume(block, hidden)`
  from `app/services/ats.py`.
- Produces:
  - `GET /api/v1/public/p/{subdomain}/{slug}/resume` and
    `GET /api/v1/public/domains/{domain}/{slug}/resume`. Mirror the
    existing domain read's path shape; check `publish.py` for the exact
    prefix. Both return `PublicResumeOut` and 404 unless
    `resume_status == "live"`.
  - `PublicResumeOut` (camelCase on the wire):
    - `name: str`, the portfolio's name;
    - `slug: str`;
    - `header`: `{name, current, description, links, portrait}`, where
      `portrait` is an `AssetOut` with a public URL or `null`;
    - `sections: list[SectionOut]`: only sections with
      `on_resume=True`, each with `blocks` filtered by
      `prints_on_resume`, `images: []` and `hidden: false`;
    - `resume: Resume`: the full stored resume, with each unticked
      contact field replaced by `""`;
    - `subdomain: str`.

- [ ] **Step 1: Write failing tests:**
  - `test_a_draft_resume_is_404`: the public resume URL of a fresh
    portfolio is 404.
  - `test_a_live_resume_is_readable_without_a_token`: publish the resume
    and read it with the anonymous `client`; 200, and `header.name`
    matches.
  - `test_an_unticked_contact_detail_never_leaves`:
    - PUT a resume with `phone="+91 98000 00000"` and
      `publicContact.phone=false`, then publish.
    - The public body has `resume.phone == ""`, and the raw response
      text does not contain `"98000"`.
  - `test_unticking_while_live_takes_effect`:
    - Publish, then PUT only `publicContact.email=false`; that is 200.
    - The next public read has `resume.email == ""`.
  - `test_only_printing_components_are_sent`:
    - A section with `onResume=True` holds a text block (`onResume:
      true`) and a stats block (`onResume: false`); a second section has
      `onResume=False`.
    - The public body has one section with one block, of type `"text"`.
  - `test_header_links_follow_the_website_tick`: with
    `publicContact.website=false`, `header.links == []`.
  - `test_the_portrait_serves_only_while_the_resume_is_live_with_the_photo_on`:
    - Upload a portrait, set `style.photo=true` and publish the resume;
      `/public/assets/{id}` is 200.
    - After unpublishing the resume it is 404.
    - Publish again with `style.photo=false`; it is 404.
- [ ] **Step 2: Run them.** Expected: failures.
- [ ] **Step 3: Implement.**
  - Load the portfolio with the same eager options as `_load_published`,
    filtered on `resume_status == "live"` instead of `status`.
  - Build the response through `SectionOut` and `asset_out(...,
    public=True)` (check the signature in `app/schemas/asset.py`), the
    way `read_published` builds its payload.
  - `_is_on_a_published_page` also returns true when the asset is the
    header's `portrait_asset_id` of a portfolio with
    `resume_status == "live"` and `resume->'style'->>'photo' = 'true'`.
  - Send the response with `X-Robots-Tag: noindex, nofollow`.
- [ ] **Step 4: Run the full suite, `ruff format --check` and
  `ruff check`.** Expected: clean.
- [ ] **Step 5: Stage.**

### Task 3: Types, store and links (frontend)

**Files:**
- Modify:
  - `src/lib/types.ts`: `Portfolio.resumeStatus: PortfolioStatus`,
    `PublicContact`, `Resume.publicContact`, and backfills in
    `normalize()` and `normalizeResume()`.
  - `src/lib/store.tsx`: `updatePortfolio`.
  - `src/lib/slug.ts`: `resumeUrl`.
  - `src/lib/published.ts`: `fetchPublishedResume` and
    `fetchPublishedResumeOnDomain`.

**Interfaces:**
- Consumes: the routes from Tasks 1 and 2.
- Produces:
  - `export type PublicContact = { email: boolean; phone: boolean;
    location: boolean; website: boolean }`.
  - `export function resumeUrl(subdomain: string, slug: string): string`,
    which is `liveUrl(subdomain, slug) + "/resume"`.
  - `export async function fetchPublishedResume(subdomain: string, slug:
    string): Promise<Portfolio | null>`. It returns `normalize()` of the
    payload laid over a blank portfolio (`status: "draft"`,
    `resumeStatus: "live"`), so `ResumeDocument` can draw it unchanged.
    `fetchPublishedResumeOnDomain(domain, slug)` is the same for a custom
    domain.

- [ ] **Step 1: Implement the types and normalizers.** `resumeStatus`
  defaults to `"draft"` and `publicContact` defaults to all `true`. Add
  `publicContact` to the resume PUT body wherever `updateResume`
  serialises it; check that it sends the whole resume.
- [ ] **Step 2: Rework `updatePortfolio`'s sequence:**
  - **First:** unpublish whichever of the page and the resume was live
    before (`/unpublish`, `/resume/unpublish`).
  - **Then:** the core and header patches, as now.
  - **Last:** publish whichever is live after (`/publish`,
    `/resume/publish`).

  A status that is live both before and after with patches in between
  is unpublished and republished. Keep the existing comment's reasoning
  and extend it.
- [ ] **Step 3: Implement `resumeUrl` and both fetchers.** Use
  `API_INTERNAL_URL` and the fallback, the way `fetchPublished` does.
- [ ] **Step 4: Run `npm run typecheck`, `npm run lint` and
  `npm run knip`.** Expected: clean. Lint stays at 0 errors.
- [ ] **Step 5: Stage.**

### Task 4: The public resume page

**Files:**
- Create:
  - `src/app/p/[subdomain]/[slug]/resume/page.tsx`
  - `src/app/d/[domain]/[slug]/resume/page.tsx`
  - `src/components/resume/PublicResume.tsx` (client)
- Modify:
  - `src/proxy.ts`: extend the 308 regex to keep a trailing `/resume`.
  - `src/components/resume/ResumePrint.tsx`: extract its
    print-on-load behaviour if `PublicResume` needs it.

**Interfaces:**
- Consumes: `fetchPublishedResume`, `fetchPublishedResumeOnDomain` and
  `resumeFileName(p)` (Task 3), and `ResumeDocument`.
- Produces: `export function PublicResume({ p }: { p: Portfolio })`:
  - a "Download PDF" bar above the sheet, hidden in print, that calls
    `window.print()`;
  - the sheet itself;
  - with `?print=1`, the print dialog once fonts and the photo have
    loaded, as `ResumePrint` does today;
  - the `@page` size and margin, and the document title from
    `resumeFileName(p)`, as `ResumePrint` writes them.

- [ ] **Step 1: Build both server pages.** Each fetches, calls
  `notFound()` on `null`, and renders `<PublicResume p={p} />`.
  `generateMetadata` returns `{ title: resumeFileName(p), robots: {
  index: false, follow: false } }`. No `AuthGuard`.
- [ ] **Step 2: Update the proxy.** The regex
  `^\/p\/([^/]+)\/([^/]+)(\/resume)?\/?$` redirects to the subdomain,
  keeping `/resume`.
- [ ] **Step 3: Check by hand.** With the API running and a resume
  published, open `http://<sub>.localhost:3000/<slug>/resume`.
  Expected:
  - the sheet renders with the PDF bar;
  - `?print=1` opens the print dialog;
  - the page has `<meta name="robots" content="noindex, nofollow">`;
  - a draft resume's address gives the 404 page.
- [ ] **Step 4: Run typecheck, lint and knip, then stage.**

### Task 5: Owner print gate and the builder

**Files:**
- Modify:
  - `src/components/resume/ResumePrint.tsx`: a gate when not live.
  - `src/components/resume/ResumeStudio.tsx`: remove `download`; add a
    live-only download and link.
  - `src/components/resume/ResumeSheet.tsx`: a watermark prop.
  - `src/app/resume.css`: `.r-watermark`.

**Interfaces:**
- Consumes: `resumeUrl` (Task 3) and `resumePrintPath(id)`.
- Produces: `ResumeSheet` gains `watermark?: boolean`.

- [ ] **Step 1: Gate the owner's print page.** When
  `p.resumeStatus !== "live"`, `ResumePrint` renders no sheet and no
  print call. It shows a message with exact copy "Publish your resume to
  download it." and a link to `/editor/<id>`, labelled "Go to publish".
- [ ] **Step 2: Rework the builder.**
  - Delete the builder's `download` element.
  - When `p.resumeStatus === "live"`, the top bar shows "Download PDF"
    (`resumePrintPath(p.id)`) and "Copy resume link" (`resumeUrl`).
  - Otherwise it shows a muted "Publish to download" link to
    `/editor/<id>`.
- [ ] **Step 3: Add the watermark.**
  - `ResumeSheet` with `watermark` overlays an absolutely positioned
    element: diagonal "PREVIEW", `pointer-events: none`,
    `display: none` in `@media print`.
  - It must not change the sheet's height or page count.
  - The builder passes `watermark={p.resumeStatus !== "live"}`.
  - The template thumbnails do not pass it.
- [ ] **Step 4: Check by hand.**
  - A draft shows the watermark and no download.
  - `/resume/<id>` on a draft shows the gate.
  - A live resume shows "Download PDF", and the PDF has no watermark.
- [ ] **Step 5: Run typecheck, lint and knip, then stage.**

### Task 6: Publish dialog, publish screen, list and share

**Files:**
- Create: `src/components/PublishDialog.tsx`
- Modify:
  - `src/components/Editor.tsx`: Publish opens the dialog; show the lock
    when either status is live.
  - `src/components/PublishedLock.tsx`: per-thing rows.
  - `src/components/PortfolioList.tsx`: pills, and the card's live
    actions.
  - `src/components/ShareDialog.tsx`: the resume address.
  - Plus every `status === "live"` check that means "frozen". Grep
    `status === "live"` under `src/components` and decide each one: it
    becomes `isFrozen(p)` (added to `types.ts`) or stays page-only.

**Interfaces:**
- Consumes: `updatePortfolio`, `updateResume`, `resumeUrl`, `liveUrl`
  and `resumePrintPath`.
- Produces:
  - `export function isFrozen(p: Portfolio): boolean` in `types.ts`.
  - `export function PublishDialog({ p, onClose }: { p: Portfolio;
    onClose: () => void })`.

- [ ] **Step 1: Build `PublishDialog`.**
  - Two checkboxes: "Page" and "Resume", both ticked by default.
  - Under "Resume", one tick per non-empty contact detail, each labelled
    with its value: "Email · a@x.com", "Phone · +91 98…",
    "Location · …", and "Website and links". Initial values come from
    `p.resume.publicContact`.
  - A "Publish" button, disabled when neither box is ticked. It first
    `updateResume`s `publicContact` (a resume-only field), then
    `updatePortfolio`s `status` and `resumeStatus` for what is ticked.
  - Use the existing `Modal` from `ui.tsx` and a `useId()` suffix on
    every name.
- [ ] **Step 2: Update `PublishedLock`.**
  - **Rows:** one row each for "Page" and "Resume", each with its
    address and "Copy link".
  - **The Resume row** also has "Download PDF" and a "Contact details"
    line. It lists what visitors see and links to edit the ticks:
    re-open `PublishDialog` showing only the contact ticks, which saves
    through `updateResume`.
  - **Not live:** a row that isn't live shows "Publish page" or
    "Publish resume" instead.
  - **Unpublish:** each row has its own "Unpublish". The page's existing
    "Unpublish to edit" means both.
  - Remove the old "Resume PDF" link block.
- [ ] **Step 3: Update `PortfolioList`.**
  - Show "Page live" and "Resume live" pills.
  - The live-card actions (Preview, Unpublish, no Edit) apply when
    `isFrozen(p)`.
  - Share is offered when either is live.
  - `ShareDialog` lists whichever addresses are live (page and/or
    resume), and its filter becomes `isFrozen`.
- [ ] **Step 4: Check by hand.**
  - Publish only the resume: the lock shows the Resume row live and
    "Publish page".
  - Unpublish the resume: the editor opens.
  - Untick phone in the lock's contact line: the public resume drops
    the phone.
- [ ] **Step 5: Run typecheck, lint and knip, then stage.**

### Task 7: Docs, seed, scan

**Files:**
- Modify:
  - `CLAUDE.md`
  - `src/lib/seed.ts`, if it sets `status`. Leave `resumeStatus` to
    default unless the seed's founder should show a live resume. Do not
    change the seed unless asked.

- [ ] **Step 1: Update CLAUDE.md.**
  - **"The resume"** gets a "Published on its own" bullet: the address,
    the ticks, the noindex, the owner gate and the watermark.
  - **"A live portfolio is frozen"** reads "either live".
  - **The contact line:** the sentence saying the resume's contact line
    "never leaves the account" becomes "leaves only when ticked on a
    published resume".
  - **Test count:** update it.
- [ ] **Step 2: Re-run `node backend/scripts/dump_seed.mjs`.** Expected:
  no diff, or only a `resumeStatus` diff.
- [ ] **Step 3: Run the CodeQL steps from AGENTS.md.** Expected: no
  finding of 7.0 or above.
- [ ] **Step 4: Run `graphify update .` and the full checks.**
  - `npm run typecheck`, `npm run lint`, `npm run knip`
  - backend pytest
  - `ruff format --check`
  - Expected: clean.
- [ ] **Step 5: Report to the user and ask before committing.**
