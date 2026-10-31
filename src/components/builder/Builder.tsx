"use client";

import Link from "next/link";
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
import { tabs } from "../published/themes";
import { PublishedLock } from "../PublishedLock";
import { Glyph } from "@/lib/glyphs";
import { usePortfolios } from "@/lib/store";
import { THEMES, pageAddress, previewPath, type Portfolio } from "@/lib/types";
import { useAccount } from "@/lib/account";

/* ── the builder ──────────────────────────────────────────────────────────
   Artboards 2a (desktop) and 2c (phone), rebuilt around the motion themes.

   Desktop is a workspace the height of the window: the section rail on the
   left and the inspector on the right scroll on their own, and the canvas
   between them always shows the whole device, so an edit and its effect are
   never a scroll apart. On a phone the canvas sits over a control sheet.

   The inspector leads with "Look" — profession and theme — because that one
   choice moves the page further than every other control together.
   ──────────────────────────────────────────────────────────────────────── */

type InspectorTab = "look" | "colour" | "type" | "motion";
type SheetTab = "look" | "style" | "motion" | "sections" | "content";

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

export function Builder({ id }: { id: string }) {
  const handle = useAccount().account.profile.handle;
  const { ready, storageError, getPortfolio, updatePortfolio } = usePortfolios();
  const [device, setDevice] = useState<Device>("desktop");
  const [tab, setTab] = useState<InspectorTab>("look");
  const [sheet, setSheet] = useState<SheetTab>("look");
  const [replay, setReplay] = useState(0);

  const portfolio = getPortfolio(id);

  if (!portfolio) {
    return (
      <div className="p-10">
        <h2>{ready ? "That portfolio doesn't exist." : "Loading…"}</h2>
        {ready && <Link href="/">← Back to portfolios</Link>}
      </div>
    );
  }

  // A live page is frozen — the API refuses every write to it — so this
  // screen steps aside for Preview and Unpublish rather than rendering
  // controls that can only fail.
  if (portfolio.status === "live") {
    return <PublishedLock portfolio={portfolio} />;
  }

  const p: Portfolio = portfolio;
  const onChange = (recipe: (prev: Portfolio) => Portfolio) => updatePortfolio(p.id, recipe);
  const theme = THEMES.find((t) => t.id === p.theme);

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      {/* ── top bar ─────────────────────────────────────────────────── */}
      <div className="nav bg-bg flex-none gap-3">
        <Link href="/" className="btn btn-ghost" aria-label="Back to portfolios">
          <Glyph id="back" size={16} />
          <span className="hidden sm:inline">Portfolios</span>
        </Link>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="nav-brand mr-0 truncate text-[15px]">{p.name}</span>
          <span className="text-neutral-700 hidden truncate text-[11px] md:inline">
            {pageAddress(handle, p.slug)}
          </span>
        </span>
        <span className="status status-draft mr-auto hidden sm:inline-flex">Draft — saved</span>

        <Link href={`/editor/${p.id}`} className="btn btn-secondary hidden md:inline-flex">
          Edit text
        </Link>
        <Link
          href={previewPath(p.id)}
          className="btn btn-secondary"
          // A new tab, because the point of a preview is seeing the page
          // with nothing of the app around it — exactly what a visitor gets.
          target="_blank"
          rel="noopener noreferrer"
        >
          Preview
        </Link>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onChange((prev) => ({ ...prev, status: "live" }))}
        >
          Publish
        </button>
      </div>

      {storageError && (
        <div
          role="alert"
          className="flex-none px-4 py-2.5 text-[13px]"
          style={{ background: "var(--color-accent)", color: "var(--color-accent-ink)" }}
        >
          {storageError}
        </div>
      )}

      {/* ══ desktop — rail, canvas, inspector ═══════════════════════ */}
      <div className="hidden min-h-0 flex-1 lg:grid lg:grid-cols-[264px_minmax(0,1fr)_368px]">
        <aside className="border-divider bg-surface min-h-0 overflow-y-auto border-r">
          <SectionRail p={p} />
        </aside>

        <main className="flex min-h-0 flex-col" style={{ background: "var(--color-surface)" }}>
          <div className="border-divider flex flex-none items-center gap-3 border-b px-5 py-2.5">
            <div className="seg" role="radiogroup" aria-label="Device">
              {DEVICES.map((d) => (
                <label key={d.id} className="seg-opt">
                  <input
                    type="radio"
                    name="builder-device"
                    checked={device === d.id}
                    onChange={() => setDevice(d.id)}
                  />
                  {d.name}
                </label>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: 0 }}
              onClick={() => setReplay((n) => n + 1)}
              title="Run the page's entrance again"
            >
              Replay motion
            </button>
            <span className="text-neutral-700 ml-auto truncate text-[11px]">
              {theme?.name} · {p.layout.motion === "full" ? "full motion" : p.layout.motion === "subtle" ? "subtle motion" : "still"} · edits apply instantly
            </span>
          </div>
          <div className="min-h-0 flex-1 p-6">
            <Canvas p={p} handle={handle} device={device} replay={replay} />
          </div>
        </main>

        <aside className="border-divider bg-bg flex min-h-0 flex-col border-l">
          <div className="border-divider flex flex-none border-b" role="tablist" aria-label="Inspector">
            {INSPECTOR.map((t) => {
              const on = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(t.id)}
                  className="font-heading flex-1 cursor-pointer px-1.5 py-3 text-[13px]"
                  style={{
                    boxShadow: on ? "inset 0 -2px 0 var(--color-foil)" : "none",
                    color: on ? "var(--color-ink)" : "var(--color-neutral-800)",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-[18px]">
            {tab === "look" && (
              <>
                <ProfessionControl p={p} onChange={onChange} />
                <ThemeControl p={p} onChange={onChange} />
                <Link href={`/themes/${p.id}`} className="btn btn-secondary btn-block">
                  Open the theme gallery
                </Link>
              </>
            )}
            {tab === "colour" && <ColourControl p={p} onChange={onChange} />}
            {tab === "type" && <TypeControl p={p} onChange={onChange} />}
            {tab === "motion" && (
              <>
                <MotionControl p={p} onChange={onChange} />
                <div className="border-divider border-t pt-5">
                  <LayoutControl p={p} onChange={onChange} />
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* ══ phone — canvas over a control sheet ═════════════════════ */}
      <div className="lg:hidden">
        <div className="flex items-center gap-2 px-3.5 pt-3">
          <span className="text-neutral-700 text-[11px]">
            {theme?.name} · live preview
          </span>
          <button
            type="button"
            className="btn btn-ghost ml-auto text-xs"
            style={{ marginTop: 0 }}
            onClick={() => setReplay((n) => n + 1)}
          >
            Replay motion
          </button>
        </div>
        <div className="h-[460px] p-3.5" style={{ background: "var(--color-surface)" }}>
          <Canvas p={p} handle={handle} device="mobile" replay={replay} panX={false} chrome={false} />
        </div>

        <div className="border-divider border-t">
          <div className="border-divider fx-rail flex overflow-x-auto border-b" role="tablist" aria-label="Controls">
            {SHEET.map((t) => {
              const on = sheet === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setSheet(t.id)}
                  className="font-heading min-h-[48px] flex-1 cursor-pointer px-3 text-xs whitespace-nowrap"
                  style={{
                    boxShadow: on ? "inset 0 -2px 0 var(--color-foil)" : "none",
                    color: on ? "var(--color-ink)" : "var(--color-neutral-800)",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {sheet === "look" && (
            <div className="p-3.5">
              <ProfessionControl p={p} onChange={onChange} />
              <ThemeControl p={p} onChange={onChange} />
            </div>
          )}
          {sheet === "style" && (
            <div className="p-3.5">
              <ColourControl p={p} onChange={onChange} />
              <div className="border-divider border-t pt-5">
                <TypeControl p={p} onChange={onChange} />
              </div>
            </div>
          )}
          {sheet === "motion" && (
            <div className="p-3.5">
              <MotionControl p={p} onChange={onChange} />
              <div className="border-divider border-t pt-5">
                <LayoutControl p={p} onChange={onChange} />
              </div>
            </div>
          )}
          {sheet === "sections" && <SectionRail p={p} />}
          {sheet === "content" && <ContentSheet p={p} onChange={onChange} />}
        </div>
      </div>
    </div>
  );
}

/* ── the section rail ─────────────────────────────────────────────────── */

function SectionRail({ p }: { p: Portfolio }) {
  const { addSection, moveSection, toggleSectionHidden } = usePortfolios();
  const [selected, setSelected] = useState<string | null>(null);
  const pageTabs = tabs(p);

  return (
    <>
      <div className="border-divider flex items-baseline border-b p-4">
        <h6 className="m-0">Sections</h6>
        <span className="text-neutral-700 ml-auto text-[11px]">
          {p.sections.length} · {pageTabs.length} {pageTabs.length === 1 ? "tab" : "tabs"}
        </span>
      </div>

      {p.sections.map((s, i) => {
        const on = selected === s.id;
        return (
          <div
            key={s.id}
            className="border-divider border-b"
            style={{
              background: on ? "var(--color-bg)" : "transparent",
              boxShadow: on ? "inset 2px 0 0 var(--color-foil)" : "none",
            }}
          >
            <button
              type="button"
              aria-expanded={on}
              onClick={() => setSelected(on ? null : s.id)}
              className="flex min-h-[48px] w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left"
              style={{ opacity: s.hidden ? 0.5 : 1 }}
            >
              <span className="font-heading text-neutral-500 w-5 flex-none text-[10px]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13px]">{s.title || "Untitled section"}</span>
                <span className="text-neutral-700 truncate text-[10.5px]">{s.tab}</span>
              </span>
              <span className="text-neutral-600 ml-auto flex-none text-[11px]">
                {s.hidden ? "Hidden" : ""}
              </span>
            </button>

            {on && (
              <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                <button
                  type="button"
                  className="btn btn-secondary btn-icon"
                  aria-label="Move section up"
                  disabled={i === 0}
                  onClick={() => moveSection(p.id, s.id, -1)}
                >
                  <Glyph id="up" size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-icon"
                  aria-label="Move section down"
                  disabled={i === p.sections.length - 1}
                  onClick={() => moveSection(p.id, s.id, 1)}
                >
                  <Glyph id="down" size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary text-xs"
                  onClick={() => toggleSectionHidden(p.id, s.id)}
                >
                  {s.hidden ? "Show" : "Hide"}
                </button>
                <Link href={`/editor/${p.id}`} className="btn btn-ghost text-xs">
                  Edit text
                  <Glyph id="arrow" size={14} />
                </Link>
              </div>
            )}
          </div>
        );
      })}

      <div className="p-3.5">
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => addSection(p.id)}
        >
          <Glyph id="plus" size={15} />
          Add section
        </button>
      </div>

      <div className="border-divider border-t p-3.5">
        <h6 className="mb-2.5">Tabs on this page</h6>
        <div className="flex flex-wrap gap-1.5">
          {pageTabs.map((t, i) => (
            <span key={t} className={`tag ${i === 0 ? "tag-accent" : "tag-neutral"}`}>
              {t}
            </span>
          ))}
          {pageTabs.length === 0 && (
            <span className="text-neutral-700 text-[11px]">
              Add a section and its tab becomes one a visitor can move along.
            </span>
          )}
        </div>
      </div>
    </>
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
    <div className="flex flex-col gap-3.5 p-3.5">
      <div className="field">
        <label htmlFor="b-name">Name</label>
        <input
          id="b-name"
          className="input"
          value={p.header.name}
          onChange={(e) => field("name", e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="b-current">Current</label>
        <input
          id="b-current"
          className="input"
          value={p.header.current}
          onChange={(e) => field("current", e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="b-desc">Description</label>
        <textarea
          id="b-desc"
          className="input"
          value={p.header.description}
          onChange={(e) => field("description", e.target.value)}
        />
      </div>
      <Link href={`/editor/${p.id}`} className="btn btn-primary btn-block">
        Open the full document editor
      </Link>
    </div>
  );
}
