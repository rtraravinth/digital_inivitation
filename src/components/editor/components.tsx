"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useRef, useState } from "react";
import { Icon, IconButton } from "../ui";
import { Glyph } from "@/lib/glyphs";
import { readImageAsset } from "@/lib/assets";
import { newId } from "@/lib/store";
import { ResumeListRows, listSummary } from "../resume/ResumeContent";
import {
  BLOCK_TYPES,
  GALLERY_LAYOUTS,
  LIST_LOOKS,
  LOOK_NAME,
  PAGE_BLOCKS,
  SECTION_BLOCKS_MAX,
  SECTION_IMAGES_MAX,
  assetSrc,
  componentHasContent,
  coverOf,
  emptyBlock,
  galleryImages,
  isListBlock,
  lookOf,
  type Asset,
  type Block,
  type BlockType,
  type ContactBlock,
  type GalleryBlock,
  type ResumeListBlock,
  type PageBlock,
  type Portfolio,
  type Resume,
  type Section,
} from "@/lib/types";

/* ── components in the editor ─────────────────────────────────────────────
   A section is a heading and a cover picture; everything under that is a
   component, and every component is the same panel — `PanelShell`: a mark,
   a name, what it holds, then the rows its kind needs and nothing else. A
   timeline asks for a date, a title and a line; a gallery for pictures and
   how to lay them out; an Experience component for roles and their dates
   (its rows live in resume/ResumeContent.tsx, because they are the
   resume's own data — the component only places the list and picks a look).
   ──────────────────────────────────────────────────────────────────────── */

const EASE = [0.16, 1, 0.3, 1] as const;

/** The resume's lists. */
const LIST_ICON: Record<PageBlock, React.ReactNode> = {
  experience: (
    <>
      <rect x="3.5" y="7.5" width="17" height="12" rx="1.5" />
      <path d="M9 7.5V5.5h6v2M3.5 13h17" />
    </>
  ),
  education: (
    <>
      <path d="m2.5 9.5 9.5-4.5 9.5 4.5-9.5 4.5-9.5-4.5Z" />
      <path d="M6.5 11.8V16c1.5 1.4 3.4 2 5.5 2s4-.6 5.5-2v-4.2" />
    </>
  ),
  skills: (
    <>
      <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  certifications: (
    <>
      <circle cx="12" cy="9.5" r="5.5" />
      <path d="m8.8 14 -1.3 6 4.5-2.4 4.5 2.4-1.3-6" />
    </>
  ),
  languages: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5s1.2-6.1 3.8-8.5Z" />
    </>
  ),
  awards: (
    <>
      <path d="M8 4.5h8v5a4 4 0 0 1-8 0v-5ZM8 6.5H5c0 2.5 1.2 4 3.2 4.3M16 6.5h3c0 2.5-1.2 4-3.2 4.3M12 13.5V17M8.5 19.5h7" />
    </>
  ),
};

/** One drawn mark per component, on the same 24px grid as the rest. */
export const COMPONENT_ICON: Record<BlockType, React.ReactNode> = {
  ...LIST_ICON,
  gallery: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4 17 5-4.5 3.5 3 3-2.5 5 4" />
    </>
  ),
  timeline: (
    <>
      <path d="M6 4v16" />
      <circle cx="6" cy="7" r="2" />
      <circle cx="6" cy="17" r="2" />
      <path d="M11 7h9M11 17h7" />
    </>
  ),
  testimonials: (
    <>
      <path d="M4 5h16v11H9l-5 4V5Z" />
      <path d="M9 10h.01M12 10h.01M15 10h.01" />
    </>
  ),
  clients: (
    <>
      <rect x="3.5" y="4" width="7" height="7" rx="1" />
      <rect x="13.5" y="4" width="7" height="7" rx="1" />
      <rect x="3.5" y="14" width="7" height="6" rx="1" />
      <rect x="13.5" y="14" width="7" height="6" rx="1" />
    </>
  ),
  tabs: (
    <>
      <path d="M3 9h18v11H3z" />
      <path d="M3 9V5h6v4M9 5h6v4" />
    </>
  ),
  stats: <path d="M4 20V12M10 20V5M16 20v-5M21 20H3" />,
  services: (
    <>
      <path d="M4 7h16M4 12h16M4 17h10" />
      <circle cx="19" cy="17" r="1.5" />
    </>
  ),
  faq: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4M12 16.8h.01" />
    </>
  ),
  contact: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
};

