"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ColourControl,
  LayoutControl,
  ThemeControl,
  ThemeThumb,
  TypeControl,
} from "./controls";
import {
  PreviewProvider,
  PublishedBody,
  PublishedHandleProvider,
  tabs,
} from "../published/themes";
import { PublishedLock } from "../PublishedLock";
import { ColourPicker } from "@/components/builder/ColourPicker";
import { FontSelect } from "@/components/builder/FontSelect";
import { usePortfolios } from "@/lib/store";
import {
  GROUNDS,
  THEMES,
  pageAddress,
  previewPath,
  type Portfolio,
} from "@/lib/types";
import { useAccount } from "@/lib/account";

type Device = "desktop" | "mobile";
type InspectorTab = "theme" | "colour" | "type" | "layout";
type SheetTab = "style" | "sections" | "content";

const DEVICE_WIDTH: Record<Device, number> = { desktop: 1440, mobile: 390 };

/** The canvas iframe starts empty; everything else is copied in or portaled. */
const FRAME_DOC =
  "<!doctype html><html><head><style>html,body{margin:0;height:100%}</style></head><body></body></html>";

/* ── the live canvas ──────────────────────────────────────────────────── */

/**
 * The real published page, in an iframe sized to the device, scaled to fit
 * whatever room the column has.
 *
 * The iframe is what makes "Mobile" mean anything. A theme's `md:` and `lg:`
 * utilities are media queries, and a media query answers about the *window* —
 * so a 390px box inside a 1440px window still got the desktop layout, crammed
 * and overflowing sideways. An iframe has a window of its own, 390px wide, so
 * the breakpoints resolve the way they do on a phone.
 *
 * The scale is a CSS transform, which does not change layout size, so the
 * iframe is given the unscaled size it needs and the outer box shows a
 * shrunken window onto it.
 */
function Canvas({
  p,
  handle,
  device,
  height,
  panX = true,
}: {
  handle: string;
  p: Portfolio;
  device: Device;
  height: number;
  /**
   * Whether a horizontal swipe inside the preview may scroll it.
   *
   * Off on a phone. The canvas fills the middle of that screen and the page
   * inside it has its own sideways tab row, so a swipe meant to scroll the
   * builder dragged that row instead — which reads as the builder scrolling
   * sideways. `touch-action: pan-y` refuses the horizontal gesture and leaves
   * the vertical one to the builder; taps still land, because touch-action
   * does not affect them.
   */
  panX?: boolean;
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
          <CanvasFrame
            width={width}
            height={height / scale}
            scale={scale}
            panX={panX}
          >
            {/* A preview, and it has to say so: otherwise a click in here is
                recorded as a real visitor's, and a section title links to
                /p/<handle>/<slug>, which does not resolve until the page is
                published. */}
            <PreviewProvider value>
              <PublishedHandleProvider value={handle}>
                <PublishedBody p={p} />
              </PublishedHandleProvider>
            </PreviewProvider>
          </CanvasFrame>
        )}
      </div>
    </div>
  );
}

/** One stylesheet of this document, in the form the iframe can re-render. */
type Sheet = { key: string; href?: string; css?: string };

/**
 * Every stylesheet in this document's head, kept current.
 *
 * The canvas iframe is a separate document and inherits none of the page's
 * CSS, so it has to render its own copy. In dev the bundler adds and swaps
 * these as you edit, which is what the observer is watching for.
 */
