@AGENTS.md

# FACET

A multi-role portfolio builder. One page per portfolio: a header, then N
sections, each with the same four fields — title, description, tab, links.
Built from a Claude Design canvas (`Portfolio Page.dc.html`), which now runs
to five turns. Every artboard in it is implemented; the map from artboard to
code is under "Layout" below.

## Running it

Two processes. The frontend does nothing useful without the API.

```
npm run api    # :8000 — uvicorn, bound to every interface
npm run dev    # :3000
```

`npm run api` exists because typing the uvicorn command by hand went wrong
twice: the venv is at `.venv/bin` on Linux and macOS but `.venv/Scripts` on
Windows, and uvicorn binds loopback by default. A loopback bind breaks every
request the moment `NEXT_PUBLIC_API_URL` names a LAN address — opening the app
from a phone — with `ERR_CONNECTION_REFUSED` and nothing in the API's log,
because the connection never arrives. Pass flags through when you need them:
`npm run api -- --host 127.0.0.1`.

```
npm run build
npm run lint
cd backend && .venv/bin/python -m pytest    # 258 tests (.venv/Scripts on Windows)
```

`NEXT_PUBLIC_API_URL` points the frontend at the API; see
`.env.local.example`. `backend/README.md` covers the database and migrations.

**Stop the dev server before `npm run build`.** They share `.next` and
contend; a build against a live dev server can take minutes instead of seconds.

**A stale `next dev` is the most common false alarm here.** If the UI looks
unimplemented or changes don't appear, check for an orphaned server before
debugging anything:

```
netstat -ano | grep LISTENING | grep :300
```

If port 3000 is held by an old process, Next silently starts on 3001 while
your browser keeps hitting the stale server on 3000. Kill it (`taskkill //F
//PID <pid>`) and restart.

## Layout

- `src/lib/types.ts` — `Portfolio` / `Section` / `PortfolioHeader` / `Layout`
  / `AccountSettings`, plus `normalize()`, which backfills fields added after
  data was stored. **Numbers and the timeline live on the header, not on a
  section**: the page draws one "By the numbers" row and one timeline, so a
  per-section copy only had to be gathered back up — and the author had to
  guess which section to type them into. A section's own extras are its
  image, its file and its quote. The editor says which is which: "Add to this
  portfolio (optional)" against the header, "Add to this section (optional)"
  against a section. Extend it whenever you add a field, or data written by an
  older build will break. `assetSrc()` lives here too: it resolves an upload
  whether it carries an API `url` or a pre-backend `dataUrl`.
- `src/lib/api.ts` — the typed API client. Access token in memory, refresh
  token in an httpOnly cookie, one silent retry on a 401.
- `src/lib/session.tsx` — who is signed in; `AuthGuard` wraps every page that
  needs an account. `/p/[...slug]` is deliberately not guarded.
- `src/lib/store.tsx` — an external store read via `useSyncExternalStore`,
  backed by the API. Do **not** move this to `setState`-in-`useEffect` — the
  React Compiler lint rule rejects it, which is why the one-shot load fires on
  first `subscribe()`.
- `src/lib/account.ts` — the same external-store shape for `/account`, with
  one action per settings group because the API has one endpoint per group.
- `src/lib/published.ts` — the server-side fetch behind `/p/[...slug]`.
- `src/lib/qr.ts` — a hand-rolled QR encoder (byte mode, ECC L, versions 1–9,
  mask 0). It exists because the print code on `/stats` has to actually scan
  and the CSP rules out a CDN. Verified against published Reed–Solomon
  generator polynomials and by round-tripping through an independent decoder.
- `src/lib/seed.ts` — the five seeded portfolios. `backend/scripts/dump_seed.mjs`
  transpiles this file and writes `backend/app/seed_data.json`, so the seed is
  not maintained twice; re-run it whenever this changes.
- `src/components/Editor.tsx` — artboards 4b (desktop document) and 4d (mobile),
  sharing one state tree.
