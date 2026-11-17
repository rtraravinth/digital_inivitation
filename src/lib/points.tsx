import { Fragment, type ReactNode } from "react";
import { POINT_BULLET_RE } from "./types";

/* ── a role's points: bullets, bold and italic ───────────────────────────
   Three marks and no more, written as plain text so the stored row, the ATS
   check and an export all still read as words: `• ` at the start of a line
   makes it a bullet, `**…**` is bold and `*…*` italic inside a line. The
   editor's toolbar writes them (ResumeContent.tsx); this reads them back.
   ──────────────────────────────────────────────────────────────────────── */

type Point = { bullet: boolean; text: string };

/** The non-blank lines, each a bullet or not, its mark taken off. */
function pointsOf(lines: string[]): Point[] {
  return lines
    .filter((l) => l.trim())
    .map((l) => (POINT_BULLET_RE.test(l) ? { bullet: true, text: l.replace(POINT_BULLET_RE, "").trim() } : { bullet: false, text: l.trim() }));
}

/** Runs of bullets become one list; plain lines stay paragraphs. */
export function pointGroups(lines: string[]): Array<{ bullet: boolean; lines: string[] }> {
  const groups: Array<{ bullet: boolean; lines: string[] }> = [];
  for (const p of pointsOf(lines)) {
    const last = groups[groups.length - 1];
    if (last && last.bullet === p.bullet) last.lines.push(p.text);
    else groups.push({ bullet: p.bullet, lines: [p.text] });
  }
  return groups;
}

function italics(text: string): ReactNode[] {
  // An asterisk with a space after it is not a mark: "5 * 3" stays as typed.
  return text.split(/\*([^*\s](?:[^*]*[^*\s])?)\*/).map((part, i) => (i % 2 ? <em key={i}>{part}</em> : <Fragment key={i}>{part}</Fragment>));
}

/** One line with its bold and italic drawn. */
export function Inline({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/);
  return <>{parts.map((part, i) => (i % 2 ? <strong key={i}>{italics(part)}</strong> : <Fragment key={i}>{italics(part)}</Fragment>))}</>;
}
