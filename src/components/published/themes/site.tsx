"use client";

import { useCallback, useState } from "react";
import type { Density, Portfolio } from "@/lib/types";
import {
  HeaderLinks,
  Media,
  SectionAside,
  SectionLinks,
  SectionTitleLink,
  StatRow,
  UiIcon,
  allDates,
  allNumbers,
  chaptersOf,
  groundStyle,
  headline,
} from "../shared";

/**
 * How much air a chapter entry gets. Site reads the Layout panel's density
 * control the same as Editorial does, but not through `pad()`: that helper's
 * `card` value is the padding under Editorial's top rule, and applying it
 * here alongside a vertical rhythm put `pt-*` and `py-*` on the same element
 * with the winner decided by stylesheet order rather than by intent.
 */
const CHAPTER_PAD: Record<Density, string> = {
  airy: "py-16",
  standard: "py-12",
  dense: "py-8",
};

/**
 * Reveal on scroll, wired in a ref callback rather than an effect.
 *
 * The React Compiler lint rule `react-hooks/set-state-in-effect` rejects the
 * no-observer fallback, which has to mark everything visible immediately —
 * that only works from a ref callback, never an effect body.
 *
 * The observer has to be built from the observed node's own window, not this
 * module's global. The builder's canvas portals this page into an iframe, so
 * an `IntersectionObserver` built from *this* module's `IntersectionObserver`
 * global measures against the *parent* document's viewport and nothing here
 * ever counts as visible — every chapter would sit at opacity 0 in the
 * builder. `node.ownerDocument.defaultView` is the frame's own window when we
 * are inside one, and just `window` when we are not.
 *
 * The fix is *not* `root: node.ownerDocument.scrollingElement`, which looks
 * like the obvious way to scope an explicit root to that window but silently
 * breaks on scroll: `getBoundingClientRect()` on a document's own scrolling
 * element returns a box pinned to document position 0, drifting upward as
 * the page scrolls rather than tracking the visible window. A percentage
 * `rootMargin` resolved against that drifting box only lines up with the
 * real viewport at scroll position zero — past that it stops matching
 * anything, so content beyond the first screen never reveals. Constructing
 * the observer via the frame's own `IntersectionObserver` constructor and
 * passing no `root` at all gets the *implicit* root instead — the
 * special-cased "this document's own viewport" that browsers apply only when
 * `root` is omitted, which is what an explicit root was trying and failing
 * to imitate.
 *
 * The class is toggled on the DOM node directly: this is presentation with no
 * bearing on what React renders, and routing it through state would re-render
 * the whole page on every chapter that scrolls past.
 */
function revealRef(node: HTMLElement | null) {
  if (!node) return;
  const view = node.ownerDocument.defaultView;
  if (!view || typeof view.IntersectionObserver === "undefined") {
    node.classList.add("in");
    return;
  }
  const io = new view.IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("in");
        obs.unobserve(entry.target);
      }
    },
    {
      rootMargin: "0px 0px -10% 0px",
      threshold: 0.01,
    },
  );
  io.observe(node);
  return () => io.disconnect();
}

/**
 * How far below the sticky nav a chapter counts as "reached" — the same
 * 128px as the `scroll-mt-32` on each chapter section, so a nav click and a
 * plain scroll agree on which chapter is current.
 */
const SPY_OFFSET = 128;

/**
 * Many small steps rather than the single crossing at `threshold: 0` — the
 * observer here exists only to wake the callback up often enough while
 * scrolling, not to decide anything by itself (see the comment on `spyRef`).
 */
const SPY_THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

/**
 * Every chapter section of *this* page, in document order — reading order.
 *
 * Scoped to the theme's own root rather than the whole document, because
 * `/print` stacks every published page into one document: two portfolios on
 * Site put two sets of chapters in it, and a document-wide query had each
 * page's nav highlighting — and its anchors scrolling to — whichever page
 * came first.
 *
 * Scrolled to the very bottom is forced to the last chapter outright, rather
 * than left to the "top past the line" rule below: when trailing content
 * after the last chapter (the timeline, the footer) is shorter than the
 * viewport, the page runs out of scroll room before that chapter's own top
 * ever reaches `SPY_OFFSET`, and the rule would otherwise leave the
 * *second*-to-last chapter active even at maximum scroll. That only holds
 * where there is scroll room at all: a page shorter than the viewport is
 * *always* at maximum scroll, and would otherwise open on its last chapter.
 */
