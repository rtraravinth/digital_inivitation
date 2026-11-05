"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LinkEditor } from "./LinkEditor";
import { PortfolioExtras, PortraitField, SectionExtras } from "./SectionExtras";
import { PublishedLock } from "./PublishedLock";
import { TabField } from "./TabField";
import { TagEditor } from "./TagEditor";
import { ResumeBlockCard, ResumeContactCard } from "./resume/ResumeContent";
import { ICON, Icon, IconButton, LookToggles, StatusPill, TiltPanel } from "./ui";
import { Glyph } from "@/lib/glyphs";
import { LinkIcon, iconFor } from "@/lib/icons";
import { BLOCK_LABEL, blockHasContent, resumePrintPath } from "@/lib/resume";
import { usePortfolios } from "@/lib/store";
import {
  PAGE_BLOCKS,
  assetSrc,
  previewPath,
  type LinkItem,
  type Portfolio,
  type PageBlock,
  type PortfolioHeader,
  type Section,
} from "@/lib/types";

/* ── the editor ───────────────────────────────────────────────────────────
   One content list for both looks. The header (the top of the page and of
   the resume), the resume-only contact details, the structured blocks —
   Experience, Education, Skills and the rest — and then the page's own
   sections. Every card carries Page and Resume switches, so nothing is
   typed twice and each piece shows where its author says. An outline
   beside them on a desk jumps to any card. Every change saves as you type.
   ──────────────────────────────────────────────────────────────────────── */

const HEADER = "header";
const EASE = [0.16, 1, 0.3, 1] as const;

function nn(index: number) {
  return String(index + 1).padStart(2, "0");
}

