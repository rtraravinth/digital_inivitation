"use client";

import {
  animate,
  motion,
  useMotionValue,
  useSpring,
  type MotionValue,
} from "motion/react";
import { createContext, useCallback, useContext } from "react";
import type { CSSProperties, ElementType, ReactNode } from "react";
import type { Asset, MotionLevel, Portfolio, ThemeId } from "@/lib/types";
import { assetSrc } from "@/lib/types";
import { groundStyle } from "./shared";

/* ── the motion layer every theme is built on ─────────────────────────────

   Three rules hold for everything in this file.

   1. **Frame-aware.** The builder renders the page inside an iframe, and an
      observer or a scroll listener built from *this* module's globals
      measures the parent document — nothing inside the canvas would ever
      reveal or move. Every one of them is built from the observed node's
      own window (`node.ownerDocument.defaultView`), with no explicit root.
      `Site` learned this the long way; its notes are in git history.

   2. **Three levels, and the visitor wins.** `p.layout.motion` is the
      author's choice — full, subtle, off — and reaches the page as
      `data-motion` on the theme root, where CSS can read it. A visitor's
      `prefers-reduced-motion` overrides "full" and "subtle" in CSS and is
      re-checked at event time in JS. It is never read during render: the
      page is server-rendered and the server cannot know it, so reading it
      there would mismatch on hydration for exactly those visitors.

   3. **Paper and no-JS see the finished page.** Everything that starts
      hidden has escapes for print (globals.css), reduced motion (same) and
      no JavaScript (the <noscript> in app/layout.tsx).
   ──────────────────────────────────────────────────────────────────────── */

const MotionContext = createContext<MotionLevel>("full");

/** The author's level. Pair it with `reducedNow()` before doing anything costly. */
export function useMotionLevel(): MotionLevel {
  return useContext(MotionContext);
}

