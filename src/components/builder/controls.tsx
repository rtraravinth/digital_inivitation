"use client";

import {
  DEFAULT_TRACKING,
  DENSITIES,
  FONTS,
  GROUNDS,
  ROLE_NAVS,
  SWATCHES,
  THEMES,
  TYPE_SCALES,
  type GridCols,
  type Portfolio,
  type ThemeId,
} from "@/lib/types";

export type Recipe = (recipe: (p: Portfolio) => Portfolio) => void;

/* ── theme thumbnails ─────────────────────────────────────────────────── */

const bar = (w: string, colour: string) => (
  <span className="block h-[2px]" style={{ width: w, background: colour }} />
);

/**
 * A CSS-built preview of each theme's structure. Abstract on purpose: it has
 * to read at 46×38 and stay legible against any accent or ground.
 */
export function ThemeThumb({
  theme,
  accent,
  size = "sm",
}: {
  theme: ThemeId;
  accent: string;
  size?: "sm" | "lg";
}) {
  const box =
    size === "lg"
      ? "block h-[150px] w-full overflow-hidden"
      : "block h-[38px] w-[46px] flex-none overflow-hidden";
  const frame = {
    border: "1px solid var(--color-divider)",
    background: "var(--color-bg)",
  };
  const grey = "var(--color-neutral-400)";
  const pad = size === "lg" ? "p-3" : "p-1";
  const gap = size === "lg" ? "gap-1.5" : "gap-[3px]";

  switch (theme) {
    case "index":
      return (
        <span className={`${box} grid`} style={{ ...frame, gridTemplateColumns: "30% 1fr" }}>
          <span style={{ background: accent }} />
          <span className={`flex flex-col justify-center ${gap} ${pad}`}>
            {bar("100%", grey)}
            {bar("100%", grey)}
            {bar("66%", grey)}
          </span>
        </span>
      );
    case "poster":
      return (
        <span className={box} style={frame}>
          <span
            className={`flex h-[55%] flex-col justify-end ${pad} ${gap}`}
            style={{ background: accent }}
          >
            {bar("70%", "rgba(255,255,255,.9)")}
            {bar("45%", "rgba(255,255,255,.6)")}
          </span>
          <span className={`grid h-[45%] grid-cols-4 ${gap} ${pad}`}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} style={{ background: grey }} />
            ))}
          </span>
        </span>
      );
    case "links":
      return (
        <span className={`${box} flex flex-col ${gap} ${pad}`} style={frame}>
          <span className="flex items-center gap-1">
            <span
              className="block aspect-square h-[30%] min-h-[8px]"
              style={{ background: accent }}
            />
            {bar("50%", grey)}
          </span>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block flex-1"
              style={{ boxShadow: `inset 0 -1px 0 ${grey}` }}
            />
          ))}
        </span>
      );
    case "ledger":
      return (
        <span className={`${box} flex flex-col justify-center ${gap} ${pad}`} style={frame}>
          {bar("100%", accent)}
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i}>{bar("100%", grey)}</span>
          ))}
        </span>
      );
    case "dossier":
      return (
        <span className={`${box} flex flex-col ${gap} ${pad}`} style={frame}>
          <span className="flex gap-1">
            <span className="block h-[8px] w-[40%]" style={{ background: accent }} />
            <span className="block h-[8px] w-[25%]" style={{ background: grey }} />
          </span>
          {bar("100%", grey)}
          {bar("100%", grey)}
          {bar("70%", grey)}
        </span>
      );
    case "broadsheet":
      return (
        <span className={`${box} flex flex-col ${pad}`} style={frame}>
          <span className="mb-1 block h-[3px] w-full" style={{ background: accent }} />
          <span
            className="grid flex-1 grid-cols-3"
            style={{ gap: 3 }}
          >
            {[0, 1, 2].map((c) => (
              <span
                key={c}
                className="flex flex-col justify-start gap-[2px]"
                style={{ borderRight: c < 2 ? `1px solid ${grey}` : undefined }}
              >
                {bar("85%", grey)}
                {bar("85%", grey)}
                {bar("60%", grey)}
              </span>
            ))}
          </span>
        </span>
      );
    default:
      return (
        <span className={`${box} flex flex-col ${gap} ${pad}`} style={frame}>
          <span className="block h-[5px] w-3/4" style={{ background: accent }} />
          <span className="grid flex-1 grid-cols-2" style={{ gap: 2 }}>
            <span style={{ background: grey }} />
            <span style={{ background: grey }} />
          </span>
        </span>
      );
  }
}

