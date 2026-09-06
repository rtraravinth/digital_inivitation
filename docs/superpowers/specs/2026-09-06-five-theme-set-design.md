# Five-theme set for the published page

Date: 2026-09-06
Status: approved design, not yet implemented
Branch: feat/fastapi-backend

## Why

The published page ships seven themes: Editorial, Index rail, Poster, Links,
Ledger, Dossier and Broadsheet. Several of them are the same page with a
different rule weight, and none of them is the thing most people arrive
wanting — a plain, printable resume. The gallery therefore asks the author to
choose between variations rather than between intentions.

This design replaces the set with five themes, each answering a different
question the author actually has:

| Question the author is asking | Theme |
| --- | --- |
| I need something I can print and attach to an application. | Resume |
| I want a safe, well-made page and no decisions. | Editorial |
| I want to look like I present on stages. | Poster |
| I want one link for a bio, sized for a thumb. | Links |
| I want an actual website. | Site |

Resume is the professional one. Site is the one that makes the gallery worth
opening.

## Scope

In scope: the `ThemeId` union and its mirrors, the five theme components, the
gallery metadata and thumbnails, the seeds, and one Alembic revision.

Out of scope, and deliberately untouched: `RoleNav`, `Density`, `TypeScale`,
`GridCols`, every API schema and route, `normalize()`, the colour and type
systems, the privacy switches, analytics, and the editor.

## The set

### 1. Resume (`resume`) — new

A print-first document. One centred column at `max-width: 46rem`.

- Header: name at display size, role line beneath, contact as a single inline
  row separated by `·`, still gated by the `showContact` privacy switch.
- Numbers: a thin inline row with rules between the cells, not stat cards.
- Body: always chapters. Resume ignores `p.layout.roleNav` the way Poster
  already does, and renders every tab as a section heading with its entries
  stacked beneath. An entry is title on the left, date on the right sharing a
  baseline, description below, links as a compact inline row.
- Timeline: a two-column dated list, dates in a fixed-width left column set in
  `.mono-label`.
- Portrait: rendered only when `header.image` exists, 96px square, grayscale.
- Rules: 2px between chapters, 1px between entries. No cards, no shadows.
- Print: `@media print` drops the claim badge and sets
  `page-break-inside: avoid` on each entry.

Visual basis: `minimalism-and-swiss-style`.

### 2. Editorial (`editorial`) — kept as-is

Behaviour unchanged. It moves to its own file and its gallery audiences are
retagged; nothing else about it changes. It remains the `default` case of the
`PublishedBody` switch and the fallback `normalize()` writes for an unknown
stored theme.

### 3. Poster (`poster`) — reworked

Today it is a colour field and large type. It becomes a modern resume built on
that hero.

- Hero: full accent field, name at `clamp(3rem, 10vw, 9rem)`, weight 800,
  tracking `-0.04em`.
- Below the hero: an asymmetric two-column grid. The left column is the tab
  navigation as a large numbered list; the right column holds the entries.
- Numbers: oversized figures on the accent field.
- Navigation: keeps its own, ignoring `roleNav`, exactly as today.

Visual basis: `exaggerated-minimalism`.

### 4. Links (`links`) — reworked

The link-in-bio page, modernised.

- Square avatar at 96px. Zero border radius holds — no circles anywhere.
- Name, a one-line bio, and the contact row.
- Tabs as a full-width segmented control.
- Rows: full-bleed, `min-height: 56px`, title on the first line and
  description on the second, a 2px divider between rows, and a press state
  that inverts to the accent over 150ms.
- The column caps at `max-width: 30rem` and centres on desktop.
- Clicks continue to route through `useRecordClick`.

Visual basis: Link-in-Bio (`Vibrant & Block-based` + `Bento Box Grid`).

### 5. Site (`site`) — new

A full personal website, and the reason to open the gallery.

- Sticky nav: name on the left, tab anchors on the right, the active chapter
  marked with a 2px accent underline driven by an `IntersectionObserver`
  scroll-spy and `aria-current`. The page reserves the nav's height so it
  never covers the first chapter.
- Hero: oversized name, role, a contact call to action, and the portrait as a
  large grayscale panel.
- Chapters: one `<section id>` per tab, all visible at once. Each chapter is a
  bento grid whose first entry spans two columns, built from per-cell borders
  rather than `gap`, because a partly-filled last row would otherwise show the
  ground as empty blocks.
- Numbers: a full-bleed accent band.
- Timeline: horizontal on desktop, vertical on mobile.
- Footer: the contact links and a back-to-top.
- Motion: a single `.reveal` class starting at `opacity: 0` and
  `translateY(12px)`, with the observer adding `.in` for a 400ms ease-out and
  a 60ms stagger by index.
- `scroll-behavior: smooth` is set on the published wrapper, never on `html`,
  so it cannot leak into the app shell.

Visual basis: Portfolio/Personal (`Minimalism & Swiss` + motion) with
`Bento Box Grid`.

All five keep `SectionDetail` at `?section=<id>`, `groundStyle`,
`PrivacyProvider`, `PreviewProvider`, `PublishedHandleProvider`, and every
privacy switch.

## Data changes

`ThemeId` becomes `"resume" | "editorial" | "poster" | "links" | "site"` in
`src/lib/types.ts`, and the same five strings appear in
`backend/app/models/enums.py` and in the `ck_portfolios_theme_is_known` check
constraint.

Cutting four themes costs less than it appears, because what distinguished two
of them lives in `p.layout.roleNav` rather than in the theme. Editorial already
implements the `rail` navigation and the `lens` gate, so Index rail and Dossier
survive as Editorial plus a Layout setting. Ledger's table folds into Resume.
Broadsheet's columns are dropped; Editorial covers that ground.

