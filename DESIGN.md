---
name: FACET — The Exhibition Catalogue
description: A portfolio read as a catalogue of plates — work reproduced at plate scale on board, each plate mounted, trimmed and captioned.
colors:
  board: "#16233b"
  board-deep: "#0e1729"
  plate-white: "#ffffff"
  hairline: "#ffffff38"
  cloth-red: "#b5261e"
  cloth-red-lit: "#cc4136"
  foil: "#d9c37a"
  foil-dim: "#8a7a46"
  alert-ink: "#d37d78"
  stock-plate: "#ffffff"
  stock-plate-surface: "#eceef2"
  stock-plate-ink: "#16233b"
  stock-plate-foil: "#7a6118"
  stock-cloth: "#1f3a32"
  stock-cloth-surface: "#152a24"
  stock-cloth-foil: "#dfc98a"
  neutral-100: "#f2f4f7"
  neutral-200: "#dfe3ea"
  neutral-300: "#c3cad6"
  neutral-400: "#9ba5b6"
  neutral-500: "#7a8598"
  neutral-600: "#5e6a7d"
  neutral-700: "#46526a"
  neutral-800: "#2c3850"
  neutral-900: "#16233b"
  accent-100: "#fdf0ee"
  accent-200: "#f8d5d1"
  accent-300: "#f0aea7"
  accent-400: "#e07b70"
  accent-500: "#cc4136"
  accent-600: "#b5261e"
  accent-700: "#961b14"
  accent-800: "#71150f"
  accent-900: "#4a120e"
typography:
  half-title:
    fontFamily: "var(--font-bodoni-moda), Georgia, serif"
    fontSize: "clamp(54px, 9vw, 116px)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.04em"
  display:
    fontFamily: "var(--font-bodoni-moda), Georgia, serif"
    fontSize: "56px"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "var(--font-bodoni-moda), Georgia, serif"
    fontSize: "38px"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.015em"
  title:
    fontFamily: "var(--font-bodoni-moda), Georgia, serif"
    fontSize: "27px"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.015em"
  plate-title:
    fontFamily: "var(--font-bodoni-moda), Georgia, serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.15
  body:
    fontFamily: "var(--font-schibsted-grotesk), system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  caption:
    fontFamily: "var(--font-schibsted-grotesk), system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  caption-credit:
    fontFamily: "var(--font-schibsted-grotesk), system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.06em"
    fontFeature: "tabular-nums lining-nums"
  label:
    fontFamily: "var(--font-schibsted-grotesk), system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.14em"
  plate-number:
    fontFamily: "var(--font-bodoni-moda), Georgia, serif"
    fontSize: "13px"
    fontWeight: 500
    letterSpacing: "0"
    fontFeature: "tabular-nums lining-nums"
rounded:
  sm: "0px"
  md: "0px"
  lg: "0px"
spacing:
  keyline-inset: "7px"
  caption-gap: "8px"
  band-rule: "20px"
  page-x: "24px"
  page-x-md: "56px"
  page-y: "48px"
  page-y-md: "72px"
  plate-gap-x: "48px"
  plate-gap-y: "80px"
components:
  button-primary:
    backgroundColor: "{colors.cloth-red}"
    textColor: "{colors.plate-white}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0.6rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.cloth-red-lit}"
  button-primary-active:
    backgroundColor: "{colors.accent-700}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.plate-white}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0.6rem 1rem"
  button-secondary-hover:
    textColor: "{colors.foil}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foil}"
    typography: "{typography.label}"
    padding: "0.6rem 0.35rem"
  button-icon:
    height: "38px"
    width: "38px"
    padding: "0"
  input:
    backgroundColor: "{colors.board-deep}"
    textColor: "{colors.plate-white}"
    rounded: "{rounded.md}"
    padding: "8px 11px"
    height: "40px"
  tag-neutral:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-300}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "4px 9px"
  tag-accent:
    backgroundColor: "transparent"
    textColor: "{colors.foil}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "4px 9px"
  status-live:
    backgroundColor: "{colors.foil}"
    textColor: "{colors.board-deep}"
    typography: "{typography.label}"
    padding: "5px 10px"
  status-draft:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-300}"
    typography: "{typography.label}"
    padding: "5px 10px"
  plate:
    backgroundColor: "color-mix(in srgb, var(--color-ink) 7%, var(--color-bg))"
    rounded: "{rounded.md}"
  dialog:
    backgroundColor: "{colors.board-deep}"
    textColor: "{colors.plate-white}"
    rounded: "{rounded.lg}"
    padding: "1.5rem"
    width: "min(460px, 100%)"