/* ── the four inspector tabs ──────────────────────────────────────────── */

function Row({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer items-center gap-3 p-3 text-left"
      style={{ background: on ? "var(--color-surface)" : "var(--color-bg)" }}
    >
      {children}
      <span
        className="ml-auto font-extrabold"
        style={{ color: on ? "var(--color-accent)" : "transparent" }}
      >
        ✓
      </span>
    </button>
  );
}

const stack = {
  background: "var(--color-divider)",
  borderBlock: "2px solid var(--color-divider)",
};

export function ThemeControl({ p, onChange }: { p: Portfolio; onChange: Recipe }) {
  return (
    <>
      <h6 className="mb-1.5">Theme</h6>
      <p className="text-neutral-700 text-xs">
        Changes the whole page structure. Your content stays where it is.
      </p>
      <div className="flex flex-col gap-0.5" style={stack}>
        {THEMES.map((t) => (
          <Row
            key={t.id}
            on={p.theme === t.id}
            onClick={() => onChange((prev) => ({ ...prev, theme: t.id }))}
          >
            <ThemeThumb theme={t.id} accent={p.accent} />
            <span className="flex flex-col gap-0.5">
              <span className="font-heading text-sm font-extrabold">{t.name}</span>
              <span className="text-neutral-700 text-[11px]">{t.desc}</span>
            </span>
          </Row>
        ))}
      </div>
    </>
  );
}

export function ColourControl({ p, onChange }: { p: Portfolio; onChange: Recipe }) {
  return (
    <>
      <h6 className="mb-1.5">Accent</h6>
      <p className="text-neutral-700 text-xs">
        One accent runs the page — buttons, kickers and the closing banner.
      </p>
      <div className="mb-5 flex flex-wrap gap-2">
        {SWATCHES.map((hex) => (
          <button
            key={hex}
            type="button"
            title={hex}
            aria-label={`Accent ${hex}`}
            onClick={() => onChange((prev) => ({ ...prev, accent: hex }))}
            className="h-8 w-8 cursor-pointer"
            style={{
              background: hex,
              boxShadow:
                p.accent === hex
                  ? "inset 0 0 0 2px var(--color-bg), 0 0 0 2px var(--color-ink)"
                  : "none",
            }}
          />
        ))}
      </div>
      <div className="field mb-5">
        <label htmlFor="accent-hex">Hex</label>
        <input
          id="accent-hex"
          className="input"
          value={p.accent}
          onChange={(e) => onChange((prev) => ({ ...prev, accent: e.target.value }))}
        />
      </div>

      <h6 className="mb-2.5">Ground</h6>
      <div className="seg mb-5">
        {GROUNDS.map((g) => (
          <label key={g.id} className="seg-opt">
            <input
              type="radio"
              name="ground"
              checked={p.ground === g.id}
              onChange={() => onChange((prev) => ({ ...prev, ground: g.id }))}
            />
            {g.name}
          </label>
        ))}
      </div>

      <div className="border-divider border-t pt-3.5">
        <div className="mb-2 flex items-center gap-2.5">
          <span className="text-xs font-extrabold">Photography</span>
          <span className="tag tag-neutral ml-auto">Black &amp; white</span>
        </div>
        <p className="text-neutral-700 m-0 text-[11px]">
          Every image on the page is printed in grayscale.
        </p>
      </div>
    </>
  );
}