export function componentName(type: BlockType): string {
  return BLOCK_TYPES.find((t) => t.id === type)?.name ?? type;
}

/** "3 milestones", "Email, phone" — what a closed card says about one. */
export function componentSummary(b: Block, resume?: Resume): string {
  if (isListBlock(b)) return resume ? listSummary(resume, b.type) : "";
  if (b.type === "gallery") {
    const n = b.imageIds.length;
    return n === 0 ? "Empty" : `${n} ${n === 1 ? "picture" : "pictures"}`;
  }
  if (b.type === "contact") {
    const parts = [b.email && "email", b.phone && "phone", b.ctaUrl && "booking link", b.form && "form"].filter(Boolean);
    return parts.length ? parts.join(", ") : "Empty";
  }
  const filled = (b.items as Array<Record<string, string>>).filter((item) =>
    Object.entries(item).some(([k, v]) => k !== "id" && typeof v === "string" && v.trim()),
  ).length;
  const noun = ITEM_NOUN[b.type];
  return filled === 0 ? "Empty" : `${filled} ${filled === 1 ? noun[0] : noun[1]}`;
}

const ITEM_NOUN: Record<Exclude<BlockType, "contact" | "gallery" | PageBlock>, [string, string]> = {
  timeline: ["milestone", "milestones"],
  testimonials: ["testimonial", "testimonials"],
  clients: ["client", "clients"],
  tabs: ["tab", "tabs"],
  stats: ["number", "numbers"],
  services: ["service", "services"],
  faq: ["question", "questions"],
};

/* ── pictures ─────────────────────────────────────────────────────────── */

/**
 * The section's one cover picture: what a theme leads the section with. A
 * set of pictures is a Gallery component, further down.
 */
