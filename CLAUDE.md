@AGENTS.md

# FACET

A multi-role portfolio builder. One page per portfolio: a header, then N
sections, each with the same fields — title, description, cover, links —
and any components under them.
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
cd backend && .venv/bin/python -m pytest    # 356 tests (.venv/Scripts on Windows)
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

## Deploying

One container, one address: the `Dockerfile` builds the frontend and runs it
beside the API, and `render.yaml` is a Render blueprint for that container
plus its PostgreSQL (New → Blueprint → this repository; every push
redeploys). `scripts/start.sh` migrates, optionally creates a demo account
(`FACET_DEMO_EMAIL` / `FACET_DEMO_PASSWORD`, seeded once), then starts both.

- **One address is the point, not a convenience.** The refresh cookie is
  `SameSite=Lax`, so a frontend and an API on two hosts sign you out on every
  reload. The image is built with `NEXT_PUBLIC_API_URL=""`, which makes every
  browser request relative, and `API_PROXY_TARGET`, which turns on the
  `/api/*` rewrite in `next.config.ts`. Both are **build-time**. Do not split
  the two onto separate hosts without a shared parent domain.
- **The server cannot use a relative URL**, so `/p/[...slug]` reads
  `API_INTERNAL_URL` (`lib/published.ts`) and falls back to `API_BASE`.
- **`FACET_DATABASE_URL` takes the host's own `postgres://` string**;
  `Settings` names the asyncpg driver itself.
- **Uploads live on the container's disk** (`FACET_MEDIA_ROOT`). On a host
  that wipes it — Render's free plan does — pictures do not survive a
  restart. `render.yaml` says how to attach a disk.

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
- `src/lib/icons.tsx` — link icons. The brand marks are Simple Icons (CC0),
  copied in as path data rather than added as a dependency: the published
  page's CSP rules out a CDN and thirty paths cost ~15KB. `iconFor()` reads a
  link's stored `icon` override, then its hostname, then falls back to a
  generic glyph — and never throws, because it runs during render in every
  theme while the editor writes a half-typed address on every keystroke.
  Hostname matching is on the registrable domain, never a substring, or
  `mysite.com/instagram-clone` takes the Instagram mark. Adding a brand is one
  line in `ICONS` and one in `HOSTS` — **except LinkedIn.** Simple Icons
  permanently removed that mark at LinkedIn's own request over trademark
  enforcement, so there is no CC0 path to copy and this repo does not
  redistribute it; `linkedin.com` and `lnkd.in` resolve to the generic
  `briefcase` glyph, display name "Profile". Do not add a LinkedIn icon. The
  reasoning is in the `icons.tsx` file header, along with why twenty-three
  solid brand marks sit beside seven stroked generics and stay that way.
- `src/lib/seed.ts` — the five seeded portfolios. `backend/scripts/dump_seed.mjs`
  transpiles this file and writes `backend/app/seed_data.json`, so the seed is
  not maintained twice; re-run it whenever this changes.
- `src/components/Editor.tsx` — artboards 4b (desktop document) and 4d (mobile),
  sharing one state tree.
- `src/components/builder/` — `Builder.tsx` is artboards 2a (a window-height
  workspace: section rail, live canvas with a device toolbar and "Replay
  motion", inspector tabbed Look / Colour / Type / Motion) and 2c (canvas over
  a five-tab control sheet). `Canvas.tsx` is the live canvas, shared with
  `ThemeGallery.tsx` (2b), which is try-before-you-apply: picking a profession
  or theme changes a local draft only the preview sees, and nothing is written
  until "Use this look". `controls.tsx` holds the Profession / Theme / Colour /
  Type / Motion / Layout controls **shared** with the editor's drawer so the
  two cannot drift.
- `src/components/PrintAll.tsx` — `/print` stacks every published page with a
  page break between so the browser's own **Save as PDF** can export them.
  That is what "Download all pages as PDF" on `/account` opens; generating a
  PDF in-process would mean a library, and the themes already print correctly.
