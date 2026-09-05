"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ColourControl,
  LayoutControl,
  ThemeControl,
  ThemeThumb,
  TypeControl,
} from "./controls";
import { QrCode } from "../QrCode";
import { PublishedBody, roles } from "../published/themes";
import { usePortfolios } from "@/lib/store";
import { FONTS, SWATCHES, THEMES, type Portfolio } from "@/lib/types";

type Device = "desktop" | "mobile";
type InspectorTab = "theme" | "colour" | "type" | "layout";
type SheetTab = "style" | "sections" | "content" | "share";

const DEVICE_WIDTH: Record<Device, number> = { desktop: 1440, mobile: 390 };

/* ── the live canvas ──────────────────────────────────────────────────── */

/**
 * The real published page, scaled to fit whatever room the column has.
 *
 * The scale is a CSS transform, which does not change layout size, so the
 * inner element is given the unscaled height it needs and scrolls itself —
 * the outer box just shows a shrunken window onto it. Anything simpler
 * either overflows the page sideways or needs a second copy of the themes.
 */
function Canvas({
  p,
  device,
  height,
}: {
  p: Portfolio;
  device: Device;
  height: number;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);

  useEffect(() => {
    const node = outerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setAvailable(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const width = DEVICE_WIDTH[device];
  const scale = available > 0 ? Math.min(1, available / width) : 0;

  return (
    <div ref={outerRef} className="w-full">
      <div className="mb-3 flex items-center gap-3">
        <span
          className="font-heading text-[11px] font-extrabold"
          style={{ color: "var(--color-neutral-700)" }}
        >
          {width} × auto
        </span>
        <span
          className="ml-auto text-[11px]"
          style={{ color: "var(--color-neutral-700)" }}
        >
          {scale > 0 && `${Math.round(scale * 100)}% · `}Live preview — edits apply
          instantly
        </span>
      </div>

      <div
        className="border-divider mx-auto overflow-hidden border-2"
        style={{
          width: scale > 0 ? width * scale : "100%",
          height,
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {scale > 0 && (
          <div
            className="overflow-y-auto"
            style={{
              width,
              height: height / scale,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <PublishedBody p={p} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── the section rail ─────────────────────────────────────────────────── */

function SectionRail({ p }: { p: Portfolio }) {
  const { addSection, moveSection, toggleSectionHidden } = usePortfolios();
  const [selected, setSelected] = useState<string | null>(null);
  const pageRoles = roles(p);

  return (
    <>
      <div className="border-divider border-b-2 p-4">
        <h6 className="m-0">Page sections</h6>
      </div>

      {p.sections.map((s, i) => {
        const on = selected === s.id;
        return (
          <div
            key={s.id}
            className="border-divider border-b"
            style={{
              background: on ? "var(--color-bg)" : "transparent",
              boxShadow: on ? "inset 3px 0 0 var(--color-accent)" : "none",
              opacity: s.hidden ? 0.45 : 1,
            }}
          >
            <button
              type="button"
              onClick={() => setSelected(on ? null : s.id)}
              className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left"
            >
              <span className="font-heading text-neutral-500 w-4 flex-none text-[10px] font-extrabold">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="truncate text-[13px] font-extrabold">
                {s.title || "Untitled section"}
              </span>
              <span className="text-neutral-600 ml-auto flex-none text-[11px]">
                {s.hidden ? "Hidden" : on ? "Selected" : ""}
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
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-icon"
                  aria-label="Move section down"
                  disabled={i === p.sections.length - 1}
                  onClick={() => moveSection(p.id, s.id, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn btn-secondary text-xs"
                  onClick={() => toggleSectionHidden(p.id, s.id)}
                >
                  {s.hidden ? "Show" : "Hide"}
                </button>
                <Link
                  href={`/editor/${p.id}`}
                  className="btn btn-ghost text-xs"
                >
                  Edit text →
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
          + Add section
        </button>
      </div>

      <div className="border-divider border-t-2 p-3.5">
        <h6 className="mb-2.5">Roles on this page</h6>
        <div className="flex flex-wrap gap-1.5">
          {pageRoles.map((r, i) => (
            <span key={r} className={`tag ${i === 0 ? "tag-accent" : "tag-neutral"}`}>
              {r}
            </span>
          ))}
          {pageRoles.length === 0 && (
            <span className="text-neutral-700 text-[11px]">
              Tag a section and its tags become the roles a visitor can filter by.
            </span>
          )}
        </div>
      </div>
    </>
  );
}

/* ── the builder ──────────────────────────────────────────────────────── */

export function Builder({ id }: { id: string }) {
  const { ready, storageError, getPortfolio, updatePortfolio } = usePortfolios();
  const [device, setDevice] = useState<Device>("desktop");
  const [tab, setTab] = useState<InspectorTab>("theme");
  const [sheet, setSheet] = useState<SheetTab>("style");
  const [copied, setCopied] = useState(false);

  const portfolio = getPortfolio(id);

  if (!portfolio) {
    return (
      <div className="p-10">
        <h2>{ready ? "That portfolio doesn't exist." : "Loading…"}</h2>
        {ready && <Link href="/">← Back to portfolios</Link>}
      </div>
    );
  }

  const p: Portfolio = portfolio;
  const onChange = (recipe: (prev: Portfolio) => Portfolio) =>
    updatePortfolio(p.id, recipe);
  const url = `https://facet.page/${p.slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked — stay silent rather than claim a copy that failed.
    }
  }

  const inspectorTabs: Array<{ id: InspectorTab; label: string }> = [
    { id: "theme", label: "Theme" },
    { id: "colour", label: "Colour" },
    { id: "type", label: "Type" },
    { id: "layout", label: "Layout" },
  ];

  const sheetTabs: Array<{ id: SheetTab; label: string }> = [
    { id: "style", label: "Style" },
    { id: "sections", label: "Sections" },
    { id: "content", label: "Content" },
    { id: "share", label: "Share" },
  ];

  return (
    <>
      {/* ── top bar ─────────────────────────────────────────────────── */}
      <div className="nav bg-bg gap-3.5">
        <Link href="/" className="font-heading text-[13px] font-extrabold">
          ← Portfolios
        </Link>
        <span className="nav-brand mr-0 hidden text-[15px] sm:inline">{p.name}</span>
        <span className="text-neutral-700 hidden text-[13px] md:inline">
          facet.page/{p.slug}
        </span>
        <span className="tag tag-neutral mr-auto">
          {p.status === "live" ? "Live" : "Draft — saved"}
        </span>

        <div className="seg hidden lg:inline-flex">
          {(["desktop", "mobile"] as Device[]).map((d) => (
            <label key={d} className="seg-opt capitalize">
              <input
                type="radio"
                name="device"
                checked={device === d}
                onChange={() => setDevice(d)}
              />
              {d}
            </label>
          ))}
        </div>

        <Link href={`/editor/${p.id}`} className="btn btn-secondary">
          Document
        </Link>
        <Link href={`/p/${p.slug}`} className="btn btn-secondary">
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
          className="px-4 py-2.5 text-[13px] font-extrabold"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        >
          {storageError}
        </div>
      )}

      {/* ══ desktop — rail, canvas, inspector ═══════════════════════ */}
      <div className="hidden lg:grid lg:grid-cols-[248px_1fr_336px]">
        <div className="border-divider bg-surface border-r-2">
          <SectionRail p={p} />
        </div>

        <div className="bg-neutral-300 p-8">
          <Canvas p={p} device={device} height={760} />
        </div>

        <div className="border-divider bg-bg border-l-2">
          <div className="border-divider flex border-b-2">
            {inspectorTabs.map((t) => {
              const on = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className="font-heading flex-1 cursor-pointer px-1.5 py-3 text-[13px] font-extrabold"
                  style={{
                    background: on ? "var(--color-accent)" : "transparent",
                    color: on ? "var(--color-bg)" : "var(--color-ink)",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="p-[18px]">
            {tab === "theme" && (
              <>
                <ThemeControl p={p} onChange={onChange} />
                <Link
                  href={`/themes/${p.id}`}
                  className="btn btn-secondary btn-block mt-4"
                >
                  Browse all {THEMES.length} themes
                </Link>
              </>
            )}
            {tab === "colour" && <ColourControl p={p} onChange={onChange} />}
            {tab === "type" && <TypeControl p={p} onChange={onChange} />}
            {tab === "layout" && <LayoutControl p={p} onChange={onChange} />}
          </div>
        </div>
      </div>

      {/* ══ mobile — canvas over a control sheet ════════════════════ */}
      <div className="lg:hidden">
        <div className="bg-neutral-300 p-3.5">
          <Canvas p={p} device="mobile" height={420} />
        </div>

        <div className="border-divider border-t-2">
          <div className="border-divider flex border-b-2">
            {sheetTabs.map((t) => {
              const on = sheet === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSheet(t.id)}
                  className="font-heading flex-1 cursor-pointer px-1.5 py-3 text-xs font-extrabold"
                  style={{
                    background: on ? "var(--color-accent)" : "transparent",
                    color: on ? "var(--color-bg)" : "var(--color-ink)",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {sheet === "style" && (
            <div className="p-3.5">
              <h6 className="mb-2.5">Theme</h6>
              <div className="mb-4 flex gap-2.5 overflow-x-auto pb-1">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onChange((prev) => ({ ...prev, theme: t.id }))}
                    className="flex flex-none cursor-pointer flex-col items-start gap-1.5 p-2"
                    style={{
                      background:
                        p.theme === t.id ? "var(--color-surface)" : "var(--color-bg)",
                      border: `2px solid ${
                        p.theme === t.id ? "var(--color-accent)" : "var(--color-divider)"
                      }`,
                    }}
                  >
                    <ThemeThumb theme={t.id} accent={p.accent} />
                    <span className="font-heading text-[11px] font-extrabold">
                      {t.name}
                    </span>
                  </button>
                ))}
              </div>

              <h6 className="mb-2.5">Accent</h6>
              <div className="mb-4 flex gap-2">
                {SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Accent ${hex}`}
                    onClick={() => onChange((prev) => ({ ...prev, accent: hex }))}
                    className="h-8 w-8 cursor-pointer"
                    style={{
                      background: hex,
                      boxShadow:
                        p.accent === hex
                          ? "inset 0 0 0 2px var(--color-bg), 0 0 0 2px var(--color-ink)"
                          : "none",
                    }}
                  />
                ))}
              </div>

              <h6 className="mb-2.5">Type</h6>
              <div
                className="mb-4 flex flex-col gap-0.5"
                style={{
                  background: "var(--color-divider)",
                  borderBlock: "2px solid var(--color-divider)",
                }}
              >
                {FONTS.map((face) => (
                  <button
                    key={face.id}
                    type="button"
                    onClick={() => onChange((prev) => ({ ...prev, font: face.id }))}
                    className="flex cursor-pointer flex-col items-start gap-0.5 p-2.5 text-left"
                    style={{
                      background:
                        p.font === face.id ? "var(--color-surface)" : "var(--color-bg)",
                    }}
                  >
                    <span
                      className="text-[15px] font-extrabold leading-none"
                      style={{ fontFamily: `var(${face.cssVar})` }}
                    >
                      {p.header.name || "Your name"}
                    </span>
                    <span
                      className="text-[11px]"
                      style={{
                        color:
                          p.font === face.id
                            ? "var(--color-accent)"
                            : "var(--color-neutral-700)",
                      }}
                    >
                      {face.name}
                    </span>
                  </button>
                ))}
              </div>

              <LayoutControl p={p} onChange={onChange} />
            </div>
          )}

          {sheet === "sections" && (
            <div className="border-divider border-t">
              <SectionRail p={p} />
            </div>
          )}

          {sheet === "content" && (
            <div className="flex flex-col gap-3.5 p-3.5">
              <div className="field">
                <label htmlFor="b-name">Name</label>
                <input
                  id="b-name"
                  className="input"
                  value={p.header.name}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      header: { ...prev.header, name: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="b-current">Current</label>
                <input
                  id="b-current"
                  className="input"
                  value={p.header.current}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      header: { ...prev.header, current: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="b-desc">Description</label>
                <textarea
                  id="b-desc"
                  className="input"
                  value={p.header.description}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      header: { ...prev.header, description: e.target.value },
                    }))
                  }
                />
              </div>
              <Link href={`/editor/${p.id}`} className="btn btn-primary btn-block">
                Open the full document editor
              </Link>
              <Link href={`/blocks/${p.id}`} className="btn btn-secondary btn-block">
                Manage blocks
              </Link>
            </div>
          )}

          {sheet === "share" && (
            <div className="flex flex-col gap-3.5 p-3.5">
              <div className="border-divider flex items-center gap-2.5 border-2 px-3 py-2.5">
                <span className="font-heading truncate text-[13px] font-extrabold">
                  facet.page/{p.slug}
                </span>
                <button
                  type="button"
                  className="btn btn-primary ml-auto text-xs"
                  onClick={copy}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <QrCode text={url} size={120} downloadName={`facet-${p.slug}.png`} />
              <Link href={`/stats?p=${p.id}`} className="btn btn-secondary btn-block">
                Views and clicks
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
