"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { TagEditor } from "../TagEditor";
import { IconButton } from "../ui";
import { Glyph } from "@/lib/glyphs";
import { dateRange } from "@/lib/resume";
import { POINT_BULLET_RE } from "@/lib/types";
import { newId, usePortfolios } from "@/lib/store";
import type {
  Award,
  Certification,
  EducationItem,
  ExperienceItem,
  Language,
  ResumeListBlock,
  Portfolio,
  Resume,
  SkillGroup,
} from "@/lib/types";

/* ── the resume's facts in the editor ────────────────────────────────────
   The rows behind the six list components — roles with dates, schools,
   skills — and the resume's contact line. A list component in a section
   (editor/components.tsx) shows `ResumeListRows` as its body and keeps the
   entries itself, structured, because a resume template and the ATS check
   read a role and its dates without parsing prose. The header card shows
   `ResumeContactFields`, which writes `p.resume`. Entries open in place and
   save as they are typed.
   ──────────────────────────────────────────────────────────────────────── */

const EASE = [0.16, 1, 0.3, 1] as const;
const LEVELS = ["Native", "Fluent", "Professional", "Conversational", "Basic"];

type Recipe = (r: Resume) => Resume;

function useResume(p: Portfolio) {
  const { updateResume } = usePortfolios();
  const change = (recipe: Recipe) => updateResume(p.id, recipe);
  const set = <K extends keyof Resume>(key: K, value: Resume[K]) => change((prev) => ({ ...prev, [key]: value }));
  return { change, set };
}

/** What one row of each list is called. */
const LIST_NOUN: Record<ResumeListBlock["type"], [string, string]> = {
  experience: ["role", "roles"],
  education: ["entry", "entries"],
  skills: ["group", "groups"],
  certifications: ["certification", "certifications"],
  languages: ["language", "languages"],
  awards: ["award", "awards"],
};

/** "4 roles", "Empty" — what a closed card says about a list. */
export function listSummary(block: ResumeListBlock): string {
  const n = block.items.length;
  return n === 0 ? "Empty" : `${n} ${n === 1 ? LIST_NOUN[block.type][0] : LIST_NOUN[block.type][1]}`;
}

/** Email, phone, place and site — printed on the resume, never on the page. */
export function ResumeContactFields({ p }: { p: Portfolio }) {
  const { set } = useResume(p);
  const r = p.resume;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Email">
        {(id) => <input id={id} className="input" type="email" autoComplete="email" value={r.email} placeholder="you@example.com" onChange={(e) => set("email", e.target.value)} />}
      </Field>
      <Field label="Phone">
        {(id) => <input id={id} className="input" type="tel" autoComplete="tel" value={r.phone} placeholder="+1 555 010 2030" onChange={(e) => set("phone", e.target.value)} />}
      </Field>
      <Field label="Location">
        {(id) => <input id={id} className="input" value={r.location} placeholder="City, Country" onChange={(e) => set("location", e.target.value)} />}
      </Field>
      <Field label="Website">
        {(id) => <input id={id} className="input" value={r.website} placeholder="yourname.com" onChange={(e) => set("website", e.target.value)} />}
      </Field>
    </div>
  );
}

/**
 * One list component's rows. The entries are the component's own: a second
 * Experience component is a second list, not a view of the first. Whether
 * it prints is the component's "Print on your resume", in its panel.
 */
