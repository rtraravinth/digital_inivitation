"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LinkEditor } from "./LinkEditor";
import { PortfolioExtras, PortraitField, SectionExtras } from "./SectionExtras";
import { PublishedLock } from "./PublishedLock";
import { TagEditor } from "./TagEditor";
import { ResumeContactFields } from "./resume/ResumeContent";
import { Card, Placeholder } from "./editor/card";
import { COMPONENT_ICON, ComponentChip, ComponentPanel, ComponentPicker, CoverField, componentName, componentSummary, newComponent } from "./editor/components";
import { ICON, Icon, IconButton, LookToggles, StatusPill } from "./ui";
import { Glyph } from "@/lib/glyphs";
import { LinkIcon, iconFor } from "@/lib/icons";
import { usePortfolios } from "@/lib/store";
import {
  BLOCK_TYPES,
  assetSrc,
  coverOf,
  previewPath,
  type LinkItem,
  type Portfolio,
  type BlockType,
  type Resume,
  type Footer,
  type PortfolioHeader,
  type Section,
} from "@/lib/types";

/* ── the editor ───────────────────────────────────────────────────────────
   One content list for both looks, and one kind of thing in it: a section.
   A section is a heading and its components, and every one is the same
   card — closed it reads like the page, open it is a form with a Done.

   The header (which also holds the resume's private contact line), the
   sections, the footer. Experience, Education, Skills and the other resume
   lists are components like a gallery or a timeline: placed in whichever
   sections their author likes, with the entries still stored as the
   resume's structured facts. Words are typed here; looks — a list's, a
   gallery's — are picked in the builder. Every section carries Page and
   Resume switches, so nothing is typed twice. An outline beside them on a
   desk jumps to any card. Every change saves as you type.
   ──────────────────────────────────────────────────────────────────────── */