/** The visitor's reduced-motion preference, asked of the node's own window. */
export function reducedNow(node: Element | null | undefined): boolean {
  const view = node?.ownerDocument.defaultView;
  return Boolean(view?.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

/** Whether a fine pointer is in charge — tilt and spotlight are for a mouse only. */
function isMouse(e: React.PointerEvent) {
  return e.pointerType === "mouse";
}

/**
 * The published wrapper every motion theme renders into.
 *
 * `groundStyle()` supplies the author's palette and faces exactly as before;
 * this adds the motion level as an attribute, the theme's id so its CSS can
 * scope itself, and `overflow-x: clip` — the floating layers run past the
 * edges on purpose, and `clip` (unlike `hidden`) does not create a scroll
 * container, so a sticky nav inside still sticks to the window.
 */
export function ThemeRoot({
  p,
  theme,
  className = "",
  style,
  children,
  spotlight,
}: {
  p: Portfolio;
  theme: ThemeId;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  /** Track the pointer into `--mx` / `--my` for a `.fx-spot` layer. */
  spotlight?: boolean;
}) {
  const level = p.layout.motion;
  return (
    <MotionContext.Provider value={level}>
      <div
        data-fx-root={theme}
        data-motion={level}
        className={`fx-root relative ${className}`}
        style={{ ...groundStyle(p), overflowX: "clip", ...style }}
        onPointerMove={spotlight && level === "full" ? trackPointer : undefined}
      >
        {children}
      </div>
    </MotionContext.Provider>
  );
}

/** Writes the pointer's position on the element into `--mx` / `--my`. */
export function trackPointer(e: React.PointerEvent<HTMLElement>) {
  if (!isMouse(e)) return;
  const el = e.currentTarget;
  const box = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${(e.clientX - box.left).toFixed(0)}px`);
  el.style.setProperty("--my", `${(e.clientY - box.top).toFixed(0)}px`);
}

/* ── reveal ───────────────────────────────────────────────────────────── */

/**
 * Adds `.in` to the node the first time it scrolls into its own window.
 *
 * A ref callback, not an effect: the no-observer fallback has to mark the
 * node visible immediately, and the React Compiler lint rejects that from an
 * effect body. The class goes straight onto the DOM node — it is
 * presentation with no bearing on what React renders, and routing it through
 * state would re-render the page for every block that scrolls past. React
 * leaves it alone afterwards because the `className` prop does not change.
 */
export function revealRef(node: HTMLElement | null) {
  if (!node) return;
  const view = node.ownerDocument.defaultView;
  if (!view || typeof view.IntersectionObserver === "undefined") {
    node.classList.add("in");
    return;
  }
  // Already on screen when it mounts — the hero, mostly — so it does not
  // wait on the observer's first delivery, which some frames are slow to
  // make (an out-of-process iframe, a throttled tab). One frame first so the
  // hidden state is painted and the entrance actually plays; the timer is
  // the backstop for a frame that never comes.
  const box = node.getBoundingClientRect();
  if (box.top < view.innerHeight && box.bottom > 0) {
    const show = () => node.classList.add("in");
    view.requestAnimationFrame(() => view.requestAnimationFrame(show));
    const backstop = view.setTimeout(show, 400);
    return () => view.clearTimeout(backstop);
  }
  const io = new view.IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("in");
        obs.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
  );
  io.observe(node);
  return () => io.disconnect();
}

export type RevealKind = "up" | "tilt" | "flip" | "scale" | "left" | "right";

/**
 * A block that arrives as it scrolls into view. `kind` picks the entrance;
 * the CSS for each lives under "motion themes" in globals.css, and "subtle"
 * collapses every one of them to a short rise.
 */
export function Reveal({
  as: Tag = "div",
  kind = "up",
  delay = 0,
  className = "",
  style,
  children,
  id,
}: {
  as?: ElementType;
  kind?: RevealKind;
  /** Milliseconds; staggered lists pass index × 60–80. */
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  id?: string;
}) {
  return (
    <Tag
      id={id}
      ref={revealRef}
      data-fx={kind}
      className={`fx-reveal ${className}`}
      style={{ ...style, "--fx-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}

/**
 * A heading whose words rise into place one after another, hinged at the
 * baseline so each turns up out of the line rather than sliding.
 *
 * The words are spans in the heading's own text, so a screen reader and a
 * text search both read the heading as written.
 */
export function Words({
  text,
  as: Tag = "h1",
  className = "",
  style,
  accentLast,
}: {
  text: string;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  /** Sets the last word in the page's mark colour. */
  accentLast?: boolean;
}) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return (
    <Tag ref={revealRef} className={`fx-words ${className}`} style={style}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`}>
          <span
            className="fx-w"
            style={
              {
                "--i": i,
                color: accentLast && i === words.length - 1 && words.length > 1
                  ? "var(--color-mark)"
                  : undefined,
              } as CSSProperties
            }
          >
            {w}
          </span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </Tag>
  );
}

/* ── depth under the pointer ──────────────────────────────────────────── */

/**
 * A surface that leans toward the pointer, with an optional glare that
 * travels across it.
 *
 * Springs rather than direct writes, so it settles rather than snapping when
 * the pointer leaves. Children marked `.fx-z` with a `--z` sit at that depth
 * and separate from the surface as it turns — that is what makes it read as
 * 3D rather than as a skewed flat card. Mouse only: a touch drag across a
 * card is a scroll, and stealing it to tilt would take the page's own
 * gesture away.
 */
export function Tilt({
  children,
  className = "",
  style,
  max = 8,
  glare = true,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Degrees at the edge. "subtle" switches tilt off entirely. */
  max?: number;
  glare?: boolean;
}) {
  const level = useMotionLevel();
  const rx = useSpring(0, { stiffness: 170, damping: 18, mass: 0.6 });
  const ry = useSpring(0, { stiffness: 170, damping: 18, mass: 0.6 });
  const active = level === "full";

  return (
    <motion.div
      className={`fx-tilt relative ${className}`}
      style={{
        ...style,
        rotateX: active ? rx : 0,
        rotateY: active ? ry : 0,
        transformPerspective: 1100,
        transformStyle: "preserve-3d",
      }}
      onPointerMove={
        active
          ? (e) => {
              if (!isMouse(e) || reducedNow(e.currentTarget)) return;
              const el = e.currentTarget;
              const box = el.getBoundingClientRect();
              const px = (e.clientX - box.left) / box.width;
              const py = (e.clientY - box.top) / box.height;
              ry.set((px - 0.5) * 2 * max);
              rx.set((0.5 - py) * 2 * max);
              el.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`);
              el.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`);
              el.dataset.hot = "";
            }
          : undefined
      }
      onPointerLeave={
        active
          ? (e) => {
              rx.set(0);
              ry.set(0);
              delete e.currentTarget.dataset.hot;
            }
          : undefined
      }
    >
      {children}
      {glare && active && <span aria-hidden className="fx-glare" />}
    </motion.div>
  );
}

