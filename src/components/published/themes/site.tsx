"use client";

import { useCallback, useState } from "react";
import type { Portfolio } from "@/lib/types";
import {
  HeaderLinks,
  Media,
  SectionAside,
  SectionLinks,
  SectionTitleLink,
  StatRow,
  allDates,
  allNumbers,
  chaptersOf,
  groundStyle,
  headline,
  pad,
} from "../shared";

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
    <div data-site-root="" style={groundStyle(p)}>
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
        <div ref={revealRef} className="reveal">
          <StatRow p={p} big onAccent />
        </div>
      )}

      {chapters.map((c) => (
        <section
          key={c.id}
          id={c.id}
          ref={spyRef}
          className="scroll-mt-32 px-6 pt-14 md:px-10"
        >
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
