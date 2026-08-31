@AGENTS.md

# FACET

A multi-role portfolio builder. One page per portfolio: a header, then N
sections, each with the same four fields — title, description, tags, links.
Built from a Claude Design canvas (`Portfolio Page.dc.html`), turn 4.

## Running it

```
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

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

- `src/lib/types.ts` — `Portfolio` / `Section` / `PortfolioHeader`, plus
  `normalize()`, which backfills fields added after data was stored. Extend it
  whenever you add a field, or old localStorage data will break.
- `src/lib/store.tsx` — an external store read via `useSyncExternalStore`.
  localStorage is the backend; swap `commit()` and the initial read for API
  calls. Do **not** move this to `setState`-in-`useEffect` — the React Compiler
  lint rule rejects it.
- `src/lib/seed.ts` — the five seeded portfolios.
- `src/components/Editor.tsx` — artboards 4b (desktop document) and 4d (mobile),
  sharing one state tree.
- `src/components/published/themes.tsx` — the published page in three themes:
  Editorial (1a), Index rail (1b), Poster (1c).
- `src/app/globals.css` — the Modernist design system: tokens in `@theme`,
  component classes in `@layer components`.

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

## Storage is the constraint

localStorage is the only backend, and a browser gives this origin a few
megabytes total. Uploads are therefore stored as data URIs with limits in
`src/lib/assets.ts`: images are downscaled to 1400px and re-encoded as JPEG
until they fit ~420KB; other attachments are capped at 800KB. When a write
still fails, `commit()` records a message that the editor shows as a banner —
a failed save must never be silent. Account offers export/import so the data
can leave the browser.

## Analytics are real, not simulated

`src/lib/analytics.ts` counts actual views of `/p/[slug]` and actual clicks on
section links and file downloads, in localStorage. They reflect this browser
only, and `/stats` says so on screen. Never replace them with generated or
placeholder figures — show an empty state instead.

## Known gaps

- **No server.** Everything is per-browser: portfolios, uploads, analytics.
- **`/account` is not designed** anywhere in the canvas; it holds page
  addresses, export/import, and the reset actions.
- **The published page has no signed-out vs. owner distinction**, so
  "Claim your page" is decorative.
