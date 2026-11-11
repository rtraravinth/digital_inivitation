"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Canvas, DEVICES, type Device } from "./Canvas";
import {
  ColourControl,
  LayoutControl,
  MotionControl,
  ProfessionControl,
  ThemeControl,
  TypeControl,
} from "./controls";
import { PublishedLock } from "../PublishedLock";
import { ResumeStudio } from "../resume/ResumeStudio";
import { ICON, Icon, IconButton, Segmented, StatusPill } from "../ui";
import { Glyph } from "@/lib/glyphs";
import { usePortfolios } from "@/lib/store";
import { THEMES, previewPath, type Portfolio } from "@/lib/types";
import { useAccount } from "@/lib/account";

/* ── the builder ──────────────────────────────────────────────────────────
   Artboards 2a (desktop) and 2c (phone), in the app's own style: the same
   top bar as the editor, panels with rounded corners, and the live canvas
   set on the dot-grid backdrop between them.

   Desktop is a workspace the height of the window: the section rail on the
   left and the inspector on the right scroll on their own, and the canvas
   between them always shows the whole device, so an edit and its effect are
   never a scroll apart. On a phone the canvas sits over a control sheet.

   The inspector leads with "Look" — profession and theme — because that one
   choice moves the page further than every other control together.
   ──────────────────────────────────────────────────────────────────────── */

type InspectorTab = "look" | "colour" | "type" | "motion";
type SheetTab = "look" | "style" | "motion" | "sections" | "content";

const EASE = [0.16, 1, 0.3, 1] as const;

const INSPECTOR: Array<{ id: InspectorTab; label: string }> = [
  { id: "look", label: "Look" },
  { id: "colour", label: "Colour" },
  { id: "type", label: "Type" },
  { id: "motion", label: "Motion" },
];

const SHEET: Array<{ id: SheetTab; label: string }> = [
  { id: "look", label: "Look" },
  { id: "style", label: "Style" },
  { id: "motion", label: "Motion" },
  { id: "sections", label: "Sections" },
  { id: "content", label: "Content" },
];

const REPLAY = <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />;