- `src/components/builder/` — `Builder.tsx` is artboards 2a (three-pane:
  section rail, live canvas, tabbed inspector) and 2c (mobile control sheet);
  `ThemeGallery.tsx` is 2b; `controls.tsx` holds the Theme / Colour / Type /
  Layout controls **shared** with the editor's drawer so the two cannot drift.
- `src/components/PrintAll.tsx` — `/print` stacks every published page with a
  page break between so the browser's own **Save as PDF** can export them.
  That is what "Download all pages as PDF" on `/account` opens; generating a
  PDF in-process would mean a library, and the themes already print correctly.
- `src/components/account/panels.tsx` + `Account.tsx` — artboards 5a and 5b.
- `src/components/published/themes.tsx` — the published page in seven themes:
  Editorial (1a), Index rail (1b), Poster (1c), Links (3a), Ledger, Dossier,
  Broadsheet. Also `SectionDetail`, artboard 1d, reached at `?section=<id>`.
- `src/app/globals.css` — the Modernist design system: tokens in `@theme`,
  component classes in `@layer components`.

**The live canvas is an iframe, and it has to be.** A theme's `md:` and `lg:`
utilities are media queries, and a media query answers about the *window* — so
a 390px box inside a 1440px window still got the desktop layout, crammed and
overflowing sideways. An iframe has a window of its own, so `Desktop`/`Mobile`
finally previews what the device actually renders. `CanvasFrame` copies this
document's stylesheets into the frame — rendered through a portal, never
appended, because the React Compiler rule rejects mutating a document held in
state — and re-reads them on a `MutationObserver` so dev HMR keeps working.
The page itself is portaled into the frame's body, so it stays in this React
tree: same context, same live edits.

**The phone canvas refuses horizontal swipes.** `Canvas` takes `panX`, and the
mobile sheet passes `false`, which puts `touch-action: pan-y` on the wrapper
*inside* the iframe — the parent cannot govern a gesture that starts in
another document. The canvas fills the middle of that screen and the page
inside it has its own sideways tab row, so a swipe meant to scroll the builder
dragged that row instead. Taps still land: `touch-action` does not affect
them, and `pointer-events: none` (which does) is the wrong tool here.

**The live canvas scales with a CSS transform, not `zoom`.** A transform does
not change layout size, so the inner element gets the unscaled height it needs
and scrolls itself while the outer box shows a shrunken window onto it.
Anything simpler either pushes the page sideways or needs a second copy of the
themes.

**The headline scale is a CSS variable, not a class swap.** `groundStyle()`
sets `--type-scale` and `--tracking` on the published wrapper; each theme's
display heading multiplies its own size through `headline()`, and the heading
rule in `globals.css` reads `--tracking`. A Tailwind `text-[64px]` utility
would beat a base rule, so the size has to be inline — that is why `headline()`
returns a style object rather than a class.

**Every section files under exactly one tab, and the tab is required.** The
tab row on a published page is `tabs(p)` in `published/themes.tsx` — every
distinct tab its visible sections use, in section order, uncapped, because a
tab is the only route to the sections under it. There is no "All work" tab
and no "everything" state: one tab is always open, the first until the
visitor picks another. The editor's `TabField` offers the page's existing
tabs before letting you name a new one, so "Advisory" typed twice cannot
become two tabs. The backend refuses a blank tab (`SectionPatch.tab`), and a
new section starts on the page's first tab, or `Work` on an empty page.

**`p.layout.roleNav` keeps its name, not its wording.** It is the wire
format, a stored value and in tests, so it is still `roleNav`; every label it
shows says "tab". Renaming the key would be a migration for no user-visible
gain.

**`p.layout.roleNav` only applies to Editorial, Links, Ledger and Broadsheet.**
Index rail, Poster and Dossier carry their own navigation — it is the reason
you would pick them. The Layout panel says so on screen rather than offering a
control that silently does nothing.

## Design system: Modernist

Archivo throughout, `#f3f2f2` ground, `#201e1d` ink, one accent `#ec3013`.
**Zero border radius anywhere** — `--radius-*` is `0` on purpose. 2px dividers,
flush-left labels (including inside wide buttons), photography in grayscale.
Build with the `.btn` / `.tag` / `.input` / `.nav` / `.table` classes rather
than inventing parallel ones, and take every colour from a token.

