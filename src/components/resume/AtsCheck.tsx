"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useRef, useState, type DragEvent } from "react";
import { ICON, Icon } from "../ui";
import { Glyph } from "@/lib/glyphs";
import { ApiError, api } from "@/lib/api";
import { flushPendingSaves, newId, usePortfolios } from "@/lib/store";
import type { Portfolio } from "@/lib/types";

/* ── ATS check ─────────────────────────────────────────────────────────────
   The resume builder's third inspector tab. Paste (or drop) a job
   description, Validate, and the same panel turns into the result: a score,
   what it is made of, the keywords found and missing, and suggestions —
   the ones that can be applied in a click change the resume there and then.

   The scoring is the API's (app/services/ats.py): rule-based, explainable,
   every point in the breakdown. It reads the resume as stored, so "Check
   again" saves anything still pending first. The description is sent, read
   and forgotten by the server; it is kept in this tab's session only, so
   switching tabs or reloading does not lose what was pasted.
   ──────────────────────────────────────────────────────────────────────── */

const EASE = [0.16, 1, 0.3, 1] as const;
const MIN = 40;
const MAX = 20000;

type Part = { key: string; label: string; points: number; outOf: number; detail: string };
type TermHit = { term: string; kind: "hard" | "soft" | "keyword"; where: string[] };
type Suggestion = { id: string; kind: "add_skill" | "use_title" | "show_block" | "tip"; title: string; detail: string; value: string };
type Report = { score: number; breakdown: Part[]; title: string; matched: TermHit[]; missing: TermHit[]; suggestions: Suggestion[] };

/** Per portfolio, for as long as the page is open: tab switches remount the panel. */
const reports = new Map<string, Report>();
const applied = new Map<string, Set<string>>();

function readDraft(id: string): string {
  try {
    return sessionStorage.getItem(`ats-jd:${id}`) ?? "";
  } catch {
    return "";
  }
}
function writeDraft(id: string, text: string) {
  try {
    sessionStorage.setItem(`ats-jd:${id}`, text);
  } catch {
    // A private window or blocked storage: the draft just is not remembered.
  }
}

function verdict(score: number): string {
  return score >= 75 ? "Strong match" : score >= 50 ? "Fair match" : "Low match";
}