export function Builder({ id }: { id: string }) {
  const handle = useAccount().account.profile.handle;
  const { ready, storageError, getPortfolio, updatePortfolio } = usePortfolios();
  const reduced = useReducedMotion();
  const [device, setDevice] = useState<Device>("desktop");
  const [tab, setTab] = useState<InspectorTab>("look");
  const [sheet, setSheet] = useState<SheetTab>("look");
  const [replay, setReplay] = useState(0);
  const router = useRouter();
  // One portfolio, two looks: the page it publishes and the resume it
  // downloads. In the address so the editor and the print page link back.
  const mode: "page" | "resume" = useSearchParams().get("mode") === "resume" ? "resume" : "page";
  const modeSwitch = (
    <span className="flex-none">
      <Segmented
        label="What to style"
        id="builder-mode"
        value={mode}
        onChange={(next) => router.replace(`/builder/${id}${next === "resume" ? "?mode=resume" : ""}`, { scroll: false })}
        options={[
          { id: "page", label: "Page" },
          { id: "resume", label: "Resume" },
        ]}
      />
    </span>
  );

  const portfolio = getPortfolio(id);

  if (!portfolio) {
    return (
      <div className="mx-auto w-full max-w-[720px] px-6 py-16">
        <h2 className="m-0 text-[22px]">{ready ? "That portfolio doesn’t exist." : "Loading…"}</h2>
        {ready && (
          <Link href="/" className="btn btn-secondary mt-4">
            <Glyph id="back" size={15} />
            Back to portfolios
          </Link>
        )}
      </div>
    );
  }

  // The resume is not on the published page, so it stays open while the
  // page is live.
  if (mode === "resume") {
    return <ResumeStudio p={portfolio} modeSwitch={modeSwitch} storageError={storageError} />;
  }

  // A live page is frozen — the API refuses every write to it — so this
  // screen steps aside for Preview and Unpublish.
  if (portfolio.status === "live") {
    return <PublishedLock portfolio={portfolio} />;
  }

  const p: Portfolio = portfolio;
  const onChange = (recipe: (prev: Portfolio) => Portfolio) => updatePortfolio(p.id, recipe);
  const theme = THEMES.find((t) => t.id === p.theme);
  const motionName = p.layout.motion === "full" ? "Full motion" : p.layout.motion === "subtle" ? "Subtle motion" : "Still";

  const inspector = (which: InspectorTab | SheetTab) => (
    <>
      {which === "look" && (
        <>
          <ProfessionControl p={p} onChange={onChange} />
          <ThemeControl p={p} onChange={onChange} />
          <Link href={`/themes/${p.id}`} className="btn btn-secondary btn-block" style={{ justifyContent: "center" }}>
            Open the theme gallery
          </Link>
        </>
      )}
      {which === "colour" && <ColourControl p={p} onChange={onChange} />}
      {which === "type" && <TypeControl p={p} onChange={onChange} />}
      {which === "style" && (
        <>
          <ColourControl p={p} onChange={onChange} />
          <div className="mt-2 pt-5" style={{ borderTop: "1px solid var(--color-divider)" }}>
            <TypeControl p={p} onChange={onChange} />
          </div>
        </>
      )}
      {which === "motion" && (
        <>
          <MotionControl p={p} onChange={onChange} />
          <div className="pt-5" style={{ borderTop: "1px solid var(--color-divider)" }}>
            <LayoutControl p={p} onChange={onChange} />
          </div>
        </>
      )}
    </>
  );

  return (
    <>
      <div aria-hidden className="app-backdrop" />
      <div className="flex min-h-dvh flex-col lg:h-dvh">
        {/* ── top bar ─────────────────────────────────────────────── */}
        <header
          className="sticky top-0 z-30 flex h-14 flex-none items-center gap-2 px-3 sm:gap-3 sm:px-5"
          style={{
            background: "color-mix(in srgb, var(--color-bg) 86%, transparent)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderBottom: "1px solid var(--color-divider)",
          }}
        >
          <Link href="/" className="btn btn-ghost" aria-label="Back to portfolios" style={{ marginTop: 0 }}>
            <Glyph id="back" size={16} />
            <span className="hidden sm:inline">Portfolios</span>
          </Link>
          <span className="hidden h-5 w-px sm:block" style={{ background: "var(--color-divider)" }} />
          <span className="hidden min-w-0 truncate text-[14.5px] font-semibold tracking-[-0.01em] md:inline">{p.name}</span>
          <span className="hidden xl:inline-flex">
            <StatusPill live={false} />
          </span>
          {modeSwitch}
          <span className="ml-auto flex flex-none items-center gap-2">
            <Link href={`/editor/${p.id}`} className="btn btn-secondary hidden md:inline-flex" style={{ marginTop: 0, minHeight: 34 }}>
              Edit text
            </Link>
            <a
              href={previewPath(p.id)}
              // A new tab: a preview is the page with nothing of the app around it.
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ marginTop: 0, minHeight: 34 }}
            >
              <Icon d={ICON.eye} size={14} />
              <span className="hidden sm:inline">Preview</span>
            </a>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 0, minHeight: 34 }}
              onClick={() => onChange((prev) => ({ ...prev, status: "live" }))}
            >
              Publish
            </button>
          </span>
        </header>

        <AnimatePresence>
          {storageError && (
            <motion.div
              role="alert"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-3 mt-3 flex flex-none items-start gap-3 rounded-xl px-4 py-2.5 text-[13.5px] sm:mx-5"
              style={{ border: "1px solid var(--color-ink)", background: "var(--color-bg)" }}
            >
              <span
                aria-hidden
                className="mt-px grid h-5 w-5 flex-none place-items-center rounded-full text-[12px] font-bold"
                style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
              >
                !
              </span>
              <span className="min-w-0 flex-1">{storageError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══ desktop — rail, canvas, inspector ═══════════════════════ */}
        <div className="hidden min-h-0 flex-1 gap-4 p-4 lg:grid lg:grid-cols-[260px_minmax(0,1fr)_372px]">
          <motion.aside
            initial={reduced ? false : { opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="min-h-0 overflow-y-auto rounded-2xl"
            style={{ background: "var(--color-bg)", border: "1px solid var(--color-divider)" }}
          >
            <SectionRail p={p} />
          </motion.aside>

          <motion.main
            initial={reduced ? false : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}
            className="flex min-h-0 flex-col"
          >
            <div className="mb-3 flex flex-none flex-wrap items-center gap-2">
              <Segmented
                label="Device"
                id="builder-device"
                value={device}
                onChange={setDevice}
                options={DEVICES.map((d) => ({ id: d.id, label: d.name }))}
              />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: 0, minHeight: 36, background: "var(--color-bg)" }}
                onClick={() => setReplay((n) => n + 1)}
                title="Run the page’s entrance again"
              >
                <Icon d={REPLAY} size={14} />
                Replay motion
              </button>
              <span className="ml-auto flex items-center gap-1.5">
                <Chip>{theme?.name}</Chip>
                <Chip>{motionName}</Chip>
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <Canvas p={p} handle={handle} device={device} replay={replay} />
            </div>
            <p className="m-0 mt-2 flex-none text-center text-[12px]" style={{ color: "var(--color-neutral-600)" }}>
              Live preview — every change shows here as you make it. Your own clicks in it are never counted.
            </p>
          </motion.main>

          <motion.aside
            initial={reduced ? false : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="flex min-h-0 flex-col overflow-hidden rounded-2xl"
            style={{ background: "var(--color-bg)", border: "1px solid var(--color-divider)" }}
          >
            <div className="flex-none p-3" style={{ borderBottom: "1px solid var(--color-divider)" }}>
              <div className="[&>div]:w-full [&>div>button]:flex-1 [&>div>button]:justify-center">
                <Segmented label="Inspector" id="builder-inspector" value={tab} onChange={setTab} options={INSPECTOR} />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={tab}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.28, ease: EASE }}
                >
                  {inspector(tab)}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.aside>
        </div>

        {/* ══ phone — canvas over a control sheet ═════════════════════ */}
        <div className="lg:hidden">
          <div className="flex items-center gap-2 px-4 pt-4">
            <Chip>{theme?.name}</Chip>
            <Chip>{motionName}</Chip>
            <button
              type="button"
              className="btn btn-ghost ml-auto"
              style={{ marginTop: 0, minHeight: 32, fontSize: 13 }}
              onClick={() => setReplay((n) => n + 1)}
            >
              <Icon d={REPLAY} size={13} />
              Replay
            </button>
          </div>
          <div className="h-[460px] px-4 pt-3 pb-4">
            <div className="h-full overflow-hidden rounded-2xl" style={{ border: "1px solid var(--color-divider)", background: "var(--color-bg)" }}>
              <Canvas p={p} handle={handle} device="mobile" replay={replay} panX={false} chrome={false} />
            </div>
          </div>

          <div className="mx-4 mb-8 overflow-hidden rounded-2xl" style={{ background: "var(--color-bg)", border: "1px solid var(--color-divider)" }}>
            <div className="fx-rail overflow-x-auto p-2.5" style={{ borderBottom: "1px solid var(--color-divider)" }}>
              <Segmented label="Controls" id="builder-sheet" value={sheet} onChange={setSheet} options={SHEET} />
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={sheet}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.25, ease: EASE }}
              >
                {sheet === "sections" ? (
                  <SectionRail p={p} />
                ) : sheet === "content" ? (
                  <ContentSheet p={p} onChange={onChange} />
                ) : (
                  <div className="p-4">{inspector(sheet)}</div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex h-7 items-center rounded-full px-3 text-[12px] font-medium whitespace-nowrap"
      style={{ background: "var(--color-bg)", border: "1px solid var(--color-divider)", color: "var(--color-neutral-700)" }}
    >
      {children}
    </span>
  );
}