---

# Design System: FACET — The Exhibition Catalogue

## Overview

**Creative North Star: "The Exhibition Catalogue"**

A portfolio here is a catalogue of plates. The work is reproduced at plate scale against board, each plate mounted and trimmed with a hairline keyline, each caption set on the board beneath the plate it describes, and the page's required tabs printed as a numbered plate list. The reader is looking at somebody's work reproduced, not at a profile — that distinction is the whole thesis, and every token below exists to hold it.

The register is institutional print: a didone half-title over a newspaper grotesk caption, hairlines rather than bars, facts rather than adjectives. Density is generous around the plates and tight inside the apparatus — a caption is read once, not studied, so it is small, flush left and short-measure, while the plate it belongs to takes the full column. Board is the ground on every route, including the owner's own chrome: there is no neutral application shell behind this world. Colour is spent almost nowhere. Cloth red fills exactly one action on a page and foil marks exactly what is open or live; everything else is ink, hairline and board.

Modernist — Archivo throughout, `#f3f2f2` ground, `#201e1d` ink, accent `#ec3013`, 2px dividers, grayscale photography — was discarded by explicit user decision and is the confirmed visual anti-reference. Two of its artifacts survive with new reasons rather than old ones: zero radius is retained because a trimmed mount has no corner radius, not as a brand commitment, and flush-left labels survive because a catalogue sets its apparatus against the page's own margin.

**Key Characteristics:**
- Board navy ground on every surface, published page and app chrome alike
- Plates mounted and trimmed: a 1px keyline, a lift off the board, never a card
- Captions on the board beneath the plate, always carrying role · date · credit
- 1px hairlines, never 2px bars; per-cell rules, never gaps over a coloured ground
- Didone half-titles and plate numbers against grotesk captions, body and controls
- Two colours of meaning: cloth red fills, foil marks
- One authored moment per surface — the plate turn and the caption lift

## Colors

A bound catalogue's palette: board navy as the ground, plate white as the ink, book cloth for the single filled action, and foil for everything that marks a state.

### Primary
- **Book Cloth Red** (`{colors.cloth-red}`): The binding colour, and the only fill a primary action ever gets. It measures 2.44:1 on board, so it can never be text there — white sits on it at 6.44:1. Its lit instance (`{colors.cloth-red-lit}`) is the hover, and `{colors.accent-700}` the press. This is also the default author accent.
- **Foil** (`{colors.foil}`): Stamped on the open plate, its number, every link, the live stamp, the focus ring, the caret and the scrollbar thumb. 9.00:1 on board. Foil is the mark colour and nothing else; it never fills a button.

### Secondary
- **Dim Foil** (`{colors.foil-dim}`): The resting scrollbar thumb, which brightens to full foil on hover. The only place the metal appears unlit.
- **Alert Ink** (`{colors.alert-ink}`): The same cloth red lightened until it reads on board — 2.44:1 becomes 5.21:1. A failure gets its own ink because it must be legible the instant it appears, and foil is the mark colour, not the alarm one.

### Neutral
- **Board Navy** (`{colors.board}` / `{colors.neutral-900}`): The ground everywhere. Not a page background with an app shell behind it — the board *is* the surface.
- **Deep Board** (`{colors.board-deep}`): The colour of a recess cut into the board: field interiors, dialogs, the counter-colour under a foil stamp.
- **Plate White** (`{colors.plate-white}`): Ink on board, and the paper a plate is printed on.
- **Hairline** (`{colors.hairline}`): Every rule in the system, at 1px.
- **Board-tinted ramp** (`{colors.neutral-100}` through `{colors.neutral-900}`): Tinted from the board's own hue rather than neutral grey, so a muted caption reads as board shadow and not as dirty white. 100 is lightest, 900 is the board itself. The published page's ground presets override 700 and 800, the two steps captions use.

### The three stocks
The published page swaps the system's own variables on one wrapper, so every component follows. Keys remain `light` / `dark` / `paper` — wire format — while the labels are the stocks:
- **Board** (`dark`, `{colors.board}`): the house ground; what a new portfolio opens on.
- **Plate** (`light`, `{colors.stock-plate}`): the catalogue printed on white stock, board navy as the ink, with its own darker foil (`{colors.stock-plate-foil}`).
- **Cloth** (`paper`, `{colors.stock-cloth}`): the binding, deep enough to hold white at full strength.