export function Editor({ id }: { id: string }) {
  const {
    ready,
    storageError,
    getPortfolio,
    updatePortfolio,
    updateSection,
    addSectionAsync,
    deleteSection,
    moveSection,
    toggleSectionHidden,
  } = usePortfolios();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState<string | null>(null);
  /** Refs, not state: focusing a new section must not cost a render of its own. */
  const justAdded = useRef<string | null>(null);

  // Opening a card brings it into view; a section just added also gets the
  // cursor in its title, since typing one is the next thing anyone does.
  useEffect(() => {
    if (!open) return;
    const node = document.getElementById(`card-${open}`);
    node?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    if (justAdded.current === open) {
      justAdded.current = null;
      window.setTimeout(() => document.getElementById(`title-${open}`)?.focus({ preventScroll: true }), 350);
    }
  }, [open, reduced]);

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

  // A live page is frozen — the API refuses every write to it — so this
  // screen steps aside for Preview and Unpublish. The structured blocks can
  // be on the page, so they are frozen with it.
  if (portfolio.status === "live") {
    return <PublishedLock portfolio={portfolio} />;
  }

  const p: Portfolio = portfolio;
  // The structured blocks, in the order the author arranged them.
  const blocks = p.resume.order.filter((b): b is PageBlock => (PAGE_BLOCKS as string[]).includes(b));
  // Hidden sections count: their tab is still one the author is using.
  const pageTabs = [...new Set(p.sections.map((s) => s.tab.trim()).filter(Boolean))];
  const hidden = p.sections.filter((s) => s.hidden).length;

  const setHeader = (recipe: (h: PortfolioHeader) => PortfolioHeader) =>
    updatePortfolio(p.id, (prev) => ({ ...prev, header: recipe(prev.header) }));

  async function add() {
    // The server mints the id, so the new card can only open once it answers.
    const added = await addSectionAsync(p.id);
    if (!added) return;
    justAdded.current = added;
    setOpen(added);
  }

  return (
    <>
      <div aria-hidden className="app-backdrop" />
      <div className="flex min-h-dvh flex-col">
        {/* ── top bar ─────────────────────────────────────────────── */}
        <header
          className="sticky top-0 z-30 flex h-14 flex-none items-center gap-2 px-3 sm:gap-3 sm:px-6"
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
          <span className="min-w-0 truncate text-[14.5px] font-semibold tracking-[-0.01em]">{p.name}</span>
          <span className="hidden sm:inline-flex">
            <StatusPill live={false} />
          </span>
          <span className="ml-auto flex flex-none items-center gap-2">
            <Link href={`/builder/${p.id}`} className="btn btn-secondary hidden md:inline-flex" style={{ marginTop: 0, minHeight: 34 }}>
              Builder
            </Link>
            <a
              href={resumePrintPath(p.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary hidden sm:inline-flex"
              style={{ marginTop: 0, minHeight: 34 }}
            >
              <Icon d={<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />} size={14} />
              Resume PDF
            </a>
            <a
              href={previewPath(p.id)}
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
              onClick={() => updatePortfolio(p.id, (prev) => ({ ...prev, status: "live" }))}
            >
              Publish
            </button>
          </span>
        </header>

        <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 pt-8 pb-24 sm:px-6 sm:pt-10">
          <AnimatePresence>
            {storageError && (
              <motion.div
                role="alert"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-6 flex items-start gap-3 rounded-xl px-4 py-3 text-[13.5px]"
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

          {/* ── title ───────────────────────────────────────────── */}
          <div className="mb-7 flex flex-wrap items-end gap-x-6 gap-y-3">
            <div className="min-w-0">
              <motion.h1
                initial={reduced ? false : { opacity: 0, y: 14, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.6, ease: EASE }}
                className="m-0 text-[26px] leading-tight tracking-[-0.03em] sm:text-[32px]"
              >
                Edit content
              </motion.h1>
              <motion.p
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="m-0 mt-1.5 max-w-[62ch] text-[14px] text-muted"
              >
                Everything on your page and your resume, written once. Each card says where it
                shows — <strong style={{ color: "var(--color-ink)" }}>Page</strong>,{" "}
                <strong style={{ color: "var(--color-ink)" }}>Resume</strong> or both. The look of each lives in the{" "}
                <Link href={`/builder/${p.id}`} className="underline underline-offset-2" style={{ color: "var(--color-ink)" }}>
                  builder
                </Link>
                .
              </motion.p>
            </div>
            <span className="ml-auto font-mono text-[12px]" style={{ color: "var(--color-neutral-600)" }}>
              1 header · {blocks.length} blocks · {p.sections.length} {p.sections.length === 1 ? "section" : "sections"}
              {hidden > 0 && ` · ${hidden} off the page`}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[230px_minmax(0,1fr)]">
            {/* ── outline ─────────────────────────────────────────── */}
            <nav aria-label="Outline" className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
              <span className="mb-2 block px-3 text-[12px] font-medium" style={{ color: "var(--color-neutral-600)" }}>
                Outline
              </span>
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                <OutlineItem
                  on={open === HEADER}
                  number="—"
                  title={p.header.name || "Header"}
                  sub="Header"
                  onPick={() => setOpen(HEADER)}
                />
                <OutlineItem on={open === "r-contact"} number="—" title="Contact details" sub="Resume only" onPick={() => setOpen("r-contact")} />
                {blocks.map((b) => (
                  <OutlineItem
                    key={b}
                    on={open === `r-${b}`}
                    number="—"
                    title={BLOCK_LABEL[b]}
                    sub={lookLabel(p.resume.pageBlocks.includes(b), !p.resume.hidden.includes(b), blockHasContent(p, b))}
                    dim={!blockHasContent(p, b)}
                    onPick={() => setOpen(`r-${b}`)}
                  />
                ))}
                {p.sections.map((s, i) => (
                  <OutlineItem
                    key={s.id}
                    on={open === s.id}
                    number={nn(i)}
                    title={s.title || "Untitled section"}
                    sub={`${s.tab} · ${lookLabel(!s.hidden, s.onResume, true)}`}
                    dim={s.hidden && !s.onResume}
                    onPick={() => setOpen(s.id)}
                  />
                ))}
              </ul>
              <button type="button" className="btn btn-ghost mt-2 w-full justify-start" onClick={add}>
                <Glyph id="plus" size={14} />
                Add section
              </button>
            </nav>

            {/* ── the document ────────────────────────────────────── */}
            <div className="flex min-w-0 flex-col gap-4" style={{ perspective: 1600 }}>
              <HeaderCard
                header={p.header}
                open={open === HEADER}
                onOpen={() => setOpen(HEADER)}
                onClose={() => setOpen(null)}
                onChange={setHeader}
              />

              <ResumeContactCard p={p} />
              {blocks.map((b) => (
                <ResumeBlockCard key={b} p={p} block={b} />
              ))}

              <div className="mt-4 flex items-baseline gap-3 px-1">
                <h2 className="m-0 text-[16px] tracking-[-0.01em]">Your sections</h2>
                <span className="text-[12.5px] text-muted">
                  Anything else — a project, a cause, a role told your way. Each files under a section title.
                </span>
              </div>

              <AnimatePresence initial={true}>
                {p.sections.map((s, i) => (
                  <motion.div
                    key={s.id}
                    layout={!reduced}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, rotateX: -10 }}
                    animate={{ opacity: 1, y: 0, rotateX: 0 }}
                    exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
                    transition={{ duration: 0.55, delay: Math.min(i, 8) * 0.05, ease: EASE }}
                    style={{ transformOrigin: "50% 100%" }}
                  >
                    <SectionCard
                      section={s}
                      number={nn(i)}
                      first={i === 0}
                      last={i === p.sections.length - 1}
                      tabOptions={pageTabs}
                      open={open === s.id}
                      onOpen={() => setOpen(s.id)}
                      onClose={() => setOpen(null)}
                      onChange={(recipe) => updateSection(p.id, s.id, recipe)}
                      onMove={(delta) => moveSection(p.id, s.id, delta)}
                      onToggleHidden={() => toggleSectionHidden(p.id, s.id)}
                      onToggleResume={() => updateSection(p.id, s.id, (x) => ({ ...x, onResume: !x.onResume }))}
                      onDelete={() => {
                        deleteSection(p.id, s.id);
                        setOpen(null);
                      }}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>

              {p.sections.length === 0 && (
                <div
                  className="rounded-2xl px-6 py-10 text-center"
                  style={{ border: "1.5px dashed var(--color-neutral-400)", background: "var(--color-bg)" }}
                >
                  <p className="m-0 text-[15px] font-medium">No sections yet</p>
                  <p className="m-0 mt-1 text-[13.5px] text-muted">
                    A section is one thing you do or did — a job, a project, a cause. Each one
                    files under a tab on your page.
                  </p>
                </div>
              )}

              <motion.button
                type="button"
                layout={!reduced}
                onClick={add}
                whileHover={reduced ? undefined : { y: -2 }}
                className="group flex cursor-pointer items-center justify-center gap-2.5 rounded-2xl py-5 text-[14px] font-medium"
                style={{
                  border: "1.5px dashed var(--color-neutral-400)",
                  background: "color-mix(in srgb, var(--color-bg) 70%, transparent)",
                }}
              >
                <span
                  className="grid h-7 w-7 place-items-center rounded-full transition-all duration-300 group-hover:rotate-90 group-hover:bg-[var(--color-ink)] group-hover:text-[var(--color-bg)]"
                  style={{ boxShadow: "inset 0 0 0 1px var(--color-divider)" }}
                >
                  <Glyph id="plus" size={15} />
                </span>
                Add section
              </motion.button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

/** "Page and resume", "Page only", … — what an outline row says about a piece. */
function lookLabel(page: boolean, resume: boolean, filled: boolean): string {
  if (!filled) return "Empty";
  if (page && resume) return "Page and resume";
  if (page) return "Page only";
  if (resume) return "Resume only";
  return "Off both";
}

/* ── outline ──────────────────────────────────────────────────────────── */

function OutlineItem({
  on,
  number,
  title,
  sub,
  dim,
  onPick,
}: {
  on: boolean;
  number: string;
  title: string;
  sub: string;
  dim?: boolean;
  onPick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={on ? "true" : undefined}
        onClick={onPick}
        className="relative flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2 text-left"
        style={{ opacity: dim ? 0.55 : 1 }}
      >
        {on && (
          <motion.span
            layoutId="outline-current"
            aria-hidden
            className="absolute inset-0 rounded-lg"
            style={{ background: "var(--color-bg)", border: "1px solid var(--color-divider)", boxShadow: "var(--shadow-sm)" }}
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
          />
        )}
        <span className="relative mt-px w-5 flex-none font-mono text-[11px]" style={{ color: "var(--color-neutral-600)" }}>
          {number}
        </span>
        <span className="relative flex min-w-0 flex-col">
          <span className="truncate text-[13px] font-medium">{title}</span>
          <span className="truncate text-[11.5px] text-muted">{sub}</span>
        </span>
      </button>
    </li>
  );
}

/* ── cards ────────────────────────────────────────────────────────────── */

/**
 * A card that reads like the page until it is opened, then holds the form.
 * Closed, the whole card is one big button; open, it is a form with a Done.
 */
function Card({
  id,
  open,
  onOpen,
  label,
  tools,
  preview,
  children,
  dim,
}: {
  id: string;
  open: boolean;
  onOpen: () => void;
  label: React.ReactNode;
  tools?: React.ReactNode;
  preview: React.ReactNode;
  children: React.ReactNode;
  dim?: boolean;
}) {
  return (
    <TiltPanel
      max={open ? 0 : 2.5}
      lift={open ? 0 : 3}
      className="scroll-mt-20 rounded-2xl"
      style={open ? { border: "1.5px solid var(--color-ink)" } : undefined}
    >
      <div id={`card-${id}`} className="scroll-mt-20" />
      <div className="flex items-center gap-2 px-5 pt-4 sm:px-6">
        <span className="min-w-0 flex-1 text-[12px] font-medium" style={{ color: "var(--color-neutral-600)" }}>
          {label}
        </span>
        {tools}
      </div>
      {open ? (
        <div className="relative px-5 pt-3 pb-5 sm:px-6">{children}</div>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          aria-label="Edit"
          className="relative block w-full cursor-pointer px-5 pt-2 pb-5 text-left sm:px-6"
          style={{ opacity: dim ? 0.55 : 1 }}
        >
          {preview}
          <span
            className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium"
            style={{ color: "var(--color-neutral-700)" }}
          >
            <Icon d={ICON.pencil} size={12} />
            Click to edit
          </span>
        </button>
      )}
    </TiltPanel>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "var(--color-neutral-500)" }}>{children}</span>;
}

function LinkList({ links }: { links: LinkItem[] }) {
  if (links.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
      {links.map((l) => (
        // The glyph the published page will draw, resolved the same way.
        <span key={l.id} className="inline-flex min-w-0 items-center gap-1.5">
          <LinkIcon id={iconFor(l)} />
          <span className="truncate">{l.label || l.url || "Untitled link"}</span>
        </span>
      ))}
    </div>
  );
}

function Grouped({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="m-0 mt-5 min-w-0 border-0 p-0 pt-5" style={{ borderTop: "1px solid var(--color-divider)" }}>
      <legend className="float-left mb-3 w-full p-0 text-[13px] font-semibold">{title}</legend>
      <div className="clear-both flex flex-col gap-4">{children}</div>
    </fieldset>
  );
}

function HeaderCard({
  header,
  open,
  onOpen,
  onClose,
  onChange,
}: {
  header: PortfolioHeader;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (recipe: (h: PortfolioHeader) => PortfolioHeader) => void;
}) {
  return (
    <Card
      id={HEADER}
      open={open}
      onOpen={onOpen}
      label="Header — the top of your page and your resume"
      tools={
        <span className="flex items-center gap-1">
          <LookToggles name="the header" page resume />
          {open && (
            <button type="button" className="btn btn-primary ml-1" style={{ marginTop: 0, minHeight: 32, fontSize: 13 }} onClick={onClose}>
              Done
            </button>
          )}
        </span>
      }
      preview={
        <div className="flex items-start gap-4">
          {header.portrait && (
            // An API URL — nothing for next/image to optimise.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={assetSrc(header.portrait)} alt="" className="h-16 w-16 flex-none rounded-full object-cover" />
          )}
          <div className="min-w-0">
            <div className="text-[26px] leading-tight font-semibold tracking-[-0.025em]">
              {header.name || <Placeholder>Your name</Placeholder>}
            </div>
            <div className="mt-1 text-[14px]">
              {header.current || <Placeholder>What you’re doing right now</Placeholder>}
            </div>
            <p className="m-0 mt-2 line-clamp-3 max-w-[64ch] text-[14px] leading-relaxed text-muted">
              {header.description || <Placeholder>A few lines about your work</Placeholder>}
            </p>
            {header.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {header.tags.map((t, i) => (
                  <span key={t} className={`tag ${i === 0 ? "tag-accent" : "tag-neutral"}`}>
                    {t}
                  </span>
                ))}
              </div>
            )}
            <LinkList links={header.links} />
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="field">
          <label htmlFor="h-name">Name</label>
          <input
            id="h-name"
            className="input"
            style={{ fontWeight: 600, fontSize: 20, minHeight: 48 }}
            placeholder="Your name"
            value={header.name}
            onChange={(e) => onChange((h) => ({ ...h, name: e.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor="h-current">What you do now — your resume headline too</label>
          <input
            id="h-current"
            className="input"
            placeholder="Founder, Northwell Kitchens · Bengaluru"
            value={header.current}
            onChange={(e) => onChange((h) => ({ ...h, current: e.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor="h-desc">About you — your resume summary too</label>
          <textarea
            id="h-desc"
            className="input"
            rows={4}
            placeholder="A few lines about your work"
            value={header.description}
            onChange={(e) => onChange((h) => ({ ...h, description: e.target.value }))}
          />
        </div>
      </div>

      <Grouped title="Tags and links">
        <div className="field">
          <label>Tags</label>
          <TagEditor accentFirst tags={header.tags} onChange={(tags) => onChange((h) => ({ ...h, tags }))} />
        </div>
        <div className="field">
          <label>Links</label>
          <LinkEditor links={header.links} onChange={(links) => onChange((h) => ({ ...h, links }))} />
        </div>
      </Grouped>

      <Grouped title="Photo">
        <PortraitField portrait={header.portrait} onChange={(portrait) => onChange((h) => ({ ...h, portrait }))} />
      </Grouped>

      {/* Draws its own rule and "Add to this portfolio (optional)" label. */}
      <div className="mt-5">
        <PortfolioExtras header={header} onChange={onChange} />
      </div>

      <div className="mt-6 flex justify-end">
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Card>
  );
}

function SectionCard({
  section: s,
  number,
  first,
  last,
  tabOptions,
  open,
  onOpen,
  onClose,
  onChange,
  onMove,
  onToggleHidden,
  onToggleResume,
  onDelete,
}: {
  section: Section;
  number: string;
  first: boolean;
  last: boolean;
  tabOptions: string[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (recipe: (s: Section) => Section) => void;
  onMove: (delta: -1 | 1) => void;
  onToggleHidden: () => void;
  onToggleResume: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const extras = [s.image && "Image", s.file && "File", s.quote?.text && "Quote"].filter(Boolean) as string[];

  return (
    <Card
      id={s.id}
      open={open}
      onOpen={onOpen}
      dim={s.hidden && !s.onResume}
      label={
        <span className="flex items-center gap-2">
          <span className="font-mono">{number}</span>
          <span className="truncate">{s.tab}</span>
        </span>
      }
      tools={
        <span className="flex flex-wrap items-center justify-end gap-1">
          <LookToggles name={s.title || "this section"} page={!s.hidden} resume={s.onResume} onPage={onToggleHidden} onResume={onToggleResume} />
          <IconButton label="Move up" onClick={() => !first && onMove(-1)}>
            <span style={{ opacity: first ? 0.3 : 1 }}>
              <Glyph id="up" size={15} />
            </span>
          </IconButton>
          <IconButton label="Move down" onClick={() => !last && onMove(1)}>
            <span style={{ opacity: last ? 0.3 : 1 }}>
              <Glyph id="down" size={15} />
            </span>
          </IconButton>
          {open && (
            <button type="button" className="btn btn-primary ml-1" style={{ marginTop: 0, minHeight: 32, fontSize: 13 }} onClick={onClose}>
              Done
            </button>
          )}
        </span>
      }
      preview={
        <>
          <div className="text-[19px] leading-snug font-semibold tracking-[-0.015em]">
            {s.title || <Placeholder>Title</Placeholder>}
          </div>
          <p className="m-0 mt-1.5 line-clamp-3 max-w-[64ch] text-[14px] leading-relaxed text-muted">
            {s.description || <Placeholder>What it is, in a few sentences</Placeholder>}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="tag tag-neutral">{s.tab}</span>
            {extras.map((x) => (
              <span key={x} className="tag tag-neutral">
                {x}
              </span>
            ))}
          </div>
          <LinkList links={s.links} />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* The section title comes first: it is the group this entry files
            under — a tab on the page, a heading on the resume. */}
        <div className="field">
          <label htmlFor={`tab-${s.id}`}>Section title</label>
          <TabField id={`tab-${s.id}`} value={s.tab} options={tabOptions} onChange={(tab) => onChange((x) => ({ ...x, tab }))} />
          <p className="m-0 mt-1.5 text-[12px] text-muted">
            Groups this entry — a tab on your page, a heading on your resume. Pick one you already use, or name a new one.
          </p>
        </div>
        <div className="field">
          <label htmlFor={`title-${s.id}`}>Title</label>
          <input
            id={`title-${s.id}`}
            className="input"
            style={{ fontWeight: 600, fontSize: 18, minHeight: 46 }}
            placeholder="e.g. Northwell Kitchens"
            value={s.title}
            onChange={(e) => onChange((x) => ({ ...x, title: e.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor={`desc-${s.id}`}>Description</label>
          <textarea
            id={`desc-${s.id}`}
            className="input"
            rows={4}
            placeholder="What it is, in a few sentences"
            value={s.description}
            onChange={(e) => onChange((x) => ({ ...x, description: e.target.value }))}
          />
        </div>
      </div>

      <Grouped title="Links">
        <LinkEditor links={s.links} onChange={(links) => onChange((x) => ({ ...x, links }))} />
      </Grouped>

      {/* Draws its own rule and "Add to this section (optional)" label. */}
      <div className="mt-5">
        <SectionExtras section={s} onChange={onChange} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <AnimatePresence mode="wait" initial={false}>
          {confirming ? (
            <motion.span
              key="confirm"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-wrap items-center gap-2"
            >
              <span className="text-[13px] font-medium">Delete this section for good?</span>
              <button type="button" className="btn btn-primary" style={{ marginTop: 0 }} onClick={onDelete}>
                Delete
              </button>
              <button type="button" className="btn btn-ghost" style={{ marginTop: 0 }} onClick={() => setConfirming(false)}>
                Keep it
              </button>
            </motion.span>
          ) : (
            <motion.span key="ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <button type="button" className="btn btn-ghost" style={{ marginTop: 0 }} onClick={() => setConfirming(true)}>
                Delete section…
              </button>
            </motion.span>
          )}
        </AnimatePresence>
        <button type="button" className="btn btn-primary ml-auto" style={{ marginTop: 0 }} onClick={onClose}>
          Done
        </button>
      </div>
    </Card>
  );
}