/* ── the section rail ─────────────────────────────────────────────────── */

function SectionRail({ p }: { p: Portfolio }) {
  const { addSection, moveSection, toggleSectionHidden } = usePortfolios();
  const reduced = useReducedMotion();
  return (
    <div className="flex flex-col">
      <div className="flex items-baseline px-4 pt-4 pb-2">
        <h2 className="m-0 text-[14px] tracking-[-0.01em]">Sections</h2>
        <span className="ml-auto font-mono text-[11px]" style={{ color: "var(--color-neutral-600)" }}>
          {p.sections.length}
        </span>
      </div>

      <ul className="m-0 flex list-none flex-col gap-0.5 px-2 p-0">
        <AnimatePresence initial={false}>
          {p.sections.map((s, i) => (
            <motion.li
              key={s.id}
              layout={!reduced}
              transition={{ duration: 0.3, ease: EASE }}
              className="group relative flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--color-surface)] focus-within:bg-[var(--color-surface)]"
              style={{ opacity: s.hidden ? 0.5 : 1 }}
            >
              <span className="w-5 flex-none font-mono text-[11px]" style={{ color: "var(--color-neutral-600)" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] font-medium">{s.title || "Untitled section"}</span>
                {s.hidden && <span className="truncate text-[11.5px] text-muted">Off the page</span>}
              </span>
              {/* The row's actions float over its right edge when the row is
                  pointed at or tabbed into, so a long title gets the whole row
                  the rest of the time. Opacity, not display: a hidden control
                  could never take focus, and focus is how a keyboard user
                  reveals them. On a phone they are always there. */}
              <span
                className="flex flex-none items-center rounded-md transition-opacity lg:pointer-events-none lg:absolute lg:top-1/2 lg:right-1 lg:-translate-y-1/2 lg:opacity-0 lg:group-focus-within:pointer-events-auto lg:group-focus-within:opacity-100 lg:group-hover:pointer-events-auto lg:group-hover:opacity-100"
                style={{ background: "var(--color-surface)" }}
              >
                <IconButton label={`Move ${s.title || "section"} up`} onClick={() => i > 0 && moveSection(p.id, s.id, -1)}>
                  <span style={{ opacity: i === 0 ? 0.3 : 1 }}>
                    <Glyph id="up" size={14} />
                  </span>
                </IconButton>
                <IconButton
                  label={`Move ${s.title || "section"} down`}
                  onClick={() => i < p.sections.length - 1 && moveSection(p.id, s.id, 1)}
                >
                  <span style={{ opacity: i === p.sections.length - 1 ? 0.3 : 1 }}>
                    <Glyph id="down" size={14} />
                  </span>
                </IconButton>
                <IconButton label={s.hidden ? `Show ${s.title || "section"}` : `Hide ${s.title || "section"}`} onClick={() => toggleSectionHidden(p.id, s.id)}>
                  <Icon
                    d={s.hidden ? <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4.4-1" /> : ICON.eye}
                    size={14}
                  />
                </IconButton>
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <div className="flex flex-col gap-2 p-3">
        <button type="button" className="btn btn-secondary btn-block" style={{ justifyContent: "center" }} onClick={() => addSection(p.id)}>
          <Glyph id="plus" size={14} />
          Add section
        </button>
        <Link href={`/editor/${p.id}`} className="btn btn-ghost btn-block" style={{ justifyContent: "center", marginTop: 0 }}>
          Edit the words
          <Glyph id="arrow" size={14} />
        </Link>
      </div>

    </div>
  );
}

/* ── the phone's content sheet ────────────────────────────────────────── */

function ContentSheet({
  p,
  onChange,
}: {
  p: Portfolio;
  onChange: (recipe: (prev: Portfolio) => Portfolio) => void;
}) {
  const field = (key: "name" | "current" | "description", value: string) =>
    onChange((prev) => ({ ...prev, header: { ...prev.header, [key]: value } }));

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="field">
        <label htmlFor="b-name">Name</label>
        <input id="b-name" className="input" value={p.header.name} onChange={(e) => field("name", e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="b-current">What you do now</label>
        <input id="b-current" className="input" value={p.header.current} onChange={(e) => field("current", e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="b-desc">About you</label>
        <textarea id="b-desc" className="input" rows={4} value={p.header.description} onChange={(e) => field("description", e.target.value)} />
      </div>
      <Link href={`/editor/${p.id}`} className="btn btn-primary btn-block" style={{ justifyContent: "center" }}>
        Edit every section
      </Link>
    </div>
  );
}
