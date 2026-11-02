"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { ResumeDocument } from "./ResumeDocument";
import { ResumeSheet } from "./ResumeSheet";
import { ColourPicker } from "../builder/ColourPicker";
import { FontSelect } from "../builder/FontSelect";
import { ICON, Icon, IconButton, Segmented, StatusPill } from "../ui";
import { Glyph } from "@/lib/glyphs";
import {
  BLOCK_LABEL,
  COLUMN_OPTIONS,
  MM,
  PAPERS,
  RESUME_ACCENTS,
  RESUME_TEMPLATES,
  SIZES,
  SPACINGS,
  TEMPLATE_CATEGORIES,
  TEMPLATE_DEFAULTS,
  blockHasContent,
  resumePrintPath,
  templateOf,
  type TemplateCategory,
} from "@/lib/resume";
import { RESUME_BACKDROPS, backdropLayers, layerStyle } from "@/lib/resume-backdrops";
import { usePortfolios } from "@/lib/store";
import type { Paper, Portfolio, Resume, ResumeBlock, ResumeColumns, ResumeStyle, ResumeTemplateId } from "@/lib/types";

/* ── the builder's Resume side ────────────────────────────────────────────
   The same three panels as the Page side, so moving between them changes
   what is styled and not where anything is: blocks on the left (order and
   visibility), the sheet in the middle at true proportions with its page
   breaks marked, and the inspector on the right — Template, then Style.

   Open while the page is live. The resume is not on the published page, so
   the freeze that protects it has nothing to protect here.
   ──────────────────────────────────────────────────────────────────────── */

type Tab = "template" | "style";
type SheetTab = "template" | "style" | "blocks";

const EASE = [0.16, 1, 0.3, 1] as const;
const DOWNLOAD = <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />;