export function AtsCheck({ p }: { p: Portfolio }) {
  const [jd, setJd] = useState(() => readDraft(p.id));
  const [report, setReport] = useState<Report | null>(() => reports.get(p.id) ?? null);
  const [done, setDone] = useState<Set<string>>(() => applied.get(p.id) ?? new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  const showResult = report && !editing;

  async function validate() {
    setBusy(true);
    setError("");
    try {
      // The check reads the stored resume: anything still waiting to save goes first.
      await flushPendingSaves();
      const next = await api.post<Report>(`/portfolios/${p.id}/resume/ats-check`, { jobDescription: jd.trim() });
      reports.set(p.id, next);
      applied.set(p.id, new Set());
      setReport(next);
      setDone(new Set());
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The check did not run. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  const markDone = (id: string) =>
    setDone((prev) => {
      const next = new Set(prev).add(id);
      applied.set(p.id, next);
      return next;
    });

  return (
    <AnimatePresence mode="wait" initial={false}>
      {showResult ? (
        <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}>
          <Result
            p={p}
            report={report}
            done={done}
            onDone={markDone}
            busy={busy}
            error={error}
            onAgain={validate}
            onEdit={() => setEditing(true)}
          />
        </motion.div>
      ) : (
        <motion.div key="input" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}>
          <Input
            jd={jd}
            onJd={(text) => {
              setJd(text);
              writeDraft(p.id, text);
            }}
            busy={busy}
            error={error}
            onValidate={validate}
            onBack={report ? () => setEditing(false) : undefined}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── the description ──────────────────────────────────────────────────── */

function Input({
  jd,
  onJd,
  busy,
  error,
  onValidate,
  onBack,
}: {
  jd: string;
  onJd: (text: string) => void;
  busy: boolean;
  error: string;
  onValidate: () => void;
  onBack?: () => void;
}) {
  const id = useId();
  const [over, setOver] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const length = jd.trim().length;
  const ready = length >= MIN && length <= MAX;

  async function readFile(f: File) {
    if (!/^text\//.test(f.type) && !/\.(txt|md)$/i.test(f.name)) return;
    onJd((await f.text()).slice(0, MAX));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void readFile(f);
    else onJd(e.dataTransfer.getData("text/plain").slice(0, MAX));
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="m-0 text-[15px] tracking-[-0.01em]">Check against a job</h3>
        <p className="m-0 mt-1 text-[12.5px] leading-snug text-muted">
          Paste the job description. You get a match score, the keywords you are missing, and changes you can apply in
          a click.
        </p>
      </div>

      <div className="field">
        <label htmlFor={id} className="sr-only">
          Job description
        </label>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className="relative rounded-xl transition-colors"
          style={{
            border: `1.5px dashed ${over ? "var(--color-ink)" : "var(--color-neutral-400)"}`,
            background: over ? "var(--color-neutral-100)" : "var(--color-bg)",
          }}
        >
          <textarea
            id={id}
            value={jd}
            onChange={(e) => onJd(e.target.value.slice(0, MAX))}
            rows={11}
            placeholder={"Paste or drop the job description here.\n\nThe whole posting works best — the title, what you’ll do and what they’re looking for."}
            className="block w-full resize-y rounded-xl bg-transparent p-3.5 text-[13px] leading-relaxed outline-none"
            style={{ minHeight: 220, color: "var(--color-ink)" }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11.5px]" style={{ color: "var(--color-neutral-600)" }}>
          <button type="button" className="cursor-pointer underline-offset-2 hover:underline" onClick={() => file.current?.click()}>
            Or choose a .txt file
          </button>
          <span className="font-mono">{length < MIN && length > 0 ? `${MIN - length} more characters` : `${length.toLocaleString()} characters`}</span>
        </div>
        <input
          ref={file}
          type="file"
          accept=".txt,.md,text/plain"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void readFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <p className="m-0 flex items-start gap-2 text-[12.5px]" role="alert">
          <span aria-hidden className="mt-px grid h-4 w-4 flex-none place-items-center rounded-full text-[10px] font-bold" style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}>
            !
          </span>
          {error}
        </p>
      )}

      <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 0, justifyContent: "center" }} disabled={!ready || busy} onClick={onValidate}>
        {busy ? <Spinner /> : <Icon d={ICON.check} size={14} />}
        {busy ? "Checking…" : "Validate"}
      </button>
      {onBack && (
        <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 0, justifyContent: "center" }} onClick={onBack}>
          Back to the result
        </button>
      )}
      <p className="m-0 text-[11.5px] leading-snug" style={{ color: "var(--color-neutral-600)" }}>
        Checked by rules you can see in the result, against the resume as it prints. The description is not stored.
      </p>
    </div>
  );
}

/* ── the result ───────────────────────────────────────────────────────── */