function useHeadSheets(): Sheet[] {
  const [sheets, setSheets] = useState<Sheet[]>([]);

  useEffect(() => {
    const read = () =>
      setSheets(
        [...document.querySelectorAll<HTMLElement>('style, link[rel="stylesheet"]')].map(
          (node, index) => {
            const href = node.getAttribute("href");
            return href
              ? { key: `l${href}`, href }
              : { key: `s${index}`, css: node.textContent ?? "" };
          },
        ),
      );

    read();
    const observer = new MutationObserver(read);
    observer.observe(document.head, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return sheets;
}

/**
 * An iframe carrying the app's stylesheets, rendering `children` through a
 * portal so they stay part of this React tree — same state, same context,
 * same live edits.
 *
 * Everything inside is rendered, never appended: the React Compiler will not
 * allow a document held in state to be mutated, and portalling the
 * stylesheets keeps them in step with the parent for free.
 */
function CanvasFrame({
  width,
  height,
  scale,
  panX,
  children,
}: {
  width: number;
  height: number;
  scale: number;
  panX: boolean;
  children: React.ReactNode;
}) {
  // Set from the load event, not from a ref at mount: `srcDoc` replaces the
  // document *after* React attaches the element, so anything written before
  // that goes with the document it was written to.
  const [doc, setDoc] = useState<Document | null>(null);
  // The font variables are declared on <html> as classes, not in a
  // stylesheet. They are custom properties, so a wrapper inherits them. Read
  // once, lazily: on the server there is no document, and by the time this
  // is used the portal has mounted, so there is nothing to mismatch.
  const [rootClass] = useState(() =>
    typeof document === "undefined" ? "" : document.documentElement.className,
  );
  const sheets = useHeadSheets();

  return (
    <>
      <iframe
        title="Live preview"
        onLoad={(event) => setDoc(event.currentTarget.contentDocument)}
        srcDoc={FRAME_DOC}
        style={{
          width,
          height,
          border: 0,
          display: "block",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      />
      {doc &&
        createPortal(
          sheets.map((sheet) =>
            sheet.href ? (
              <link key={sheet.key} rel="stylesheet" href={sheet.href} />
            ) : (
              <style key={sheet.key} dangerouslySetInnerHTML={{ __html: sheet.css ?? "" }} />
            ),
          ),
          doc.head,
        )}
      {doc &&
        createPortal(
          // touch-action lives inside the iframe because that is the document
          // the gesture starts in — the parent's own value cannot reach it.
          <div
            className={rootClass}
            style={{ minHeight: "100%", touchAction: panX ? undefined : "pan-y" }}
          >
            {children}
          </div>,
          doc.body,
        )}
    </>
  );
}

/* ── the section rail ─────────────────────────────────────────────────── */

function SectionRail({ p }: { p: Portfolio }) {
  const { addSection, moveSection, toggleSectionHidden } = usePortfolios();
  const [selected, setSelected] = useState<string | null>(null);
  const pageTabs = tabs(p);

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

/* ── the builder ──────────────────────────────────────────────────────── */

export function Builder({ id }: { id: string }) {
  const handle = useAccount().account.profile.handle;
  const { ready, storageError, getPortfolio, updatePortfolio } = usePortfolios();
  const [device, setDevice] = useState<Device>("desktop");
  const [tab, setTab] = useState<InspectorTab>("theme");
  const [sheet, setSheet] = useState<SheetTab>("style");
  // The mobile sheet's own radio group. A radio `name` is document-scoped and
  // the desktop inspector is mounted at the same time, so a shared name would
  // put both panels' inputs in one group and let the hidden one hold the only
  // checked member.
  const sheetGroup = useId();

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
  const onChange = (recipe: (prev: Portfolio) => Portfolio) =>
    updatePortfolio(p.id, recipe);
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
          {pageAddress(handle, p.slug)}
        </span>
        <span className="status status-draft mr-auto">Not published — saved</span>

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
          <Canvas p={p} handle={handle} device={device} height={760} />
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
          <Canvas p={p} handle={handle} device="mobile" height={420} panX={false} />
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
              <div className="mb-4">
                <ColourPicker
                  id="accent-hex-mobile"
                  name="Accent"
                  value={p.accent}
                  onPick={(hex) => onChange((prev) => ({ ...prev, accent: hex }))}
                />
              </div>

              <h6 className="mb-2.5">Ground</h6>
              <div className="seg mb-3">
                {GROUNDS.map((g) => (
                  <label key={g.id} className="seg-opt">
                    <input
                      type="radio"
                      name={`ground-${sheetGroup}`}
                      checked={p.groundHex === "" && p.ground === g.id}
                      onChange={() =>
                        onChange((prev) => ({ ...prev, ground: g.id, groundHex: "" }))
                      }
                    />
                    {g.name}
                  </label>
                ))}
              </div>
              <div className="mb-4">
                <ColourPicker
                  id="ground-hex-mobile"
                  name="Ground"
                  value={
                    p.groundHex ||
                    (GROUNDS.find((g) => g.id === p.ground) ?? GROUNDS[0]).hex
                  }
                  onPick={(hex) => onChange((prev) => ({ ...prev, groundHex: hex }))}
                />
              </div>

              <h6 className="mb-2.5">Type</h6>
              <div className="field mb-3">
                <label htmlFor="headline-face-mobile">Headline</label>
                <FontSelect
                  id="headline-face-mobile"
                  label="Headline face"
                  value={p.font}
                  specimen={p.header.name || "Your name"}
                  onPick={(id) => onChange((prev) => ({ ...prev, font: id }))}
                />
              </div>
              <div className="field mb-4">
                <label htmlFor="body-face-mobile">Body</label>
                <FontSelect
                  id="body-face-mobile"
                  label="Body face"
                  value={p.bodyFont}
                  onPick={(id) => onChange((prev) => ({ ...prev, bodyFont: id }))}
                />
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
            </div>
          )}
        </div>
      </div>
    </>
  );
}
