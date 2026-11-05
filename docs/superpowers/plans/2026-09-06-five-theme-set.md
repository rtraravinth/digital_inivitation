# Five-Theme Set Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the seven published themes with five — Resume, Editorial, Poster, Links, Site — each answering a different question the author has.

**Architecture:** `themes.tsx` splits into `published/shared.tsx` (helpers, contexts, shared parts) plus one file per theme, and stays the public entry point so no importer changes. Two Alembic revisions bracket the frontend work: the first widens the theme check constraint to accept `resume` and `site`, the last remaps stored rows off the four removed themes and narrows the constraint to five. That ordering means every task leaves working software — the API never rejects a theme the UI is offering, and the UI never offers a theme the API rejects.

**Tech Stack:** Next.js 16.3.2, React 19.2.8, Tailwind CSS 4, FastAPI on PostgreSQL, Alembic, pytest.

**Spec:** `docs/superpowers/specs/2026-09-06-five-theme-set-design.md`

## Global Constraints

- **Zero border radius anywhere.** `--radius-*` is `0` on purpose. No circles, no rounded cards.
- **Take every colour from a token** — `var(--color-bg)`, `var(--color-ink)`, `var(--color-accent)`, `var(--color-divider)`, `var(--color-neutral-700)`, `var(--color-neutral-800)`. Never a raw hex in a theme.
- **Never build grid rules out of `gap` over a coloured ground.** A partly-filled last row shows the ground as empty grey blocks. Use per-cell `borderRight` / `borderBottom`.
- **The body must never scroll horizontally** at any width.
- **Headline sizes go through `headline("NNpx")`**, which returns a style object, because a Tailwind `text-[64px]` utility would beat the base rule that applies `--type-scale`.
- **No `setState` called directly from an effect body.** The React Compiler lint rule `react-hooks/set-state-in-effect` rejects it. Wire `IntersectionObserver` in a **ref callback**, as `src/components/builder/FontSample.tsx` does.
- **Every radio group needs a `useId()` suffix** — the builder mounts its controls twice.
- **The frontend has no test runner.** The gate for a frontend task is `npm run lint`, `npm run build` with the dev server stopped, and the named manual checks. Backend tasks use real pytest TDD.
- **The API is camelCase on the wire.** No mapping layer; keep it that way.
- Backend test command: `cd backend && .venv/bin/python -m pytest` (`.venv/Scripts` on Windows). 258 tests pass today.

## Deviations from the spec, decided while planning

1. **Two Alembic revisions, not one.** The spec called for a single revision. A single one cannot exist at any point where the frontend and backend disagree about the id set: adding Resume before the API accepts `resume` makes every save 422, and dropping `ledger` before the gallery stops offering it does the same in reverse. Task 2 widens; Task 8 narrows and remaps.
2. **Site's smooth scrolling is JavaScript, not `scroll-behavior: smooth`.** The spec put that property on the published wrapper. It would do nothing there — `scroll-behavior` only applies to an element that is itself the scroll container, and the wrapper is not; in-page anchors scroll `html`. Site therefore calls `scrollIntoView({ behavior })` on click, passing `"auto"` when `prefers-reduced-motion: reduce` matches. Nothing global is touched.
3. **`HeaderLinks` gains an `inline` variant** rather than Resume re-implementing the contact row. The privacy branch that hides contact details lives inside `HeaderLinks`, and duplicating it is how that switch eventually gets missed.
4. **The header's portrait field is `header.portrait`,** not `header.image` as the spec's Resume section wrote it. `Section` has `image`; `PortfolioHeader` has `portrait`.
5. **`DateEntry` is `{ id, year, text }`.** The timeline renders `text`, not `label`.
6. **A Résumé entry carries no date.** The spec described an entry as "title left, date right on the same baseline". There is no date to put there: `Section` is `{ id, title, description, tab, links, image, file, quote, hidden }`, and the only dates a portfolio holds are `header.dates`, drawn once as the timeline. Résumé renders the title alone and keeps the timeline as its own closing section. Adding a per-section date would be a schema change across `types.ts`, the API schemas, the editor and a migration — out of this plan's scope.

## File Structure

**Created**

| File | Responsibility |
| --- | --- |
| `src/components/published/shared.tsx` | Everything more than one theme needs: the ground palette and `derivedGround`, `groundStyle`, `headline`, `tabs`, `visibleSections`, `pad`, `gridCols`, `allNumbers`, `allDates`, `StatRow`, `useTabFilter`, `LensGate`, `Tabs`, `Kicker`, `href`, `SectionLinks`, `Media`, `SectionAside`, `HATCH`, the three contexts and their hooks, `useRecordClick`, `usePageHref`, `HeaderLinks`, `saveContact`, `SectionTitleLink`, `SectionCard`. |
| `src/components/published/themes/editorial.tsx` | `Editorial` only. |
| `src/components/published/themes/poster.tsx` | `Poster` only. |
| `src/components/published/themes/links.tsx` | `Links` only. |
| `src/components/published/themes/index-rail.tsx` | `IndexRail` — created by the split, deleted in Task 7. |
| `src/components/published/themes/ledger.tsx` | `Ledger` — created by the split, deleted in Task 7. |
| `src/components/published/themes/dossier.tsx` | `Dossier` — created by the split, deleted in Task 7. |
| `src/components/published/themes/broadsheet.tsx` | `Broadsheet` — created by the split, deleted in Task 7. |
| `src/components/published/themes/resume.tsx` | `Resume`, the print-first document. |
| `src/components/published/themes/site.tsx` | `Site`, the sticky-nav website, plus its `revealRef` and scroll-spy. |
| `src/components/published/section-detail.tsx` | `SectionDetail`, artboard 1d. |
| `backend/alembic/versions/<rev>_widen_theme_constraint.py` | Adds `resume` and `site` to the check constraint. |
| `backend/alembic/versions/<rev>_five_theme_set.py` | Remaps rows off the four removed themes, narrows the constraint to five. |

**Modified**