- `src/components/resume/` — the resume, a portfolio's second look; see "The
  resume" below. `ResumeDocument.tsx` draws all six templates from one markup,
  `src/app/resume.css` gives each its look, `ResumeSheet.tsx` is the scaled
  preview, `ResumeContent.tsx` the editor's Resume view, `ResumeStudio.tsx`
  the builder's Resume side and `ResumePrint.tsx` the `/resume/[id]` page
  that Download PDF opens. `src/lib/resume.ts` holds what they share.
- `src/components/account/panels.tsx` + `Account.tsx` — artboards 5a and 5b.
- `src/components/published/themes.tsx` — the published page in five motion
  themes: Aurora (the default), Meridian, Stage, Arcade, Journey, one file
  each under `themes/`. Also `SectionDetail`, artboard 1d, reached at
  `?section=<id>`. The catalogue themes (Résumé, Editorial, Poster, Links,
  Site) are retired; migration `b6e2f0d4a913` remapped stored rows, and
  `LEGACY_THEMES` on both sides maps old ids arriving any other way.
- `src/components/published/fx.tsx` — the motion layer every theme is built
  on: `ThemeRoot`, `Reveal`, `Words`, `Tilt`, `useScrollProgress`, `CountUp`,
  `Marquee`. Read its header before adding motion — see "Motion" below.
- `src/app/globals.css` — the Modernist design system: tokens in `@theme`,
  component classes in `@layer components`.

**The header's numbers and timeline are drawn with the header, before the
sections.** Both are typed in the header's card, so in every theme the order
is hero, numbers, timeline, then the sections. The timeline used to come
after the last section, where it read as a section of its own nobody had
added. Its block carries top padding only; the sections' own padding is what
separates them from it.

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

**One kind of thing in the editor: a section, and under its heading,
components.** A section is a title, a description, links and **one cover
picture**; everything else it shows is a
component, edited in the one frame `PanelShell` (`editor/components.tsx`)
inside the one `Card` (`editor/card.tsx`). Do not add a second card or panel
chrome — that inconsistency is what this replaced.

- **A gallery is a component, and it names pictures rather than holding
  them.** `GalleryBlock` is `{layout, imageIds}`; the bytes stay in
  `section.images` (`section_images` rows), so every upload reference is
  still a foreign key. The cover is the one picture no gallery names. Read
  pictures through `coverOf()` and `galleryImages()` in `types.ts`, never
  `images[0]`. Removing a gallery removes its pictures from the section;
  the cover and all galleries share the twelve-picture allowance.
  `sectionOf()` in `normalize()` gives pictures stored before this (cover
  first, the rest loose) a gallery with a derived id — no migration.
- **The resume's lists are components too, and they place rather than
  hold.** Experience, Education, Skills, Certifications, Languages and
  Awards are `ResumeListBlock`s: `{type, look}` and nothing else. The
  entries stay in `p.resume[type]` — see "The resume" for why — and the
  component's panel edits them there (`ResumeListRows` in
  `resume/ResumeContent.tsx`). **The component is the only thing that puts a
  list on the page**: there is no Page switch for a list any more. It can be
  placed any number of times — do not restrict it to one — and every
  placement draws the same list, in its own look, because the resume has one
  list of each kind. Removing a component keeps the entries. `LIST_LOOKS` in
  `types.ts` says which looks each list has (the first is its default) and
  `lookOf()` falls back to it; the backend accepts any look so adding one is
  frontend-only.
- **One list of components, and no "resume" group in it.** `BLOCK_TYPES` is
  the order "Add a component" offers, the six resume lists mixed in with
  the rest. The editor's "Quick add" is those six lists only (`QUICK_ADD` in
  `Editor.tsx`) — by request; do not widen it to every component. It makes
  a new section named after the list with its component inside; it is a
  shortcut, not a different kind of section.