### Named Rules

**The Cloth Fills, Foil Marks Rule.** Cloth red is a fill and never text. Foil is a mark and never a fill behind a label it did not darken for. If a colour has to be read as a word, it is foil or ink; if it has to be read as a field, it is cloth.

**The One Board Rule.** Board is the ground on every route, including the owner's chrome. Never introduce a neutral grey or white application shell behind the world.

**The Derived Mark Rule.** An author may pick any accent and any ground, so a mark's lightness is the system's and its hue is the author's. `--color-mark` is the accent walked to the nearest instance of itself that clears 4.5:1 on that ground; `--color-accent-ink` is whichever of dark or light ink contrasts better with the accent fill. Both are derived at render, never authored, and the walk mixes toward pure white or black rather than toward the ink so the hue survives. Never paint link text or an open-plate mark from the raw `--color-accent`.

**The Tinted Mute Rule.** A muted colour is mixed from the ink toward the ground (`color-mix(in srgb, var(--color-ink) 62%, var(--color-bg))`, 6.5:1 on board), never set as a grey. A fixed grey breaks the moment an author picks their own ground.

## Typography

**Display Font:** Bodoni Moda (variable, optical-size axis; Georgia, serif fallback)
**Body Font:** Schibsted Grotesk (system-ui, sans-serif fallback)
**Apparatus Font:** Schibsted Grotesk — plate numbers excepted, which are Bodoni's lining figures

**Character:** A catalogue's didone against a newspaper grotesk. Bodoni Moda carries the half-title on stroke contrast alone and holds at both a 12px plate number and a 120px masthead because the optical-size axis is real. Schibsted Grotesk stays legible small, which is exactly what a caption is.

Both house faces are preloaded because every route renders them. Twelve author alternates (plus the two house faces, offered as choices) carry `preload: false` — preload is per-family, not per-page, so preloading all fourteen would fetch all fourteen to serve the one a portfolio picked. Every face in the list is variable and reaches at least 700, which is the entry requirement rather than a coincidence: headings ask 700, and a single-weight family would be faux-bolded into a smear.

### Hierarchy
- **Half-title** (700, `clamp(54px, 9vw, 116px)`, 1.08, `-0.04em`): The name at display scale in the opening band, flush left, with nothing else in it. Poster pushes the same role to `clamp(3.5rem, 13vw, 11.5rem)`.
- **Display / Headline / Title** (700, 56px / 38px / 27px, 1.08, `{typography.display.letterSpacing}`): `h1`–`h3`. Tracking is a variable (`--tracking`) retuned per portfolio.
- **Plate title** (700, 21px, 1.15): A plate's own title in the caption block. Where the mount already carries the title because there was no reproduction, the caption prints number and credit and leaves the title alone — a catalogue does not set the same title twice forty pixels apart.
- **Body** (400, 16px, 1.6): Descriptions and prose; 46–62ch measure depending on surface.
- **Caption** (400, 14px, 1.5, max 46ch): Set on the board beneath its plate. Short measure on purpose.
- **Caption credit** (11.5px, `0.06em`, uppercase, tabular lining figures): The role · medium · credit line.
- **Label** (600, 11px, `0.14em`, uppercase): `h6` and `.mono-label`, the tracked label marking every structural slot. 10–11px at `0.08em`–`0.1em` inside buttons, tags, status stamps, table heads and field labels.
- **Plate number** (Bodoni, 500, 13px, tabular lining, `0` tracking): Zero-padded, foil on the open plate.

Headline sizes multiply through `--type-scale` (Compact 0.82, Default 1, Display 1.28) and are emitted inline, because a Tailwind arbitrary font-size utility would beat a base rule.

### Named Rules

**The Apparatus Keeps Its Voice Rule.** Plate numbers, captions, labels and rules stay in the house faces whatever a portfolio picks for its own content (`--font-apparatus`, `--font-plate-no`). The catalogue's voice is the catalogue's, not the author's.

**The Pairing Is Two Faces Rule.** An author's headline choice sets `--font-heading`; their body choice sets both `--font-body` and `--font-sans`, because `--font-sans` is what Tailwind's `font-sans` resolves to and leaving it behind splits a page between two faces.

**The Tabular Figure Rule.** Figures in a catalogue line up in columns. `table`, `time` and `.figure` carry `tabular-nums lining-nums` so a column of dates, counts or plate numbers never jitters.