export function ResumeStudio({
  p,
  modeSwitch,
  storageError,
}: {
  p: Portfolio;
  modeSwitch: ReactNode;
  storageError: string | null;
}) {
  const { updateResume } = usePortfolios();
  const reduced = useReducedMotion();
  const [tab, setTab] = useState<Tab>("template");
  const [sheet, setSheet] = useState<SheetTab>("template");
  const [pages, setPages] = useState(1);

  const change = (recipe: (r: Resume) => Resume) => updateResume(p.id, recipe);
  const style = (patch: Partial<ResumeStyle>) => change((r) => ({ ...r, style: { ...r.style, ...patch } }));
  const template = templateOf(p.resume.style.template);

  const download = (
    <a href={resumePrintPath(p.id)} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ marginTop: 0, minHeight: 34 }}>
      <Icon d={DOWNLOAD} size={14} />
      <span className="hidden sm:inline">Download PDF</span>
      <span className="sm:hidden">PDF</span>
    </a>
  );

  const inspector = (which: Tab) =>
    which === "template" ? (
      <TemplatePicker p={p} onPick={(id) => style({ template: id, columns: "auto", ...TEMPLATE_DEFAULTS[id] })} />
    ) : (
      <StylePanel p={p} onStyle={style} />
    );

  const pageCount = (
    <Chip>
      {pages} {pages === 1 ? "page" : "pages"}
    </Chip>
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
            <StatusPill live={p.status === "live"} />
          </span>
          {modeSwitch}
          <span className="ml-auto flex flex-none items-center gap-2">
            <Link href={`/editor/${p.id}`} className="btn btn-secondary hidden md:inline-flex" style={{ marginTop: 0, minHeight: 34 }}>
              Edit resume
            </Link>
            {download}
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
              <span aria-hidden className="mt-px grid h-5 w-5 flex-none place-items-center rounded-full text-[12px] font-bold" style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}>
                !
              </span>
              <span className="min-w-0 flex-1">{storageError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══ desktop — blocks, sheet, inspector ═══════════════════════ */}
        <div className="hidden min-h-0 flex-1 gap-4 p-4 lg:grid lg:grid-cols-[260px_minmax(0,1fr)_372px]">
          <motion.aside
            initial={reduced ? false : { opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="min-h-0 overflow-y-auto rounded-2xl"
            style={{ background: "var(--color-bg)", border: "1px solid var(--color-divider)" }}
          >
            <BlockRail p={p} onChange={change} />
          </motion.aside>

          <motion.main
            initial={reduced ? false : { opacity: 0, y: 16, rotateX: 6 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}
            className="flex min-h-0 flex-col"
            style={{ transformPerspective: 1400 }}
          >
            <div className="mb-3 flex flex-none flex-wrap items-center gap-2">
              <PaperSwitch value={p.resume.style.paper} onChange={(paper) => style({ paper })} id="studio-paper" />
              <span className="ml-auto flex items-center gap-1.5">
                <Chip>{template.name}</Chip>
                {pageCount}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl p-6" style={{ background: "var(--color-neutral-200)" }}>
              <div className="mx-auto max-w-[860px]">
                <ResumeSheet p={p} onPages={setPages} />
              </div>
            </div>
            <p className="m-0 mt-2 flex-none text-center text-[12px]" style={{ color: "var(--color-neutral-600)" }}>
              Dashed lines mark where each page fills up. The PDF never splits a role across two pages.
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
                <Segmented
                  label="Inspector"
                  id="studio-inspector"
                  value={tab}
                  onChange={setTab}
                  options={[
                    { id: "template", label: "Template" },
                    { id: "style", label: "Style" },
                  ]}
                />
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

        {/* ══ phone — sheet over a control sheet ═══════════════════════ */}
        <div className="lg:hidden">
          <div className="flex items-center gap-2 px-4 pt-4">
            <Chip>{template.name}</Chip>
            {pageCount}
            <span className="ml-auto">
              <PaperSwitch value={p.resume.style.paper} onChange={(paper) => style({ paper })} id="studio-paper-phone" />
            </span>
          </div>
          <div className="px-4 pt-3 pb-4">
            <div className="max-h-[520px] overflow-y-auto rounded-2xl p-3" style={{ background: "var(--color-neutral-200)" }}>
              <ResumeSheet p={p} onPages={setPages} />
            </div>
          </div>
          <div className="mx-4 mb-8 overflow-hidden rounded-2xl" style={{ background: "var(--color-bg)", border: "1px solid var(--color-divider)" }}>
            <div className="p-2.5" style={{ borderBottom: "1px solid var(--color-divider)" }}>
              <div className="[&>div]:w-full [&>div>button]:flex-1 [&>div>button]:justify-center">
                <Segmented
                  label="Controls"
                  id="studio-sheet"
                  value={sheet}
                  onChange={setSheet}
                  options={[
                    { id: "template", label: "Template" },
                    { id: "style", label: "Style" },
                    { id: "blocks", label: "Blocks" },
                  ]}
                />
              </div>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={sheet}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.25, ease: EASE }}
              >
                {sheet === "blocks" ? <BlockRail p={p} onChange={change} /> : <div className="p-4">{inspector(sheet)}</div>}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex h-7 items-center rounded-full px-3 text-[12px] font-medium whitespace-nowrap"
      style={{ background: "var(--color-bg)", border: "1px solid var(--color-divider)", color: "var(--color-neutral-700)" }}
    >
      {children}
    </span>
  );
}

function PaperSwitch({ value, onChange, id }: { value: Paper; onChange: (p: Paper) => void; id: string }) {
  return (
    <Segmented
      label="Paper size"
      id={id}
      value={value}
      onChange={onChange}
      options={(Object.keys(PAPERS) as Paper[]).map((k) => ({ id: k, label: PAPERS[k].name }))}
    />
  );
}

/* ── blocks: order and visibility ─────────────────────────────────────── */