- **Words in the editor, looks in the builder.** How anything is laid out
  is picked in the builder's Motion tab, under "Section styles"
  (`SectionStyleControl` in `builder/controls.tsx`), beside the canvas that
  shows the change. The editor's component panels have no look controls; do
  not add one there.
- **Seven shapes draw everything that is a set of entries.** Cards,
  Timeline, Carousel, Side tabs, List, Spotlight and Chips
  (`published/section-styles.tsx`, from `feature/section_style_changes`),
  in every theme, with the theme's own colours and corners. Two things are
  drawn by them:
  - **A resume list component.** Its `look` is one of the seven, or "theme"
    for "the one that suits this kind" (`LIST_DEFAULT_STYLE`; `lookOf()`
    resolves it and maps the old "cards"/"tags"). `ResumeListView` hands
    `listSections()` — the entries as stand-in sections, id `resume-…`,
    organisation and dates on the description's first line where
    `entryMeta()` reads them — to `renderStyle()`. There is no second,
    list-only renderer; do not add one. `SectionTitleLink` draws a stand-in's
    title as plain text, because an entry has no page of its own.
  - **The page's plain sections** — the ones a theme would draw as cards.
    One choice for the page, `p.layout.sectionStyle`; "theme" leaves them to
    the theme. `StyledSections` wraps each theme's own card markup and
    replaces it only when a style is picked. Bio ignores it. On the feature
    branch this was per tab; there is no tab now.
  Both are in JSON already stored, so no migration; the API validates them
  (`Layout.section_style`, `ResumeListBlock.look`).
- **The builder's panel is one row per thing.** Each list component gets a
  row of seven tiles, the plain sections share one row of eight, a gallery
  keeps its three layouts. A row marks its suggested style, and "Match
  everything to its content" applies every suggestion. Nothing is applied
  without a click. An earlier version styled only the plain sections, so a
  style picked for the page did nothing to an Experience section — which is
  what "the style is not applied" meant.
- **The editor's outline is as tall as the window, never taller.** It reads
  in the page's order — header, sections, "Add section", footer — and only
  the sections scroll, so "Add section", the footer and "Quick add" below
  them stay in view however many sections there are. The page title sits in the document column for the same reason: above
  both columns it pushed the outline down past a short window. Below `lg`
  there is no outline, and the same two controls sit under the cards.
- **A blank portfolio starts with no sections.** The create dialog's
  "Blank" used to add one empty section, which was a thing to delete first.
  Only "Copy a page" and "Founder" start with sections, because picking
  either asks for them. The test fixture `portfolio` adds one itself.
