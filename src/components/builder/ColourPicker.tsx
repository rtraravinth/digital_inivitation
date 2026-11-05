"use client";

import { useState } from "react";
import { isHexColour, readHexColour } from "@/lib/types";

/* ── colour maths ─────────────────────────────────────────────────────── */

type Hsv = { h: number; s: number; v: number };

function hexToHsv(hex: string): Hsv {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const span = max - Math.min(r, g, b);

  let h = 0;
  if (span !== 0) {
    if (max === r) h = ((g - b) / span) % 6;
    else if (max === g) h = (b - r) / span + 2;
    else h = (r - g) / span + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max === 0 ? 0 : span / max, v: max };
}

function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return `#${[r, g, b]
    .map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

/* ── drag surface ─────────────────────────────────────────────────────── */

/**
 * A box that reports where it was pressed or dragged, as a 0–1 fraction of
 * its own width and height.
 *
 * Pointer capture rather than listeners on the document: the pointer keeps
 * reporting to this element once it is captured, so a drag that leaves the
 * box still tracks and there is nothing to tear down.
 */
function Surface({
  className,
  style,
  onPoint,
  onKeyDown,
  label,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  onPoint: (x: number, y: number) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  label: string;
  children?: React.ReactNode;
}) {
  const point = (e: React.PointerEvent) => {
    const box = e.currentTarget.getBoundingClientRect();
    onPoint(clamp((e.clientX - box.left) / box.width), clamp((e.clientY - box.top) / box.height));
  };

  return (
    <div
      role="application"
      aria-label={label}
      tabIndex={0}
      className={`relative cursor-crosshair touch-none outline-offset-2 ${className ?? ""}`}
      style={style}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        point(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) point(e);
      }}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}

/** A square marker, because the design system puts radius at 0 everywhere. */
function Marker({ left, top }: { left: string; top: string }) {
  return (
    <span
      className="pointer-events-none absolute block h-3 w-3"
      style={{
        left,
        top,
        transform: "translate(-50%, -50%)",
        boxShadow: "inset 0 0 0 2px #fff, 0 0 0 1px rgba(0,0,0,.55)",
      }}
    />
  );
}

/* ── the picker ───────────────────────────────────────────────────────── */

/**
 * An always-visible colour picker: a saturation/value box over a hue slider,
 * with a hex field under it.
 *
 * Hand-rolled rather than `<input type="color">` because that one is only a
 * button — it shows a swatch and opens the operating system's dialog on
 * click, and cannot render its own controls inline.
 *
 * Hue is held in state instead of read back from the colour every time. A
 * grey has no hue and black has no hue or saturation, so `hexToHsv` reports
 * 0 for them; without this the marker would snap to red the moment you
 * dragged the value down to black.
 */
export function ColourPicker({
  id,
  name,
  value,
  onPick,
}: {
  id: string;
  /** What this colour is. Both hex fields read "Hex" on screen, so the
   *  accessible names come from here. */
  name: string;
  value: string;
  onPick: (hex: string) => void;
}) {
  const hsv = hexToHsv(isHexColour(value) ? value : "#000000");
  const [hue, setHue] = useState(hsv.h);
  const [seen, setSeen] = useState(value);
  const [draft, setDraft] = useState<string | null>(null);

  // Adjusting state during render, which is how React wants a value derived
  // from a prop kept in sync. Only a colour that actually has a hue updates
  // the slider, so dragging into the greys leaves it where the user put it.
  if (value !== seen) {
    setSeen(value);
    if (hsv.s > 0 && hsv.v > 0) setHue(hsv.h);
  }

  const pick = (next: Partial<Hsv>) => {
    setDraft(null);
    // The slider is the only record of hue, so a change to it has to land in
    // state as well as in the colour.
    if (next.h !== undefined) setHue(next.h);
    onPick(hsvToHex({ h: hue, s: hsv.s, v: hsv.v, ...next }));
  };

  const nudge = (e: React.KeyboardEvent, axes: Record<string, Partial<Hsv>>) => {
    const move = axes[e.key];
    if (!move) return;
    e.preventDefault();
    pick(move);
  };

  const step = arrowSteps(hsv, hue);

  return (
    <div className="field">
      <div
        className="mb-2.5"
        style={{ border: "1px solid var(--color-divider)" }}
      >
        <Surface
          label={`${name} saturation and brightness`}
          className="h-[124px]"
          style={{
            backgroundColor: hsvToHex({ h: hue, s: 1, v: 1 }),
            backgroundImage:
              "linear-gradient(to right, #fff, transparent), linear-gradient(to top, #000, transparent)",
          }}
          onPoint={(x, y) => pick({ s: x, v: 1 - y })}
          onKeyDown={(e) => nudge(e, step.satval)}
        >
          <Marker left={`${hsv.s * 100}%`} top={`${(1 - hsv.v) * 100}%`} />
        </Surface>
        <Surface
          label={`${name} hue`}
          className="h-4"
          style={{
            borderTop: "1px solid var(--color-divider)",
            backgroundImage:
              "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
          }}
          onPoint={(x) => pick({ h: x * 360 })}
          onKeyDown={(e) => nudge(e, step.hue)}
        >
          <span
            className="pointer-events-none absolute top-0 block h-full w-[3px]"
            style={{
              left: `${(hue / 360) * 100}%`,
              transform: "translateX(-50%)",
              boxShadow: "inset 0 0 0 1px #fff, 0 0 0 1px rgba(0,0,0,.55)",
            }}
          />
        </Surface>
      </div>

      <label htmlFor={id}>Hex</label>
      <input
        id={id}
        className="input"
        aria-label={`${name} hex`}
        spellCheck={false}
        value={draft ?? value}
        // Only a complete #rrggbb commits. Writing every keystroke is what
        // the accent field used to do, and it meant typing `#ec3013` sent
        // `#e`, `#ec`, `#ec3` — values the API rejects — so the first
        // characters of any hand-typed colour raised a save-failed banner.
        onChange={(e) => {
          setDraft(e.target.value);
          const hex = readHexColour(e.target.value);
          if (hex) onPick(hex);
        }}
        onBlur={() => setDraft(null)}
      />
    </div>
  );
}

/** Arrow-key steps, so the picker is reachable without a pointer. */
function arrowSteps(hsv: Hsv, hue: number) {
  return {
    satval: {
      ArrowLeft: { s: clamp(hsv.s - 0.02) },
      ArrowRight: { s: clamp(hsv.s + 0.02) },
      ArrowDown: { v: clamp(hsv.v - 0.02) },
      ArrowUp: { v: clamp(hsv.v + 0.02) },
    },
    hue: {
      ArrowLeft: { h: (hue - 2 + 360) % 360 },
      ArrowRight: { h: (hue + 2) % 360 },
      ArrowDown: { h: (hue - 2 + 360) % 360 },
      ArrowUp: { h: (hue + 2) % 360 },
    },
  };
}