function BlockRail({ p, onChange }: { p: Portfolio; onChange: (recipe: (r: Resume) => Resume) => void }) {
  const reduced = useReducedMotion();
  const r = p.resume;
  // The order is the page's too (the structured blocks on it follow it), so
  // a live page freezes it; what prints stays a resume-only choice.
  const live = p.status === "live";

  const move = (block: ResumeBlock, delta: -1 | 1) =>
    onChange((prev) => {
      const order = [...prev.order];
      const from = order.indexOf(block);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= order.length) return prev;
      order.splice(from, 1);
      order.splice(to, 0, block);
      return { ...prev, order };
    });
  const toggle = (block: ResumeBlock) =>
    onChange((prev) => ({
      ...prev,
      hidden: prev.hidden.includes(block) ? prev.hidden.filter((b) => b !== block) : [...prev.hidden, block],
    }));

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline px-4 pt-4 pb-2">
        <h2 className="m-0 text-[14px] tracking-[-0.01em]">Blocks</h2>
        <span className="ml-auto font-mono text-[11px]" style={{ color: "var(--color-neutral-600)" }}>
          top to bottom
        </span>
      </div>

      <ul className="m-0 flex list-none flex-col gap-0.5 p-0 px-2">
        {r.order.map((b, i) => {
          const off = r.hidden.includes(b);
          const empty = !blockHasContent(p, b);
          return (
            <motion.li
              key={b}
              layout={!reduced}
              transition={{ duration: 0.3, ease: EASE }}
              className="group relative flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--color-surface)] focus-within:bg-[var(--color-surface)]"
              style={{ opacity: off ? 0.5 : 1 }}
            >
              <span className="w-5 flex-none font-mono text-[11px]" style={{ color: "var(--color-neutral-600)" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] font-medium">{BLOCK_LABEL[b]}</span>
                <span className="truncate text-[11.5px] text-muted">{off ? "Hidden" : empty ? "Nothing to print yet" : "On the sheet"}</span>
              </span>
              <span
                className="flex flex-none items-center rounded-md transition-opacity lg:pointer-events-none lg:absolute lg:top-1/2 lg:right-1 lg:-translate-y-1/2 lg:opacity-0 lg:group-focus-within:pointer-events-auto lg:group-focus-within:opacity-100 lg:group-hover:pointer-events-auto lg:group-hover:opacity-100"
                style={{ background: "var(--color-surface)" }}
              >
                <IconButton label={live ? "Unpublish to reorder" : `Move ${BLOCK_LABEL[b]} up`} onClick={() => !live && move(b, -1)}>
                  <span style={{ opacity: live || i === 0 ? 0.3 : 1 }}>
                    <Glyph id="up" size={14} />
                  </span>
                </IconButton>
                <IconButton label={live ? "Unpublish to reorder" : `Move ${BLOCK_LABEL[b]} down`} onClick={() => !live && move(b, 1)}>
                  <span style={{ opacity: live || i === r.order.length - 1 ? 0.3 : 1 }}>
                    <Glyph id="down" size={14} />
                  </span>
                </IconButton>
                <IconButton label={off ? `Show ${BLOCK_LABEL[b]}` : `Hide ${BLOCK_LABEL[b]}`} onClick={() => toggle(b)}>
                  <Icon
                    d={off ? <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4.4-1" /> : ICON.eye}
                    size={14}
                  />
                </IconButton>
              </span>
            </motion.li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2 p-3">
        <Link href={`/editor/${p.id}`} className="btn btn-secondary btn-block" style={{ justifyContent: "center" }}>
          Edit resume content
          <Glyph id="arrow" size={14} />
        </Link>
      </div>
      <p className="m-0 mx-3 mb-4 rounded-xl p-3 text-[12px] leading-snug text-muted" style={{ background: "var(--color-surface)" }}>
        {live && "The page is live, so the order is fixed until you unpublish. "}“Your sections” are the page’s sections switched on for the resume, each under its section title. In two-column templates, Skills, Certifications, Languages and Awards sit in the narrow column.
      </p>
    </div>
  );
}

/* ── template picker ──────────────────────────────────────────────────── */

/** A template's thumbnail is the author's own resume in it, at a glance. */
function TemplatePicker({ p, onPick }: { p: Portfolio; onPick: (id: ResumeTemplateId) => void }) {
  const reduced = useReducedMotion();
  const current = p.resume.style.template;
  const [filter, setFilter] = useState<TemplateCategory | "all">("all");
  const shown = filter === "all" ? RESUME_TEMPLATES : RESUME_TEMPLATES.filter((t) => t.categories.includes(filter));
  const thumbW = 150;
  const scale = thumbW / (PAPERS.a4.w * MM);

  const pill = (id: TemplateCategory | "all", name: string) => {
    const on = filter === id;
    return (
      <button
        key={id}
        type="button"
        aria-pressed={on}
        onClick={() => setFilter(id)}
        className="cursor-pointer rounded-full px-2.5 py-1 text-[12px] font-medium"
        style={
          on
            ? { background: "var(--color-ink)", color: "var(--color-bg)" }
            : { boxShadow: "inset 0 0 0 1px var(--color-divider)", color: "var(--color-neutral-700)" }
        }
      >
        {name}
      </button>
    );
  };

  return (
    <section>
      <h3 className="m-0 mb-1 text-[14px] tracking-[-0.01em]">
        Templates <span className="font-normal text-muted">· {RESUME_TEMPLATES.length}</span>
      </h3>
      <p className="m-0 mb-3 text-[12.5px] leading-snug text-muted">
        Each comes with a suggested face and colour; change both under Style. Every template sets real text, so an ATS can
        read any of them — single-column ones are the safest.
      </p>
      <div role="group" aria-label="Filter templates" className="mb-3 flex flex-wrap gap-1.5">
        {pill("all", "All")}
        {TEMPLATE_CATEGORIES.map((c) => pill(c.id, c.name))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {shown.map((t, i) => {
          const on = t.id === current;
          const look: Portfolio = {
            ...p,
            resume: { ...p.resume, style: { ...p.resume.style, template: t.id, paper: "a4", columns: "auto", ...TEMPLATE_DEFAULTS[t.id] } },
          };
          return (
            <motion.button
              key={t.id}
              type="button"
              aria-pressed={on}
              title={t.desc}
              onClick={() => onPick(t.id)}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.04, duration: 0.3, ease: EASE }}
              whileHover={reduced ? undefined : { y: -3 }}
              className="flex cursor-pointer flex-col items-stretch gap-2 rounded-xl p-2 text-left"
              // Thirty-odd live thumbnails, twice over (inspector and phone
              // sheet): let the browser skip the ones scrolled out of view.
              style={{
                boxShadow: on ? "inset 0 0 0 2px var(--color-ink)" : "inset 0 0 0 1px var(--color-divider)",
                contentVisibility: "auto",
                containIntrinsicSize: `auto ${Math.round(thumbW * 1.25 + 56)}px`,
              }}
            >
              <span
                aria-hidden
                className="relative block overflow-hidden rounded-md"
                style={{ height: thumbW * 1.25, background: "#fff", boxShadow: "0 1px 3px rgb(0 0 0 / 0.12)" }}
              >
                <span
                  className="pointer-events-none absolute top-0 left-0 block origin-top-left"
                  style={{ transform: `scale(${scale})` }}
                  inert
                >
                  <ResumeDocument p={look} print />
                </span>
                {on && (
                  <span className="absolute right-1.5 bottom-1.5 grid h-6 w-6 place-items-center rounded-full" style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}>
                    <Icon d={ICON.check} size={13} />
                  </span>
                )}
              </span>
              <span className="flex flex-col px-0.5">
                <span className="text-[13px] font-semibold">{t.name}</span>
                <span className="text-[11px]" style={{ color: "var(--color-neutral-600)" }}>
                  {t.layout === "one" ? "One column · ATS-safe" : "Two columns"}
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>
      <p className="m-0 mt-3 text-[12px] text-muted">
        <span className="font-semibold" style={{ color: "var(--color-ink)" }}>
          {templateOf(current).name}
        </span>{" "}
        — {templateOf(current).desc}
      </p>
    </section>
  );
}

/* ── style panel ──────────────────────────────────────────────────────── */

function StylePanel({ p, onStyle }: { p: Portfolio; onStyle: (patch: Partial<ResumeStyle>) => void }) {
  const s = p.resume.style;
  const group = useId();
  const hasPortrait = !!p.header.portrait;

  return (
    <>
      <Group title="Colour" note="Headings, rules and bullets. Body text stays near-black for print.">
        <div className="mb-3 flex flex-wrap gap-2">
          {RESUME_ACCENTS.map((hex) => (
            <button
              key={hex}
              type="button"
              aria-label={`Accent ${hex}`}
              aria-pressed={s.accent.toLowerCase() === hex}
              onClick={() => onStyle({ accent: hex })}
              className="h-8 w-8 cursor-pointer rounded-full transition-transform hover:scale-110"
              style={{
                background: hex,
                boxShadow:
                  s.accent.toLowerCase() === hex
                    ? "0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-ink)"
                    : // A ring off the ink, so the black swatch still shows on a dark panel.
                      "inset 0 0 0 1px color-mix(in srgb, var(--color-ink) 28%, transparent)",
              }}
            />
          ))}
        </div>
        <ColourPicker id={`resume-accent-${group}`} name="Resume accent" value={s.accent} onPick={(accent) => onStyle({ accent })} />
      </Group>

      <Group title="Type">
        <div className="field mb-3">
          <label htmlFor={`r-head-${group}`}>Headings</label>
          <FontSelect id={`r-head-${group}`} label="Resume heading face" value={s.headingFont} specimen={p.header.name || "Your name"} onPick={(headingFont) => onStyle({ headingFont })} />
        </div>
        <div className="field mb-4">
          <label htmlFor={`r-body-${group}`}>Body</label>
          <FontSelect id={`r-body-${group}`} label="Resume body face" value={s.font} onPick={(font) => onStyle({ font })} />
        </div>
        <span className="mb-2 block text-[12.5px] font-medium" style={{ color: "var(--color-neutral-700)" }}>
          Text size
        </span>
        <div className="seg mb-1">
          {SIZES.map((z) => (
            <label key={z.id} className="seg-opt">
              <input type="radio" name={`r-size-${group}`} checked={s.size === z.id} onChange={() => onStyle({ size: z.id })} />
              {z.name}
            </label>
          ))}
        </div>
      </Group>

      <Group title="Spacing" note="Page margins and the room between blocks. Compact is the quickest way back to one page.">
        <div className="seg">
          {SPACINGS.map((z) => (
            <label key={z.id} className="seg-opt">
              <input type="radio" name={`r-spacing-${group}`} checked={s.spacing === z.id} onChange={() => onStyle({ spacing: z.id })} />
              {z.name}
            </label>
          ))}
        </div>
      </Group>

      <Group title="Columns" note="Two columns put Skills, Certifications, Languages and Awards beside your work. One column is the safest for an ATS.">
        <div role="group" aria-label="Columns" className="grid grid-cols-5 gap-2">
          {COLUMN_OPTIONS.map((c) => {
            const on = (s.columns ?? "auto") === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                title={c.name}
                onClick={() => onStyle({ columns: c.id })}
                className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg p-1.5"
                style={{ boxShadow: on ? "inset 0 0 0 2px var(--color-ink)" : "inset 0 0 0 1px var(--color-divider)" }}
              >
                <ColumnsGlyph id={c.id} template={templateOf(s.template).layout} />
                <span className="text-center text-[10.5px] leading-tight" style={{ color: "var(--color-neutral-700)" }}>
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="Background" note="Decoration behind the text, in your accent. It is never part of the text, so an ATS reads the page the same.">
        <div role="group" aria-label="Background" className="grid grid-cols-4 gap-2">
          {RESUME_BACKDROPS.map((b) => {
            const on = (s.backdrop ?? "none") === b.id;
            const { page, corner } = backdropLayers(b.id, s.accent);
            return (
              <button
                key={b.id}
                type="button"
                aria-pressed={on}
                aria-label={b.name}
                title={b.name}
                onClick={() => onStyle({ backdrop: b.id })}
                className="relative aspect-[3/4] cursor-pointer overflow-hidden rounded-md"
                style={{
                  ...layerStyle([...corner, ...page], "#fff", true),
                  boxShadow: on ? "0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-ink)" : "inset 0 0 0 1px rgb(0 0 0 / 0.14)",
                }}
              >
                {b.id === "none" && (
                  <span aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(to top right, transparent calc(50% - 0.75px), rgb(0 0 0 / 0.25) 50%, transparent calc(50% + 0.75px))" }} />
                )}
              </button>
            );
          })}
        </div>
        <p className="m-0 mt-2 text-[12px] text-muted">
          {RESUME_BACKDROPS.find((b) => b.id === (s.backdrop ?? "none"))?.name}
        </p>
      </Group>

      <Group title="Photo" note={hasPortrait ? "Many employers prefer resumes without one — off by default." : "Add a portrait to your page header to use one here."}>
        <label className={`flex items-center gap-3 text-[13.5px] ${hasPortrait ? "cursor-pointer" : "opacity-50"}`}>
          <input
            type="checkbox"
            disabled={!hasPortrait}
            checked={s.photo && hasPortrait}
            onChange={(e) => onStyle({ photo: e.target.checked })}
            className="h-4 w-4 accent-[var(--color-ink)]"
          />
          Show my photo
        </label>
      </Group>
    </>
  );
}

/** A sheet in miniature: the header bar, then the column split a Columns choice gives. */
function ColumnsGlyph({ id, template }: { id: ResumeColumns; template: "one" | "left" | "right" }) {
  const layout = id === "auto" ? template : id;
  const fill = "var(--color-ink)";
  return (
    <svg viewBox="0 0 30 40" width="30" height="40" aria-hidden>
      <rect x=".5" y=".5" width="29" height="39" rx="2" fill="var(--color-bg)" stroke="var(--color-divider)" />
      <rect x="4" y="4" width="14" height="3" rx="1" fill={fill} />
      {layout === "one" && <rect x="4" y="10" width="22" height="26" rx="1" fill={fill} opacity=".22" />}
      {layout === "left" && (
        <>
          <rect x="4" y="10" width="7" height="26" rx="1" fill={fill} opacity=".5" />
          <rect x="13" y="10" width="13" height="26" rx="1" fill={fill} opacity=".22" />
        </>
      )}
      {layout === "right" && (
        <>
          <rect x="4" y="10" width="13" height="26" rx="1" fill={fill} opacity=".22" />
          <rect x="19" y="10" width="7" height="26" rx="1" fill={fill} opacity=".5" />
        </>
      )}
      {layout === "half" && (
        <>
          <rect x="4" y="10" width="10.5" height="26" rx="1" fill={fill} opacity=".22" />
          <rect x="15.5" y="10" width="10.5" height="26" rx="1" fill={fill} opacity=".5" />
        </>
      )}
      {id === "auto" && <circle cx="24" cy="5.5" r="2.5" fill={fill} />}
    </svg>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      <h3 className={`m-0 text-[14px] tracking-[-0.01em] ${note ? "mb-1" : "mb-3"}`}>{title}</h3>
      {note && <p className="m-0 mb-3 text-[12.5px] leading-snug text-muted">{note}</p>}
      {children}
    </section>
  );
}