**The No Costume Mono Rule.** There is no monospaced face in the system's own voice. `.mono-label` is not monospaced; a mono face worn as a costume for "technical" is precisely what this world refuses.

## Layout

The page is a board with margins and plates set into them. Horizontal page margin is 24px, opening to 56px at `md` (`{spacing.page-x}` / `{spacing.page-x-md}`); vertical rhythm is 48px / 72px at Standard density, with Airy (`px-6 py-16 md:px-16 md:py-24`) and Dense (`px-5 py-8 md:px-10 md:py-12`) as the author's two other settings. Plates in a run are spaced `{spacing.plate-gap-x}` across and `{spacing.plate-gap-y}` down — the vertical gap is much the larger, because the gap is board, and board between plates is what makes them read as mounted rather than tiled.

Content measure is capped by role rather than by one container: 46ch for a caption, 52–62ch for body prose, 860px for the caption-lift detail view and the lens gate. Editorial sets a two-column board with the plate list in a sticky right or left margin (`lg:grid-cols-[250px_1fr]` / `[1fr_300px]`), collapsing to a horizontally scrolling plate list above the run below `lg`. Grid column count for the plate run is the author's (1 / 2 / 3, via `sm:` and `lg:` breakpoints at 40rem and 64rem). A tab row target always clears 44px: 60px for the underline row, 56px for Poster's block tab, 52px for the segmented variant.

Breakpoints are Tailwind's defaults as used: `sm` 40rem, `md` 48rem, `lg` 64rem. The published wrapper takes `min-height: var(--ground-min-h, 100dvh)` and `flex-grow: 1` so the page's own ground reaches both the bottom of the window and the bottom of the document; print drops the minimum to 0 so a stacked sheet is as tall as its content.

### Named Rules

**The No Horizontal Scroll Rule.** The body never scrolls sideways. The nav wraps rather than pushing its primary action off a narrow screen, tab rows scroll inside their own overflow container, and a grid tab cell takes `min-w-0` plus `overflow-hidden` so a long label clips in its own column instead of widening the page.

**The Per-Cell Rule Rule.** Never build grid rules out of `gap` over a coloured ground — a partly-filled last row shows the ground as empty blocks. Rule each cell on one edge and drop the rule on whichever cell opens a row, so the first figure stays flush with the page's own margin. Where the column count changes at a breakpoint, the reset has to be rewritten per breakpoint, because `:nth-child()` cannot read a variable.

## Elevation & Depth

Depth is two materials, not a shadow scale. A **plate** is lifted off the board: a 1px keyline ring plus an offset-and-blur shadow keyed to a colour *below* the board (`#050a14`) rather than to black, so it reads as a sheet catching light instead of an outlined box. A **recess** is cut into the board: deeper ground, a hairline, and no shadow at all — fields, dialogs, segmented controls. Nothing else is raised.

A plate derives its own surface as `color-mix(in srgb, var(--color-ink) 7%, var(--color-bg))` rather than taking `--color-surface`. Surface is the colour of a recess, so on board it is darker than the board — and a mount darker than what it is mounted on disappears. Deriving from the ink makes the sheet lighter on a dark ground and darker on a light one, which is what a mounted sheet does under any light.

### Shadow Vocabulary
- **Lift, small** (`box-shadow: 0 1px 3px color-mix(in srgb, #050a14 42%, transparent)`): A plate reproduced small — a thumbnail, a reference figure.
- **Lift, plate** (`box-shadow: 0 4px 14px color-mix(in srgb, #050a14 48%, transparent)`): The standard mount, always paired with `0 0 0 1px var(--color-divider)` as the trim.
- **Lift, insert** (`box-shadow: 0 18px 48px color-mix(in srgb, #050a14 55%, transparent)`): A loose insert laid on the board — the dialog, over a `color-mix(in srgb, #050a14 72%, transparent)` backdrop.

### Named Rules

**The Mount, Not Card Rule.** A plate holds one reproduction at plate scale and its caption lives outside it on the board. The moment a raised box contains its own title, description and buttons, it has become a card and left this world.

**The Paper Does Not Lift Rule.** In print the plate keeps its keyline and loses its shadow entirely: there is no light on paper to catch.

## Shapes

Zero radius throughout (`{rounded.sm}` / `{rounded.md}` / `{rounded.lg}` are all `0px`). This is not a brand commitment carried over from the discarded system — it is what a trimmed mount looks like, and it holds only because the catalogue wants a hairline plate edge. Everything cut from board is square: plates, tags, the radio indicator, segmented cells, status stamps, dialogs.

