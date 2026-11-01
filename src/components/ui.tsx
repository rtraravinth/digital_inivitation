"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode } from "react";

/* ── the app's shared pieces ──────────────────────────────────────────────
   What Portfolios and Stats both draw, kept in one place so the two screens
   cannot drift: the icon set, the segmented control with its sliding
   marker, the Live / Draft pill, and the surface that leans in 3D.
   ──────────────────────────────────────────────────────────────────────── */

const EASE = [0.16, 1, 0.3, 1] as const;

export function Icon({ d, size = 16 }: { d: React.ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {d}
    </svg>
  );
}

export const ICON = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  share: (
    <>
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="19" cy="12" r="1" fill="currentColor" />
    </>
  ),
  pencil: <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4" />,
  out: <path d="M7 17 17 7M9 7h8v8" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  check: <path d="m5 12 5 5 9-10" />,
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
};

export function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-8 w-8 flex-none cursor-pointer place-items-center rounded-md transition-colors hover:bg-[var(--color-neutral-200)]"
      style={{ color: "var(--color-neutral-700)" }}
    >
      {children}
    </button>
  );
}

/** A segmented control whose marker slides between options on a shared id. */
export function Segmented<T extends string>({
  label,
  id,
  value,
  onChange,
  options,
}: {
  label: string;
  id: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<{ id: T; label: string; count?: number; icon?: React.ReactNode }>;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center gap-0.5 rounded-lg p-0.5"
      style={{ background: "var(--color-neutral-200)" }}
    >
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            aria-label={o.icon ? o.label : undefined}
            title={o.icon ? o.label : undefined}
            onClick={() => onChange(o.id)}
            className={`relative flex h-8 cursor-pointer items-center gap-1.5 rounded-md text-[13px] font-medium ${
              o.icon ? "w-9 justify-center" : "px-3"
            }`}
            style={{ color: on ? "var(--color-ink)" : "var(--color-neutral-700)" }}
          >
            {on && (
              // One pill per group, sliding between options on a shared id.
              <motion.span
                layoutId={`seg-${id}`}
                aria-hidden
                className="absolute inset-0 rounded-md"
                style={{ background: "var(--color-bg)", boxShadow: "var(--shadow-sm)" }}
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {o.icon ? <Icon d={o.icon} size={15} /> : o.label}
              {o.count !== undefined && (
                <span className="font-mono text-[11px]" style={{ color: "var(--color-neutral-600)" }}>
                  {o.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Live or draft, said so it reads across the room and without colour. */
export function StatusPill({ live, floating }: { live: boolean; floating?: boolean }) {
  return (
    <span
      className="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap"
      style={
        live
          ? {
              background: "var(--color-ink)",
              color: "var(--color-bg)",
              boxShadow: floating ? "0 2px 8px #0000004d" : undefined,
            }
          : {
              background: floating
                ? "color-mix(in srgb, var(--color-bg) 82%, transparent)"
                : "transparent",
              color: "var(--color-ink)",
              border: "1px dashed color-mix(in srgb, var(--color-ink) 45%, transparent)",
              backdropFilter: floating ? "blur(8px)" : undefined,
              WebkitBackdropFilter: floating ? "blur(8px)" : undefined,
            }
      }
    >
      {live ? (
        <span className="app-live-dot" aria-hidden />
      ) : (
        <span aria-hidden className="opacity-70">
          <Icon d={ICON.pencil} size={11} />
        </span>
      )}
      {live ? "Live" : "Draft"}
    </span>
  );
}

/**
 * A surface that leans toward the pointer in 3D, lifts while hovered, and
 * carries a soft light where the pointer is.
 *
 * Springs, so it settles rather than snapping when the pointer leaves.
 * Mouse only and never under reduced motion: a touch drag over a panel is
 * a scroll, and taking it to tilt would steal the page's own gesture.
 */
export function TiltPanel({
  children,
  className = "",
  style,
  max = 6,
  lift = 4,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Degrees at the edge. */
  max?: number;
  /** Pixels it rises while hovered. */
  lift?: number;
  as?: "div" | "section" | "article";
}) {
  const reduced = useReducedMotion();
  const rx = useSpring(0, { stiffness: 180, damping: 20 });
  const ry = useSpring(0, { stiffness: 180, damping: 20 });
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const glare = useMotionTemplate`radial-gradient(380px circle at ${gx}% ${gy}%, color-mix(in srgb, var(--color-ink) 7%, transparent), transparent 60%)`;
  const [hot, setHot] = useState(false);
  const Tag = motion[as];

  return (
    <Tag
      className={`relative ${className}`}
      style={{
        rotateX: rx,
        rotateY: ry,
        transformPerspective: 1200,
        border: "1px solid var(--color-divider)",
        background: "var(--color-bg)",
        ...style,
      }}
      animate={{
        y: hot && !reduced ? -lift : 0,
        boxShadow: hot
          ? "0 26px 50px -26px #00000059, 0 0 0 1px color-mix(in srgb, var(--color-ink) 18%, transparent)"
          : "0 1px 2px #0000000f",
      }}
      transition={{ duration: 0.3, ease: EASE }}
      onPointerEnter={() => setHot(true)}
      onPointerMove={(e) => {
        if (reduced || e.pointerType !== "mouse") return;
        const box = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - box.left) / box.width;
        const py = (e.clientY - box.top) / box.height;
        ry.set((px - 0.5) * 2 * max);
        rx.set((0.5 - py) * 2 * max);
        gx.set(px * 100);
        gy.set(py * 100);
      }}
      onPointerLeave={() => {
        setHot(false);
        rx.set(0);
        ry.set(0);
      }}
    >
      {!reduced && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ background: glare, opacity: hot ? 1 : 0, transition: "opacity 300ms" }}
        />
      )}
      {children}
    </Tag>
  );
}

/**
 * Said wherever it matters when the account has no handle.
 *
 * A published page lives at /p/<handle>/<page>, so without a handle a "live"
 * page has no address anyone can open — and since a visit is counted when
 * someone opens the page, its stats can only ever read zero. Nothing else in
 * the app made that visible: the page said Live and the numbers said 0.
 */
export function NoHandleNotice({ live }: { live: number }) {
  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl px-4 py-3.5"
      style={{ border: "1px solid var(--color-ink)", background: "var(--color-bg)" }}
    >
      <span
        aria-hidden
        className="grid h-6 w-6 flex-none place-items-center rounded-full text-[13px] font-bold"
        style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
      >
        !
      </span>
      <span className="min-w-0 flex-1 text-[13.5px] leading-snug">
        <strong className="font-semibold">Your pages don’t have a public address yet.</strong>{" "}
        Every page lives at <span className="font-mono text-[12.5px]">/p/your-handle/page</span>, and
        your account has no handle — so {live === 1 ? "your live page" : `your ${live} live pages`}{" "}
        can’t be opened by anyone, and can’t get visits. Choose a handle to fix it.
      </span>
      <Link href="/account" className="btn btn-primary" style={{ minHeight: 32, padding: "0.35rem 0.85rem", fontSize: 13 }}>
        Choose a handle
      </Link>
    </div>
  );
}

/* ── the app's one modal ──────────────────────────────────────────────────
   Every dialog in the app is this: a title, a short line under it, a close
   button, a body that scrolls on its own, and an optional footer that stays
   put. On a phone it rises as a sheet from the bottom edge.

   - **Portaled to <body>.** A fixed-position element inside a transformed
     ancestor is positioned against that ancestor, not the window — and the
     pages here put perspective and 3D transforms on their own wrappers.
   - **Focus stays inside.** It moves in on open, Tab cycles within, and it
     goes back to whatever opened the dialog when it closes.
   - **The page behind holds still,** and Escape or a click outside closes.

   Render it inside an `<AnimatePresence>` so it can animate out.
   ──────────────────────────────────────────────────────────────────────── */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  role = "dialog",
  width = 480,
}: {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  role?: "dialog" | "alertdialog";
  width?: number;
}) {
  const reduced = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  // Read through a ref so the effect below runs once per open, not once per
  // render of a parent that passes a fresh arrow each time.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const node = panel.current;
    // An element that asked for focus (autoFocus) keeps it; otherwise the
    // first control in the body, never the close button in the corner.
    if (node && !node.contains(document.activeElement)) {
      const first = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].find(
        (el) => !el.hasAttribute("data-modal-close"),
      );
      (first ?? node).focus();
    }
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2 }}
      style={{
        background: "color-mix(in srgb, #000 48%, transparent)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close.current();
      }}
    >
      <motion.div
        ref={panel}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl outline-none sm:rounded-2xl"
        style={{
          maxWidth: width,
          background: "var(--color-bg)",
          border: "1px solid var(--color-divider)",
          boxShadow: "var(--shadow-lg)",
        }}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.15 } }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
      >
        {/* The grab line a phone sheet carries. */}
        <span aria-hidden className="mx-auto mt-2 h-1 w-10 flex-none rounded-full sm:hidden" style={{ background: "var(--color-neutral-300)" }} />
        <header className="flex flex-none items-start gap-3 px-5 pt-4 pb-3 sm:px-6 sm:pt-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="m-0 text-[18px] leading-snug tracking-[-0.015em]">
              {title}
            </h2>
            {description && (
              <p id={descId} className="m-0 mt-1 text-[13.5px] leading-relaxed text-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            data-modal-close=""
            aria-label="Close"
            title="Close"
            onClick={() => close.current()}
            className="-mt-1 -mr-2 grid h-9 w-9 flex-none cursor-pointer place-items-center rounded-lg transition-colors hover:bg-[var(--color-neutral-200)]"
            style={{ color: "var(--color-neutral-700)" }}
          >
            <Icon d={<path d="M6 6l12 12M18 6 6 18" />} size={16} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
        {footer && (
          <footer
            className="flex flex-none flex-wrap items-center justify-end gap-2 px-5 py-3.5 sm:px-6"
            style={{ borderTop: "1px solid var(--color-divider)", background: "var(--color-surface)" }}
          >
            {footer}
          </footer>
        )}
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/* ── whole-page states ───────────────────────────────────────────────────── */

/**
 * The screen for "nothing to show here yet": loading, a redirect in flight,
 * a page that does not exist. One centred card on the app's backdrop, so a
 * waiting screen looks like the app it is waiting for.
 */
export function PageState({
  mark,
  title,
  note,
  busy,
  children,
}: {
  /** Large set-piece above the title, such as "404". */
  mark?: ReactNode;
  title: ReactNode;
  note?: ReactNode;
  /** Draws a spinner and announces the wait. */
  busy?: boolean;
  /** Actions under the note. */
  children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <>
      <div aria-hidden className="app-backdrop" />
      <main
        className="grid min-h-dvh place-items-center px-4 py-16"
        aria-busy={busy || undefined}
      >
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 12, rotateX: 8 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="flex w-full max-w-[420px] flex-col items-center text-center"
          style={{ transformPerspective: 1000 }}
        >
          {busy ? (
            <span className="relative mb-6 grid h-12 w-12 place-items-center" aria-hidden>
              <motion.span
                className="absolute inset-0 rounded-full"
                style={{ border: "2px solid var(--color-divider)", borderTopColor: "var(--color-ink)" }}
                animate={reduced ? undefined : { rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
              />
              <span
                className="grid h-7 w-7 place-items-center rounded-md text-[13px] font-bold"
                style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
              >
                F
              </span>
            </span>
          ) : mark ? (
            <span
              aria-hidden
              className="mb-4 font-mono text-[72px] leading-none font-semibold tracking-[-0.06em] sm:text-[96px]"
              style={{
                color: "transparent",
                WebkitTextStroke: "1.5px var(--color-ink)",
              }}
            >
              {mark}
            </span>
          ) : null}
          <h1 className="m-0 text-[22px] leading-tight font-semibold tracking-[-0.02em]" role={busy ? "status" : undefined}>
            {title}
          </h1>
          {note && <p className="text-muted mt-2 mb-0 text-[14px] leading-relaxed">{note}</p>}
          {children && <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>}
        </motion.div>
      </main>
    </>
  );
}