/* ── scroll-linked depth ──────────────────────────────────────────────── */

/**
 * How far an element has travelled through its own window: 0 as its top
 * enters at the bottom of the viewport, 1 as its bottom leaves at the top.
 *
 * A scroll listener on the node's own window, coalesced to one read per
 * frame, rather than Motion's `useScroll` — that one attaches to the window
 * this module was loaded in, which inside the builder's canvas is the
 * builder, not the page. When `enabled` is false nothing is attached and the
 * value sits at `rest`, so a still page costs nothing.
 */
export function useScrollProgress(
  enabled: boolean,
  rest = 0.5,
): [(node: HTMLElement | null) => (() => void) | undefined, MotionValue<number>] {
  const progress = useMotionValue(rest);

  const ref = useCallback(
    (node: HTMLElement | null) => {
      if (!node || !enabled || reducedNow(node)) return;
      const view = node.ownerDocument.defaultView;
      if (!view) return;
      let frame = 0;
      const read = () => {
        frame = 0;
        const box = node.getBoundingClientRect();
        const vh = view.innerHeight || 1;
        const travelled = (vh - box.top) / (vh + box.height);
        progress.set(Math.min(1, Math.max(0, travelled)));
      };
      const queue = () => {
        if (!frame) frame = view.requestAnimationFrame(read);
      };
      read();
      view.addEventListener("scroll", queue, { passive: true });
      view.addEventListener("resize", queue, { passive: true });
      return () => {
        view.removeEventListener("scroll", queue);
        view.removeEventListener("resize", queue);
        if (frame) view.cancelAnimationFrame(frame);
      };
    },
    [enabled, progress],
  );

  return [ref, progress];
}

/* ── figures ──────────────────────────────────────────────────────────── */

const FIGURE = /^(\D*?)(\d[\d,]*(?:\.\d+)?)([\s\S]*)$/;

/**
 * A figure that counts up to itself when it first scrolls into view.
 *
 * The finished value is what renders — on the server, on paper, with motion
 * off — and the count only rewrites the text node while it runs, ending on
 * exactly the string the author typed. A figure with no leading number
 * ("Top 1%", "Gold") is simply shown. Prefix and suffix are kept, so "₹2.5Cr"
 * counts 0 → 2.5 between its "₹" and its "Cr".
 */
export function CountUp({ value, className, style }: {
  value: string;
  className?: string;
  style?: CSSProperties;
}) {
  const level = useMotionLevel();

  const ref = useCallback(
    (node: HTMLSpanElement | null) => {
      if (!node || level === "off" || reducedNow(node)) return;
      const match = FIGURE.exec(value.trim());
      const view = node.ownerDocument.defaultView;
      if (!match || !view || typeof view.IntersectionObserver === "undefined") return;
      const [, prefix, digits, suffix] = match;
      const target = Number(digits.replace(/,/g, ""));
      if (!Number.isFinite(target) || target === 0) return;
      const decimals = digits.includes(".") ? digits.split(".")[1].length : 0;
      const grouped = digits.includes(",");
      const format = (n: number) => {
        const fixed = n.toFixed(decimals);
        return grouped ? Number(fixed).toLocaleString("en-IN", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }) : fixed;
      };

      // The text node React rendered, written in place. Assigning
      // `textContent` would swap in a new node and leave React updating the
      // detached one — the builder would then show a stale figure after the
      // author edits it.
      const write = (s: string) => {
        const text = node.firstChild;
        if (text && text.nodeType === 3) text.nodeValue = s;
      };

      let stop: (() => void) | undefined;
      const io = new view.IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const seconds = level === "subtle" ? 0.9 : 1.6;
        const controls = animate(0, target, {
          duration: seconds,
          ease: [0.16, 1, 0.3, 1],
          onUpdate: (n) => write(`${prefix}${format(n)}${suffix}`),
          onComplete: () => write(value),
        });
        // The count runs on animation frames, and frames can stall — a
        // throttled tab, a headless render, a page snapshotted mid-count.
        // A figure frozen at "0" is a wrong figure, so a plain timer lands
        // the real value once the count should have finished, frames or not.
        const settle = view.setTimeout(() => {
          controls.stop();
          write(value);
        }, seconds * 1000 + 250);
        stop = () => {
          controls.stop();
          view.clearTimeout(settle);
        };
      }, { threshold: 0.4 });
      io.observe(node);
      return () => {
        io.disconnect();
        stop?.();
        write(value);
      };
    },
    [level, value],
  );

  return (
    <span ref={ref} className={`figure ${className ?? ""}`} style={style}>
      {value}
    </span>
  );
}