function currentChapterId(root: HTMLElement): string {
  const sections = Array.from(root.querySelectorAll<HTMLElement>('[id^="chapter-"]'));
  if (sections.length === 0) return "";
  const doc = root.ownerDocument;
  const scroller = doc.scrollingElement ?? doc.documentElement;
  const scrolls = scroller.scrollHeight > scroller.clientHeight + 1;
  if (scrolls && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1) {
    return sections[sections.length - 1].id;
  }
  let current = sections[0].id;
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= SPY_OFFSET) current = section.id;
  }
  return current;
}

export function Site({ p }: { p: Portfolio }) {
  // The portfolio's own id is in there because `/print` renders every page
  // into one document, and two Site pages would otherwise both own
  // `chapter-0`: every nav highlighted the same chapter and a click on the
  // second page scrolled to the first page's content.
  const chapters = chaptersOf(p).map((c, i) => ({ ...c, id: `chapter-${p.id}-${i}` }));
  const numbers = allNumbers(p);
  const dates = allDates(p);
  const [active, setActive] = useState("");
  const current = active || chapters[0]?.id || "";

  // Same root problem as revealRef, and the same fix for the window — built
  // from the observed node's own, implicit root rather than an explicit
  // scrolling element. setState runs from the observer's callback, never
  // from an effect body.
  //
  // The first version used `rootMargin: "-45% 0px -45% 0px"` — a thin band
  // across the vertical *centre* of the viewport — and set `active` to
  // whichever chapter last reported `isIntersecting: true`. That is a
  // one-way ratchet: nothing intersects a centred band at the very top of
  // the page (the hero and numbers row push every chapter below it) or at
  // the very bottom (past the last chapter), so the callback simply stops
  // firing there, and `active` is stuck on whatever fired last — concretely,
  // scrolling from "Writing" back up to the hero left "Writing" highlighted
  // instead of reverting to "Work".
  //
  // The decision itself is `currentChapterId`, below: not "is this chapter
  // centred", but "has this chapter's heading reached the line just under
  // the sticky nav, and is it the last one that has." That rule is
  // monotonic and self-correcting in both directions — at the top, no
  // chapter has reached the line, so the first one wins by default;
  // anywhere in between, the most recent one to cross wins, which is
  // exactly the one being read — and it re-reads every chapter's live
  // position fresh each time rather than accumulating from a stream of
  // booleans, so it can't get stuck on a stale answer the way the centred
  // band did.
  //
  // The observer configured here is deliberately *not* shrunk to that line
  // with a `rootMargin`, even though that would seem like the obvious way
  // to get a crossing event exactly when it matters: tested directly against
  // this component, in the builder's nested iframe, a margined root —
  // pixel or percentage, explicit or implicit — simply stops delivering
  // after the first callback. A real scroll (mouse wheel, not just a
  // `scrollTop` assignment) inside the canvas produced exactly one entry, at
  // `observe()` time, and then silence all the way to the bottom of the
  // page. An *unmargined* root kept delivering throughout the same scroll.
  // Whatever the underlying engine reason, the fix that survives contact
  // with the builder's iframe is to stop asking the observer to do the
  // measuring at all: it only exists to wake this callback up often enough
  // while scrolling — `SPY_THRESHOLDS` is many steps rather than one so
  // that "often enough" holds for a chapter shorter than the viewport,
  // which is every chapter in practice — and `currentChapterId` does the
  // actual measuring itself, straight off `getBoundingClientRect()`, which
  // carries none of the root's baggage.
  const spyRef = useCallback((node: HTMLElement | null) => {
    const view = node?.ownerDocument.defaultView;
    if (!node || !view || typeof view.IntersectionObserver === "undefined") return;
    // The theme's own wrapper, so the measuring never reaches another
    // portfolio's chapters stacked into the same document by /print.
    const root =
      node.closest<HTMLElement>("[data-site-root]") ?? node.ownerDocument.documentElement;
    const io = new view.IntersectionObserver(() => setActive(currentChapterId(root)), {
      threshold: SPY_THRESHOLDS,
    });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  // scroll-behavior would have to sit on the scroll container to work, and
  // the published wrapper is not one. Doing it here keeps it scoped to this
  // theme and lets the motion preference be honoured.
  //
  // It scrolls this document's own scroller rather than calling
  // `scrollIntoView`, which walks *every* ancestor scrollport and does not
  // stop at an iframe boundary: in the builder's canvas it scrolled the
  // parent page too, aligning the iframe's top edge with the top of the
  // window and taking the builder's own sticky header off screen. Scrolling
  // `scrollingElement` cannot leave the frame. Same reason as the footer's
  // back-to-top below.
  //
  // A manual scroll does not honour `scroll-margin`, so SPY_OFFSET is
  // subtracted here — it is the same 128px the chapters carry as
  // `scroll-mt-32` for the no-JS fragment path, and the same line the
  // scroll-spy measures against, so the chapter a click lands on is the
  // chapter the nav then marks.
  const jump = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const doc = event.currentTarget.ownerDocument;
    const target = doc.getElementById(id);
    const scroller = doc.scrollingElement;
    const root = event.currentTarget.closest<HTMLElement>("[data-site-root]");
    if (!target || !scroller) return;
    event.preventDefault();
    const view = doc.defaultView;
    const reduced = view?.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({
      top: Math.max(0, target.getBoundingClientRect().top + scroller.scrollTop - SPY_OFFSET),
      behavior: reduced ? "auto" : "smooth",
    });

    // Recompute once the scroll settles. The observer only wakes the spy while
    // ratios are changing, and a jump can finish without crossing another
    // threshold step — so the nav kept marking the chapter you left. Clicking
    // "Writing" scrolled to Writing and highlighted the one above it.
    // `scrollend` is the exact signal; the timeout covers browsers without it.
    if (!root || !view) return;
    // Both, deliberately: `scrollend` is the exact signal but is not in every
    // browser, and the timeout covers the ones without it. Whichever lands
    // second recomputes the same answer, so a second call costs nothing.
    const settle = () => setActive(currentChapterId(root));
    view.addEventListener("scrollend", settle, { once: true });
    view.setTimeout(settle, 700);
  };

  return (
    <div data-site-root="" style={groundStyle(p)}>
      <nav
        className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-8 gap-y-2 px-6 py-2 md:px-10"
        style={{
          background: "var(--color-bg)",
          borderBottom: "2px solid var(--color-divider)",
        }}
      >
        <span
          className="font-heading text-lg font-extrabold"
          style={{ letterSpacing: "-0.02em" }}
        >
          {p.header.name}
        </span>
        <div className="flex flex-wrap gap-x-8 gap-y-1">
          {chapters.map((c) => (
            <a
              key={c.id}
              href={`#${c.id}`}
              onClick={(e) => jump(e, c.id)}
              aria-current={c.id === current ? "true" : undefined}
              className="font-heading flex min-h-[44px] items-center text-[15px] font-extrabold"
              style={{
                color: c.id === current ? "var(--color-accent)" : "var(--color-neutral-800)",
                boxShadow: c.id === current ? "inset 0 -3px 0 var(--color-accent)" : "none",
                transition: "color 160ms var(--ease-out)",
              }}
            >
              {c.tab}
            </a>
          ))}
        </div>
      </nav>

      {/* The portrait runs to the right edge of the window rather than
          stopping at the page's margin: it is the one full-bleed element on
          the theme, and it is what stops the hero reading as a two-column
          form. `pr-0` only on the wide layout, where there is a second
          column at all. */}
      <header className="grid gap-12 px-6 py-16 md:grid-cols-[1.3fr_1fr] md:items-end md:py-24 md:pr-0 md:pl-10">
        <div ref={revealRef} className="reveal flex flex-col items-start">
          {p.header.current && (
            <div className="card-kicker mb-6">{p.header.current}</div>
          )}
          <h1
            className="font-heading m-0 max-w-[13ch] font-extrabold"
            style={{
              ...headline("clamp(44px, 6.5vw, 84px)"),
              lineHeight: 0.94,
              letterSpacing: "-0.045em",
            }}
          >
            {p.header.name}
          </h1>
          {p.header.description && (
            <p
              className="m-0 mt-8 max-w-[46ch] text-xl leading-[1.52]"
              style={{ color: "var(--color-neutral-800)" }}
            >
              {p.header.description}
            </p>
          )}
          <div className="mt-10">
            <HeaderLinks p={p} />
          </div>
        </div>
        {p.header.portrait && (
          <div ref={revealRef} className="reveal h-[300px] w-full md:h-[560px]">
            <Media asset={p.header.portrait} className="h-full w-full" />
          </div>
        )}
      </header>

      {numbers.length > 0 && (
        <div ref={revealRef} className="reveal">
          <StatRow p={p} big onAccent />
        </div>
      )}

      {chapters.map((c) => (
        <section
          key={c.id}
          id={c.id}
          ref={spyRef}
          className="grid scroll-mt-32 gap-x-14 gap-y-8 px-6 pt-24 md:grid-cols-[232px_minmax(0,1fr)] md:px-10"
        >
          {/* The chapter number is set at display size in the ink at 10%:
              it marks where you are in the page without competing with the
              first heading under it, which is what a full-width rule and a
              30px title were both trying to do at once. */}
          <div className="flex flex-col gap-2.5 md:sticky md:top-24 md:self-start">
            <span
              className="font-heading font-extrabold"
              style={{
                ...headline("96px"),
                lineHeight: 0.8,
                letterSpacing: "-0.05em",
                color: "color-mix(in srgb, var(--color-ink) 12%, transparent)",
              }}
            >
              {String(chapters.indexOf(c) + 1).padStart(2, "0")}
            </span>
            <span className="card-kicker">{c.tab}</span>
          </div>
          <div className="grid">
            {c.sections.map((s, i) => (
              <article
                key={s.id}
                ref={revealRef}
                className={`reveal grid items-start gap-x-11 gap-y-5 first:pt-0 md:grid-cols-[minmax(0,1fr)_300px] ${CHAPTER_PAD[p.layout.density]}`}
                style={{
                  transitionDelay: `${Math.min(i, 6) * 60}ms`,
                  borderBottom: "1px solid var(--color-divider)",
                }}
              >
                <div className="flex flex-col items-start gap-3.5">
                <SectionTitleLink
                  p={p}
                  section={s}
                  className="font-heading text-[30px] leading-[1.02] font-extrabold tracking-[-0.035em] hover:underline md:text-[42px]"
                />
                <p
                  className="m-0 max-w-[54ch] text-[17px] leading-[1.62]"
                  style={{ color: "var(--color-neutral-800)" }}
                >
                  {s.description}
                </p>
                <SectionAside p={p} section={s} />
                <SectionLinks p={p} section={s} />
                </div>
                {s.image && (
                  <Media asset={s.image} className="h-[220px] w-full md:order-last" />
                )}
              </article>
            ))}
          </div>
        </section>
      ))}

      {dates.length > 0 && (
        <section className="px-6 pt-24 md:px-10">
          <h6 className="mb-8">Timeline</h6>
          <ol className="m-0 grid list-none grid-cols-2 gap-x-10 gap-y-10 p-0 md:grid-cols-4">
            {dates.map((d, i) => (
              <li
                key={d.id}
                ref={revealRef}
                className="reveal flex flex-col gap-2.5 pt-5"
                style={{
                  transitionDelay: `${Math.min(i, 6) * 60}ms`,
                  borderTop: "2px solid var(--color-divider)",
                }}
              >
                <div
                  className="font-heading text-3xl font-extrabold"
                  style={{ letterSpacing: "-0.03em", color: "var(--color-accent)" }}
                >
                  {d.year}
                </div>
                <p className="m-0 text-base leading-[1.45]">{d.text}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer
        className="mt-24 flex flex-wrap items-center justify-between gap-6 px-6 py-12 md:px-10"
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
          className="font-heading flex min-h-[44px] items-center gap-2 text-[15px] font-extrabold"
          style={{ color: "var(--color-accent)" }}
        >
          <UiIcon id="up" size={17} />
          Back to top
        </a>
      </footer>
    </div>
  );
}
