"use client";

import { useId, useState } from "react";
import { ColourPicker } from "@/components/builder/ColourPicker";
import { FontSelect } from "@/components/builder/FontSelect";
import { ThemeThumb } from "./ThemeThumb";
import { Glyph } from "@/lib/glyphs";
import {
  DEFAULT_TRACKING,
  DENSITIES,
  FONTS,
  GROUNDS,
  MOTION_LEVELS,
  PHOTO_TREATMENTS,
  PROFESSIONS,
  ROLE_NAVS,
  THEMES,
  TYPE_SCALES,
  applyProfession,
  type FontId,
  type GridCols,
  type Portfolio,
  type ProfessionId,
  type ThemeId,
} from "@/lib/types";

export type Recipe = (recipe: (p: Portfolio) => Portfolio) => void;

// In its own module so the portfolio list can draw one without loading every
// control on this page; re-exported so existing imports keep working.
export { ThemeThumb } from "./ThemeThumb";

/* ── shared pieces ────────────────────────────────────────────────────── */

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <h3 className={`m-0 text-[14px] tracking-[-0.01em] ${note ? "mb-1" : "mb-3"}`}>{title}</h3>
      {note && <p className="m-0 mb-3 text-[12.5px] leading-snug text-muted">{note}</p>}
      {children}
    </section>
  );
}

/* ── look: profession and theme ───────────────────────────────────────── */

/**
 * "What do you do?" — ten starting looks. Applying one rewrites the theme,
 * the colours and the faces in one go, so the panel keeps the look it
 * replaced and offers it back until the author moves on.
 */