export function ResumeListRows({ block, onChange }: { block: ResumeListBlock; onChange: (next: ResumeListBlock) => void }) {
  switch (block.type) {
    case "experience":
      return (
        <ListCard<ExperienceItem>
          hint="Most recent first. Start each point with what you did, end it with the result."
          items={block.items}
          onItems={(items) => onChange({ ...block, items })}
          make={() => ({ id: newId(), role: "", company: "", location: "", start: "", end: "", current: false, heading: "", bullets: [], formatted: true })}
          addLabel="Add a role"
          max={40}
          summary={(e) => ({
            title: e.role || e.company || "New role",
            sub: [e.role && e.company, dateRange(e.start, e.end, e.current)].filter(Boolean).join(" · "),
          })}
          render={(e, edit) => (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Job title">{(id) => <input id={id} className="input" value={e.role} placeholder="Product Designer" onChange={(ev) => edit({ role: ev.target.value })} />}</Field>
              <Field label="Company">{(id) => <input id={id} className="input" value={e.company} placeholder="Company name" onChange={(ev) => edit({ company: ev.target.value })} />}</Field>
              <Field label="Location">{(id) => <input id={id} className="input" value={e.location} placeholder="City or Remote" onChange={(ev) => edit({ location: ev.target.value })} />}</Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start">{(id) => <input id={id} className="input" value={e.start} placeholder="Mar 2021" onChange={(ev) => edit({ start: ev.target.value })} />}</Field>
                <Field label="End">
                  {(id) => <input id={id} className="input" value={e.current ? "Present" : e.end} disabled={e.current} placeholder="Jun 2024" onChange={(ev) => edit({ end: ev.target.value })} />}
                </Field>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[13.5px] sm:col-span-2">
                <input type="checkbox" checked={e.current} onChange={(ev) => edit({ current: ev.target.checked })} className="h-4 w-4 accent-[var(--color-ink)]" />
                I work here now
              </label>
              <Field label="Heading over the points (optional)" span>
                {(id) => <input id={id} className="input" value={e.heading} maxLength={120} placeholder="Key achievements" onChange={(ev) => edit({ heading: ev.target.value })} />}
              </Field>
              <Field label="What you did — one point per line" span>
                {(id) => <PointsField id={id} lines={e.bullets} onLines={(bullets) => edit({ bullets, formatted: true })} />}
              </Field>
            </div>
          )}
        />
      );

    case "education":
      return (
        <ListCard<EducationItem>
          items={block.items}
          onItems={(items) => onChange({ ...block, items })}
          make={() => ({ id: newId(), degree: "", school: "", location: "", start: "", end: "", detail: "" })}
          addLabel="Add education"
          max={20}
          summary={(e) => ({ title: e.degree || e.school || "New entry", sub: [e.degree && e.school, dateRange(e.start, e.end)].filter(Boolean).join(" · ") })}
          render={(e, edit) => (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Degree or qualification">{(id) => <input id={id} className="input" value={e.degree} placeholder="BSc Computer Science" onChange={(ev) => edit({ degree: ev.target.value })} />}</Field>
              <Field label="School">{(id) => <input id={id} className="input" value={e.school} placeholder="University name" onChange={(ev) => edit({ school: ev.target.value })} />}</Field>
              <Field label="Location">{(id) => <input id={id} className="input" value={e.location} onChange={(ev) => edit({ location: ev.target.value })} />}</Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start">{(id) => <input id={id} className="input" value={e.start} placeholder="2016" onChange={(ev) => edit({ start: ev.target.value })} />}</Field>
                <Field label="End">{(id) => <input id={id} className="input" value={e.end} placeholder="2020" onChange={(ev) => edit({ end: ev.target.value })} />}</Field>
              </div>
              <Field label="Details (optional)" span>
                {(id) => <textarea id={id} className="input" rows={2} value={e.detail} placeholder="Honours, GPA, thesis…" onChange={(ev) => edit({ detail: ev.target.value })} />}
              </Field>
            </div>
          )}
        />
      );

    case "skills":
      return (
        <ListCard<SkillGroup>
          hint="Group them if you have many — “Design”, “Tools”. One unnamed group is fine too."
          items={block.items}
          onItems={(items) => onChange({ ...block, items })}
          make={() => ({ id: newId(), name: "", items: [] })}
          addLabel="Add a skill group"
          max={20}
          summary={(g) => ({ title: g.name || "Skills", sub: g.items.slice(0, 6).join(", ") + (g.items.length > 6 ? "…" : "") })}
          render={(g, edit) => (
            <div className="flex flex-col gap-4">
              <Field label="Group name (optional)">{(id) => <input id={id} className="input" value={g.name} placeholder="Design" onChange={(ev) => edit({ name: ev.target.value })} />}</Field>
              <div className="field">
                <label>Skills</label>
                <TagEditor tags={g.items} onChange={(items) => edit({ items: items.slice(0, 60) })} />
              </div>
            </div>
          )}
        />
      );

    case "certifications":
      return (
        <ListCard<Certification>
          items={block.items}
          onItems={(items) => onChange({ ...block, items })}
          make={() => ({ id: newId(), name: "", issuer: "", date: "", url: "" })}
          addLabel="Add a certification"
          max={40}
          summary={(c) => ({ title: c.name || "New certification", sub: [c.issuer, c.date].filter(Boolean).join(" · ") })}
          render={(c, edit) => (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name" span>{(id) => <input id={id} className="input" value={c.name} placeholder="AWS Certified Solutions Architect" onChange={(ev) => edit({ name: ev.target.value })} />}</Field>
              <Field label="Issued by">{(id) => <input id={id} className="input" value={c.issuer} placeholder="Amazon Web Services" onChange={(ev) => edit({ issuer: ev.target.value })} />}</Field>
              <Field label="Date">{(id) => <input id={id} className="input" value={c.date} placeholder="Dec 2023" onChange={(ev) => edit({ date: ev.target.value })} />}</Field>
              <Field label="Credential link (optional)" span>{(id) => <input id={id} className="input" value={c.url} placeholder="https://…" onChange={(ev) => edit({ url: ev.target.value })} />}</Field>
            </div>
          )}
        />
      );

    case "languages":
      return (
        <ListCard<Language>
          items={block.items}
          onItems={(items) => onChange({ ...block, items })}
          make={() => ({ id: newId(), name: "", level: "" })}
          addLabel="Add a language"
          max={20}
          summary={(l) => ({ title: l.name || "New language", sub: l.level })}
          render={(l, edit) => (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Language">{(id) => <input id={id} className="input" value={l.name} placeholder="Spanish" onChange={(ev) => edit({ name: ev.target.value })} />}</Field>
              <Field label="Level">
                {(id) => (
                  <>
                    <input id={id} className="input" list={`${id}-levels`} value={l.level} placeholder="Fluent" onChange={(ev) => edit({ level: ev.target.value })} />
                    <datalist id={`${id}-levels`}>
                      {LEVELS.map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                  </>
                )}
              </Field>
            </div>
          )}
        />
      );

    case "awards":
      return (
        <ListCard<Award>
          items={block.items}
          onItems={(items) => onChange({ ...block, items })}
          make={() => ({ id: newId(), title: "", issuer: "", date: "", detail: "" })}
          addLabel="Add an award"
          max={40}
          summary={(a) => ({ title: a.title || "New award", sub: [a.issuer, a.date].filter(Boolean).join(" · ") })}
          render={(a, edit) => (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Award" span>{(id) => <input id={id} className="input" value={a.title} onChange={(ev) => edit({ title: ev.target.value })} />}</Field>
              <Field label="Given by">{(id) => <input id={id} className="input" value={a.issuer} onChange={(ev) => edit({ issuer: ev.target.value })} />}</Field>
              <Field label="Date">{(id) => <input id={id} className="input" value={a.date} onChange={(ev) => edit({ date: ev.target.value })} />}</Field>
              <Field label="Details (optional)" span>{(id) => <textarea id={id} className="input" rows={2} value={a.detail} onChange={(ev) => edit({ detail: ev.target.value })} />}</Field>
            </div>
          )}
        />
      );
  }
}

/* ── pieces ─────────────────────────────────────────────────────────────── */

const BULLET = "• ";
const MAX_POINT_LINES = 20;

/**
 * A role's points: a textarea under a three-button toolbar — bullets, bold,
 * italic — whose marks are plain text (lib/points.tsx reads them). A new
 * line after a bullet is a bullet, and the first thing typed into an empty
 * box starts one, so a list is still what you get without touching the
 * toolbar; the bullet button takes the mark off the lines selected.
 */
function PointsField({ id, lines, onLines }: { id: string; lines: string[]; onLines: (lines: string[]) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<[number, number] | null>(null);
  const value = lines.join("\n");

  // Put the selection back where the edit left it, once the new value is in.
  useLayoutEffect(() => {
    const el = ref.current;
    const at = caret.current;
    if (!el || !at) return;
    caret.current = null;
    el.setSelectionRange(at[0], at[1]);
  });

  const commit = (next: string, start: number, end = start) => {
    caret.current = [start, end];
    onLines(next.split("\n").slice(0, MAX_POINT_LINES));
    ref.current?.focus();
  };

  const toggleBullets = () => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const from = value.lastIndexOf("\n", s - 1) + 1;
    const nl = value.indexOf("\n", e > s && value[e - 1] === "\n" ? e - 1 : e);
    const to = nl === -1 ? value.length : nl;
    const block = value.slice(from, to).split("\n");
    const marked = block.filter((l) => l.trim()).every((l) => POINT_BULLET_RE.test(l)) && block.some((l) => l.trim());
    const next = block
      .map((l) => {
        if (marked) return l.replace(POINT_BULLET_RE, "");
        if (POINT_BULLET_RE.test(l) || (!l.trim() && block.length > 1)) return l;
        return BULLET + l.replace(/^\s+/, "");
      })
      .join("\n");
    commit(value.slice(0, from) + next + value.slice(to), from, from + next.length);
  };

  const wrap = (mark: "**" | "*") => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const n = mark.length;
    const before = value.slice(Math.max(0, s - n), s);
    const after = value.slice(e, e + n);
    // Italic's "*" is half of bold's "**": only a lone asterisk counts.
    const lone = n === 2 || (value[s - 2] !== "*" && value[e + 1] !== "*");
    if (before === mark && after === mark && lone) {
      commit(value.slice(0, s - n) + value.slice(s, e) + value.slice(e + n), s - n, e - n);
      return;
    }
    const picked = value.slice(s, e);
    // Never across lines: a mark only holds within one.
    const text = picked.includes("\n") ? picked.slice(0, picked.indexOf("\n")) : picked;
    const end = s + text.length;
    commit(value.slice(0, s) + mark + text + mark + value.slice(end), s + n, end + n);
  };

  const onKeyDown = (ev: KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = ev.metaKey || ev.ctrlKey;
    if (mod && !ev.shiftKey && !ev.altKey && (ev.key === "b" || ev.key === "i")) {
      ev.preventDefault();
      wrap(ev.key === "b" ? "**" : "*");
      return;
    }
    if (ev.key !== "Enter" || mod || ev.shiftKey || ev.altKey || ev.nativeEvent.isComposing) return;
    const el = ev.currentTarget;
    const { selectionStart: s, selectionEnd: e } = el;
    const from = value.lastIndexOf("\n", s - 1) + 1;
    if (!POINT_BULLET_RE.test(value.slice(from, s))) return;
    ev.preventDefault();
    const nl = value.indexOf("\n", e);
    const whole = value.slice(from, nl === -1 ? value.length : nl);
    if (!whole.replace(POINT_BULLET_RE, "").trim()) {
      // Enter on an empty bullet ends the list, as in any editor.
      commit(value.slice(0, from) + value.slice(s), from);
      return;
    }
    if (lines.length >= MAX_POINT_LINES) return;
    commit(value.slice(0, s) + "\n" + BULLET + value.slice(e), s + 1 + BULLET.length);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div role="toolbar" aria-label="Format the points" aria-controls={id} className="flex items-center gap-1">
        <FormatButton label="Bullet points" onClick={toggleBullets}>
          <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 6h11M9 12h11M9 18h11" />
            <circle cx="4" cy="6" r="1" fill="currentColor" />
            <circle cx="4" cy="12" r="1" fill="currentColor" />
            <circle cx="4" cy="18" r="1" fill="currentColor" />
          </svg>
        </FormatButton>
        <FormatButton label="Bold (Ctrl+B)" onClick={() => wrap("**")}>
          <span className="text-[14px] font-bold">B</span>
        </FormatButton>
        <FormatButton label="Italic (Ctrl+I)" onClick={() => wrap("*")}>
          <span className="font-serif text-[15px] italic">I</span>
        </FormatButton>
        <span className="ml-auto text-[12px] text-muted">**bold** · *italic*</span>
      </div>
      <textarea
        ref={ref}
        id={id}
        className="input"
        rows={5}
        value={value}
        placeholder={"• Led a team of 6 to rebuild checkout\n• Cut drop-off by **18%** in two quarters"}
        onKeyDown={onKeyDown}
        onChange={(ev) => {
          let next = ev.target.value;
          let at = ev.target.selectionStart;
          // The first thing typed into an empty box starts a bullet.
          if (!value && next.trim() && !POINT_BULLET_RE.test(next)) {
            next = BULLET + next;
            at += BULLET.length;
          }
          if (next !== ev.target.value) caret.current = [at, at];
          onLines(next.split("\n").slice(0, MAX_POINT_LINES));
        }}
      />
    </div>
  );
}

function FormatButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // Keep the textarea's selection: a click would otherwise take focus first.
      onMouseDown={(ev) => ev.preventDefault()}
      onClick={onClick}
      className="grid h-8 w-8 cursor-pointer place-items-center rounded-md transition-colors hover:bg-[var(--color-neutral-200)]"
      style={{ color: "var(--color-ink)", boxShadow: "inset 0 0 0 1px var(--color-divider)" }}
    >
      {children}
    </button>
  );
}

function Field({ label, span, children }: { label: string; span?: boolean; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className={`field ${span ? "sm:col-span-2" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
    </div>
  );
}

function ListCard<T extends { id: string }>({
  hint,
  items,
  onItems,
  make,
  addLabel,
  max,
  summary,
  render,
}: {
  hint?: string;
  items: T[];
  onItems: (items: T[]) => void;
  make: () => T;
  addLabel: string;
  max: number;
  summary: (item: T) => { title: string; sub: string };
  render: (item: T, edit: (patch: Partial<T>) => void) => ReactNode;
}) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState<string | null>(null);
  // An empty list opens on one blank entry rather than a lone "Add" button:
  // a list component is added to be filled. The entry is stored on the first
  // keystroke, so adding a component and leaving it writes nothing.
  const [draft] = useState(make);

  const edit = (itemId: string) => (patch: Partial<T>) => onItems(items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)));
  // The draft keeps its box while it is the only entry, so the field being
  // typed in is not remounted (and does not lose focus) when it is stored.
  const stored = items.length === 1 && items[0].id === draft.id;
  const inBox = items.length === 0 || stored;
  const editDraft = stored ? edit(draft.id) : (patch: Partial<T>) => onItems([{ ...draft, ...patch }]);
  const shown = stored ? [] : items;
  const move = (index: number, delta: -1 | 1) => {
    const to = index + delta;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(to, 0, moved);
    onItems(next);
  };

  return (
    <div className="flex flex-col gap-4">
      {hint && <p className="m-0 max-w-[64ch] text-[13px] leading-snug text-muted">{hint}</p>}
      <div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        <AnimatePresence initial={false}>
          {shown.map((item, i) => {
            const s = summary(item);
            const isOpen = open === item.id;
            return (
              <motion.li
                key={item.id}
                layout={!reduced}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, transition: { duration: 0.15 } }}
                transition={{ duration: 0.25, ease: EASE }}
                className="overflow-hidden rounded-xl"
                style={{ border: `1px solid ${isOpen ? "var(--color-ink)" : "var(--color-divider)"}` }}
              >
                <div className="flex items-center gap-1 pr-1.5">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : item.id)}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-3.5 py-2.5 text-left"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[14px] font-medium">{s.title}</span>
                      {s.sub && <span className="truncate text-[12.5px] text-muted">{s.sub}</span>}
                    </span>
                    <span aria-hidden className="flex-none transition-transform duration-200" style={{ transform: isOpen ? "rotate(180deg)" : "none", color: "var(--color-neutral-600)" }}>
                      <Glyph id="down" size={14} />
                    </span>
                  </button>
                  <IconButton label={`Move ${s.title} up`} onClick={() => move(i, -1)}>
                    <span style={{ opacity: i === 0 ? 0.3 : 1 }}>
                      <Glyph id="up" size={14} />
                    </span>
                  </IconButton>
                  <IconButton label={`Move ${s.title} down`} onClick={() => move(i, 1)}>
                    <span style={{ opacity: i === items.length - 1 ? 0.3 : 1 }}>
                      <Glyph id="down" size={14} />
                    </span>
                  </IconButton>
                  <IconButton
                    label={`Remove ${s.title}`}
                    onClick={() => {
                      onItems(items.filter((it) => it.id !== item.id));
                      if (isOpen) setOpen(null);
                    }}
                  >
                    <Glyph id="close" size={14} />
                  </IconButton>
                </div>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: EASE }}
                    >
                      <div className="px-3.5 pt-1 pb-4" style={{ borderTop: "1px solid var(--color-divider)" }}>
                        <div className="pt-3">{render(item, edit(item.id))}</div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {inBox && (
        <div className="rounded-xl px-3.5 pt-1 pb-4" style={{ border: "1px solid var(--color-ink)" }}>
          <div className="pt-3">{render(stored ? items[0] : draft, editDraft)}</div>
        </div>
      )}

      <button
        type="button"
        disabled={items.length >= max}
        onClick={() => {
          const created = make();
          onItems([...items, created]);
          setOpen(created.id);
        }}
        className="group mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl py-3 text-[13.5px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
        style={{ border: "1.5px dashed var(--color-neutral-400)" }}
      >
        <span className="grid h-6 w-6 place-items-center rounded-full transition-all duration-300 group-hover:rotate-90 group-hover:bg-[var(--color-ink)] group-hover:text-[var(--color-bg)]" style={{ boxShadow: "inset 0 0 0 1px var(--color-divider)" }}>
          <Glyph id="plus" size={13} />
        </span>
        {addLabel}
      </button>
      </div>
    </div>
  );
}