export function CoverField({ section, onChange }: { section: Section; onChange: (recipe: (s: Section) => Section) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cover = coverOf(section);
  const full = !cover && section.images.length >= SECTION_IMAGES_MAX;

  async function pick(file: File) {
    setError("");
    setBusy(true);
    try {
      const asset = await readImageAsset(file);
      // The cover leads the list; whatever it replaces leaves with it.
      onChange((s) => {
        const old = coverOf(s);
        const rest = s.images.filter((a) => a !== old && a.id !== asset.id);
        return { ...s, images: [asset, ...rest] };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That picture could not be read.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        {cover ? (
          // An API URL — nothing for next/image to optimise.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={assetSrc(cover)}
            alt={cover.name}
            className="block aspect-[4/3] w-40 flex-none rounded-xl object-cover"
            style={{ boxShadow: "inset 0 0 0 1px var(--color-divider)", background: "var(--color-surface)", opacity: busy ? 0.5 : 1 }}
          />
        ) : (
          <button
            type="button"
            disabled={busy || full}
            onClick={() => input.current?.click()}
            className={`flex aspect-[4/3] w-40 flex-none cursor-pointer flex-col items-center justify-center gap-2 rounded-xl text-[13px] font-medium transition-colors hover:bg-[var(--color-neutral-100)] disabled:cursor-not-allowed disabled:opacity-50 ${busy ? "animate-pulse" : ""}`}
            style={{ border: "1.5px dashed var(--color-neutral-400)", color: "var(--color-neutral-700)" }}
          >
            <Glyph id="plus" size={18} />
            {busy ? "Uploading…" : "Add a cover"}
          </button>
        )}
        {cover && (
          <span className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary" style={{ marginTop: 0 }} disabled={busy} onClick={() => input.current?.click()}>
              {busy ? "Uploading…" : "Replace"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: 0 }}
              disabled={busy}
              onClick={() => onChange((s) => ({ ...s, images: s.images.filter((a) => a !== coverOf(s)) }))}
            >
              Remove
            </button>
          </span>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void pick(file);
          e.target.value = "";
        }}
      />
      {full && (
        <p className="m-0 mt-2 text-[12.5px] text-muted">
          This section already holds {SECTION_IMAGES_MAX} pictures in its galleries. Remove one to add a cover.
        </p>
      )}
      {error && (
        <p className="m-0 mt-2 text-[12.5px]" style={{ color: "var(--color-accent-700)" }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * A gallery's pictures as tiles. Several can be picked at once; each
 * uploads on its own, so one unreadable file does not lose the others.
 * `room` is how many more the section can hold — the cover and every
 * gallery share one allowance.
 */
function PicturesField({
  images,
  room,
  onChange,
}: {
  images: Asset[];
  room: number;
  onChange: (recipe: (images: Asset[]) => Asset[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState("");
  const reduced = useReducedMotion();

  async function pick(files: FileList) {
    setError("");
    const chosen = [...files].slice(0, room);
    if (files.length > room) setError(`A section holds ${SECTION_IMAGES_MAX} pictures; the rest were left out.`);
    setBusy((n) => n + chosen.length);
    await Promise.all(
      chosen.map(async (file) => {
        try {
          const asset = await readImageAsset(file);
          onChange((list) => [...list, asset]);
        } catch (err) {
          setError(err instanceof Error ? `${file.name}: ${err.message}` : `${file.name} could not be read.`);
        } finally {
          setBusy((n) => n - 1);
        }
      }),
    );
  }

  const move = (from: number, to: number) =>
    onChange((list) => {
      if (to < 0 || to >= list.length) return list;
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });

  return (
    <div>
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 md:grid-cols-4">
        <AnimatePresence initial={false}>
          {images.map((asset, i) => (
            <motion.li
              key={asset.id ?? asset.name + i}
              layout={!reduced}
              initial={reduced ? false : { opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
              transition={{ duration: 0.35, ease: EASE }}
              className="group relative overflow-hidden rounded-xl"
              style={{ boxShadow: "inset 0 0 0 1px var(--color-divider)", background: "var(--color-surface)" }}
            >
              {/* An API URL — nothing for next/image to optimise. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={assetSrc(asset)} alt={asset.name} className="block aspect-[4/3] w-full object-cover" />
              <span
                className="absolute top-2 left-2 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold"
                style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
              >
                {i + 1}
              </span>
              <div
                className="flex items-center justify-between gap-1 px-1.5 py-1"
                style={{ borderTop: "1px solid var(--color-divider)", background: "var(--color-bg)" }}
              >
                <span className="flex">
                  <IconButton label={`Move picture ${i + 1} earlier`} onClick={() => move(i, i - 1)}>
                    <span style={{ opacity: i === 0 ? 0.3 : 1 }}>
                      <Glyph id="back" size={14} />
                    </span>
                  </IconButton>
                  <IconButton label={`Move picture ${i + 1} later`} onClick={() => move(i, i + 1)}>
                    <span style={{ opacity: i === images.length - 1 ? 0.3 : 1 }}>
                      <Glyph id="chevron" size={14} />
                    </span>
                  </IconButton>
                </span>
                <IconButton label={`Remove picture ${i + 1}`} onClick={() => onChange((list) => list.filter((_, j) => j !== i))}>
                  <Glyph id="close" size={14} />
                </IconButton>
              </div>
            </motion.li>
          ))}
          {Array.from({ length: busy }, (_, i) => (
            <li
              key={`busy-${i}`}
              aria-hidden
              className="aspect-[4/3] animate-pulse rounded-xl"
              style={{ background: "var(--color-neutral-200)" }}
            />
          ))}
        </AnimatePresence>
        {room > 0 && (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl text-[13px] font-medium transition-colors hover:bg-[var(--color-neutral-100)]"
              style={{ border: "1.5px dashed var(--color-neutral-400)", color: "var(--color-neutral-700)" }}
            >
              <Glyph id="plus" size={18} />
              {images.length === 0 ? "Add pictures" : "Add more"}
              <span className="text-[11.5px] font-normal text-muted">{room} of {SECTION_IMAGES_MAX} left</span>
            </button>
          </li>
        )}
      </ul>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length) void pick(files);
          e.target.value = "";
        }}
      />
      {error && (
        <p className="m-0 mt-2 text-[12.5px]" style={{ color: "var(--color-accent-700)" }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/* ── the picker ───────────────────────────────────────────────────────── */

/**
 * "Add a component": a disclosure that opens every kind, in two groups —
 * what the page adds, and the lists the resume already holds. A resume list
 * is one list, so it can be placed once: a kind already in a section says
 * which, and cannot be added again.
 */
export function ComponentPicker({
  count,
  resume,
  placed,
  onAdd,
}: {
  count: number;
  resume: Resume;
  /** The section each placed list sits in, by name. */
  placed: Map<PageBlock, string>;
  onAdd: (type: BlockType) => void;
}) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  const reduced = useReducedMotion();
  const full = count >= SECTION_BLOCKS_MAX;
  const isList = (id: BlockType): id is PageBlock => (PAGE_BLOCKS as string[]).includes(id);
  const groups = [
    { title: "For the page", types: BLOCK_TYPES.filter((t) => !isList(t.id)) },
    { title: "From your resume", types: BLOCK_TYPES.filter((t) => isList(t.id)) },
  ];

  return (
    <div>
      <button
        type="button"
        className="btn btn-secondary"
        style={{ marginTop: 0 }}
        aria-expanded={open}
        aria-controls={panel}
        disabled={full}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="inline-grid transition-transform duration-300" style={{ transform: open ? "rotate(45deg)" : "none" }}>
          <Glyph id="plus" size={14} />
        </span>
        {full ? `${SECTION_BLOCKS_MAX} components is the most a section holds` : open ? "Close" : "Add a component"}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panel}
            initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            {groups.map((g) => (
              <div key={g.title} className="mt-4">
                <p className="m-0 mb-2 text-[12px] font-medium" style={{ color: "var(--color-neutral-600)" }}>
                  {g.title}
                </p>
                <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
                  {g.types.map((t) => {
                    const where = isList(t.id) ? placed.get(t.id) : undefined;
                    const saved = isList(t.id) && resume[t.id].length > 0 ? listSummary(resume, t.id) : "";
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          disabled={where !== undefined}
                          onClick={() => {
                            onAdd(t.id);
                            setOpen(false);
                          }}
                          className="flex w-full cursor-pointer items-start gap-3 rounded-xl p-3 text-left transition-colors hover:bg-[var(--color-neutral-100)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-transparent"
                          style={{ boxShadow: "inset 0 0 0 1px var(--color-divider)" }}
                        >
                          <span
                            className="grid h-9 w-9 flex-none place-items-center rounded-lg"
                            style={{ background: "var(--color-neutral-100)", color: "var(--color-ink)" }}
                          >
                            <Icon d={COMPONENT_ICON[t.id]} size={18} />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[13.5px] font-semibold">
                              {t.name}
                              {saved && !where && <span className="ml-2 font-normal text-muted">{saved} saved</span>}
                            </span>
                            <span className="block text-[12.5px] leading-snug text-muted">
                              {where !== undefined ? `Already in “${where || "Untitled section"}”. A list is placed once.` : t.desc}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A new component of a type, with one empty row ready to type into. */
export function newComponent(type: BlockType): Block {
  return emptyBlock(type, newId(), newId());
}

/* ── one component ────────────────────────────────────────────────────── */

type Field = { key: string; label: string; placeholder: string; long?: boolean; narrow?: boolean };

const FIELDS: Record<Exclude<BlockType, "contact" | "gallery" | PageBlock>, { fields: Field[]; add: string }> = {
  timeline: {
    add: "Add a milestone",
    fields: [
      { key: "date", label: "When", placeholder: "2021", narrow: true },
      { key: "title", label: "What happened", placeholder: "Opened the second kitchen" },
      { key: "text", label: "Detail", placeholder: "A line or two about it", long: true },
    ],
  },
  testimonials: {
    add: "Add a testimonial",
    fields: [
      { key: "quote", label: "What they said", placeholder: "In their words, not yours", long: true },
      { key: "name", label: "Name", placeholder: "Asha Kulkarni" },
      { key: "role", label: "Role", placeholder: "CEO, Lavonne" },
    ],
  },
  clients: {
    add: "Add a client",
    fields: [
      { key: "name", label: "Name", placeholder: "Third Wave Coffee" },
      { key: "url", label: "Website (optional)", placeholder: "thirdwavecoffee.in" },
    ],
  },
  tabs: {
    add: "Add a tab",
    fields: [
      { key: "label", label: "Tab", placeholder: "Approach", narrow: true },
      { key: "text", label: "What it says", placeholder: "A short paragraph", long: true },
    ],
  },
  stats: {
    add: "Add a number",
    fields: [
      { key: "value", label: "Figure", placeholder: "40+", narrow: true },
      { key: "label", label: "Of what", placeholder: "Families advised" },
    ],
  },
  services: {
    add: "Add a service",
    fields: [
      { key: "title", label: "Service", placeholder: "Financial plan" },
      { key: "price", label: "Price (optional)", placeholder: "From ₹45,000", narrow: true },
      { key: "text", label: "What it includes", placeholder: "What a client gets", long: true },
    ],
  },
  faq: {
    add: "Add a question",
    fields: [
      { key: "question", label: "Question", placeholder: "Do you work remotely?" },
      { key: "answer", label: "Answer", placeholder: "Yes — most sessions are on video.", long: true },
    ],
  },
};

/**
 * The one frame every component is edited in: its mark, its name, what it
 * holds, the tools that act on it, then its rows. The components a section
 * adds and the built-in ones the resume prints both sit in this.
 */
export function PanelShell({
  icon,
  name,
  summary,
  tools,
  children,
}: {
  icon: React.ReactNode;
  name: string;
  summary: string;
  tools?: React.ReactNode;
  children: React.ReactNode;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="rounded-xl"
      style={{ boxShadow: "inset 0 0 0 1px var(--color-divider)", background: "var(--color-bg)" }}
    >
      <header className="flex flex-wrap items-center gap-2 px-3 py-2.5" style={{ borderBottom: "1px solid var(--color-divider)" }}>
        <span className="grid h-8 w-8 flex-none place-items-center rounded-lg" style={{ background: "var(--color-neutral-100)" }}>
          <Icon d={icon} size={16} />
        </span>
        <span id={titleId} className="text-[13.5px] font-semibold">
          {name}
        </span>
        <span className="text-[12px] text-muted">{summary}</span>
        {tools && <span className="ml-auto flex items-center">{tools}</span>}
      </header>
      <div className="flex flex-col gap-4 p-3 sm:p-4">{children}</div>
    </section>
  );
}

/** A small chip naming a component and what it holds — on a closed card. */
export function ComponentChip({ icon, name, summary }: { icon: React.ReactNode; name: string; summary: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full py-1 pr-3 pl-2 text-[12.5px]"
      style={{ boxShadow: "inset 0 0 0 1px var(--color-divider)" }}
    >
      <Icon d={icon} size={13} />
      <span className="font-medium">{name}</span>
      <span className="text-muted">{summary}</span>
    </span>
  );
}

/**
 * One of a section's components. It is handed the section, not only its
 * own block, because a gallery's pictures are the section's: adding one
 * writes the picture to `section.images` and its id to the gallery in the
 * same change, and removing a gallery takes its pictures with it.
 */
export function ComponentPanel({
  block,
  section,
  p,
  first,
  last,
  onSection,
}: {
  block: Block;
  section: Section;
  /** The portfolio: a resume list's entries are its resume's, not the block's. */
  p: Portfolio;
  first: boolean;
  last: boolean;
  onSection: (recipe: (s: Section) => Section) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const empty = !componentHasContent(block, p.resume);
  const name = componentName(block.type);

  const onChange = (next: Block) => onSection((s) => ({ ...s, blocks: s.blocks.map((x) => (x.id === block.id ? next : x)) }));
  const onMove = (delta: -1 | 1) =>
    onSection((s) => {
      const from = s.blocks.findIndex((x) => x.id === block.id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= s.blocks.length) return s;
      const blocks = [...s.blocks];
      const [moved] = blocks.splice(from, 1);
      blocks.splice(to, 0, moved);
      return { ...s, blocks };
    });
  const onRemove = () =>
    onSection((s) => {
      const gone = s.blocks.find((x) => x.id === block.id);
      const theirs = new Set(gone?.type === "gallery" ? gone.imageIds : []);
      return {
        ...s,
        blocks: s.blocks.filter((x) => x.id !== block.id),
        images: s.images.filter((a) => !a.id || !theirs.has(a.id)),
      };
    });

  return (
    <PanelShell
      icon={COMPONENT_ICON[block.type]}
      name={name}
      summary={empty ? "Empty — not shown yet" : componentSummary(block, p.resume)}
      tools={
        <>
          <IconButton label={`Move ${name} up`} onClick={() => !first && onMove(-1)}>
            <span style={{ opacity: first ? 0.3 : 1 }}>
              <Glyph id="up" size={14} />
            </span>
          </IconButton>
          <IconButton label={`Move ${name} down`} onClick={() => !last && onMove(1)}>
            <span style={{ opacity: last ? 0.3 : 1 }}>
              <Glyph id="down" size={14} />
            </span>
          </IconButton>
          {confirming ? (
            <span className="ml-1 flex items-center gap-1">
              <button type="button" className="btn btn-primary" style={{ marginTop: 0, minHeight: 30, fontSize: 12.5 }} onClick={onRemove}>
                Remove
              </button>
              <button type="button" className="btn btn-ghost" style={{ marginTop: 0, minHeight: 30, fontSize: 12.5 }} onClick={() => setConfirming(false)}>
                Keep
              </button>
            </span>
          ) : (
            <IconButton label={`Remove ${name}`} onClick={() => (empty ? onRemove() : setConfirming(true))}>
              <Glyph id="close" size={14} />
            </IconButton>
          )}
        </>
      }
    >
      <div className="field">
        <label htmlFor={`${block.id}-title`}>Heading (optional)</label>
        <input
          id={`${block.id}-title`}
          className="input"
          placeholder={HEADING_HINT[block.type]}
          value={block.title}
          onChange={(e) => onChange({ ...block, title: e.target.value })}
        />
      </div>
      {isListBlock(block) ? (
        <>
          {LIST_LOOKS[block.type].length > 1 && (
            <ChoiceField
              label="Look on the page"
              value={lookOf(block)}
              options={LIST_LOOKS[block.type].map((id) => ({ id, ...LOOK_NAME[id] }))}
              onChange={(look) => onChange({ ...block, look })}
            />
          )}
          <ResumeListRows p={p} block={block.type} />
        </>
      ) : block.type === "gallery" ? (
        <GalleryFields block={block} section={section} onChange={onChange} onSection={onSection} />
      ) : block.type === "contact" ? (
        <ContactFields block={block} onChange={onChange} />
      ) : (
        <ItemRows block={block} onChange={onChange} />
      )}
    </PanelShell>
  );
}

/** A handful of looks to pick one from, each with a line saying what it is. */
function ChoiceField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ id: T; name: string; desc: string }>;
  onChange: (next: T) => void;
}) {
  // The builder mounts some controls twice; a radio name has to be unique.
  const group = useId();
  return (
    <div className="field">
      <label id={`${group}-label`}>{label}</label>
      <div role="radiogroup" aria-labelledby={`${group}-label`} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {options.map((o) => {
          const on = value === o.id;
          return (
            <label
              key={o.id}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg p-2.5"
              style={{ boxShadow: `inset 0 0 0 ${on ? "1.5px var(--color-ink)" : "1px var(--color-divider)"}` }}
            >
              <input
                type="radio"
                name={`choice-${group}`}
                className="mt-0.5 h-4 w-4 flex-none accent-[var(--color-ink)]"
                checked={on}
                onChange={() => onChange(o.id)}
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold">{o.name}</span>
                <span className="block text-[12px] leading-snug text-muted">{o.desc}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function GalleryFields({
  block,
  section,
  onChange,
  onSection,
}: {
  block: GalleryBlock;
  section: Section;
  onChange: (next: Block) => void;
  onSection: (recipe: (s: Section) => Section) => void;
}) {
  // One change for both halves: the pictures the section holds and the ids
  // this gallery names. Run against the latest section, not this render's,
  // because several uploads land one after another.
  const setPictures = (recipe: (images: Asset[]) => Asset[]) =>
    onSection((s) => {
      const mine = s.blocks.find((x) => x.id === block.id);
      if (mine?.type !== "gallery") return s;
      const before = galleryImages(s, mine);
      const beforeIds = new Set(before.map((a) => a.id));
      const elsewhere = new Set(s.images.flatMap((a) => (a.id && !beforeIds.has(a.id) ? [a.id] : [])));
      let room = SECTION_IMAGES_MAX - s.images.length;
      const after: Asset[] = [];
      for (const a of recipe(before)) {
        if (!a.id || elsewhere.has(a.id) || after.some((x) => x.id === a.id)) continue;
        if (!beforeIds.has(a.id) && room-- <= 0) continue;
        after.push(a);
      }
      const afterIds = new Set(after.map((a) => a.id));
      return {
        ...s,
        images: [...s.images.filter((a) => !beforeIds.has(a.id) || afterIds.has(a.id)), ...after.filter((a) => !beforeIds.has(a.id))],
        blocks: s.blocks.map((x) => (x.id === mine.id ? { ...mine, imageIds: after.flatMap((a) => (a.id ? [a.id] : [])) } : x)),
      };
    });

  return (
    <>
      <ChoiceField label="Layout" value={block.layout} options={GALLERY_LAYOUTS} onChange={(layout) => onChange({ ...block, layout })} />
      <PicturesField images={galleryImages(section, block)} room={SECTION_IMAGES_MAX - section.images.length} onChange={setPictures} />
    </>
  );
}

const HEADING_HINT: Record<BlockType, string> = {
  experience: "Where I’ve worked",
  education: "Education",
  skills: "What I’m good at",
  certifications: "Certifications",
  languages: "Languages",
  awards: "Recognition",
  gallery: "A closer look",
  timeline: "How it grew",
  testimonials: "Kind words",
  clients: "Trusted by",
  tabs: "How it works",
  stats: "By the numbers",
  services: "What I offer",
  faq: "Questions people ask",
  contact: "Get in touch",
};

type ListBlock = Exclude<Block, ContactBlock | GalleryBlock | ResumeListBlock>;

function ItemRows({ block, onChange }: { block: ListBlock; onChange: (next: Block) => void }) {
  const config = FIELDS[block.type];
  const items = block.items as Array<Record<string, string>>;
  const reduced = useReducedMotion();
  const set = (next: Array<Record<string, string>>) => onChange({ ...block, items: next } as Block);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    set(next);
  };
  const blank = () => Object.fromEntries([["id", newId()], ...config.fields.map((f) => [f.key, ""])]);
  const shortFields = config.fields.filter((f) => !f.long);
  const longFields = config.fields.filter((f) => f.long);
  const cols = shortFields.map((f) => (f.narrow ? "minmax(0,9rem)" : "minmax(0,1fr)")).join(" ");

  return (
    <div className="flex flex-col gap-2">
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        <AnimatePresence initial={false}>
          {items.map((item, i) => (
            <motion.li
              key={item.id}
              layout={!reduced}
              initial={reduced ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.3, ease: EASE }}
              className="flex items-start gap-2 rounded-lg p-2.5"
              style={{ background: "var(--color-neutral-100)" }}
            >
              <span className="mt-2.5 w-5 flex-none text-right font-mono text-[11px] text-muted">{i + 1}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="grid gap-2 max-sm:!grid-cols-1" style={{ gridTemplateColumns: cols }}>
                  {shortFields.map((f) => (
                    <input
                      key={f.key}
                      className="input"
                      aria-label={`${f.label}, row ${i + 1}`}
                      placeholder={f.placeholder}
                      value={item[f.key] ?? ""}
                      onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, [f.key]: e.target.value } : x)))}
                    />
                  ))}
                </div>
                {longFields.map((f) => (
                  <textarea
                    key={f.key}
                    className="input"
                    rows={2}
                    aria-label={`${f.label}, row ${i + 1}`}
                    placeholder={f.placeholder}
                    value={item[f.key] ?? ""}
                    onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, [f.key]: e.target.value } : x)))}
                  />
                ))}
              </div>
              <span className="flex flex-none flex-col">
                <IconButton label={`Move row ${i + 1} up`} onClick={() => move(i, i - 1)}>
                  <span style={{ opacity: i === 0 ? 0.3 : 1 }}>
                    <Glyph id="up" size={13} />
                  </span>
                </IconButton>
                <IconButton label={`Move row ${i + 1} down`} onClick={() => move(i, i + 1)}>
                  <span style={{ opacity: i === items.length - 1 ? 0.3 : 1 }}>
                    <Glyph id="down" size={13} />
                  </span>
                </IconButton>
                <IconButton label={`Remove row ${i + 1}`} onClick={() => set(items.filter((_, j) => j !== i))}>
                  <Glyph id="close" size={13} />
                </IconButton>
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      <button
        type="button"
        className="btn btn-ghost self-start"
        style={{ marginTop: 0 }}
        onClick={() => set([...items, blank()])}
      >
        <Glyph id="plus" size={13} />
        {config.add}
      </button>
    </div>
  );
}

function ContactFields({ block, onChange }: { block: ContactBlock; onChange: (next: Block) => void }) {
  const set = <K extends keyof ContactBlock>(key: K, value: ContactBlock[K]) => onChange({ ...block, [key]: value });
  const field = (key: "email" | "phone" | "location" | "ctaLabel" | "ctaUrl", label: string, placeholder: string, type = "text") => (
    <div className="field">
      <label htmlFor={`${block.id}-${key}`}>{label}</label>
      <input
        id={`${block.id}-${key}`}
        type={type}
        className="input"
        placeholder={placeholder}
        value={block[key]}
        onChange={(e) => set(key, e.target.value)}
      />
    </div>
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="field">
        <label htmlFor={`${block.id}-text`}>A line above the details</label>
        <textarea
          id={`${block.id}-text`}
          className="input"
          rows={2}
          placeholder="Write a line about what you need and I’ll come back with a time."
          value={block.text}
          onChange={(e) => set("text", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {field("email", "Email", "you@example.com", "email")}
        {field("phone", "Phone", "+91 98450 12345", "tel")}
        {field("location", "Where", "Indiranagar, Bengaluru")}
        <span aria-hidden className="hidden sm:block" />
        {field("ctaLabel", "Button label", "Book a call")}
        {field("ctaUrl", "Button link", "cal.com/you")}
      </div>
      <label className="flex cursor-pointer items-start gap-3 text-[13.5px]">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 flex-none accent-[var(--color-ink)]"
          checked={block.form}
          onChange={(e) => set("form", e.target.checked)}
        />
        <span>
          <span className="font-medium">Show a message form</span>
          <span className="block text-[12.5px] text-muted">
            A visitor’s message opens in their own mail app, addressed to your email. Nothing is sent or stored by
            Facet{block.email ? "" : " — add an email above for the form to appear"}.
          </span>
        </span>
      </label>
    </div>
  );
}
