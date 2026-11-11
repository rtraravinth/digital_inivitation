"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState, type ReactNode } from "react";
import { TagEditor } from "../TagEditor";
import { Card, Placeholder } from "../editor/card";
import { BUILT_IN_ICON, ComponentChip, PanelShell } from "../editor/components";
import { IconButton, LookToggles } from "../ui";
import { Glyph } from "@/lib/glyphs";
import { BLOCK_LABEL, dateRange } from "@/lib/resume";
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

/* ── the built-in sections in the content list ───────────────────────────
   The facts a resume is read for — roles with dates, schools, skills — as
   sections like any other in the one content list: the same card, the same
   Page / Resume switches, and inside it the same component panel. What
   makes them built in is that each holds exactly one component, of its own
   kind, and that component is stored as structured facts in `p.resume`
   rather than in a section's `blocks` — a resume template and a later ATS
   check have to read a role and its dates without parsing prose. Entries
   open in place and save as they are typed.
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

/** Email, phone, place and site — printed on the resume, never on the page. */
type CardState = { open: boolean; onOpen: () => void; onClose: () => void };

function Done({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" className="btn btn-primary ml-1" style={{ marginTop: 0, minHeight: 32, fontSize: 13 }} onClick={onClose}>
      Done
    </button>
  );
}

export function ResumeContactCard({ p, open, onOpen, onClose }: { p: Portfolio } & CardState) {
  const { set } = useResume(p);
  const r = p.resume;
  const filled = [r.email, r.phone, r.location, r.website].filter((v) => v.trim());
  const summary = filled.length === 0 ? "Empty — not printed yet" : `${filled.length} of 4 details`;
  return (
    <Card
      id="r-contact"
      open={open}
      onOpen={onOpen}
      dim={filled.length === 0}
      label="Contact details — built in, resume only"
      tools={
        <span className="flex flex-wrap items-center justify-end gap-1">
          <LookToggles name="contact details" page={false} resume />
          {open && <Done onClose={onClose} />}
        </span>
      }
      preview={
        <>
          <div className="text-[19px] leading-snug font-semibold tracking-[-0.015em]">Contact details</div>
          <p className="m-0 mt-1.5 max-w-[64ch] text-[14px] leading-relaxed text-muted">
            {filled.length > 0 ? filled.join(" · ") : <Placeholder>Email, phone, place and site — the line under your name on the resume</Placeholder>}
          </p>
          <div className="mt-3">
            <ComponentChip icon={BUILT_IN_ICON.contact} name="Contact details" summary={filled.length === 0 ? "Empty" : `${filled.length} of 4`} />
          </div>
        </>
      }
    >
      <p className="m-0 mb-4 max-w-[64ch] text-[13px] leading-snug text-muted">
        Printed at the top of your resume and never shown on your page. Your page’s links print beside them. To
        put a way to reach you on the page, add a Contact component to one of your sections.
      </p>
      <PanelShell icon={BUILT_IN_ICON.contact} name="Contact details" summary={summary}>
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
      </PanelShell>
      <div className="mt-6 flex justify-end">
        <button type="button" className="btn btn-primary" style={{ marginTop: 0 }} onClick={onClose}>
          Done
        </button>
      </div>
    </Card>
  );
}

/** One structured block — Experience, Education and so on — as a card. */
export function ResumeBlockCard({ p, block, open, onOpen, onClose }: { p: Portfolio; block: PageBlock } & CardState) {
  const { change, set } = useResume(p);
  const r = p.resume;
  const onPage = r.pageBlocks.includes(block);
  const onResume = !r.hidden.includes(block);
  const toggles = (
    <LookToggles
      name={BLOCK_LABEL[block]}
      page={onPage}
      resume={onResume}
      onPage={() =>
        change((prev) => ({
          ...prev,
          pageBlocks: prev.pageBlocks.includes(block) ? prev.pageBlocks.filter((b) => b !== block) : [...prev.pageBlocks, block],
        }))
      }
      onResume={() =>
        change((prev) => ({
          ...prev,
          hidden: prev.hidden.includes(block) ? prev.hidden.filter((b) => b !== block) : [...prev.hidden, block],
        }))
      }
    />
  );
  const common = { block, toggles, dim: !onPage && !onResume, open, onOpen, onClose };

  switch (block) {
    case "experience":
      return (
        <ListCard<ExperienceItem>
          {...common}
          noun={["role", "roles"]}
          empty="Roles with their dates, most recent first"
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
          noun={["entry", "entries"]}
          empty="Degrees and schools"
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
          noun={["group", "groups"]}
          empty="What you are good at, grouped if there are many"
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
          noun={["certification", "certifications"]}
          empty="Qualifications and who issued them"
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
          noun={["language", "languages"]}
          empty="The languages you work in"
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
          noun={["award", "awards"]}
          empty="Recognition worth a line"
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
  block,
  noun,
  empty,
  hint,
  toggles,
  dim,
  open: cardOpen,
  onOpen,
  onClose,
  items,
  onItems,
  make,
  addLabel,
  max,
  summary,
  render,
}: {
  block: PageBlock;
  /** What one row is called: ["role", "roles"]. */
  noun: [string, string];
  /** What the closed card says while there are no rows. */
  empty: string;
  hint?: string;
  toggles: ReactNode;
  dim?: boolean;
  items: T[];
  onItems: (items: T[]) => void;
  make: () => T;
  addLabel: string;
  max: number;
  summary: (item: T) => { title: string; sub: string };
  render: (item: T, edit: (patch: Partial<T>) => void) => ReactNode;
} & CardState) {
  const title = BLOCK_LABEL[block];
  const count = items.length === 0 ? "Empty" : `${items.length} ${items.length === 1 ? noun[0] : noun[1]}`;
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
    <Card
      id={`r-${block}`}
      open={cardOpen}
      onOpen={onOpen}
      dim={dim || items.length === 0}
      label={`${title} — built in`}
      tools={
        <span className="flex flex-wrap items-center justify-end gap-1">
          {toggles}
          {cardOpen && <Done onClose={onClose} />}
        </span>
      }
      preview={
        <>
          <div className="text-[19px] leading-snug font-semibold tracking-[-0.015em]">{title}</div>
          {items.length === 0 ? (
            <p className="m-0 mt-1.5 text-[14px] leading-relaxed">
              <Placeholder>{empty}</Placeholder>
            </p>
          ) : (
            <ul className="m-0 mt-1.5 flex list-none flex-col gap-0.5 p-0 text-[14px] leading-relaxed">
              {items.slice(0, 3).map((item) => {
                const line = summary(item);
                return (
                  <li key={item.id} className="truncate">
                    <span className="font-medium">{line.title}</span>
                    {line.sub && <span className="text-muted"> — {line.sub}</span>}
                  </li>
                );
              })}
              {items.length > 3 && <li className="text-muted">and {items.length - 3} more</li>}
            </ul>
          )}
          <div className="mt-3">
            <ComponentChip icon={BUILT_IN_ICON[block]} name={title} summary={count} />
          </div>
        </>
      }
    >
      {hint && <p className="m-0 mb-4 max-w-[64ch] text-[13px] leading-snug text-muted">{hint}</p>}
      <PanelShell icon={BUILT_IN_ICON[block]} name={title} summary={items.length === 0 ? "Empty — not shown yet" : count}>
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
      </PanelShell>
      <div className="mt-6 flex justify-end">
        <button type="button" className="btn btn-primary" style={{ marginTop: 0 }} onClick={onClose}>
          Done
        </button>
      </div>
    </Card>
  );
}