/* ── a band that never stops ──────────────────────────────────────────── */

/**
 * A row of items running sideways forever. The list is drawn twice and the
 * track moves by exactly half its width, so the loop has no seam. The copy is
 * hidden from assistive tech, and "subtle", "off" and reduced motion all stop
 * the track and let the first copy wrap as an ordinary row.
 */
export function Marquee({
  items,
  className = "",
  itemClassName = "",
  seconds = 32,
}: {
  items: string[];
  className?: string;
  itemClassName?: string;
  seconds?: number;
}) {
  if (items.length === 0) return null;
  const row = (copy: boolean) => (
    <ul
      aria-hidden={copy || undefined}
      className={`fx-marquee-row m-0 flex flex-none list-none items-center gap-10 p-0 pr-10 ${copy ? "fx-marquee-copy" : ""}`}
    >
      {items.map((t, i) => (
        <li key={`${t}-${i}`} className={itemClassName}>
          {t}
        </li>
      ))}
    </ul>
  );
  return (
    <div className={`fx-marquee ${className}`}>
      <div className="fx-marquee-track" style={{ "--fx-marquee": `${seconds}s` } as CSSProperties}>
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

/* ── small shared pieces ──────────────────────────────────────────────── */

/** An uploaded photograph, through the author's photo treatment. */
export function Photo({
  asset,
  alt,
  className = "",
  style,
}: {
  asset: Asset;
  alt?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    // An API URL or a stored data URI — nothing for next/image to optimise.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={assetSrc(asset)}
      alt={alt ?? asset.name}
      loading="lazy"
      decoding="async"
      className={`published-photo ${className}`}
      style={style}
    />
  );
}

/** Up to two initials, for a page with no portrait. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Two-digit index, the way every theme numbers its chapters. */
export function nn(i: number): string {
  return String(i + 1).padStart(2, "0");
}

/**
 * Scrolls this page's own document to `id`, minus `offset` for a sticky nav.
 *
 * Not `scrollIntoView`, which walks every ancestor scrollport and does not
 * stop at an iframe boundary — in the builder's canvas it scrolled the
 * builder as well and took its toolbar off screen.
 */
export function jumpTo(e: React.MouseEvent<HTMLAnchorElement>, id: string, offset = 84) {
  const doc = e.currentTarget.ownerDocument;
  const target = doc.getElementById(id);
  const scroller = doc.scrollingElement;
  if (!target || !scroller) return;
  e.preventDefault();
  scroller.scrollTo({
    top: Math.max(0, target.getBoundingClientRect().top + scroller.scrollTop - offset),
    behavior: reducedNow(target) ? "auto" : "smooth",
  });
}

/** Back to the top of this page's own document; see `jumpTo`. */
export function toTop(e: React.MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  const doc = e.currentTarget.ownerDocument;
  doc.scrollingElement?.scrollTo({
    top: 0,
    behavior: reducedNow(e.currentTarget) ? "auto" : "smooth",
  });
}