const HEADER = "header";
const FOOTER = "footer";
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
    // The outline scrolls on its own, so its row for this card may be out of
    // sight — a section just added is always the last one.
    document.getElementById(`outline-${open}`)?.scrollIntoView({ block: "nearest" });
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
  const hidden = p.sections.filter((s) => s.hidden).length;

  const setHeader = (recipe: (h: PortfolioHeader) => PortfolioHeader) =>
    updatePortfolio(p.id, (prev) => ({ ...prev, header: recipe(prev.header) }));
  const setFooter = (recipe: (f: Footer) => Footer) =>
    updatePortfolio(p.id, (prev) => ({ ...prev, footer: recipe(prev.footer) }));

  async function add() {
    // The server mints the id, so the new card can only open once it answers.
    const added = await addSectionAsync(p.id);
    if (!added) return;
    justAdded.current = added;
    setOpen(added);
  }

  /** Quick add: a new section named after a component, with it inside. */
  async function quickAdd(type: BlockType) {
    const added = await addSectionAsync(p.id);
    if (!added) return;
    updateSection(p.id, added, (s) => ({ ...s, title: componentName(type), blocks: [newComponent(type)] }));
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
              Open builder
            </Link>
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

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[250px_minmax(0,1fr)]">
            {/* ── outline ─────────────────────────────────────────── */}
            {/* As tall as the window and no taller: the list scrolls inside
                it, and what adds a section stays pinned under the list. It
                used to be one long column, so on a page with many sections
                "Add section" sat below the fold until the whole document had
                been scrolled to its end. */}
            <nav
              aria-label="Outline"
              className="hidden lg:sticky lg:top-20 lg:flex lg:max-h-[calc(100dvh-7.5rem)] lg:flex-col lg:self-start"
            >
              <span className="mb-2 block flex-none px-3 text-[12px] font-medium" style={{ color: "var(--color-neutral-600)" }}>
                Outline
              </span>
              {/* Header, the sections, "Add section", footer: the order of
                  the page, with the button where a new section lands. Only
                  the sections scroll, so the button and the footer stay in
                  view under them however many there are. */}
              <ul className="m-0 flex flex-none list-none flex-col gap-0.5 p-0">
                <OutlineItem
                  id={HEADER}
                  on={open === HEADER}
                  number="—"
                  title={p.header.name || "Header"}
                  sub="Header"
                  onPick={() => setOpen(HEADER)}
                />
              </ul>
              <div className="-mr-2 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2">
                <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                  {p.sections.map((s, i) => (
                    <OutlineItem
                      key={s.id}
                      id={s.id}
                      on={open === s.id}
                      number={nn(i)}
                      title={s.title || "Untitled section"}
                      sub={lookLabel(!s.hidden, s.onResume, true)}
                      dim={s.hidden && !s.onResume}
                      onPick={() => setOpen(s.id)}
                    />
                  ))}
                </ul>
              </div>

              <div className="flex flex-none flex-col gap-1 pt-1">
                <button type="button" className="btn btn-secondary w-full justify-center" style={{ marginTop: 0 }} onClick={add}>
                  <Glyph id="plus" size={14} />
                  Add section
                </button>
                <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                  <OutlineItem
                    id={FOOTER}
                    on={open === FOOTER}
                    number="—"
                    title={p.footer.headline || "Footer"}
                    sub="Footer · Page only"
                    onPick={() => setOpen(FOOTER)}
                  />
                </ul>
              </div>

              <div className="mt-2 flex flex-none flex-col gap-3 pt-3" style={{ borderTop: "1px solid var(--color-divider)" }}>
                <QuickAdd onAdd={quickAdd} compact />
              </div>
            </nav>

            {/* ── the document ────────────────────────────────────── */}
            <div className="flex min-w-0 flex-col gap-4" style={{ perspective: 1600 }}>
              {/* The title sits in this column, not above both: the outline
                  beside it then starts at the top of the window, so its
                  pinned "Add section" is in view before any scrolling. */}
              <div className="mb-3 flex flex-wrap items-end gap-x-6 gap-y-3">
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
                  1 header · {p.sections.length} {p.sections.length === 1 ? "section" : "sections"}
                  {hidden > 0 && ` · ${hidden} off the page`}
                </span>
              </div>

              <HeaderCard
                header={p.header}
                open={open === HEADER}
                onOpen={() => setOpen(HEADER)}
                onClose={() => setOpen(null)}
                onChange={setHeader}
                p={p}
              />

              <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1">
                <h2 className="m-0 text-[16px] tracking-[-0.01em]">Sections</h2>
                <span className="text-[12.5px] text-muted">
                  Each is one thing with one title: a cover, a description, and any components under it.
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
                      resume={p.resume}
                      p={p}
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
                    A section is one thing you do or did — a job, a project, a cause. Add one below,
                    or start from a resume list with Quick add.
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

              {/* Beside the document on a desk, in the outline; here only
                  where there is no outline to hold it. */}
              <div className="lg:hidden">
                <QuickAdd onAdd={quickAdd} />
              </div>

              <div className="mt-4 flex items-baseline gap-3 px-1">
                <h2 className="m-0 text-[16px] tracking-[-0.01em]">Footer</h2>
                <span className="text-[12.5px] text-muted">How the page ends — a last call to action and the small print.</span>
              </div>
              <FooterCard
                p={p}
                open={open === FOOTER}
                onOpen={() => setOpen(FOOTER)}
                onClose={() => setOpen(null)}
                onChange={setFooter}
              />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

/** What quick add offers, in this order: the resume's six lists. */
const QUICK_ADD: BlockType[] = ["experience", "education", "skills", "certifications", "awards", "languages"];

/**
 * The resume's lists as a one-click start: a new section named after the
 * list, with its component already inside. These six and no others — they
 * are what most pages begin with, and a short row stays readable in the
 * outline. Everything else, and these too, is under "Add a component" in
 * any section, as often as its author likes. `compact` is the outline's
 * copy.
 */
function QuickAdd({ onAdd, compact }: { onAdd: (type: BlockType) => void; compact?: boolean }) {
  const chips = (
    <ul className={`m-0 grid list-none gap-1 p-0 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
      {QUICK_ADD.map((id) => BLOCK_TYPES.find((t) => t.id === id)!).map((t) => (
        <li key={t.id} className="min-w-0">
          <button
            type="button"
            onClick={() => onAdd(t.id)}
            title={t.desc}
            className="flex min-h-[32px] w-full cursor-pointer items-center gap-1.5 rounded-lg px-2 text-left text-[12px] transition-colors hover:bg-[var(--color-neutral-100)]"
            style={{ boxShadow: "inset 0 0 0 1px var(--color-divider)" }}
          >
            <span className="flex-none">
              <Icon d={COMPONENT_ICON[t.id]} size={13} />
            </span>
            <span className="quick-add-name min-w-0 flex-1 truncate">{t.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
  if (compact) {
    return (
      <div>
        <span className="mb-1.5 block px-1 text-[12px] font-medium" style={{ color: "var(--color-neutral-600)" }}>
          Quick add
        </span>
        {chips}
      </div>
    );
  }
  return (
    <div className="rounded-2xl px-5 py-4 sm:px-6" style={{ border: "1px solid var(--color-divider)", background: "var(--color-bg)" }}>
      <p className="m-0 text-[13px] font-semibold">Quick add</p>
      <p className="m-0 mt-0.5 mb-3 max-w-[64ch] text-[12.5px] leading-snug text-muted">A new section with this component already in it.</p>
      {chips}
    </div>
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
  id,
  on,
  number,
  title,
  sub,
  dim,
  onPick,
}: {
  /** The card this row opens; also what the outline scrolls to. */
  id: string;
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
        id={`outline-${id}`}
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

function Grouped({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="m-0 mt-5 min-w-0 border-0 p-0 pt-5" style={{ borderTop: "1px solid var(--color-divider)" }}>
      <legend className="float-left mb-3 w-full p-0 text-[13px] font-semibold">
        {title}
        {hint && <span className="mt-0.5 block text-[12.5px] font-normal text-muted">{hint}</span>}
      </legend>
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
  p,
}: {
  /** For the resume's contact line, which is the resume's, not the header's. */
  p: Portfolio;
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

      <Grouped
        title="Resume contact details"
        hint="Printed under your name on the resume and never shown on your page. To put a way to reach you on the page, add a Contact component to a section."
      >
        <ResumeContactFields p={p} />
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
  resume,
  p,
  open,
  onOpen,
  onClose,
  onChange,
  onMove,
  onToggleHidden,
  onToggleResume,
  onDelete,
}: {
  resume: Resume;
  p: Portfolio;
  section: Section;
  number: string;
  first: boolean;
  last: boolean;
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
  const extras = [s.file && "File", s.quote?.text && "Quote"].filter(Boolean) as string[];
  const cover = coverOf(s);

  return (
    <Card
      id={s.id}
      open={open}
      onOpen={onOpen}
      dim={s.hidden && !s.onResume}
      label={
        <span className="flex items-center gap-2">
          <span className="font-mono">{number}</span>
          <span className="truncate">Section</span>
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
        </span>
      }
      preview={
        <>
          <div className="flex items-start gap-4">
            {cover && (
              // An API URL — nothing for next/image to optimise.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assetSrc(cover)}
                alt=""
                className="h-16 w-[5.3rem] flex-none rounded-lg object-cover"
                style={{ boxShadow: "inset 0 0 0 1px var(--color-divider)" }}
              />
            )}
            <div className="min-w-0">
              <div className="text-[19px] leading-snug font-semibold tracking-[-0.015em]">
                {s.title || <Placeholder>Title</Placeholder>}
              </div>
              <p className="m-0 mt-1.5 line-clamp-3 max-w-[64ch] text-[14px] leading-relaxed text-muted">
                {s.description || <Placeholder>What it is, in a few sentences</Placeholder>}
              </p>
            </div>
          </div>
          {s.blocks.length > 0 && (
            <ul className="m-0 mt-3 flex list-none flex-wrap gap-1.5 p-0">
              {s.blocks.map((b) => (
                <li key={b.id} className="inline-flex">
                  <ComponentChip icon={COMPONENT_ICON[b.type]} name={componentName(b.type)} summary={componentSummary(b, resume)} />
                </li>
              ))}
            </ul>
          )}
          {extras.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {extras.map((x) => (
                <span key={x} className="tag tag-neutral">
                  {x}
                </span>
              ))}
            </div>
          )}
          <LinkList links={s.links} />
        </>
      }
    >
      <div className="flex flex-col gap-4">
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
          <p className="m-0 mt-1.5 text-[12px] text-muted">
            The section’s name: its heading on your page and its place on the page’s menu.
          </p>
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

      <Grouped title="Cover picture" hint="One picture the page leads this section with. For a set of pictures, add a Gallery component below.">
        <CoverField section={s} onChange={onChange} />
      </Grouped>

      <Grouped title="Links">
        <LinkEditor links={s.links} onChange={(links) => onChange((x) => ({ ...x, links }))} />
      </Grouped>

      <Grouped
        title="Components"
        hint="Everything else this section shows on your page, in this order. How each one looks is picked in the builder."
      >
        {s.blocks.length > 0 && (
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {s.blocks.map((b, i) => (
                <motion.div
                  key={b.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.4, ease: EASE }}
                >
                  <ComponentPanel block={b} section={s} p={p} first={i === 0} last={i === s.blocks.length - 1} onSection={onChange} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
        <ComponentPicker count={s.blocks.length} onAdd={(type) => onChange((x) => ({ ...x, blocks: [...x.blocks, newComponent(type)] }))} />
      </Grouped>

      {/* Draws its own rule and "Attach (optional)" label. */}
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

/* ── the footer ───────────────────────────────────────────────────────── */

function FooterCard({
  p,
  open,
  onOpen,
  onClose,
  onChange,
}: {
  p: Portfolio;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (recipe: (f: Footer) => Footer) => void;
}) {
  const f = p.footer;
  const headerLinks = f.showHeaderLinks ? p.header.links : [];
  return (
    <Card
      id={FOOTER}
      open={open}
      onOpen={onOpen}
      label="Footer — the end of your page"
      tools={
        <span className="flex items-center gap-1">
          <LookToggles name="the footer" page resume={null} />
        </span>
      }
      preview={
        <>
          <div className="text-[21px] leading-snug font-semibold tracking-[-0.02em]">
            {f.headline || <Placeholder>{p.header.name ? `Say hello to ${p.header.name.split(" ")[0]}` : "A last line to visitors"}</Placeholder>}
          </div>
          {f.text && <p className="m-0 mt-1.5 line-clamp-2 max-w-[64ch] text-[14px] leading-relaxed text-muted">{f.text}</p>}
          {f.ctaLabel && (
            <span className="mt-3 inline-flex h-8 items-center rounded-full px-3.5 text-[12.5px] font-semibold" style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}>
              {f.ctaLabel}
            </span>
          )}
          <LinkList links={[...headerLinks, ...f.links]} />
          <p className="m-0 mt-3 text-[12.5px] text-muted">{f.note || <Placeholder>© {new Date().getFullYear()} {p.header.name || "Your name"}</Placeholder>}</p>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="field">
          <label htmlFor="f-headline">Closing line</label>
          <input
            id="f-headline"
            className="input"
            style={{ fontWeight: 600, fontSize: 18, minHeight: 46 }}
            placeholder="Let’s build something together"
            value={f.headline}
            onChange={(e) => onChange((x) => ({ ...x, headline: e.target.value }))}
          />
          <p className="m-0 mt-1.5 text-[12px] text-muted">Left empty, the footer leads with your name.</p>
        </div>
        <div className="field">
          <label htmlFor="f-text">A line under it</label>
          <textarea
            id="f-text"
            className="input"
            rows={2}
            placeholder="Taking on two projects this quarter."
            value={f.text}
            onChange={(e) => onChange((x) => ({ ...x, text: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="field">
            <label htmlFor="f-cta-label">Button label</label>
            <input
              id="f-cta-label"
              className="input"
              placeholder="Email me"
              value={f.ctaLabel}
              onChange={(e) => onChange((x) => ({ ...x, ctaLabel: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="f-cta-url">Button link</label>
            <input
              id="f-cta-url"
              className="input"
              placeholder="mailto:you@example.com or cal.com/you"
              value={f.ctaUrl}
              onChange={(e) => onChange((x) => ({ ...x, ctaUrl: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <Grouped title="Links" hint="Your header’s links can repeat here; these are added after them.">
        <label className="flex cursor-pointer items-center gap-3 text-[13.5px]">
          <input
            type="checkbox"
            className="h-4 w-4 flex-none accent-[var(--color-ink)]"
            checked={f.showHeaderLinks}
            onChange={(e) => onChange((x) => ({ ...x, showHeaderLinks: e.target.checked }))}
          />
          Repeat the header’s links ({p.header.links.length})
        </label>
        <LinkEditor links={f.links} onChange={(links) => onChange((x) => ({ ...x, links }))} />
      </Grouped>

      <Grouped title="Small print">
        <div className="field">
          <label htmlFor="f-note">Last line</label>
          <input
            id="f-note"
            className="input"
            placeholder={`© ${new Date().getFullYear()} ${p.header.name || "Your name"} · Bengaluru`}
            value={f.note}
            onChange={(e) => onChange((x) => ({ ...x, note: e.target.value }))}
          />
        </div>
      </Grouped>

      <div className="mt-6 flex justify-end">
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Card>
  );
}