The recurring silhouette is the mounted sheet: a rectangle with a 1px trim ring and a second ruled keyline drawn 7px inside it, the way a catalogue prints a keyline around a reproduction. A plate with no reproduction available prints a ruled blank — 45° hairlines at 1px every 9px, mixed from the page's own ink — never a grey box and never an icon.

Rules are hairlines: 1px, never 2px, at the divider colour. Tags, status stamps and outlines are drawn with `inset box-shadow` rings rather than borders so they never change an element's box. Interface marks are one drawn glyph set (ten paths on a 24px grid, 1.75 stroke, one cap and one join), replacing the `✕ ↓ › → ↗` characters the interface used to print — a character takes whatever baseline the surrounding face gives it, and the surrounding face is now a didone.

## Components

### Buttons
- **Shape:** Trimmed square (`{rounded.md}`), 13px uppercase label at `0.08em`, apparatus face, 600.
- **Primary:** The one cloth fill on a page (`{components.button-primary}`), carrying `--color-accent-ink` rather than a hardcoded white, so a pale author accent gets dark ink instead of an unreadable label. Hover lights to `{colors.cloth-red-lit}`, press deepens to `{colors.accent-700}`.
- **Secondary:** Transparent on a hairline border; hover moves border and label to foil, press washes 16% foil behind it.
- **Ghost:** Foil label, no border, tighter inline padding; hover and press wash 14% / 22% foil.
- **Icon:** 38×38, no padding.
- **Block:** Full width and flush left — a button wider than its label starts at the padding edge, never centres.
- **Transitions:** 180ms on `--ease-out`. Disabled is 0.4 opacity.

### Chips (tags)
- **Style:** A catalogue's classification line: ruled, tracked, uppercase at 10.5px / `0.1em`, inset 1px ring, never a filled pill.
- **State:** `tag-accent` rings and sets in foil; `tag-neutral` rings in hairline and sets in tinted ink.

### Cards / Containers
There is no card. The container is the **plate** — see Elevation & Depth and the signature component below.

### Inputs / Fields
- **Style:** A recess cut into the board: `{colors.board-deep}` interior, 1px hairline, square, 15px text, 40px minimum height, foil caret. Placeholder is mixed from the ink at 58% so it follows a picked ground and still clears 4.5:1.
- **Label:** 11px uppercase at `0.1em`, tinted ink, 7px above the field.
- **Focus:** Border goes foil with a 2px inset foil rule under the field — the ruled underline of a filled-in form, not a glow.
- **Hover:** Border lifts to 45% ink.
- **Radio:** A 14px square, hairline at rest, foil border with a 3px inset foil fill when checked. Every radio group needs a `useId()` suffix: the builder mounts its controls twice.
- **Segmented control:** Hairline-ringed row of uppercase 11px cells divided by 1px rules; the checked cell fills foil with deep-board text.

### Navigation
- **Style:** The catalogue's running head — brand left in the display face at 22px, apparatus right at 11px uppercase `0.1em`, one hairline under it, baseline-aligned, wrapping rather than overflowing.
- **States:** Links inherit ink; hover and `aria-current="page"` go foil, 160ms.
- **Published tab row (the plate list):** Numbered, zero-padded, display face, with the section count as the one extra figure it earns. The open tab takes `--color-mark` with a 1px inset underline; the others sit at 0.62 opacity. Three variants — scrolling underline row (60px), Poster's solid block on the accent field (56px), segmented grid (52px). Four author navigation shapes: tabs, rail, scroll (chaptered, no filter) and lens (the visitor picks a plate list entry before anything is shown). There is no "everything" state; one tab is always open.

### Status stamp
Published or not is the one fact a card has to answer across a room, so it is a stamp rather than a tinted word: live strikes solid foil with deep-board text, draft is a hairline ring on tinted ink. A 6px square before the label repeats the fact without colour.

### Table
A plate list is a table, so the table is the plate list: 14px rows, uppercase 10.5px heads at `0.1em` closed by a 1px ink rule, body rows closed by hairlines, no vertical rules and no zebra.

### The Plate (signature)
A reproduction mounted on board: a 1px trim ring, the plate lift, a ruled keyline 7px inside the trim, and nothing else. Its caption is set outside it on the board, flush left, as plate number · title · `role · medium · credit` · description. Every credit field is read off what the author actually filled in, and an absent one prints an em dash rather than dropping the line, so two plates' captions stay comparable down a column.