- **The builder: Page / Resume heads the left rail on a desk** (in the top
  bar only below `lg`, where there is no rail). Its top bar links to the
  editor as "Edit content". Layout controls a theme does not read —
  Navigation (Meridian's alone), Columns, Density — collapse to one line
  naming why (`Unused` in `builder/controls.tsx`); Columns comes back
  wherever the Cards style is picked, because that style lays its cards
  with the same count in any theme.
- **The resume prints, and its Blocks rail lists, only what is in use**
  (`blockInUse()` in `lib/resume.ts`): the summary and the sections once
  written, and a list once a component places it in a section — a section
  off the page counts, which is how a list is kept to the resume. Entries
  left in a list nobody placed do not print. The seed keeps its roles on
  the resume that way, with an off-page "Experience" section.
- **Resume background patterns are drawn at half strength**
  (`PATTERN_STRENGTH` in `lib/resume-backdrops.ts`), full-page and corner
  alike, when drawn in the accent (the headings' colour). A colour picked
  for the pattern itself (`style.backdropColor`; empty means the accent —
  `patternColour()`) is drawn at full strength, as picked.
- **One Done per card, at its foot.** An open card's top bar carries only
  its switches and move buttons. The editor's top bar has "Open builder",
  "Preview" and "Publish"; the resume PDF is downloaded from the builder's
  Resume side, not here.
- **There are no built-in cards.** The editor is header, sections, footer.
  The resume's private contact line lives in the header card ("Resume
  contact details"). It is deliberately *not* a component: it never leaves
  the account, and the page has its own Contact component.

**A section is one thing with one title; there is no tab to file it
under.** The tab used to be a second name that grouped several sections
under one menu item. A section holds components now, so what belongs
together goes in one section, and the field is gone from the editor. Do not
bring it back as "group" or "category".

- **`tab` is still on the wire, and it is derived.** The API stores a
  required `tab` per section (at most sixty characters), so `tabOf()` in
  `types.ts` sends the title for it (`Untitled` when blank) and
  `normalize()` overwrites whatever was stored. Nothing on the backend
  changed and there is no migration. **Read `tabOf(section)`, never
  `section.tab`**: the stored value lags the title while a save is on its
  way, and the builder's canvas draws from that in-flight state.
- **The page's menu is one item per section**, by title. `tabs(p)` in
  `published/shared.tsx` is that list. Two sections with the same title
  share an item, which is the only way a count above one can appear.
- **There are no chapter headings.** Aurora, Journey, Stage and Meridian's
  "one long page" draw `runsOf()` (`published/components.tsx`): a grid of
  cards and then the bands after it, a new run starting where a card
  follows a band, so the page reads in the author's order while each theme
  keeps drawing "cards, then bands". Every card and band shows its own
  title; `FeatureBand`'s is the `h2`. `menuOf()` scrolls to a band itself
  and to the run a card sits in. Meridian's tabs and Arcade's levels still
  filter with `useTabFilter` — one section per pick.
- **On the resume the sections are entries under one heading**,
  `PROJECTS_HEADING` in `lib/resume.ts`.

**`p.layout.roleNav` keeps its name, not its wording.** It is the wire
format, a stored value and in tests, so it is still `roleNav`; every label it
shows says "tab". Renaming the key would be a migration for no user-visible
gain.

**`p.layout.roleNav` only applies to Meridian.** It is the one theme built
on `useTabFilter` with all four shapes (tabs, rail, scroll, lens). Aurora
and Journey show every tab as a chapter on one scroll, Stage gives each tab a
rail, and Arcade's tabs are its level-select menu. "Content grid" is read by
Aurora, Meridian and Arcade (`gridCols`); "Density" by Aurora, Meridian and
Journey. The Layout panel says so on screen rather than offering a control
that silently does nothing: `IGNORED` in `builder/controls.tsx` carries one
reason per theme per control — grep `useTabFilter`, `gridCols(` and
`layout.density` under `src/components/published/themes/` before editing it.

**Professions are looks, not data.** `PROFESSIONS` in `types.ts` maps ten
professions to a theme, accent, picked ground and type pairing;
`applyProfession()` writes those fields and nothing remembers which
profession was picked. The Colour panel's palettes and the Type panel's
pairings are read off the same list, so adding a profession extends all three.

## The resume

**One content list, two looks: the page it publishes and the resume it
downloads.** Nothing is typed twice. Edit text is a single list — the
header (with the resume-only contact details in it), then sections — and
every section carries **Page** and **Resume** switches (`LookToggles` in
`ui.tsx`). The resume's structured lists are edited inside the component
that places them in a section. There used to be a separate Resume view of
the editor, and then a row of built-in cards; two places to type one
person's history is exactly what this replaced, so do not bring either
back. The builder still has a **Page / Resume** switch
(`/builder/<id>?mode=resume`), because the two *looks* are styled
separately.

- **The header is the resume's top.** Its name, current line and About are
  the resume's name, headline and summary; there is no resume-only copy.
  Migration `d2f7b8c41a90` moved any old `headline`/`summary` into the
  header and `resume_from_stored()` ignores the stale keys.
- **The facts a page section has no fields for are structured, not prose.**
  `p.resume` holds roles (company, dates, `current`, bullets), education,
  skill groups, certifications, languages and awards, plus the template and
  its style. Structured so a later ATS check can read a role and its dates
  without parsing text — keep it that way.
- **Switches.** A structured list is on the page while a component of its
  type sits in a section that is not `hidden`, and on the resume unless it
  is in `resume.hidden` ("Print on your resume" in the component's panel).
  A section is on the page unless `hidden` and on the resume while
  `onResume` (a column, `sections.on_resume`). On the resume, sections print
  as entries under one "Projects" heading via `sectionGroups()`, which skips
  a section that is only a list's place on the page — the resume prints the
  list itself.
- **Lists reach the page as components, not as sections.** `listEntries()`
  in `lib/resume.ts` hands any of the six lists over in one shape (title,
  sub, date, lines, tags) and `ResumeListView` in `published/components.tsx`
  draws it in the component's look, so the themes know nothing about roles
  or degrees. `withPlacedLists()` drops a list component whose list is empty
  before the page is drawn; it runs in `PublishedBody` and the previews,
  never in the editor. Migration `a7d3e1c95f42` turned every list that was
  on the page (`resume.pageBlocks`, now gone) into a section holding its
  component, and the import does the same for an older export.
- **It is one JSONB column, `portfolios.resume`, sent whole** with `PUT
  /portfolios/{id}/resume`, validated by `app/schemas/resume.py`. `{}` is a
  valid resume, and `resume_from_stored()` turns anything that no longer
  validates into the defaults rather than failing the portfolio read.
- **Only lists placed on the page ever leave the account.**
  `PublicPortfolioOut` carries `public_resume()` — the lists that have a
  component in a section a visitor can see, nothing else: no email, phone,
  location, website or style, and not a list whose only component is in a
  hidden section. `tests/test_resume.py` pins that.
- **A live page freezes what can reach it.** `PUT /resume` takes
  `OwnedPortfolio` so the builder can restyle a live page's resume, but
  while live it answers 409 `portfolio_published` to any change outside
  `RESUME_ONLY_FIELDS` (style, `hidden`, the contact details). The editor
  renders `PublishedLock` for a live portfolio as before, and the builder's
  block rail cannot reorder while live (the order is the page's too).
  `updateResume` is its own debounced write, not part of `updatePortfolio`.
- **Thirty-two templates, one markup — and a template is a row, not a
  stylesheet.** `RESUME_TEMPLATES` in `lib/resume.ts` gives each one a part
  per slot: layout (`one` / `left` / `right`), aside, header, heading, entry,
  skills, contact. `ResumeDocument` writes the parts as `data-*` attributes
  and `resume.css` styles each part once, plus a short "finishing touches"
  list keyed off `data-template`. A new template is usually a new row. Its id
  goes in `RESUME_TEMPLATE_IDS` (`types.ts`) **and** the backend's
  `ResumeTemplate` Literal. `test_the_template_list_matches_the_frontend`
  fails if the two drift. Two-column layouts put Skills, Certifications,
  Languages and Awards in the narrow column (`SIDE_BLOCKS`). Every template
  sets real text in reading order, name first, because that is what an ATS
  reads. Never render a resume as an image or a canvas. Organisation-first
  entries and the date gutters are markup every template shares (`Entry`
  writes the dates twice), so no template moves a node.
- **A solid column is the paper's background, not the column's.** Under
  `aside: "solid"` the sheet becomes the grid (`.r-columns` is
  `display: contents`) so the column can run past the header. The colour is
  `paperGround()`, a horizontal gradient set on the sheet, on the print
  margin cells and on the printed page's `html`. Painted on the column
  instead, it stops where its text does — on page 2, partway down. The
  `band` header reaches the paper's top edge with negative margins of
  `--r-my` / `--r-mx`.
- **Columns and Background are style, not template.** `style.columns`
  (`auto` follows the template) is laid over the template's parts by
  `sheetParts()`, which everything that draws a sheet reads instead of
  `templateOf()`. Picking a template resets it to `auto`, and the picker's
  thumbnails ignore it. `style.backdrop` is decoration in
  `lib/resume-backdrops.ts`: CSS background layers of SVG drawn in the
  accent, never an element, so the PDF's text layer is unchanged. On screen
  the sheet paints them; in print `resume.css` clears the sheet and
  `/resume/[id]` paints the same layers on `html`. That is the only
  surface that reaches every page's edges, and it puts a corner graphic flush
  with the paper's top. Layers that fill the page repeat: on a printed page,
  `100%` is one page tall.
- **`resume.css` is unlayered on purpose**, so it beats `globals.css`'s heading
  and link rules, and it is imported in `layout.tsx`. The sheet is paper:
  white with near-black ink in either app theme, sized in mm and pt so the
  preview and the PDF agree.
- **The PDF is the browser's own Save as PDF**, from `/resume/[id]`, which
  writes the `@page` size and margin per resume, names the document after the
  person (the PDF's default file name) and, with `?print=1`, opens the print
  dialog once fonts and the photo have loaded. **The `@page` margin is 0**:
  the browser prints its own header and footer (date, title, address, page
  number) in that margin, and with none it has nowhere to put them. Each
  page's top and bottom room comes from empty cells in a table's `thead` and
  `tfoot`, which repeat on every printed page, so the sheet drops its own
  vertical padding in print. Entries are `break-inside: avoid`.
- **The preview's page breaks are close, not exact.** `ResumeSheet` is one
  continuous sheet with a dashed line wherever a page's room runs out; the
  printer moves an entry that will not fit whole, so a real break can land a
  little earlier. The page count is what matters for keeping a resume to one.
- **Testing the PDF:** this machine's Edge refuses to print over CDP
  ("Printing is not available") in both headless modes. Headless Chrome
  (`%LOCALAPPDATA%/Google/Chrome`) prints; sign in and move with
  `window.next.router.push` so the in-memory access token survives.

## The ATS check

The resume builder's third inspector tab ("ATS check",
`resume/AtsCheck.tsx`): paste or drop a job description, Validate, and the
panel becomes the result — a score, its breakdown, keywords found and
missing, and suggestions. The scoring is `app/services/ats.py`, behind
`POST /portfolios/{id}/resume/ats-check`.

- **It is a real analysis, and says what it is.** No vendor publishes how
  its ATS ranks a resume; what every account agrees on is parse, then
  compare against the description, weighted towards hard skills, then the
  job title, education and years asked for, then soft skills, plus whether
  the resume can be parsed. That is the scoring, in plain Python with no
  model and no network: n-gram terms weighted with BM25-style saturated term
  frequency and boosted on requirement lines and for known skills, matched
  after light stemming and synonym folding. The weights sum to 100 and every
  point is in the breakdown. The panel calls it an estimate, never a
  verdict. Do not replace it with a figure that is not computed this way.
- **It reads the resume as it prints** (`resume_text()`): a list counts only
  when a section places it and it is not switched off for the resume — the
  same rule as `visibleBlocks()`. "Check again" calls `flushPendingSaves()`
  first, because the check reads stored data.
- **The description is not stored.** The API reads it and forgets it; the
  panel keeps it in `sessionStorage` for the tab only. A test pins that.
- **Suggestions that change the resume are explicit clicks**: add a skill
  (to the first skill group, adding an off-page Skills section if no section
  holds the list), lead the headline with the job title, print a list that
  is switched off. Everything else is a tip. On a live page the actions are
  disabled — its content is frozen. "Only add what is true of you" is on
  every skill suggestion; keep it.
- **The vocabulary is ours** (`KNOWN_SKILLS`, `SOFT_SKILLS`, `SYNONYMS`),
  so extending it needs no licence. A larger list could come from ESCO or
  O*NET, both CC BY 4.0 (commercial use with attribution).

## Motion

`p.layout.motion` is `full`, `subtle` or `off` (labelled Full / Subtle /
Still), stored in the layout JSON like `photo` — no migration. `ThemeRoot`
writes it to `data-motion`, and CSS under "motion themes" in `globals.css`
does most of the work from there. Rules the code depends on:

- **Frame-aware, always.** Every observer and scroll listener is built from
  `node.ownerDocument.defaultView` with no explicit root, never this module's
  globals and never Motion's `useScroll` / `whileInView` — inside the builder
  canvas those measure the builder, and nothing in the page would ever
  reveal or move.
- **The visitor's reduced-motion setting is never read during render.** The
  page is server-rendered and the server cannot know it; CSS escapes it and
  JS re-checks at event time (`reducedNow`).
- **Paper and no-JS see the finished page.** Anything that starts hidden has
  a print rule, a reduced-motion rule and the `<noscript>` in `layout.tsx`.
- **Motion owns its own transforms.** On an element with a Motion `style`
  transform, depth is Motion's `z`, not the `.fx-z` class — the inline
  transform overwrites the class.
- **A grid always has a column template.** A grid with none gets an `auto`
  column that grows past the viewport and `overflow-x: clip` on the theme
  root hides it. `gridCols()` and every theme grid start from `grid-cols-1`.

Testing motion headlessly lies in two ways: headless Edge clamps windows to
492px (emulate a phone over CDP instead), and virtual-time budgets can catch
transitions mid-flight. `CountUp` lands its exact value on a timer for that
reason as much as for throttled tabs.

## Design system: Mono (the app) and the catalogue (published pages)

**The app is black and white, in a light and a dark theme.** Inter for the
interface, JetBrains Mono for things a person copies or compares (addresses,
counts). No colour of its own anywhere — accent and foil resolve to the ink,
errors are told by words and an icon, and portfolio thumbnails on the list
are greyscale. Tool corners: `--radius-sm/md/lg` are 6/8/12px.

- **Light is the `@theme` token set; `:root[data-theme="dark"]` redefines
  the same names.** The neutral ramp *inverts* in dark, so a step keeps its
  meaning: `neutral-700` is muted text and `neutral-200` a quiet fill in
  both. Never hard-code a grey; take it from the ramp or it will be wrong in
  one of the two themes.
- **The theme is applied before first paint** by `THEME_BOOT`
  (`lib/theme-boot.ts`, inlined in `app/layout.tsx`'s `<head>`); `<html>`
  carries `suppressHydrationWarning` for exactly that. `lib/theme.ts` keeps
  it current after load. The switch is `ThemeSwitch` in `AppHeader.tsx`,
  which is the one header for Portfolios, Stats and Account.
- **Control voice is tokens, with the catalogue value as the fallback.**
  Label-like classes (`.btn`, `.tag`, `.mono-label`, `.caption-credit`,
  `.field > label`, `.seg-opt`, `.status`, `.nav a`, `.table th`, `h6`) read
  `var(--ui-*, <catalogue value>)`. The app sets sentence case and Inter on
  `:root`; `groundStyle()` sets every `--ui-*` to `initial`, which makes
  `var()` take the fallback, so a published page keeps its tracked capitals.
  Add a new label class the same way or it will leak the app's voice into
  portfolios.
- **Font tokens are a plain `@theme`, not `@theme inline`.** Inline compiles
  `.font-heading` with the face written in, so a published page's
  `font-heading` elements ignored the author's pick.

**Published pages are the catalogue, untouched by any of the above.**
`groundStyle()` pins `CATALOGUE_APPARATUS` — the house faces, square trim,
catalogue shadows — and its palette, whichever app theme the viewer is in.
The motion themes then pick their own corners: `--fx-pill` rounds the shared
`.btn` and `.tag` inside them.

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

**Eighteen faces, and only the two house faces are preloaded.** `layout.tsx`
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
- **The canvas says "all 12 themes"; there are five.** Five are built and
  real. Do not pad the gallery to hit the number in the artboard.
- **Slugs are global.** Two accounts cannot both hold `rohan`, because the
  address is `facet.page/<slug>` with nothing in front of it. The create
  dialog surfaces the 409 as a message.
- **The frontend has no test runner.** The backend has 356 pytest tests;
  changes here are checked with `npm run lint`, `npm run build` and by
  actually opening the app.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