export function TypeControl({ p, onChange }: { p: Portfolio; onChange: Recipe }) {
  return (
    <>
      <h6 className="mb-1.5">Type pairing</h6>
      <p className="text-neutral-700 text-xs">
        Headline over body. Applies everywhere at once — the body stays Archivo,
        which is the system default.
      </p>
      <div className="mb-5 flex flex-col gap-0.5" style={stack}>
        {FONTS.map((face) => (
          <Row
            key={face.id}
            on={p.font === face.id}
            onClick={() => onChange((prev) => ({ ...prev, font: face.id }))}
          >
            <span
              className="w-[46px] flex-none text-2xl font-extrabold leading-none"
              style={{ fontFamily: `var(${face.cssVar})` }}
            >
              Aa
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="font-heading text-sm font-extrabold">{face.name}</span>
              <span className="text-neutral-700 text-[11px]">{face.sample}</span>
            </span>
          </Row>
        ))}
      </div>

      <h6 className="mb-2.5">Headline scale</h6>
      <div className="seg mb-5">
        {TYPE_SCALES.map((s) => (
          <label key={s.id} className="seg-opt">
            <input
              type="radio"
              name="typescale"
              checked={p.layout.scale === s.id}
              onChange={() =>
                onChange((prev) => ({ ...prev, layout: { ...prev.layout, scale: s.id } }))
              }
            />
            {s.name}
          </label>
        ))}
      </div>

      <div className="field">
        <label htmlFor="tracking">Letter spacing</label>
        <input
          id="tracking"
          className="input"
          value={p.layout.tracking}
          placeholder={DEFAULT_TRACKING}
          onChange={(e) =>
            onChange((prev) => ({
              ...prev,
              layout: { ...prev.layout, tracking: e.target.value },
            }))
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

/** Themes that read their navigation from the Layout panel rather than their own. */
const NAV_AWARE: ThemeId[] = ["editorial", "links", "ledger", "broadsheet"];

export function LayoutControl({ p, onChange }: { p: Portfolio; onChange: Recipe }) {
  const navApplies = NAV_AWARE.includes(p.theme);
  const themeName = THEMES.find((t) => t.id === p.theme)?.name ?? p.theme;

  return (
    <>
      <h6 className="mb-1.5">Role navigation</h6>
      <p className="text-neutral-700 text-xs">
        How visitors move between the things you do.
      </p>
      {!navApplies && (
        <p
          className="mb-3 text-[11px]"
          style={{ color: "var(--color-accent-700)" }}
          role="note"
        >
          {themeName} carries its own navigation — it is the reason you would pick
          it — so this setting is stored and does nothing until you switch theme.
        </p>
      )}
      <div className={`mb-5 flex flex-col gap-2.5 ${navApplies ? "" : "opacity-50"}`}>
        {ROLE_NAVS.map((n) => (
          <label key={n.id} className="radio">
            <input
              type="radio"
              name="rolenav"
              checked={p.layout.roleNav === n.id}
              onChange={() =>
                onChange((prev) => ({
                  ...prev,
                  layout: { ...prev.layout, roleNav: n.id },
                }))
              }
            />
            <span className="dot" />
            {n.name}
          </label>
        ))}
      </div>

      <h6 className="mb-2.5">Content grid</h6>
      <div className="seg mb-5">
        {([1, 2, 3] as GridCols[]).map((n) => (
          <label key={n} className="seg-opt">
            <input
              type="radio"
              name="gridcols"
              checked={p.layout.grid === n}
              onChange={() =>
                onChange((prev) => ({ ...prev, layout: { ...prev.layout, grid: n } }))
              }
            />
            {n} col
          </label>
        ))}
      </div>

      <h6 className="mb-2.5">Rules &amp; density</h6>
      <div className="flex flex-col gap-2.5">
        {DENSITIES.map((d) => (
          <label key={d.id} className="radio">
            <input
              type="radio"
              name="density"
              checked={p.layout.density === d.id}
              onChange={() =>
                onChange((prev) => ({
                  ...prev,
                  layout: { ...prev.layout, density: d.id },
                }))
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