Two rules worth repeating because they are easy to break:

- **The body must never scroll horizontally.** Check narrow widths; the nav
  wraps rather than pushing its primary action off-screen.
- **Don't build grid rules out of `gap` over a coloured ground.** A
  partly-filled last row shows the ground as empty grey blocks. Use per-cell
  borders instead.

The published page swaps the design system's own CSS variables on a wrapper
(`groundStyle`), so every `.btn` and `.tag` follows the chosen accent and
ground with no per-theme restyling.

**Accent and ground are both any colour, and the ground carries two fields.**
The builder's Colour panel draws an always-visible picker for each —
`ColourPicker` in `builder/ColourPicker.tsx`, a saturation/value box over a
hue slider with a hex field under it. Hand-rolled because `<input
type="color">` is only a button: it shows a swatch and opens the operating
system's dialog, and cannot render its controls inline. It holds **hue in
state** rather than reading it back from the colour every time, because a
grey has no hue and black has neither hue nor saturation — without that the
marker snaps to red the moment you drag the value down to black. Accent has
no preset swatches; ground keeps Light/Dark/Paper, and picking a colour
overrides whichever is selected. `p.ground` still names one of three presets
and `p.groundHex` overrides it; empty means "use the preset", which is why
the preset is never cleared and always has something to fall back to.
A preset supplies six variables — paper, surface, ink, divider and two
neutrals — so a picked colour has to supply the same six: `derivedGround()`
in `published/themes.tsx` works them out, choosing whichever ink contrasts
better rather than thresholding on luminance, because a threshold gets
mid-tones wrong. The presets keep their hand-tuned maps; derivation runs only
for a picked colour. Contrast is derived, not enforced — a mid-grey ground
tops out around 4.2:1 whichever ink it gets.

**Fourteen headline faces, and only Archivo is preloaded.** `layout.tsx`
declares them all through `next/font/google`; the thirteen alternates carry
`preload: false`. Preloading is per-family rather than per-page, so with it
on, every face would be fetched on every page load to serve the one a
portfolio picked — the three faces we started with cost ~93KB that way, and
all fourteen preloaded would be far worse. Without it a face is fetched only
when text renders in it, which is what `display: swap` covers. One preload
link is emitted, for Archivo, the body face every page uses.

**A face has to reach 700 to be offered at all.** `globals.css` sets
`font-weight: 800` on every heading and the themes add `font-extrabold` 22
times, so a single-weight family would be faux-bolded by the browser into a
smear. That is why Anton, Bebas Neue and Instrument Serif are not in the
list, however well they would suit a poster. Every face in `FONTS` is
variable; where a family stops short — Space Grotesk, Lora and Oswald cap at
700 — the axis clamps to a real instance rather than synthesising one. Adding
a face means editing `FontId` and `FONTS` on both sides plus a migration for
the `font_is_known` check constraint; that constraint stays, because making
drift loud is the point of it.

**Every radio group needs a `useId()` suffix, because the builder mounts its
controls twice.** The desktop inspector and the mobile sheet are both in the
DOM at once — the sheet is `lg:hidden`, not unmounted — so `ColourControl`,
`TypeControl` and `LayoutControl` each render twice. A radio `name` is scoped
to the *document*, so a fixed name put all eight `rolenav` inputs in one
native group, and a native group allows exactly one checked member: React set
`checked` on the visible copy and the browser immediately moved it to the
hidden one. Since `.radio input:checked + .dot` and `.seg-opt:has(input:checked)`
both key off the *native* state, the selection silently stopped showing while
the page itself kept updating — the state was never wrong, only the dot. Name
every radio group `` `<group>-${useId()}` ``.

