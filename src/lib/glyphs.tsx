/**
 * The product's interface glyphs — close, move, outbound, download.
 *
 * Deliberately **not** in `ICONS` (`src/lib/icons.tsx`): that record backs the
 * editor's icon picker and `ICON_LIST`, and a close button is not something an
 * author should be offered for a link. This module is the separate home that
 * comment always implied, so the published page and the owner's chrome draw
 * the same marks from one place instead of two.
 *
 * They replace the `✕ ↓ › → ↗` characters the interface used to print. A
 * character takes whatever size, weight and baseline the surrounding face
 * gives it, and the surrounding face is now a didone — where several of those
 * characters are a different shape again, and half of them sat off the
 * baseline in the fourteen author faces before that.
 *
 * One stroke weight, one cap, one join, drawn on the same 24px grid.
 */
const GLYPH_PATHS = {
  out: "M7 17 17 7M8 7h9v9",
  up: "M12 20V5m-6 6 6-6 6 6",
  down: "M12 4v15m6-6-6 6-6-6",
  chevron: "m9 6 6 6-6 6",
  back: "m15 6-6 6 6 6",
  download: "M12 3v12m-5-4 5 5 5-5M4 20h16",
  close: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  check: "m4 12 5 5L20 6",
  arrow: "M4 12h15m-6-6 6 6-6 6",
} as const;

export type GlyphId = keyof typeof GLYPH_PATHS;

export function Glyph({ id, size = 17 }: { id: GlyphId; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className="flex-none"
    >
      <path d={GLYPH_PATHS[id]} />
    </svg>
  );
}