function Result({
  p,
  report,
  done,
  onDone,
  busy,
  error,
  onAgain,
  onEdit,
}: {
  p: Portfolio;
  report: Report;
  done: Set<string>;
  onDone: (id: string) => void;
  busy: boolean;
  error: string;
  onAgain: () => void;
  onEdit: () => void;
}) {
  const reduced = useReducedMotion();
  const live = p.status === "live";
  const actions = report.suggestions.filter((s) => s.kind !== "tip");
  const tips = report.suggestions.filter((s) => s.kind === "tip");
  const changed = done.size > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* the score */}
      <div className="flex items-center gap-4">
        <ScoreRing score={report.score} reduced={!!reduced} />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[15px] font-semibold tracking-[-0.01em]">{verdict(report.score)}</p>
          {report.title && <p className="m-0 mt-0.5 truncate text-[12.5px] text-muted">for {report.title}</p>}
          <button type="button" className="mt-1.5 inline-flex cursor-pointer items-center gap-1 text-[12.5px] font-medium underline-offset-2 hover:underline" onClick={onEdit}>
            <Icon d={ICON.pencil} size={11} />
            Edit the description
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {changed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}>
              <span className="min-w-0 flex-1 text-[12.5px] leading-snug">
                {done.size} {done.size === 1 ? "change" : "changes"} applied. Check again for your new score.
              </span>
              <button
                type="button"
                onClick={onAgain}
                disabled={busy}
                className="flex h-8 flex-none cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold"
                style={{ background: "var(--color-bg)", color: "var(--color-ink)" }}
              >
                {busy && <Spinner />}
                {busy ? "Checking…" : "Check again"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {error && (
        <p className="m-0 text-[12.5px]" role="alert">
          {error}
        </p>
      )}

      {/* what it is made of */}
      <section>
        <Heading>How it adds up</Heading>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {report.breakdown.map((b) => (
            <li key={b.key}>
              <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                <span className="font-medium">{b.label}</span>
                <span className="font-mono text-[11.5px]" style={{ color: "var(--color-neutral-600)" }}>
                  {b.points}/{b.outOf}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--color-neutral-200)" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "var(--color-ink)" }}
                  initial={reduced ? false : { width: 0 }}
                  animate={{ width: `${(b.points / b.outOf) * 100}%` }}
                  transition={{ duration: 0.7, ease: EASE }}
                />
              </div>
              <p className="m-0 mt-1 text-[11.5px] text-muted">{b.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* keywords */}
      {(report.matched.length > 0 || report.missing.length > 0) && (
        <section>
          <Heading>Keywords</Heading>
          {report.missing.length > 0 && (
            <>
              <p className="m-0 mb-1.5 text-[11.5px] text-muted">Missing · {report.missing.length}</p>
              <ul className="m-0 mb-3 flex list-none flex-wrap gap-1.5 p-0">
                {report.missing.map((t) => (
                  <li key={t.term} className="rounded-full px-2.5 py-1 text-[12px]" style={{ border: "1px dashed var(--color-neutral-500)", color: "var(--color-neutral-700)" }}>
                    {t.term}
                  </li>
                ))}
              </ul>
            </>
          )}
          {report.matched.length > 0 && (
            <>
              <p className="m-0 mb-1.5 text-[11.5px] text-muted">Found · {report.matched.length}</p>
              <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                {report.matched.map((t) => (
                  <li
                    key={t.term}
                    title={t.where.length ? `In your ${t.where.join(", ")}` : undefined}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px]"
                    style={{ background: "var(--color-neutral-200)" }}
                  >
                    <Icon d={ICON.check} size={11} />
                    {t.term}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {/* suggestions */}
      {report.suggestions.length > 0 && (
        <section>
          <Heading>Suggestions · {report.suggestions.length}</Heading>
          {live && actions.length > 0 && (
            <p className="m-0 mb-2.5 text-[12px] leading-snug text-muted">
              This page is live, so its content is frozen. Unpublish it to apply a suggestion.
            </p>
          )}
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {actions.map((s) => (
              <SuggestionCard key={s.id} p={p} s={s} done={done.has(s.id)} disabled={live} onDone={() => onDone(s.id)} />
            ))}
            {tips.map((s) => (
              <SuggestionCard key={s.id} p={p} s={s} done={false} disabled onDone={() => undefined} />
            ))}
          </ul>
        </section>
      )}

      <p className="m-0 text-[11.5px] leading-snug" style={{ color: "var(--color-neutral-600)" }}>
        An estimate by keyword rules, not any one ATS’s verdict. Aim for 75 or more, and only add what is true of you.
      </p>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h4 className="m-0 mb-2.5 text-[13px] font-semibold tracking-[-0.005em]">{children}</h4>;
}

const ACTION_LABEL: Record<Exclude<Suggestion["kind"], "tip">, string> = {
  add_skill: "Add to skills",
  use_title: "Use in headline",
  show_block: "Print it",
};

function SuggestionCard({ p, s, done, disabled, onDone }: { p: Portfolio; s: Suggestion; done: boolean; disabled: boolean; onDone: () => void }) {
  const apply = useApply(p);
  const tip = s.kind === "tip";
  return (
    <li
      className="flex flex-col gap-2 rounded-xl p-3"
      style={{ boxShadow: "inset 0 0 0 1px var(--color-divider)", background: tip ? "transparent" : "var(--color-bg)", opacity: done ? 0.7 : 1 }}
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full"
          style={tip ? { boxShadow: "inset 0 0 0 1px var(--color-neutral-400)", color: "var(--color-neutral-700)" } : { background: "var(--color-ink)", color: "var(--color-bg)" }}
        >
          {tip ? <span className="text-[10.5px] font-semibold">i</span> : done ? <Icon d={ICON.check} size={11} /> : <Glyph id="plus" size={11} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[13px] leading-snug font-medium">{s.title}</p>
          <p className="m-0 mt-0.5 text-[12px] leading-snug text-muted">{s.detail}</p>
        </div>
      </div>
      {!tip && (
        <button
          type="button"
          disabled={done || disabled}
          onClick={async () => {
            if (await apply(s)) onDone();
          }}
          className="btn btn-secondary self-end"
          style={{ marginTop: 0, minHeight: 30, fontSize: 12.5 }}
        >
          {done ? (
            <>
              <Icon d={ICON.check} size={12} />
              Applied
            </>
          ) : (
            ACTION_LABEL[s.kind as Exclude<Suggestion["kind"], "tip">]
          )}
        </button>
      )}
    </li>
  );
}

/**
 * What a suggestion does to the resume. Each is the smallest change that
 * makes the resume say the thing, through the same store writes the editor
 * uses, so it saves, and shows in the sheet beside the panel, at once.
 */
function useApply(p: Portfolio) {
  const { updateResume, updatePortfolio, addSectionAsync, updateSection } = usePortfolios();

  return async (s: Suggestion): Promise<boolean> => {
    switch (s.kind) {
      case "add_skill": {
        updateResume(p.id, (r) => {
          const [first, ...rest] = r.skills;
          const has = r.skills.some((g) => g.items.some((i) => i.trim().toLowerCase() === s.value.toLowerCase()));
          const skills = has ? r.skills : first ? [{ ...first, items: [...first.items, s.value] }, ...rest] : [{ id: newId(), name: "", items: [s.value] }];
          return { ...r, skills, hidden: r.hidden.filter((b) => b !== "skills") };
        });
        // A list prints once a section holds it. With none, add one that is
        // kept off the page, so the skill reaches the resume and nothing else.
        if (!p.sections.some((sec) => sec.blocks.some((b) => b.type === "skills"))) {
          const added = await addSectionAsync(p.id);
          if (!added) return false;
          updateSection(p.id, added, (sec) => ({
            ...sec,
            title: "Skills",
            hidden: true,
            onResume: false,
            blocks: [{ id: newId(), type: "skills", title: "", look: "theme" }],
          }));
        }
        return true;
      }
      case "use_title":
        updatePortfolio(p.id, (prev) => {
          const current = prev.header.current.trim();
          const next = current ? `${s.value} · ${current}` : s.value;
          return { ...prev, header: { ...prev.header, current: next } };
        });
        return true;
      case "show_block":
        updateResume(p.id, (r) => ({ ...r, hidden: r.hidden.filter((b) => b !== s.value) }));
        return true;
      default:
        return false;
    }
  };
}

/* ── pieces ───────────────────────────────────────────────────────────── */

function ScoreRing({ score, reduced }: { score: number; reduced: boolean }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-[84px] w-[84px] flex-none place-items-center" role="img" aria-label={`Match score ${score} out of 100`}>
      <svg viewBox="0 0 84 84" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="42" cy="42" r={r} fill="none" stroke="var(--color-neutral-200)" strokeWidth="7" />
        <motion.circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduced ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ duration: 0.9, ease: EASE }}
        />
      </svg>
      <span className="relative text-center leading-none">
        <span className="block text-[24px] font-semibold tracking-[-0.03em]">{score}</span>
        <span className="block font-mono text-[10px]" style={{ color: "var(--color-neutral-600)" }}>
          / 100
        </span>
      </span>
    </div>
  );
}

function Spinner() {
  return <span aria-hidden className="h-3.5 w-3.5 flex-none animate-spin rounded-full border-2 border-current border-t-transparent" />;
}