A plate large enough to be worth catching light takes `tilt`: a soft radial sheen band that tracks the pointer through `--tilt-x` / `--tilt-y`, and a bounded 6° rotation. Pointer-only and mouse-only — a touch drag on a plate is a scroll, and stealing it would take the page's own gesture away. Unanimated while the pointer is on the plate, because specular travel has to be exactly as fast as the hand; eased (420ms) only on the return to rest. Reduced motion leaves the sheen off and the plate square.

### Motion
One authored moment per surface, on one curve. `--ease-out` (`cubic-bezier(0.16, 1, 0.3, 1)`) carries almost everything at 160–220ms; `--ease-turn` (`cubic-bezier(0.33, 0, 0.1, 1)`) at 520ms carries weight into the start of the plate turn.

- **The plate turn.** Changing tab never swaps a page. A persistent container animates its own box as the run inside it changes height; the turning happens per plate inside an `AnimatePresence` (`mode="popLayout"`), each leaf arriving from `rotateX(-7deg)`, 24px below and 7px of blur. A plate present in both rooms travels on a shared `layoutId` rather than leaving and arriving as two objects.
- **The caption lift.** Section detail expands the caption off the plate while the plate stays mounted behind it, sharing the same `layoutId` under one `LayoutGroup` — never a page that hides the collection.
- **Reveal on scroll** (Site): 520ms opacity, 14px rise and a 6px blur coming off; an observer adds `.in`, and the print, reduced-motion and `<noscript>` escapes all restore the finished state.
- **The sweeping underline:** a published link's rule grows from 0 to 100% width (220ms) as a gradient background, because `text-decoration` cannot be animated.
- Every one of these has a reduced-motion path: the turn becomes a 120ms crossfade, the reveal and the link rule become instant, the sheen is removed.

### Browser surfaces
The parts not drawn still carry the design: foil selection on deep board, foil caret, a dim-foil thin scrollbar that brightens on hover, and a 2px foil `:focus-visible` outline at 2px offset (0 offset inside a field, where the inset rule carries it).

## Do's and Don'ts

### Do:
- **Do** take every colour from a token and retune in `@theme` in `src/app/globals.css` — never hard-code a hex or a font name.
- **Do** build with `.plate`, `.caption`, `.caption-credit`, `.plate-no`, `.mono-label`, `.btn`, `.tag`, `.status`, `.input`, `.nav`, `.table` and `.hr` rather than inventing parallel classes.
- **Do** fill with cloth red and mark with foil, and derive both `--color-mark` and `--color-accent-ink` rather than painting from the raw accent.
- **Do** set a caption on the board beneath its plate, flush left, with all three credit fields present and an em dash where one is empty.
- **Do** rule hairlines at 1px, per cell, dropping the rule on whichever cell opens a row.
- **Do** keep the apparatus — plate numbers, captions, labels — in the house faces whatever face a portfolio picks.
- **Do** give every raised plate a keyline and a lift keyed below the board, and give every recess a hairline and no shadow.
- **Do** mix muted and placeholder colours from the ink toward the ground, so they survive any author-picked ground.
- **Do** give every motion a reduced-motion path and every scroll-revealed block a no-JavaScript escape.
- **Do** suffix every radio group's `name` with `useId()`.

### Don't:
- **Don't** set cloth red as text on board — it measures 2.44:1. If it has to be read as a word, it is foil or ink.
- **Don't** introduce a neutral grey or white application shell behind the world; board is the ground on every route, owner chrome included.
- **Don't** give a plate `--color-surface`. Surface is a recess, and a mount darker than its board disappears.
- **Don't** draw a 2px divider, or build grid rules out of `gap` over a coloured ground.
- **Don't** turn a plate into a card by putting its title, description and buttons inside the raised box.
- **Don't** add a radius to anything trimmed from board.
- **Don't** print an interface mark as a text character (`✕ ↓ › → ↗`); draw it from the glyph set, on the 24px grid at 1.75 stroke.
- **Don't** add a monospaced face as the system's own voice.
- **Don't** let the body scroll horizontally, or let a tab row push the page wider than the viewport.
- **Don't** preload an author-pickable face; preload is per-family, and only the two house faces earn it.
- **Don't** add a headline face that cannot reach 700, or a non-variable one.
- **Don't** ease a tilt while the pointer is on the plate, or exceed 6° of rotation.
- **Don't** animate a tab change as a page swap; the plate list re-numbers in place and the plates turn.
