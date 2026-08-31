"use client";

import { FONTS, GROUNDS, SWATCHES, THEMES, type Portfolio } from "@/lib/types";

function Thumb({ theme, accent }: { theme: string; accent: string }) {
  const base = "flex-none w-[46px] h-[38px] border";
  if (theme === "index") {
    return (
      <span
        className={`${base} grid grid-cols-[14px_1fr]`}
        style={{ borderColor: "var(--color-divider)", background: "var(--color-bg)" }}
      >
        <span style={{ background: accent }} />
        <span className="flex flex-col justify-center gap-[3px] px-1">
          <span className="bg-neutral-400 h-[2px] w-full" />
          <span className="bg-neutral-400 h-[2px] w-full" />
          <span className="bg-neutral-400 h-[2px] w-2/3" />
        </span>
      </span>
    );
  }
  if (theme === "poster") {
    return (
      <span className={base} style={{ borderColor: "var(--color-divider)", background: accent }}>
        <span className="flex h-full flex-col justify-end gap-[3px] p-1">
          <span className="h-[6px] w-2/3 bg-white/90" />
          <span className="h-[2px] w-1/2 bg-white/60" />
        </span>
      </span>
    );
  }
  return (
    <span
      className={`${base} flex flex-col gap-[3px] p-1`}
      style={{ borderColor: "var(--color-divider)", background: "var(--color-bg)" }}
    >
      <span className="h-[5px] w-3/4" style={{ background: accent }} />
      <span className="grid flex-1 grid-cols-2 gap-[2px]">
        <span className="bg-neutral-300" />
        <span className="bg-neutral-300" />
      </span>
    </span>
  );
}

export function ThemePanel({
  portfolio,
  onChange,
  onClose,
}: {
  portfolio: Portfolio;
  onChange: (recipe: (p: Portfolio) => Portfolio) => void;
  onClose: () => void;
}) {
  return (
    <aside
      className="border-divider bg-bg fixed right-0 top-0 z-40 flex h-full w-full flex-col sm:w-[336px] overflow-y-auto border-l-2"
      aria-label="Theme"
    >
      <div className="border-divider flex items-center border-b-2 px-4 py-3">
        <span className="font-heading text-[15px] font-extrabold">Theme</span>
        <button type="button" className="btn btn-ghost ml-auto" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="p-[18px]">
        <h6 className="mb-1.5">Theme</h6>
        <p className="text-neutral-700 text-xs">
          Changes the whole page structure. Your content stays where it is.
        </p>
        <div
          className="flex flex-col gap-0.5"
          style={{
            background: "var(--color-divider)",
            borderBlock: "2px solid var(--color-divider)",
          }}
        >
          {THEMES.map((t) => {
            const on = portfolio.theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange((p) => ({ ...p, theme: t.id }))}
                className="flex cursor-pointer items-center gap-3 p-3 text-left"
                style={{ background: on ? "var(--color-surface)" : "var(--color-bg)" }}
              >
                <Thumb theme={t.id} accent={portfolio.accent} />
                <span className="flex flex-col gap-0.5">
                  <span className="font-heading text-sm font-extrabold">{t.name}</span>
                  <span className="text-neutral-700 text-[11px]">{t.desc}</span>
                </span>
                <span
                  className="ml-auto font-extrabold"
                  style={{ color: on ? "var(--color-accent)" : "transparent" }}
                >
                  ✓
                </span>
              </button>
            );
          })}
        </div>

        <h6 className="mb-1.5 mt-6">Accent</h6>
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
              onClick={() => onChange((p) => ({ ...p, accent: hex }))}
              className="h-8 w-8 cursor-pointer"
              style={{
                background: hex,
                boxShadow:
                  portfolio.accent === hex
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
            value={portfolio.accent}
            onChange={(e) => onChange((p) => ({ ...p, accent: e.target.value }))}
          />
        </div>

        <h6 className="mb-2.5">Ground</h6>
        <div className="seg mb-5">
          {GROUNDS.map((g) => (
            <label key={g.id} className="seg-opt">
              <input
                type="radio"
                name="ground"
                checked={portfolio.ground === g.id}
                onChange={() => onChange((p) => ({ ...p, ground: g.id }))}
              />
              {g.name}
            </label>
          ))}
        </div>

        <h6 className="mb-1.5">Type pairing</h6>
        <p className="text-neutral-700 text-xs">
          Headline over body. Applies everywhere at once — the body stays Archivo,
          which is the system default.
        </p>
        <div
          className="mb-5 flex flex-col gap-0.5"
          style={{
            background: "var(--color-divider)",
            borderBlock: "2px solid var(--color-divider)",
          }}
        >
          {FONTS.map((face) => {
            const on = portfolio.font === face.id;
            return (
              <button
                key={face.id}
                type="button"
                onClick={() => onChange((p) => ({ ...p, font: face.id }))}
                className="flex cursor-pointer items-center gap-3 p-3 text-left"
                style={{ background: on ? "var(--color-surface)" : "var(--color-bg)" }}
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
                <span
                  className="ml-auto font-extrabold"
                  style={{ color: on ? "var(--color-accent)" : "transparent" }}
                >
                  ✓
                </span>
              </button>
            );
          })}
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
      </div>
    </aside>
  );
}