**Type pairing is two faces, and `font` is only the headline.** `p.font` sets
`--font-heading`, which drives `h1`-`h6`, `.btn`, `.mono-label`, `.status`,
`.nav-brand`, `.dialog-title` and every `.font-heading` element in the
themes. `p.bodyFont` sets `--font-body` **and** `--font-sans` — both, because
`--font-sans` is what Tailwind's `font-sans` utility resolves to, and leaving
it behind would split the page between two faces depending on whether an
element happens to name one. The body used to be Archivo always, which made
a "pairing" panel with one half missing: picking Playfair moved the headings
and left every description in Archivo. `bodyFont` defaults to `archivo`, so
an untouched portfolio renders exactly as before. `font` keeps its name for
the same reason `roleNav` does — it is the wire format and a stored value.

**The face is a dropdown, not a `<select>`** (`builder/FontSelect.tsx`, used
by both the inspector and the mobile sheet). `font-family` on an `<option>`
is ignored on macOS and unreliable in Chrome, so a native list would name
fourteen fonts in the system font and show none of them — and seeing the face
is the whole point of the control. **It closes on a backdrop, not a listener
on `document`.** Most of the builder is the live canvas and that canvas is an
iframe, so a `pointerdown` inside it never reaches this document: a document
listener leaves the dropdown open when you click the page you are styling.

**The Type panel's specimens load lazily** (`builder/FontSample.tsx`). A font
downloads when text renders in it, so a list drawing all fourteen at once
fetches all fourteen at once. Each row renders in the inherited face and
names no family until it scrolls within 200px of the viewport — inside the
dropdown's own scrolling panel as much as anywhere. The observer is wired in
a **ref callback, not an effect**: the React Compiler lint rejects `setState`
called straight from an effect body (`react-hooks/set-state-in-effect`),
which the no-observer fallback has to do. The row for the face already in use
passes `eager` — the canvas is rendering it anyway.

**A hex field must not write every keystroke into the store.** The accent
field used to, so typing `#ec3013` sent `#e`, `#ec`, `#ec3` — the API
rejects those, and the first characters of any hand-typed colour raised a
save-failed banner. `ColourField` keeps a local draft and commits only a
complete `#rrggbb`, dropping the draft on blur.

## The backend

`backend/` is a FastAPI service on PostgreSQL, and it is where everything now
lives: portfolios, uploads, analytics, accounts. Its own README covers running
it, but two rules matter from this side:

- **The frontend needs it up.** With the API down, every authenticated page
  shows its error banner and `/p/[slug]` returns a 404 — there is no local
  fallback and there should not be one.
- **An owner's asset URL is signed, not merely authenticated.** `asset_out()`
  appends `?t=<jwt>` to `/api/v1/assets/{id}`, and the route takes that
  signature *or* a bearer token. An `<img>` cannot send an `Authorization`
  header, and the access token lives in memory in `src/lib/api.ts` and never
  reaches the markup — without the signature every owner-side image (editor,
  builder canvas, `/preview`, `/print`) is a 401 and renders
  broken. The token names one asset and expires
  (`FACET_ASSET_URL_TTL_MINUTES`, 24h). Published pages are unaffected: they
  use `/api/v1/public/assets/{id}`, which needs nothing.
- **`src/lib/api.ts` is the only module that knows the API exists.** It owns
  the access token, one silent refresh-and-retry on a 401, and turning an
  error envelope into an `ApiError` with a `code` a caller can branch on.
- **A live portfolio is frozen.** `EditablePortfolio` in `backend/app/api/deps.py`
  answers 409 `portfolio_published` to every portfolio and section write while
  `status == "live"`; publish and unpublish take `OwnedPortfolio`, or there
  would be no way back out. The editor, builder and theme gallery all render
  `PublishedLock` instead of themselves for a live portfolio, and the list card offers Preview and Unpublish in place of Edit,
  Builder and Delete. `updatePortfolio` in `src/lib/store.tsx` therefore
  unpublishes *before* its patches and publishes *after* them — a batch that
  published first would 409 on its own edits.

The API is camelCase on the wire, so its responses drop straight into the
types in `src/lib/types.ts` with no mapping layer. Keep it that way.

## Saving is optimistic, and never silent

`store.tsx` and `account.ts` apply a change locally and fire their listeners
before the request goes out, so typing never waits on a round trip. Text
fields are debounced by 500ms per section — that was free against
localStorage and is not free against an API — and anything still waiting is
flushed on `pagehide`.

