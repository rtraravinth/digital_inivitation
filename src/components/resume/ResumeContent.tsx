"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState, type ReactNode } from "react";
import { TagEditor } from "../TagEditor";
import { IconButton } from "../ui";
import { Glyph } from "@/lib/glyphs";
import { dateRange } from "@/lib/resume";
import { newId, usePortfolios } from "@/lib/store";
import type {
  Award,
  Certification,
  EducationItem,
  ExperienceItem,
  Language,
  PageBlock,
  Portfolio,
  Resume,
  SkillGroup,
} from "@/lib/types";

/* ── the resume's facts in the editor ────────────────────────────────────
   The rows behind the six list components — roles with dates, schools,
   skills — and the resume's contact line. A list component in a section
   (editor/components.tsx) shows `ResumeListRows` as its body, so the entries
   are typed where the list sits on the page; the header card shows
   `ResumeContactFields`. Neither stores anything in a section: both write
   `p.resume`, structured, because a resume template and a later ATS check
   have to read a role and its dates without parsing prose. Entries open in
   place and save as they are typed.
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
const LIST_NOUN: Record<PageBlock, [string, string]> = {
  experience: ["role", "roles"],
  education: ["entry", "entries"],
  skills: ["group", "groups"],
  certifications: ["certification", "certifications"],
  languages: ["language", "languages"],
  awards: ["award", "awards"],
};

/** "4 roles", "Empty" — what a closed card says about a list. */
export function listSummary(resume: Resume, list: PageBlock): string {
  const n = resume[list].length;
  return n === 0 ? "Empty" : `${n} ${n === 1 ? LIST_NOUN[list][0] : LIST_NOUN[list][1]}`;
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
 * One list's rows, and whether the resume prints it. The body of a list
 * component: what is typed here is the resume's own data, so it is the same
 * list wherever the component sits and whether or not the page shows it.
 */
export function ResumeListRows({ p, block }: { p: Portfolio; block: PageBlock }) {
  const { change, set } = useResume(p);
  const r = p.resume;
  const onResume = !r.hidden.includes(block);
  const common = {
    footer: (
      <label className="flex cursor-pointer items-start gap-3 text-[13.5px]">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 flex-none accent-[var(--color-ink)]"
          checked={onResume}
          onChange={() =>
            change((prev) => ({
              ...prev,
              hidden: prev.hidden.includes(block) ? prev.hidden.filter((b) => b !== block) : [...prev.hidden, block],
            }))
          }
        />
        <span>
          <span className="font-medium">Print on your resume</span>
          <span className="block text-[12.5px] text-muted">
            The resume sets this list in its own template, whatever look the page gives it.
          </span>
        </span>
      </label>
    ),
  };

  switch (block) {
    case "experience":
      return (
        <ListCard<ExperienceItem>
          {...common}
          hint="Most recent first. Start each point with what you did, end it with the result."
          items={r.experience}
          onItems={(experience) => set("experience", experience)}
          make={() => ({ id: newId(), role: "", company: "", location: "", start: "", end: "", current: false, bullets: [] })}
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
              <Field label="What you did — one point per line" span>
                {(id) => (
                  <textarea
                    id={id}
                    className="input"
                    rows={5}
                    value={e.bullets.join("\n")}
                    placeholder={"Led a team of 6 to rebuild checkout\nCut drop-off by 18% in two quarters"}
                    onChange={(ev) => edit({ bullets: ev.target.value.split("\n").slice(0, 20) })}
                  />
                )}
              </Field>
            </div>
          )}
        />
      );

    case "education":
      return (
        <ListCard<EducationItem>
          {...common}
          items={r.education}
          onItems={(education) => set("education", education)}
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
          {...common}
          hint="Group them if you have many — “Design”, “Tools”. One unnamed group is fine too."
          items={r.skills}
          onItems={(skills) => set("skills", skills)}
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
          {...common}
          items={r.certifications}
          onItems={(certifications) => set("certifications", certifications)}
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
          {...common}
          items={r.languages}
          onItems={(languages) => set("languages", languages)}
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
          {...common}
          items={r.awards}
          onItems={(awards) => set("awards", awards)}
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
  footer,
  items,
  onItems,
  make,
  addLabel,
  max,
  summary,
  render,
}: {
  hint?: string;
  footer: ReactNode;
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

  const edit = (itemId: string) => (patch: Partial<T>) => onItems(items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)));
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
          {items.map((item, i) => {
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
      {footer}
    </div>
  );
}