`RoleNav` therefore keeps all four of its values. No enum but `ThemeId`
changes.

The gallery keeps its five audiences and retags:

| Theme | Audiences |
| --- | --- |
| Resume | advisers, office |
| Editorial | multi, founders |
| Poster | founders, writers |
| Links | founders, writers |
| Site | multi, founders |

`Site` carries the `badge: "New"` marker; `Dossier` held it and is going.

## Migration

One Alembic revision:

1. Remap stored rows: `index` and `dossier` and `broadsheet` to `editorial`,
   `ledger` to `resume`.
2. Drop `ck_portfolios_theme_is_known` and recreate it over the five new
   values.

`downgrade` restores the old constraint but cannot un-remap a row: a portfolio
that was `broadsheet` comes back as `editorial`. The revision's docstring says
so plainly rather than implying the downgrade is lossless.

`normalize()` in `src/lib/types.ts` already falls back to `editorial` for a
theme it does not recognise, so a stale browser tab holding a removed theme
self-heals without an error.

## File plan

`themes.tsx` remains the public entry point, so no importer changes. The four
modules that import it — `src/components/PrintAll.tsx`,
`src/components/builder/Builder.tsx`,
`src/components/published/PublishedPage.tsx` and
`src/components/published/DraftPreview.tsx` — keep importing `PublishedBody`,
`PreviewProvider`, `PublishedHandleProvider` and `tabs` from the same path.

New files:

- `src/components/published/shared.tsx` — everything the themes share: the
  `GROUNDS` map, `parseHex`, `toHex`, `mix`, `luminance`, `contrast`,
  `derivedGround`, `palette`, `groundStyle`, `headline`, `tabs`, `StatRow`,
  `visibleSections`, `pad`, `gridCols`, `useTabFilter`, `LensGate`, `Tabs`,
  `Kicker`, `href`, `SectionLinks`, `Media`, `SectionAside`, `HATCH`, the
  privacy, handle and preview contexts with their hooks, `useRecordClick`,
  `usePageHref`, `HeaderLinks`, `saveContact`, `SectionTitleLink` and
  `SectionCard`.
- `src/components/published/themes/editorial.tsx`
- `src/components/published/themes/poster.tsx`
- `src/components/published/themes/links.tsx`
- `src/components/published/themes/resume.tsx`
- `src/components/published/themes/site.tsx`
- `src/components/published/section-detail.tsx` — `SectionDetail`, artboard 1d.

Rewritten:

- `src/components/published/themes.tsx` — re-exports plus the `PublishedBody`
  switch, now five cases with `editorial` as `default`.

Edited:

- `src/lib/types.ts` — the `ThemeId` union and the `THEMES` metadata array.
- `src/components/builder/controls.tsx` — `ThemeThumb`: four cases out,
  `resume` and `site` in.
- `src/lib/seed.ts` — the two seeds on `index` and `poster` retargeted, then
  `node backend/scripts/dump_seed.mjs` regenerates
  `backend/app/seed_data.json`.
- `src/app/globals.css` — `.reveal` and `.in`, their
  `prefers-reduced-motion: reduce` and `print` blocks, and the Resume print
  rules.
- `backend/app/models/enums.py` — the `ThemeId` literal and `THEMES` tuple.
- `backend/tests/test_portfolios.py` — two references to removed themes.
- `CLAUDE.md` — the theme list under Layout, and the `roleNav` note naming
  which themes it applies to.

New migration:

- `backend/alembic/versions/<rev>_five_theme_set.py`

## Risks and how the design handles them

**IntersectionObserver inside the builder iframe.** `CanvasFrame` portals the
published page into the frame's body while the React tree stays in the parent
document. An observer created there with no explicit `root` resolves its
implicit root against the top-level viewport, so Site's scroll-spy and its
`.reveal` elements could observe nodes that never count as visible — leaving
every chapter at `opacity: 0` in the builder canvas. Site passes an explicit
`root`, the observed node's `ownerDocument.scrollingElement`, resolved in the
ref callback rather than an effect: the React Compiler lint rule
`react-hooks/set-state-in-effect` rejects the effect form, which is the same
reason `builder/FontSample.tsx` wires its observer in a ref callback. When no
observer is available, the fallback renders the final state.

**Site's reveal on `/print`.** `PrintAll` stacks every published page for the
browser's Save as PDF, and an unrevealed element would print blank. The same
CSS block that handles `prefers-reduced-motion` forces `.reveal` to its final
state under `@media print`.

**Contrast on a picked ground.** Unchanged and still derived rather than
enforced — a mid-grey ground tops out around 4.2:1 whichever ink it gets. This
work does not make it worse and does not fix it.

## Accessibility requirements

- Links rows: at least 44px touch targets with 8px separation.
- Visible focus on every interactive element; no `outline: none` anywhere.
- Site's nav anchors keyboard-reachable, with `aria-current` on the active
  chapter.
- The sticky nav's height reserved so it never covers a chapter.
- `scroll-behavior: smooth` scoped to the published wrapper.
- `prefers-reduced-motion: reduce` renders Site's final state with no
  transition.
- Body text at 16px minimum with a 1.5 line-height; no horizontal scroll at
  any width.

## Verification

```
npm run lint
npm run build                                   # with the dev server stopped
cd backend && .venv/bin/python -m pytest         # 258 tests
alembic upgrade head && alembic downgrade -1 && alembic upgrade head
```

There is no frontend test runner, so the rest is by hand. All five themes at
375, 768 and 1440 widths; in the builder canvas on both Desktop and Mobile; on
`/preview/[id]`; on `/print`; at `?section=<id>`; across the light, dark and
paper grounds and one picked ground; with contact hidden and the badge off;
and with reduced motion enabled.