When a write fails, the store re-reads from the server rather than restoring a
snapshot: by the time a debounced save fails, that snapshot is several
keystrokes stale, and reverting to it would throw away edits that were fine.
The API's own message goes into `syncError`, which the editor and `/account`
render as a banner. **A failed save must never be silent.**

Uploads go to `POST /assets`, which sniffs the type from the bytes, downscales
images to 1400px and strips their EXIF. The browser no longer resizes anything
and there is no storage budget to respect — `src/lib/assets.ts` is a thin
wrapper over the upload now.

## Analytics are real, not simulated

`src/lib/analytics.ts` posts actual views of `/p/[slug]` and actual clicks on
section links, and `/stats` reads the aggregate endpoint. They are counted
from event rows across every visitor, not estimated and not per-browser.
Never replace them with generated or placeholder figures — show an empty state
instead. Recording answers 202 whether or not it counted, so a visitor never
sees an analytics decision, including the owner having "count visits" off.

## The published page is server-rendered

`/p/[...slug]` is an async server component that fetches
`GET /api/v1/public/p/{slug}`. Do not turn it back into a client fetch: the
privacy switches are enforced in that response, and `generateMetadata` is what
makes "let search engines index my pages" actually emit a robots tag.

The owner's switches arrive already applied — `header.links` is empty when
contact is hidden, hidden sections are absent — and reach the themes through
`PrivacyProvider`. `usePublishedPrivacy()` reads that context. It used to read
the *visitor's* account, which meant a signed-out visitor saw the defaults and
a signed-in one had their own settings applied to somebody else's page.

**A preview knows it is one, and every theme asks.** `PreviewProvider` wraps
`PublishedBody` wherever it is *not* the published page — `/preview/[id]`,
the builder canvas and `/print` — and two things read that context.
`useRecordClick` goes quiet, so the owner's own clicks never reach analytics.
`usePageHref` returns `/preview/<id>` instead of `/p/<handle>/<slug>`, because
the public address does not resolve until the portfolio is published: a
section title inside a draft preview used to link straight to a 404. Render
`PublishedBody` anywhere new and wrap it in both providers, or it will quietly
claim to be the live page.

## Known gaps

- **Artboard 3b — the block manager, at `/blocks/[id]` — is deliberately not
  built.** It listed the sections with reorder, hide and delete buttons, a
  click count each, a copy-address bar and a typed "+ Add block" picker.
  Every one of those lives somewhere else: the editor reorders and deletes,
  the builder's rail hides and shows, `/stats` counts the clicks, and
  `ShareDialog` copies the address. It was a second front door to one set of
  writes, so it went, and with it `Section.kind` — the picker was the only
  thing that ever set a kind, and every kind was the same fields underneath.
  Do not rebuild it from the canvas.
- **Three `/account` groups still describe services this build has not
  chosen.** Billing needs a payment processor, custom domains need DNS and a
  host, email notifications need a mail service. Each renders a
  `<ServerNotice>` saying so in as many words. Do not quietly make them look
  functional — if you add one, delete its notice in the same change.
  Everything else on that page is real: sign-in, passwords, two-step (TOTP),
  single-use recovery codes, the device list and its revoke buttons, and all
  four Privacy switches.
- **The published page has no signed-out vs. owner distinction**, so
  "Claim your page" is decorative. The `badge` privacy switch hides it.
- **Reordering is buttons, not drag.** The canvas draws a drag handle and says
  "hold to reorder"; the implementation uses up/down buttons, which are
  keyboard-reachable and need no pointer heuristics.
- **The canvas says "all 12 themes"; there are seven.** Seven are built and
  real. Do not pad the gallery to hit the number in the artboard.
- **Slugs are global.** Two accounts cannot both hold `rohan`, because the
  address is `facet.page/<slug>` with nothing in front of it. The create
  dialog surfaces the 409 as a message.
- **The frontend has no test runner.** The backend has 258 pytest tests;
  changes here are checked with `npm run lint`, `npm run build` and by
  actually opening the app.