| File | Change |
| --- | --- |
| `src/components/published/themes.tsx` | Becomes re-exports plus the `PublishedBody` switch. |
| `src/lib/types.ts` | `ThemeId` union, `THEMES` metadata array. |
| `src/components/builder/controls.tsx` | `ThemeThumb` cases. |
| `src/lib/seed.ts` | Two seeds retargeted off removed themes. |
| `backend/app/seed_data.json` | Regenerated by `node backend/scripts/dump_seed.mjs`. |
| `src/app/globals.css` | `.reveal` / `.reveal.in`, its reduced-motion and print blocks, Resume print rules. |
| `backend/app/models/enums.py` | `ThemeId` literal and `THEMES` tuple. |
| `backend/tests/test_portfolios.py` | Theme references. |
| `CLAUDE.md` | The theme list and the `roleNav` applicability note. |

---

### Task 1: Split `themes.tsx`, no behaviour change

Pure move. The file is 1642 lines holding helpers plus seven themes; every later task edits it, and none of them should have to read all of it.

**Files:**
- Create: `src/components/published/shared.tsx`
- Create: `src/components/published/themes/{editorial,index-rail,poster,links,ledger,dossier,broadsheet}.tsx`
- Create: `src/components/published/section-detail.tsx`
- Modify: `src/components/published/themes.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `shared.tsx` exporting `HATCH`, `derivedGround(hex: string): Record<string, string>`, `groundStyle(p: Portfolio): CSSProperties`, `headline(size: string): CSSProperties`, `tabs(p: Portfolio): string[]`, `allNumbers(p: Portfolio): Stat[]`, `allDates(p: Portfolio): DateEntry[]`, `StatRow({ p, big }: { p: Portfolio; big?: boolean })`, `visibleSections(p: Portfolio): Section[]`, `pad(p: Portfolio): { card: string; page: string; row: string }`, `gridCols(p: Portfolio): string`, `useTabFilter(p: Portfolio)`, `LensGate`, `Tabs`, `Kicker`, `href(url: string): string`, `SectionLinks`, `Media`, `SectionAside`, `PrivacyProvider`, `usePublishedPrivacy`, `PublishedHandleProvider`, `usePublishedHandle`, `PreviewProvider`, `useIsPreview`, `useRecordClick`, `usePageHref`, `HeaderLinks`, `saveContact`, `SectionTitleLink`, `SectionCard`. Each theme file exports one component of the same name it has today. `themes.tsx` re-exports all of the above plus `PublishedBody` and `SectionDetail`.

- [ ] **Step 1: Move lines 1–706 of `themes.tsx` into `shared.tsx` verbatim**

Everything from the `"use client"` directive through `SectionTitleLink` and `SectionCard`, ending just before `export function Editorial`. Keep the comments — they carry the reasoning. Add `export` to the members that were file-private and are now imported across files: `allNumbers`, `allDates`, `StatRow`, `useTabFilter`, `LensGate`, `Tabs`, `Kicker`, `href`, `SectionLinks`, `Media`, `SectionAside`, `HeaderLinks`, `saveContact`, `SectionTitleLink`, `SectionCard`, `HATCH`.

- [ ] **Step 2: Move each theme into its own file**

One file per theme, each starting with `"use client";` and importing what it uses from `../shared`. Example, `src/components/published/themes/editorial.tsx`:

```tsx
"use client";

import Link from "next/link";
import type { Portfolio } from "@/lib/types";
import {
  HeaderLinks,
  Media,
  SectionCard,
  StatRow,
  Tabs,
  allDates,
  allNumbers,
  gridCols,
  groundStyle,
  headline,
  pad,
  tabs,
  useTabFilter,
} from "../shared";

export function Editorial({ p }: { p: Portfolio }) {
  // body moved verbatim from themes.tsx lines 707-939
}
```

Repeat for `index-rail.tsx` (`IndexRail`, lines 940–1052), `poster.tsx` (`Poster`, 1053–1139), `links.tsx` (`Links`, 1140–1293), `ledger.tsx` (`Ledger`, 1294–1389), `dossier.tsx` (`Dossier`, 1390–1477), `broadsheet.tsx` (`Broadsheet`, 1478–1578). Do not change a line of any body. Let the TypeScript errors tell you which imports each file needs.

- [ ] **Step 3: Move `SectionDetail` into `section-detail.tsx`**

Lines 1579–1624, verbatim, importing from `./shared`.

- [ ] **Step 4: Rewrite `themes.tsx` as the entry point**

```tsx
"use client";

import type { Portfolio } from "@/lib/types";
import { Broadsheet } from "./themes/broadsheet";
import { Dossier } from "./themes/dossier";
import { Editorial } from "./themes/editorial";
import { IndexRail } from "./themes/index-rail";
import { Ledger } from "./themes/ledger";
import { Links } from "./themes/links";
import { Poster } from "./themes/poster";

export * from "./shared";
export { SectionDetail } from "./section-detail";
export { Broadsheet, Dossier, Editorial, IndexRail, Ledger, Links, Poster };