export function ProfessionControl({
  p,
  onChange,
  columns = 2,
}: {
  p: Portfolio;
  onChange: Recipe;
  columns?: 2 | 3 | 5;
}) {
  const [applied, setApplied] = useState<{ id: ProfessionId; before: Portfolio } | null>(null);
  const cols = columns === 5 ? "grid-cols-2 sm:grid-cols-5" : columns === 3 ? "grid-cols-3" : "grid-cols-2";

  const current = PROFESSIONS.find(
    (x) =>
      x.theme === p.theme &&
      x.accent === p.accent &&
      x.groundHex === p.groundHex &&
      x.font === p.font &&
      x.bodyFont === p.bodyFont,
  );

  return (
    <Section
      title="Start from what you do"
      note="Sets a theme, colours and type that suit the work. Your words stay exactly as they are."
    >
      <div className={`grid gap-1.5 ${cols}`}>
        {PROFESSIONS.map((x) => {
          const on = current?.id === x.id;
          return (
            <button
              key={x.id}
              type="button"
              aria-pressed={on}
              title={x.goal}
              onClick={() => {
                setApplied({ id: x.id, before: p });
                onChange((prev) => applyProfession(prev, x.id));
              }}
              className="group flex min-h-[52px] cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-[var(--color-surface)]"
              style={{
                background: on ? "var(--color-surface)" : "var(--color-bg)",
                boxShadow: on ? "inset 0 0 0 1.5px var(--color-ink)" : "inset 0 0 0 1px var(--color-divider)",
                transition: "box-shadow 160ms var(--ease-out)",
              }}
            >
              <span
                aria-hidden
                className="relative h-7 w-7 flex-none overflow-hidden rounded-lg"
                style={{ background: x.groundHex, boxShadow: "inset 0 0 0 1px #ffffff26" }}
              >
                <span
                  className="absolute right-1 bottom-1 h-2.5 w-2.5 rounded-full"
                  style={{ background: x.accent }}
                />
              </span>
              <span className="min-w-0">
                <span className="font-heading block truncate text-[13px]">{x.name}</span>
                <span className="text-neutral-700 block truncate text-[10.5px]">
                  {THEMES.find((t) => t.id === x.theme)?.name}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {applied && (
        <div
          role="status"
          className="mt-2.5 flex items-center gap-3 rounded-lg px-3 py-2 text-[12px]"
          style={{ background: "var(--color-surface)" }}
        >
          <span className="min-w-0 flex-1 truncate">
            {PROFESSIONS.find((x) => x.id === applied.id)?.name} look applied.
          </span>
          <button
            type="button"
            className="btn btn-ghost text-xs"
            style={{ marginTop: 0 }}
            onClick={() => {
              const before = applied.before;
              setApplied(null);
              onChange((prev) => ({
                ...prev,
                theme: before.theme,
                accent: before.accent,
                ground: before.ground,
                groundHex: before.groundHex,
                font: before.font,
                bodyFont: before.bodyFont,
              }));
            }}
          >
            Undo
          </button>
        </div>
      )}
    </Section>
  );
}

export function ThemeControl({ p, onChange }: { p: Portfolio; onChange: Recipe }) {
  return (
    <Section
      title="Theme"
      note="Changes the whole page structure and how it moves. Your content stays where it is."
    >
      <div className="flex flex-col gap-2">
        {THEMES.map((t) => {
          const on = p.theme === t.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange((prev) => ({ ...prev, theme: t.id }))}
              className="flex cursor-pointer flex-col overflow-hidden rounded-xl text-left transition-transform duration-200 hover:-translate-y-0.5"
              style={{
                background: on ? "var(--color-surface)" : "var(--color-bg)",
                boxShadow: on ? "inset 0 0 0 1.5px var(--color-ink)" : "inset 0 0 0 1px var(--color-divider)",
              }}
            >
              <ThemeThumb theme={t.id} accent={p.accent} size="md" />
              <span className="flex items-start gap-3 p-3">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-heading text-sm">{t.name}</span>
                  <span className="text-neutral-700 text-[11px]">{t.desc}</span>
                </span>
                <span
                  className="mt-0.5 flex-none"
                  style={{ color: on ? "var(--color-foil)" : "transparent" }}
                >
                  <Glyph id="check" size={15} />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

/* ── colour ───────────────────────────────────────────────────────────── */

export function ColourControl({ p, onChange }: { p: Portfolio; onChange: Recipe }) {
  // A radio `name` is document-scoped, and this panel is mounted twice in the
  // builder (inspector and mobile sheet) — one group per mounted copy.
  const group = useId();
  const preset = GROUNDS.find((g) => g.id === p.ground) ?? GROUNDS[0];
  const custom = p.groundHex !== "";

  return (
    <>
      <Section title="Palettes" note="An accent and a ground that belong together. Pick one, then fine-tune below.">
        <div className="grid grid-cols-5 gap-1.5">
          {PROFESSIONS.map((x) => {
            const on = p.accent === x.accent && p.groundHex === x.groundHex;
            return (
              <button
                key={x.id}
                type="button"
                aria-pressed={on}
                aria-label={`${x.name} palette`}
                title={`${x.name} palette`}
                onClick={() => onChange((prev) => ({ ...prev, accent: x.accent, groundHex: x.groundHex }))}
                className="relative aspect-square cursor-pointer overflow-hidden rounded-lg transition-transform duration-200 hover:scale-105"
                style={{
                  background: x.groundHex,
                  boxShadow: on
                    ? "0 0 0 2px var(--color-bg), 0 0 0 3.5px var(--color-ink)"
                    : "inset 0 0 0 1px #8883",
                }}
              >
                <span
                  className="absolute right-[18%] bottom-[18%] h-[38%] w-[38%] rounded-full"
                  style={{ background: x.accent }}
                />
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Accent" note="Buttons, links, highlights and the glow behind the motion.">
        <ColourPicker
          id={`accent-hex-${group}`}
          name="Accent"
          value={p.accent}
          onPick={(hex) => onChange((prev) => ({ ...prev, accent: hex }))}
        />
      </Section>

      <Section title="Ground">
        <div className="seg mb-3">
          {GROUNDS.map((g) => (
            <label key={g.id} className="seg-opt">
              <input
                type="radio"
                name={`ground-${group}`}
                // A preset is only showing while no colour has been picked: its
                // palette is hand-tuned, and derivation only approximates it.
                checked={!custom && p.ground === g.id}
                onChange={() => onChange((prev) => ({ ...prev, ground: g.id, groundHex: "" }))}
              />
              {g.name}
            </label>
          ))}
        </div>
        <ColourPicker
          id={`ground-hex-${group}`}
          name="Ground"
          // Before a colour is picked the picker shows the preset's own paper,
          // and touching it takes over from there.
          value={custom ? p.groundHex : preset.hex}
          onPick={(hex) => onChange((prev) => ({ ...prev, groundHex: hex }))}
        />
        <p className="text-neutral-700 mt-1.5 text-[11px]">
          {custom
            ? "Text, dividers and panels are worked out from this colour — the ink flips to light once the ground is dark enough."
            : "Pick a colour to replace the preset. A preset sets the ink, panels and dividers to match its paper."}
        </p>
      </Section>

      <Section title="Photography">
        <div className="seg mb-2">
          {PHOTO_TREATMENTS.map((t) => (
            <label key={t.id} className="seg-opt">
              <input
                type="radio"
                name={`photo-${group}`}
                checked={p.layout.photo === t.id}
                onChange={() =>
                  onChange((prev) => ({ ...prev, layout: { ...prev.layout, photo: t.id } }))
                }
              />
              {t.name}
            </label>
          ))}
        </div>
        <p className="text-neutral-700 m-0 text-[11px]">
          Every image on the published page, including the portrait.
        </p>
      </Section>
    </>
  );
}

/* ── type ─────────────────────────────────────────────────────────────── */

/** The professions' pairings, once each, named by the headline face. */
const PAIRINGS: Array<{ font: FontId; bodyFont: FontId; for: string }> = (() => {
  const seen = new Map<string, { font: FontId; bodyFont: FontId; for: string[] }>();
  for (const x of PROFESSIONS) {
    const key = `${x.font}|${x.bodyFont}`;
    const entry = seen.get(key) ?? { font: x.font, bodyFont: x.bodyFont, for: [] };
    entry.for.push(x.name);
    seen.set(key, entry);
  }
  return [...seen.values()].map((e) => ({ ...e, for: e.for.join(", ") }));
})();

function faceVar(id: FontId) {
  const face = FONTS.find((f) => f.id === id) ?? FONTS[0];
  return `var(${face.cssVar}), system-ui, sans-serif`;
}

export function TypeControl({ p, onChange }: { p: Portfolio; onChange: Recipe }) {
  const group = useId();
  return (
    <>
      <Section title="Pairings" note="A headline face and a body face that work together.">
        <div className="grid grid-cols-2 gap-1.5">
          {PAIRINGS.map((pair) => {
            const on = p.font === pair.font && p.bodyFont === pair.bodyFont;
            return (
              <button
                key={`${pair.font}-${pair.bodyFont}`}
                type="button"
                aria-pressed={on}
                onClick={() => onChange((prev) => ({ ...prev, font: pair.font, bodyFont: pair.bodyFont }))}
                className="flex cursor-pointer flex-col items-start gap-1 rounded-xl p-3 text-left transition-colors hover:bg-[var(--color-surface)]"
                style={{
                  background: on ? "var(--color-surface)" : "var(--color-bg)",
                  boxShadow: on ? "inset 0 0 0 1.5px var(--color-ink)" : "inset 0 0 0 1px var(--color-divider)",
                }}
              >
                <span style={{ fontFamily: faceVar(pair.font), fontSize: 24, fontWeight: 700, lineHeight: 1 }}>
                  Aa
                </span>
                <span style={{ fontFamily: faceVar(pair.bodyFont), fontSize: 12 }} className="text-neutral-800">
                  {FONTS.find((f) => f.id === pair.font)?.name} + {FONTS.find((f) => f.id === pair.bodyFont)?.name}
                </span>
                <span className="text-neutral-700 text-[10.5px]">{pair.for}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Faces" note="Or pick each half yourself. Set both to one family to run one face throughout.">
        <div className="field mb-3">
          <label htmlFor={`headline-face-${group}`}>Headline</label>
          <FontSelect
            id={`headline-face-${group}`}
            label="Headline face"
            value={p.font}
            specimen={p.header.name || "Your name"}
            onPick={(id) => onChange((prev) => ({ ...prev, font: id }))}
          />
        </div>
        <div className="field">
          <label htmlFor={`body-face-${group}`}>Body</label>
          <FontSelect
            id={`body-face-${group}`}
            label="Body face"
            value={p.bodyFont}
            onPick={(id) => onChange((prev) => ({ ...prev, bodyFont: id }))}
          />
        </div>
        <p className="text-neutral-700 mt-2 text-[11px]">
          Syne, Oswald, Playfair Display and JetBrains Mono are display faces —
          they carry a headline well and are hard going for a paragraph.
        </p>
      </Section>

      <Section title="Headline scale">
        <div className="seg">
          {TYPE_SCALES.map((s) => (
            <label key={s.id} className="seg-opt">
              <input
                type="radio"
                name={`typescale-${group}`}
                checked={p.layout.scale === s.id}
                onChange={() =>
                  onChange((prev) => ({ ...prev, layout: { ...prev.layout, scale: s.id } }))
                }
              />
              {s.name}
            </label>
          ))}
        </div>
      </Section>

      <div className="field">
        <label htmlFor={`tracking-${group}`}>Letter spacing</label>
        <input
          id={`tracking-${group}`}
          className="input"
          value={p.layout.tracking}
          placeholder={DEFAULT_TRACKING}
          onChange={(e) =>
            onChange((prev) => ({ ...prev, layout: { ...prev.layout, tracking: e.target.value } }))
          }
        />
        <p className="text-neutral-700 mt-1.5 text-[11px]">
          Any CSS length — <code>-0.02em</code>, <code>0</code>, <code>1px</code>. Applies
          to every heading on the published page.
        </p>
      </div>
    </>
  );
}

/* ── motion ───────────────────────────────────────────────────────────── */

export function MotionControl({ p, onChange }: { p: Portfolio; onChange: Recipe }) {
  const group = useId();
  const theme = THEMES.find((t) => t.id === p.theme);
  return (
    <Section title="Motion" note={theme ? `${theme.name}: ${theme.depth}` : undefined}>
      <div className="flex flex-col gap-1.5">
        {MOTION_LEVELS.map((m) => {
          const on = p.layout.motion === m.id;
          return (
            <label
              key={m.id}
              className="flex cursor-pointer items-start gap-3 rounded-xl p-3"
              style={{
                background: on ? "var(--color-surface)" : "var(--color-bg)",
                boxShadow: on ? "inset 0 0 0 1.5px var(--color-ink)" : "inset 0 0 0 1px var(--color-divider)",
              }}
            >
              {/* The real radio stays for the keyboard and assistive tech; the
                  dot beside it is drawn, because a native radio is painted
                  however the browser likes — one rendering showed unchosen
                  options as solid black, which reads as chosen. */}
              <input
                type="radio"
                className="peer sr-only"
                name={`motion-${group}`}
                checked={on}
                onChange={() =>
                  onChange((prev) => ({ ...prev, layout: { ...prev.layout, motion: m.id } }))
                }
              />
              <span
                aria-hidden
                className="mt-0.5 grid h-[18px] w-[18px] flex-none place-items-center rounded-full peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2"
                style={{ boxShadow: `inset 0 0 0 ${on ? 5 : 1.5}px ${on ? "var(--color-ink)" : "var(--color-neutral-500)"}`, transition: "box-shadow 160ms" }}
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-heading text-sm">{m.name}</span>
                <span className="text-neutral-700 text-[11px]">{m.desc}</span>
              </span>
            </label>
          );
        })}
      </div>
      <p className="text-neutral-700 mt-2.5 text-[11px]">
        A visitor whose device asks for reduced motion always gets the still page, whatever is set here.
      </p>
    </Section>
  );
}

/* ── layout ───────────────────────────────────────────────────────────── */

/**
 * Why a theme ignores one of the Layout controls.
 *
 * The standing rule is that the panel says so on screen rather than offering
 * a control that silently does nothing. A missing key means the theme reads
 * that control. The facts are in `src/components/published/themes/` — grep
 * for `useTabFilter`, `gridCols(` and `layout.density` before editing this.
 */
const IGNORED: Record<ThemeId, { nav?: string; grid?: string; density?: string }> = {
  meridian: {},
  aurora: {
    nav: "Aurora shows every tab as a chapter on one scroll, with a glass nav that jumps between them.",
  },
  stage: {
    nav: "Stage gives every tab its own showreel rail, one under another.",
    grid: "Stage's rails are a single row of posters that scrolls sideways.",
    density: "Stage sets its own rhythm around the billboard and the rails.",
  },
  arcade: {
    nav: "Arcade's sections are its level-select menu.",
    density: "Arcade sets its own spacing around the horizon.",
  },
  journey: {
    nav: "Journey tells every tab as a chapter on one scroll.",
    grid: "Journey's entries are one column of cards that stack as you read.",
  },
  bio: {
    nav: "Bio lists every link on one page, grouped by tab.",
    grid: "Bio is a single column of link buttons.",
    density: "Bio keeps its buttons at one comfortable spacing.",
  },
};

function IgnoredNote({ reason }: { reason: string }) {
  return (
    <p className="mb-3 text-[11px]" style={{ color: "var(--color-neutral-700)" }} role="note">
      {reason} The setting is stored and applies again when you switch theme.
    </p>
  );
}

export function LayoutControl({ p, onChange }: { p: Portfolio; onChange: Recipe }) {
  // A radio `name` is scoped to the document, not to the component. The
  // builder mounts this panel twice — the desktop inspector and the mobile
  // sheet, which is `lg:hidden` rather than unmounted — so a fixed name put
  // both copies' inputs in one native group, and the hidden copy took the
  // only checked member. The state was right; only the dot was missing.
  const group = useId();
  const ignored = IGNORED[p.theme] ?? {};

  return (
    <>
      <h3 className="m-0 mb-1 text-[14px] tracking-[-0.01em]">Tab navigation</h3>
      <p className="m-0 mb-3 text-[12.5px] text-muted">How visitors move between your sections.</p>
      {ignored.nav && <IgnoredNote reason={ignored.nav} />}
      <div className={`mb-5 flex flex-col gap-2.5 ${ignored.nav ? "opacity-50" : ""}`}>
        {ROLE_NAVS.map((n) => (
          <label key={n.id} className="radio">
            <input
              type="radio"
              name={`rolenav-${group}`}
              checked={p.layout.roleNav === n.id}
              onChange={() =>
                onChange((prev) => ({ ...prev, layout: { ...prev.layout, roleNav: n.id } }))
              }
            />
            <span className="dot" />
            {n.name}
          </label>
        ))}
      </div>

      <h3 className={`m-0 text-[14px] tracking-[-0.01em] ${ignored.grid ? "mb-1.5" : "mb-3"}`}>Content grid</h3>
      {ignored.grid && <IgnoredNote reason={ignored.grid} />}
      <div className={`seg mb-5 ${ignored.grid ? "opacity-50" : ""}`}>
        {([1, 2, 3] as GridCols[]).map((n) => (
          <label key={n} className="seg-opt">
            <input
              type="radio"
              name={`gridcols-${group}`}
              checked={p.layout.grid === n}
              onChange={() =>
                onChange((prev) => ({ ...prev, layout: { ...prev.layout, grid: n } }))
              }
            />
            {n} col
          </label>
        ))}
      </div>

      <h3 className={`m-0 text-[14px] tracking-[-0.01em] ${ignored.density ? "mb-1.5" : "mb-3"}`}>Density</h3>
      {ignored.density && <IgnoredNote reason={ignored.density} />}
      <div className={`flex flex-col gap-2.5 ${ignored.density ? "opacity-50" : ""}`}>
        {DENSITIES.map((d) => (
          <label key={d.id} className="radio">
            <input
              type="radio"
              name={`density-${group}`}
              checked={p.layout.density === d.id}
              onChange={() =>
                onChange((prev) => ({ ...prev, layout: { ...prev.layout, density: d.id } }))
              }
            />
            <span className="dot" />
            {d.name}
          </label>
        ))}
      </div>
    </>
  );
}