export function PublishedBody({ p }: { p: Portfolio }) {
  switch (p.theme) {
    case "index":
      return <IndexRail p={p} />;
    case "poster":
      return <Poster p={p} />;
    case "links":
      return <Links p={p} />;
    case "ledger":
      return <Ledger p={p} />;
    case "dossier":
      return <Dossier p={p} />;
    case "broadsheet":
      return <Broadsheet p={p} />;
    default:
      return <Editorial p={p} />;
  }
}
```

- [ ] **Step 5: Verify nothing changed**

Run, with the dev server stopped:

```bash
npm run lint
npm run build
```

Expected: both pass, no new warnings. Then `npm run api` and `npm run dev`, open `/builder/<id>` and step through all seven themes in the gallery. Each must render exactly as before.

- [ ] **Step 6: Commit**

```bash
git add src/components/published
git commit -m "refactor: split themes.tsx into shared parts and one file per theme"
```

---

### Task 2: Widen the theme constraint to accept `resume` and `site`

The API must accept the two new ids before the UI can offer them.

**Files:**
- Modify: `backend/app/models/enums.py:13-16`
- Create: `backend/alembic/versions/<rev>_widen_theme_constraint.py`
- Test: `backend/tests/test_portfolios.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `THEMES` in `backend/app/models/enums.py` as a 9-tuple containing `"resume"` and `"site"`; the check constraint `ck_portfolios_theme_is_known` accepting all nine.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_portfolios.py`, following the file's existing client/auth fixtures:

```python
@pytest.mark.parametrize("theme", ["resume", "site"])
def test_patch_accepts_new_themes(client, auth_headers, portfolio_id, theme):
    response = client.patch(
        f"/api/v1/portfolios/{portfolio_id}",
        json={"theme": theme},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["theme"] == theme
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd backend && .venv/bin/python -m pytest tests/test_portfolios.py::test_patch_accepts_new_themes -v
```

Expected: FAIL — 422, because `resume` and `site` are not in the `ThemeId` literal.

- [ ] **Step 3: Widen the enum**

In `backend/app/models/enums.py`:

```python
ThemeId = Literal[
    "editorial", "index", "poster", "links", "ledger", "dossier", "broadsheet",
    "resume", "site",
]
THEMES: Final[tuple[str, ...]] = (
    "editorial", "index", "poster", "links", "ledger", "dossier", "broadsheet",
    "resume", "site",
)
```

- [ ] **Step 4: Widen the check constraint**

```bash
cd backend && .venv/bin/python -m alembic revision -m "widen theme constraint"
```

Fill the revision in:

```python
"""Accept the two new themes before the UI offers them.

Widening only. The four themes this set replaces are still accepted here;
the revision that removes them also remaps the rows that use them.
"""

OLD = "'editorial', 'index', 'poster', 'links', 'ledger', 'dossier', 'broadsheet'"
NEW = OLD + ", 'resume', 'site'"


def upgrade() -> None:
    op.drop_constraint("ck_portfolios_theme_is_known", "portfolios", type_="check")
    op.create_check_constraint("ck_portfolios_theme_is_known", "portfolios", f"theme IN ({NEW})")


def downgrade() -> None:
    op.drop_constraint("ck_portfolios_theme_is_known", "portfolios", type_="check")
    op.create_check_constraint("ck_portfolios_theme_is_known", "portfolios", f"theme IN ({OLD})")
```

- [ ] **Step 5: Run the migration and the whole suite**

```bash
cd backend && .venv/bin/python -m alembic upgrade head
cd backend && .venv/bin/python -m pytest
```

Expected: the new test passes, 259 tests pass in total.

- [ ] **Step 6: Round-trip the migration**

```bash
cd backend && .venv/bin/python -m alembic downgrade -1 && .venv/bin/python -m alembic upgrade head
```

Expected: no error.

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/enums.py backend/alembic/versions backend/tests/test_portfolios.py
git commit -m "feat(api): accept the resume and site themes"
```

---

### Task 3: The Resume theme

The professional one, and the whole reason for this change.

**Files:**
- Create: `src/components/published/themes/resume.tsx`
- Modify: `src/components/published/shared.tsx` (`HeaderLinks` gains `inline`)
- Modify: `src/lib/types.ts` (`ThemeId`, `THEMES`)
- Modify: `src/components/published/themes.tsx` (switch case)
- Modify: `src/components/builder/controls.tsx` (`ThemeThumb` case)
- Modify: `src/app/globals.css` (print rules)

**Interfaces:**
- Consumes: `groundStyle`, `headline`, `tabs`, `visibleSections`, `allNumbers`, `allDates`, `Media`, `SectionLinks`, `SectionAside`, `SectionTitleLink`, `HeaderLinks` from `../shared`.
- Produces: `Resume({ p }: { p: Portfolio })` from `themes/resume.tsx`; `"resume"` in `ThemeId`; `HeaderLinks({ p, block, inline })`.

- [ ] **Step 1: Add the `inline` variant to `HeaderLinks`**

In `shared.tsx`, replace the component's return with a branch that keeps the privacy check exactly as it is:

```tsx
export function HeaderLinks({
  p,
  block,
  inline,
}: {
  p: Portfolio;
  block?: boolean;
  inline?: boolean;
}) {
  const privacy = usePublishedPrivacy();
  if (!privacy.showContact) {
    return (
      <p className="m-0 text-[12px]" style={{ color: "var(--color-neutral-700)" }}>
        Contact details are hidden. Ask {p.header.name.split(" ")[0] || "the owner"} for
        them directly.
      </p>
    );
  }
  if (inline) {
    return (
      <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        {p.header.links.map((l, i) => (
          <span key={l.id} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true" style={{ color: "var(--color-neutral-700)" }}>·</span>}
            <a
              href={href(l.url)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--color-accent)" }}
            >
              {l.label || l.url}
            </a>
          </span>
        ))}
      </p>
    );
  }
  return (
    <div className={block ? "flex flex-col gap-2" : "flex flex-wrap gap-2"}>
      {p.header.links.map((l) => (
        <a
          key={l.id}
          href={href(l.url)}
          target="_blank"
          rel="noopener noreferrer"
          className={`btn btn-secondary ${block ? "btn-block" : ""}`}
        >
          {l.label}
        </a>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write the Resume component**

Create `src/components/published/themes/resume.tsx`:

```tsx
"use client";

import type { Portfolio } from "@/lib/types";
import {
  HeaderLinks,
  Media,
  SectionAside,
  SectionLinks,
  SectionTitleLink,
  allDates,
  allNumbers,
  groundStyle,
  headline,
  tabs,
  visibleSections,
} from "../shared";

/**
 * A resume, first and foremost printable. One column, rules instead of
 * cards, and every tab rendered as a heading rather than a filter: a CV that
 * showed one section at a time would be a CV with most of itself missing.
 * Resume therefore ignores `p.layout.roleNav`, as Poster already does.
 */
export function Resume({ p }: { p: Portfolio }) {
  const all = visibleSections(p);
  const chapters = tabs(p)
    .map((tab) => ({ tab, sections: all.filter((s) => s.tab === tab) }))
    .filter((c) => c.sections.length > 0);
  const numbers = allNumbers(p);
  const dates = allDates(p);

  return (
    <div style={groundStyle(p)}>
      <div className="resume-page mx-auto w-full max-w-[46rem] px-6 py-10 md:px-10">
        <header className="pb-6" style={{ borderBottom: "2px solid var(--color-divider)" }}>
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h1
                className="font-heading m-0 font-extrabold leading-none"
                style={headline("44px")}
              >
                {p.header.name}
              </h1>
              {p.header.current && (
                <p
                  className="m-0 mt-2 text-[15px]"
                  style={{ color: "var(--color-neutral-800)" }}
                >
                  {p.header.current}
                </p>
              )}
            </div>
            {p.header.portrait && (
              <div className="h-[96px] w-[96px] flex-none">
                <Media asset={p.header.portrait} className="h-full w-full" />
              </div>
            )}
          </div>
          {p.header.description && (
            <p className="m-0 mt-4 text-sm leading-relaxed opacity-80">
              {p.header.description}
            </p>
          )}
          <div className="mt-4">
            <HeaderLinks p={p} inline />
          </div>
        </header>

        {numbers.length > 0 && (
          <div className="flex flex-wrap py-4" style={{ borderBottom: "1px solid var(--color-divider)" }}>
            {numbers.slice(0, 8).map((n) => (
              <div key={n.id} className="pr-8 last:pr-0">
                <span className="font-heading text-[17px] font-extrabold">{n.value}</span>{" "}
                <span className="text-[13px]" style={{ color: "var(--color-neutral-700)" }}>
                  {n.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {chapters.map((c) => (
          <section key={c.tab} className="pt-8">
            <h2
              className="font-heading m-0 pb-2 text-[13px] font-extrabold uppercase tracking-[0.12em]"
              style={{
                color: "var(--color-accent)",
                borderBottom: "2px solid var(--color-divider)",
              }}
            >
              {c.tab}
            </h2>
            {c.sections.map((s) => (
              <article
                key={s.id}
                className="resume-entry py-5"
                style={{ borderBottom: "1px solid var(--color-divider)" }}
              >
                <SectionTitleLink
                  p={p}
                  section={s}
                  className="font-heading text-[18px] font-extrabold leading-tight hover:underline"
                />
                {s.description && (
                  <p className="m-0 mt-1.5 text-sm leading-relaxed opacity-80">
                    {s.description}
                  </p>
                )}
                <SectionAside p={p} section={s} />
                <div className="mt-2">
                  <SectionLinks p={p} section={s} />
                </div>
              </article>
            ))}
          </section>
        ))}

        {dates.length > 0 && (
          <section className="pt-8">
            <h2
              className="font-heading m-0 pb-2 text-[13px] font-extrabold uppercase tracking-[0.12em]"
              style={{
                color: "var(--color-accent)",
                borderBottom: "2px solid var(--color-divider)",
              }}
            >
              Timeline
            </h2>
            <dl className="m-0">
              {dates.map((d) => (
                <div
                  key={d.id}
                  className="resume-entry flex gap-6 py-3"
                  style={{ borderBottom: "1px solid var(--color-divider)" }}
                >
                  <dt className="mono-label w-[72px] flex-none">{d.year}</dt>
                  <dd className="m-0 text-sm">{d.text}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Register the theme**

In `src/lib/types.ts`, add `"resume"` to the `ThemeId` union and this entry at the **top** of `THEMES`, so the gallery opens on it:

```ts
  {
    id: "resume",
    name: "Résumé",
    desc: "One column, rules, made to print",
    long: "A plain document with every tab as a heading. The one to attach to an application.",
    audiences: ["advisers", "office", "multi"],
  },
```

In `themes.tsx`, import `Resume` and add `case "resume": return <Resume p={p} />;` to the switch.

- [ ] **Step 4: Add the thumbnail**

In `controls.tsx`, inside `ThemeThumb`'s switch:

```tsx
    case "resume":
      return (
        <span className={`${box} flex flex-col ${gap} ${pad}`} style={frame}>
          {bar("55%", "var(--color-ink)")}
          {bar("35%", grey)}
          <span className="mt-[2px] block h-[2px] w-full" style={{ background: accent }} />
          {bar("100%", grey)}
          {bar("100%", grey)}
          {bar("72%", grey)}
        </span>
      );
```

- [ ] **Step 5: Add the print rules**

In `src/app/globals.css`, at the end of the file:

```css
@media print {
  .resume-entry {
    break-inside: avoid;
    page-break-inside: avoid;
  }
}
```

- [ ] **Step 6: Verify**

```bash
npm run lint
npm run build
```

Then by hand: pick Résumé in the builder gallery; check the canvas at Desktop and Mobile; open `/preview/<id>`; print-preview `/print` and confirm no entry is split across a page break; open `?section=<id>` from a title; turn the `showContact` privacy switch off and confirm the contact line becomes the "hidden" sentence; check 375 / 768 / 1440 for horizontal scroll.

- [ ] **Step 7: Commit**

```bash
git add src/components/published src/lib/types.ts src/components/builder/controls.tsx src/app/globals.css
git commit -m "feat(themes): add the Résumé theme"
```

---

### Task 4: The Site theme

The exciting one: a full website with a sticky scroll-spy nav and scroll reveal.

**Files:**
- Create: `src/components/published/themes/site.tsx`
- Modify: `src/lib/types.ts`, `src/components/published/themes.tsx`, `src/components/builder/controls.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes: `groundStyle`, `headline`, `tabs`, `visibleSections`, `allNumbers`, `allDates`, `Media`, `SectionLinks`, `SectionAside`, `SectionTitleLink`, `HeaderLinks`, `pad` from `../shared`.
- Produces: `Site({ p }: { p: Portfolio })`; `"site"` in `ThemeId`; the `.reveal` / `.reveal.in` CSS contract.

- [ ] **Step 1: Add the reveal CSS**

In `src/app/globals.css`, after the Resume print block:

```css
@layer components {
  .reveal {
    opacity: 0;
    transform: translateY(12px);
    transition:
      opacity 400ms ease-out,
      transform 400ms ease-out;
  }
  .reveal.in {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reveal,
  .reveal.in {
    opacity: 1;
    transform: none;
    transition: none;
  }
}

@media print {
  .reveal,
  .reveal.in {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
```

The print block matters: `/print` stacks every published page for the browser's Save as PDF, and an unrevealed element would print blank.

- [ ] **Step 2: Write the Site component**

Create `src/components/published/themes/site.tsx`:

```tsx
"use client";

import { useCallback, useState } from "react";
import type { Portfolio } from "@/lib/types";
import {
  HeaderLinks,
  Media,
  SectionAside,
  SectionLinks,
  SectionTitleLink,
  allDates,
  allNumbers,
  groundStyle,
  headline,
  pad,
  tabs,
  visibleSections,
} from "../shared";

/**
 * Reveal on scroll, wired in a ref callback rather than an effect.
 *
 * Two reasons it cannot be an effect. The React Compiler lint rule
 * `react-hooks/set-state-in-effect` rejects the no-observer fallback, which
 * has to mark everything visible immediately; and the root has to be resolved
 * from the observed node. The builder's canvas portals this page into an
 * iframe, so an observer with no `root` measures against the *parent*
 * document's viewport and nothing here ever counts as visible — every chapter
 * would sit at opacity 0 in the builder. `ownerDocument.scrollingElement` is
 * the frame's own scroller when we are inside one, and `html` when we are not.
 *
 * The class is toggled on the DOM node directly: this is presentation with no
 * bearing on what React renders, and routing it through state would re-render
 * the whole page on every chapter that scrolls past.
 */
function revealRef(node: HTMLElement | null) {
  if (!node) return;
  if (typeof IntersectionObserver === "undefined") {
    node.classList.add("in");
    return;
  }
  const io = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("in");
        obs.unobserve(entry.target);
      }
    },
    {
      root: node.ownerDocument.scrollingElement,
      rootMargin: "0px 0px -10% 0px",
      threshold: 0.01,
    },
  );
  io.observe(node);
  return () => io.disconnect();
}

export function Site({ p }: { p: Portfolio }) {
  const all = visibleSections(p);
  const options = tabs(p);
  const chapters = options
    .map((tab, i) => ({ tab, id: `chapter-${i}`, sections: all.filter((s) => s.tab === tab) }))
    .filter((c) => c.sections.length > 0);
  const numbers = allNumbers(p);
  const dates = allDates(p);
  const [active, setActive] = useState("");
  const current = active || chapters[0]?.id || "";

  // Same root problem as revealRef, and the same fix. setState runs from the
  // observer's callback, never from an effect body.
  const spyRef = useCallback((node: HTMLElement | null) => {
    if (!node || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive((entry.target as HTMLElement).id);
        }
      },
      {
        root: node.ownerDocument.scrollingElement,
        rootMargin: "-45% 0px -45% 0px",
        threshold: 0,
      },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  // scroll-behavior would have to sit on the scroll container to work, and
  // the published wrapper is not one. Doing it here keeps it scoped to this
  // theme and lets the motion preference be honoured.
  const jump = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = event.currentTarget.ownerDocument.getElementById(id);
    if (!target) return;
    event.preventDefault();
    const reduced = event.currentTarget.ownerDocument.defaultView?.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  return (
    <div style={groundStyle(p)}>
      <nav
        className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3 md:px-10"
        style={{
          background: "var(--color-bg)",
          borderBottom: "2px solid var(--color-divider)",
        }}
      >
        <span className="font-heading text-[15px] font-extrabold">{p.header.name}</span>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {chapters.map((c) => (
            <a
              key={c.id}
              href={`#${c.id}`}
              onClick={(e) => jump(e, c.id)}
              aria-current={c.id === current ? "true" : undefined}
              className="font-heading py-1 text-[13px] font-extrabold"
              style={{
                color: c.id === current ? "var(--color-accent)" : "var(--color-neutral-700)",
                boxShadow: c.id === current ? "inset 0 -2px 0 var(--color-accent)" : "none",
              }}
            >
              {c.tab}
            </a>
          ))}
        </div>
      </nav>

      <header className="grid gap-8 px-6 py-14 md:grid-cols-[1.4fr_1fr] md:px-10">
        <div ref={revealRef} className="reveal">
          <h1
            className="font-heading m-0 font-extrabold leading-[0.95]"
            style={headline("64px")}
          >
            {p.header.name}
          </h1>
          {p.header.current && (
            <p className="m-0 mt-4 text-[17px]" style={{ color: "var(--color-neutral-800)" }}>
              {p.header.current}
            </p>
          )}
          {p.header.description && (
            <p className="m-0 mt-4 max-w-[52ch] text-sm leading-relaxed opacity-80">
              {p.header.description}
            </p>
          )}
          <div className="mt-6">
            <HeaderLinks p={p} />
          </div>
        </div>
        {p.header.portrait && (
          <div ref={revealRef} className="reveal h-[280px] w-full md:h-full">
            <Media asset={p.header.portrait} className="h-full w-full" />
          </div>
        )}
      </header>

      {numbers.length > 0 && (
        <div
          ref={revealRef}
          className="reveal grid grid-cols-2 md:grid-cols-4"
          style={{ background: "var(--color-accent)" }}
        >
          {numbers.slice(0, 8).map((n) => (
            <div
              key={n.id}
              className="px-6 py-8"
              style={{ borderRight: "1px solid rgba(255,255,255,.25)", borderBottom: "1px solid rgba(255,255,255,.25)" }}
            >
              <div
                className="font-heading font-extrabold leading-none"
                style={{ fontSize: 40, color: "#fff" }}
              >
                {n.value}
              </div>
              <div className="mt-1.5 text-xs" style={{ color: "rgba(255,255,255,.8)" }}>
                {n.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {chapters.map((c) => (
        <section key={c.id} id={c.id} ref={spyRef} className="px-6 pt-14 md:px-10">
          <h2
            className="font-heading m-0 pb-3 font-extrabold"
            style={{ ...headline("30px"), borderBottom: "2px solid var(--color-divider)" }}
          >
            {c.tab}
          </h2>
          <div
            className="grid md:grid-cols-2"
            style={{ borderTop: "1px solid var(--color-divider)" }}
          >
            {c.sections.map((s, i) => (
              <article
                key={s.id}
                ref={revealRef}
                className={`reveal flex flex-col gap-2.5 ${pad(p).card} ${i === 0 ? "md:col-span-2" : ""}`}
                style={{
                  transitionDelay: `${Math.min(i, 6) * 60}ms`,
                  borderRight: "1px solid var(--color-divider)",
                  borderBottom: "1px solid var(--color-divider)",
                }}
              >
                {s.image && (
                  <Media
                    asset={s.image}
                    className={`mb-1 w-full ${i === 0 ? "h-[260px]" : "h-[160px]"}`}
                  />
                )}
                <SectionTitleLink
                  p={p}
                  section={s}
                  className="font-heading text-[21px] font-extrabold leading-tight hover:underline"
                />
                <p className="m-0 flex-1 text-sm opacity-80">{s.description}</p>
                <SectionAside p={p} section={s} />
                <SectionLinks p={p} section={s} />
              </article>
            ))}
          </div>
        </section>
      ))}

      {dates.length > 0 && (
        <section className="px-6 pt-14 md:px-10">
          <h2
            className="font-heading m-0 pb-3 font-extrabold"
            style={{ ...headline("30px"), borderBottom: "2px solid var(--color-divider)" }}
          >
            Timeline
          </h2>
          <ol
            className="m-0 grid list-none p-0 md:grid-flow-col md:auto-cols-fr"
            style={{ borderTop: "1px solid var(--color-divider)" }}
          >
            {dates.map((d, i) => (
              <li
                key={d.id}
                ref={revealRef}
                className="reveal px-5 py-6"
                style={{
                  transitionDelay: `${Math.min(i, 6) * 60}ms`,
                  borderRight: "1px solid var(--color-divider)",
                  borderBottom: "1px solid var(--color-divider)",
                }}
              >
                <div className="mono-label" style={{ color: "var(--color-accent)" }}>
                  {d.year}
                </div>
                <p className="m-0 mt-1.5 text-sm">{d.text}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer
        className="mt-14 flex flex-wrap items-center justify-between gap-4 px-6 py-10 md:px-10"
        style={{ borderTop: "2px solid var(--color-divider)" }}
      >
        <HeaderLinks p={p} />
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            const doc = e.currentTarget.ownerDocument;
            const reduced = doc.defaultView?.matchMedia("(prefers-reduced-motion: reduce)").matches;
            doc.scrollingElement?.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
          }}
          className="font-heading text-[13px] font-extrabold"
          style={{ color: "var(--color-accent)" }}
        >
          Back to top ↑
        </a>
      </footer>
    </div>
  );
}
```

- [ ] **Step 3: Register the theme**

Add `"site"` to the `ThemeId` union. Add to `THEMES`, after `poster`:

```ts
  {
    id: "site",
    name: "Site",
    desc: "A real website: sticky nav, hero, work grid",
    long: "A full personal website — a sticky nav that follows you down the page, a hero, and the work in a grid.",
    badge: "New",
    audiences: ["multi", "founders"],
  },
```

In `themes.tsx`, import `Site` and add `case "site": return <Site p={p} />;`.

- [ ] **Step 4: Add the thumbnail**

```tsx
    case "site":
      return (
        <span className={`${box} flex flex-col ${gap} ${pad}`} style={frame}>
          <span className="flex items-center justify-between">
            {bar("22%", "var(--color-ink)")}
            {bar("34%", accent)}
          </span>
          <span className="grid flex-1 grid-cols-2 gap-[2px]">
            <span className="col-span-2" style={{ background: grey }} />
            <span style={{ background: grey }} />
            <span style={{ background: grey }} />
          </span>
        </span>
      );
```

- [ ] **Step 5: Verify, with the iframe check first**

```bash
npm run lint
npm run build
```

Then, in order — the first check is the one most likely to fail:

1. Open the builder on a Site portfolio. Every chapter must be **visible**, not stuck faded out. If anything sits at opacity 0, `root` is resolving wrong; re-read the comment on `revealRef`.
2. Scroll the canvas: the nav's active underline must follow the current chapter.
3. `/preview/<id>`, then `/print` — on `/print` every Site page must be fully rendered, nothing blank.
4. Enable reduced motion in the OS or DevTools rendering pane: everything renders in place with no transition, and the nav jumps rather than glides.
5. Tab through the nav: every anchor focusable with a visible ring, active one marked `aria-current`.
6. 375 / 768 / 1440: no horizontal scroll; the nav wraps rather than pushing anything off-screen; the sticky nav never covers a heading.

- [ ] **Step 6: Commit**

```bash
git add src/components/published src/lib/types.ts src/components/builder/controls.tsx src/app/globals.css
git commit -m "feat(themes): add the Site theme"
```

---

### Task 5: Rework Poster into a modern résumé

**Files:**
- Modify: `src/components/published/themes/poster.tsx`
- Modify: `src/lib/types.ts` (the Poster entry's `desc` and `long`)

**Interfaces:**
- Consumes: everything Poster already imports.
- Produces: `Poster` with an unchanged signature.

- [ ] **Step 1: Rework the hero**

Keep the accent field. Replace the display heading's size with `headline("clamp(3rem, 10vw, 9rem)")` and add `letterSpacing: "-0.04em"` on the same style object. Keep `font-extrabold` and `leading-[0.9]`.

- [ ] **Step 2: Replace the body with the two-column résumé grid**

Below the hero — everything after `<StatRow p={p} big />` and before the closing wrapper `</div>` — replace the current single-column stack with:

```tsx
      <div className="grid gap-10 px-6 py-12 md:grid-cols-[minmax(180px,240px)_1fr] md:px-10">
        <nav className="md:sticky md:top-6 md:self-start">
          <ol className="m-0 list-none p-0">
            {tabs(p).map((t, i) => (
              <li key={t} style={{ borderBottom: "1px solid var(--color-divider)" }}>
                <button
                  type="button"
                  onClick={() => setTab(t)}
                  className="font-heading flex w-full cursor-pointer items-baseline gap-3 py-3 text-left font-extrabold"
                  style={{
                    color: t === tab ? "var(--color-accent)" : "inherit",
                    fontSize: 20,
                  }}
                >
                  <span className="mono-label flex-none">{String(i + 1).padStart(2, "0")}</span>
                  <span>{t}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div style={{ borderTop: "1px solid var(--color-divider)" }}>
          {shown.map((s) => (
            <article
              key={s.id}
              className="py-6"
              style={{ borderBottom: "1px solid var(--color-divider)" }}
            >
              <SectionTitleLink
                p={p}
                section={s}
                className="font-heading text-[24px] font-extrabold leading-tight hover:underline"
              />
              <p className="m-0 mt-2 text-sm leading-relaxed opacity-80">{s.description}</p>
              <SectionAside p={p} section={s} />
              <div className="mt-2">
                <SectionLinks p={p} section={s} />
              </div>
            </article>
          ))}
        </div>
      </div>
```

Poster keeps its own navigation and continues to ignore `p.layout.roleNav` — `useTabFilter` supplies `tab`, `setTab` and `shown`, and `nav` stays unread here.

- [ ] **Step 3: Keep `<StatRow p={p} big />` where it is**, directly under the hero. That is the oversized-figures row the design asks for.

- [ ] **Step 4: Update the gallery copy**

```ts
    desc: "A colour field, then the record",
    long: "A colour field and display type over the work, listed. A résumé for people who present.",
```

- [ ] **Step 5: Verify**

```bash
npm run lint
npm run build
```

Manual: Poster in the builder at Desktop and Mobile; the numbered tab list switches sections; the hero name does not overflow at 375px with the longest seeded name; `?section=<id>`; `/print`.

- [ ] **Step 6: Commit**

```bash
git add src/components/published/themes/poster.tsx src/lib/types.ts
git commit -m "feat(themes): rework Poster into a modern résumé"
```

---

### Task 6: Rework Links

**Files:**
- Modify: `src/components/published/themes/links.tsx`
- Modify: `src/lib/types.ts` (the Links entry's copy)

**Interfaces:**
- Consumes: unchanged.
- Produces: `Links` with an unchanged signature.

- [ ] **Step 1: Rework the header**

Centre it and grow the avatar. Replace the current `flex items-start gap-3.5` block with:

```tsx
          <div className="flex flex-col items-center text-center">
            <div className="h-[96px] w-[96px] flex-none">
              <Media asset={p.header.portrait} className="h-full w-full" />
            </div>
            <h2 className="m-0 mt-3.5" style={headline("24px")}>
              {p.header.name}
            </h2>
            <p
              className="m-0 mt-1 text-[13px]"
              style={{ color: "var(--color-neutral-800)" }}
            >
              {p.header.description}
            </p>
          </div>
```

The avatar stays square. Zero border radius is a project rule, not a Links detail.

- [ ] **Step 2: Make the tab row a full-width segmented control**

```tsx
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${Math.max(tabs(p).length, 1)}, minmax(0, 1fr))`,
              borderBottom: "2px solid var(--color-divider)",
            }}
          >
            <Tabs p={p} tab={tab} setTab={setTab} variant="underline" />
          </div>
```

- [ ] **Step 3: Give the rows a real touch target and a press state**

On each row's wrapper, replace the existing padding classes with `flex min-h-[56px] items-center gap-3 px-[18px] py-3` and add:

```tsx
              style={{
                borderBottom: "2px solid var(--color-divider)",
                transition: "background 150ms ease-out, color 150ms ease-out",
              }}
              onPointerDown={(e) => {
                e.currentTarget.style.background = "var(--color-accent)";
                e.currentTarget.style.color = "#fff";
              }}
              onPointerUp={(e) => {
                e.currentTarget.style.background = "";
                e.currentTarget.style.color = "";
              }}
              onPointerLeave={(e) => {
                e.currentTarget.style.background = "";
                e.currentTarget.style.color = "";
              }}
```

56px clears the 44px minimum with room for the two lines of text.

- [ ] **Step 4: Narrow the column**

Change the wrapper's `max-w-[560px]` to `max-w-[30rem]`. It already centres.

- [ ] **Step 5: Update the gallery copy**

```ts
    desc: "A stack of tappable rows, thumb-sized",
    long: "One shareable page of rows, sized for a thumb. The link you put in a bio.",
```

- [ ] **Step 6: Verify**

```bash
npm run lint
npm run build
```

Manual: Links at 375px — every row at least 44px tall, press state visible on a real tap in the mobile canvas, click recording still firing (check a link click shows on `/stats` for a published page); the segmented tab row does not overflow with five tabs.

- [ ] **Step 7: Commit**

```bash
git add src/components/published/themes/links.tsx src/lib/types.ts
git commit -m "feat(themes): rework Links for a thumb"
```

---

### Task 7: Remove the four replaced themes from the frontend

The UI must stop offering them before the API stops accepting them.

**Files:**
- Delete: `src/components/published/themes/{index-rail,ledger,dossier,broadsheet}.tsx`
- Modify: `src/components/published/themes.tsx`, `src/lib/types.ts`, `src/components/builder/controls.tsx`, `src/lib/seed.ts`, `CLAUDE.md`
- Regenerate: `backend/app/seed_data.json`

**Interfaces:**
- Consumes: Tasks 3–6.
- Produces: `ThemeId` as `"resume" | "editorial" | "poster" | "links" | "site"`; `THEMES` with five entries.

- [ ] **Step 1: Narrow `ThemeId` and `THEMES`**

```ts
export type ThemeId = "resume" | "editorial" | "poster" | "links" | "site";
```

Remove the `index`, `ledger`, `dossier` and `broadsheet` entries from `THEMES`, then retag the survivors so the gallery's filter still divides them usefully:

| Theme | `audiences` |
| --- | --- |
| `resume` | `["advisers", "office", "multi"]` |
| `editorial` | `["multi", "founders"]` |
| `poster` | `["founders", "writers"]` |
| `links` | `["founders", "writers"]` |
| `site` | `["multi", "founders"]` |

Every audience keeps at least one theme: `advisers` and `office` on Résumé, `founders` on Editorial / Poster / Links / Site, `writers` on Poster and Links, `multi` on Résumé / Editorial / Site.

- [ ] **Step 2: Delete the four theme files and their switch cases**

`themes.tsx` becomes:

```tsx
export function PublishedBody({ p }: { p: Portfolio }) {
  switch (p.theme) {
    case "resume":
      return <Resume p={p} />;
    case "poster":
      return <Poster p={p} />;
    case "links":
      return <Links p={p} />;
    case "site":
      return <Site p={p} />;
    default:
      return <Editorial p={p} />;
  }
}
```

`editorial` stays the `default`, matching the fallback `normalize()` writes for an unrecognised stored theme.

- [ ] **Step 3: Delete the four `ThemeThumb` cases**

Remove `case "index"`, `case "ledger"`, `case "dossier"` and `case "broadsheet"` from `controls.tsx`. Leave the `default` alone.

- [ ] **Step 4: Retarget the seeds**

In `src/lib/seed.ts`, change the seed on `theme: "index"` to `theme: "resume"` — it is the long-history portfolio, which is exactly what Résumé is for. Leave the `poster` seed as it is. Then:

```bash
node backend/scripts/dump_seed.mjs
git diff --stat backend/app/seed_data.json
```

Expected: `seed_data.json` shows the theme change and nothing else structural.

- [ ] **Step 5: Update CLAUDE.md**

Two edits. Under **Layout**, replace the `published/themes.tsx` line's theme list with "the published page in five themes: Résumé, Editorial (1a), Poster (1c), Links (3a), Site". And replace the `roleNav` applicability paragraph:

> **`p.layout.roleNav` only applies to Editorial and Links.** Poster, Résumé and Site carry their own navigation — Poster its numbered list, Résumé every tab as a heading, Site its sticky nav. The Layout panel says so on screen rather than offering a control that silently does nothing.

Note in the same paragraph that the rail and lens options live on Editorial, since that is where Index rail and Dossier went.

- [ ] **Step 6: Verify**

```bash
npm run lint
npm run build
```

Manual: the gallery shows exactly five themes; each renders; a portfolio still stored on a removed theme falls back to Editorial without an error (temporarily set one in the database, load it, then set it back).

- [ ] **Step 7: Commit**

```bash
git add -A src/ backend/app/seed_data.json CLAUDE.md
git commit -m "feat(themes): cut Index rail, Ledger, Dossier and Broadsheet"
```

---

### Task 8: Narrow the API to five themes and remap stored rows

**Files:**
- Modify: `backend/app/models/enums.py`
- Create: `backend/alembic/versions/<rev>_five_theme_set.py`
- Modify: `backend/tests/test_portfolios.py`

**Interfaces:**
- Consumes: Task 7 (nothing in the product still asks for a removed theme).
- Produces: `THEMES` as `("resume", "editorial", "poster", "links", "site")`.

- [ ] **Step 1: Write the failing test**

```python
@pytest.mark.parametrize("theme", ["index", "ledger", "dossier", "broadsheet"])
def test_patch_rejects_removed_themes(client, auth_headers, portfolio_id, theme):
    response = client.patch(
        f"/api/v1/portfolios/{portfolio_id}",
        json={"theme": theme},
        headers=auth_headers,
    )
    assert response.status_code == 422
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd backend && .venv/bin/python -m pytest tests/test_portfolios.py::test_patch_rejects_removed_themes -v
```

Expected: FAIL — 200, because the enum still accepts all nine.

- [ ] **Step 3: Narrow the enum**

```python
ThemeId = Literal["resume", "editorial", "poster", "links", "site"]
THEMES: Final[tuple[str, ...]] = ("resume", "editorial", "poster", "links", "site")
```

- [ ] **Step 4: Fix the two existing references**

`grep -rn "broadsheet\|dossier\|ledger" backend/tests` finds two. Change them to a surviving theme; `editorial` unless the test is asserting something a specific theme provides.

- [ ] **Step 5: Write the migration**

```bash
cd backend && .venv/bin/python -m alembic revision -m "five theme set"
```

```python
"""Remap the four replaced themes and narrow the constraint to five.

The downgrade restores the old constraint but cannot un-remap a row: a
portfolio that was 'broadsheet' comes back as 'editorial'. That is a real
loss, not an oversight — the mapping is many-to-one and the original value
is not stored anywhere else.
"""

WIDE = (
    "'editorial', 'index', 'poster', 'links', 'ledger', 'dossier', "
    "'broadsheet', 'resume', 'site'"
)
FIVE = "'resume', 'editorial', 'poster', 'links', 'site'"


def upgrade() -> None:
    op.execute("UPDATE portfolios SET theme = 'resume' WHERE theme = 'ledger'")
    op.execute(
        "UPDATE portfolios SET theme = 'editorial' "
        "WHERE theme IN ('index', 'dossier', 'broadsheet')"
    )
    op.drop_constraint("ck_portfolios_theme_is_known", "portfolios", type_="check")
    op.create_check_constraint("ck_portfolios_theme_is_known", "portfolios", f"theme IN ({FIVE})")


def downgrade() -> None:
    op.drop_constraint("ck_portfolios_theme_is_known", "portfolios", type_="check")
    op.create_check_constraint("ck_portfolios_theme_is_known", "portfolios", f"theme IN ({WIDE})")
```

- [ ] **Step 6: Run the migration and the suite**

```bash
cd backend && .venv/bin/python -m alembic upgrade head
cd backend && .venv/bin/python -m pytest
```

Expected: all tests pass, including both new theme tests.

- [ ] **Step 7: Round-trip the migration**

```bash
cd backend && .venv/bin/python -m alembic downgrade -1 && .venv/bin/python -m alembic upgrade head
```

Expected: no error. Rows stay remapped, as the docstring says.

- [ ] **Step 8: Commit**

```bash
git add backend/
git commit -m "feat(api): narrow the theme set to five and remap stored rows"
```

---

### Task 9: Full verification pass

No new code. This is the gate before the branch is done.

**Files:** none.

- [ ] **Step 1: Run every automated check**

```bash
npm run lint
npm run build
cd backend && .venv/bin/python -m pytest
```

Expected: lint clean, build succeeds with the dev server stopped, all backend tests pass.

- [ ] **Step 2: Walk the matrix by hand**

For each of Résumé, Editorial, Poster, Links and Site:

- 375, 768 and 1440 widths, checking for horizontal body scroll at each.
- The builder canvas on both Desktop and Mobile.
- `/preview/<id>`.
- `/print`.
- `?section=<id>` reached from a section title.
- Light, dark and paper grounds plus one picked ground.
- `showContact` off — the contact line becomes the hidden-details sentence.
- `badge` off — "Claim your page" is gone.
- Reduced motion on — Site renders in place with no transition.
- Body text at 16px minimum with a 1.5 line-height, and no text under 12px anywhere.

- [ ] **Step 3: Publish one portfolio on each theme end to end**

Publish, open `/p/<handle>/<slug>` signed out, click a section link, confirm the click reaches `/stats`. Then unpublish. This is the only path that exercises the frozen-portfolio rules alongside the new themes.

- [ ] **Step 4: Report**

State plainly what passed and what did not, with the failing output if anything failed. Do not claim the branch is done on a partial pass.
