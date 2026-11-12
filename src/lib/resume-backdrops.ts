import { paperGround } from "./resume";
import type { Resume, ResumeBackdrop } from "./types";

/* ── resume backgrounds ───────────────────────────────────────────────────
   Decoration drawn behind the sheet's text: CSS background layers only,
   never an element, so the PDF's text layer — what an ATS reads — is
   exactly what it was without one. Each graphic is a small SVG drawn here in
   the resume's accent, so it follows the colour the author picks.

   Two kinds, because a printed resume is several pages but one sheet:
   - `page` layers repeat (a pattern, an edge stripe, a paper tint).
   - `corner` layers are placed once, at the top of the first page.
   In print all of them go on the page itself — `/resume/[id]` puts them on
   `html` — so a pattern reaches every page's edges, margins included, and
   a corner sits flush with the paper's top rather than below its margin.
   ──────────────────────────────────────────────────────────────────────── */

export type BgLayer = {
  image: string;
  size: string;
  position: string;
  repeat: string;
  /** How the swatch in the Style panel draws it, when the sheet's size would not fit a 56px tile. */
  preview?: string;
};

export const RESUME_BACKDROPS: Array<{ id: ResumeBackdrop; name: string; kind: "none" | "page" | "corner" }> = [
  { id: "none", name: "None", kind: "none" },
  { id: "dots", name: "Dots", kind: "page" },
  { id: "grid", name: "Grid", kind: "page" },
  { id: "diagonal", name: "Hatch", kind: "page" },
  { id: "hexagons", name: "Honeycomb", kind: "page" },
  { id: "topography", name: "Contours", kind: "page" },
  { id: "waves", name: "Waves", kind: "page" },
  { id: "triangles", name: "Triangles", kind: "page" },
  { id: "plus", name: "Crosses", kind: "page" },
  { id: "edge", name: "Edge stripe", kind: "page" },
  { id: "cream", name: "Cream paper", kind: "page" },
  { id: "wash", name: "Colour wash", kind: "corner" },
  { id: "rainbow", name: "Rainbow", kind: "corner" },
  { id: "arcs", name: "Arcs", kind: "corner" },
  { id: "circles", name: "Circles", kind: "corner" },
  { id: "lines", name: "Lines", kind: "corner" },
];

const svg = (w: number, h: number, body: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`,
  )}")`;

const tile = (image: string, w: number, h: number): BgLayer => ({
  image,
  size: `${w}px ${h}px`,
  position: "0 0",
  repeat: "repeat",
});

const corner = (image: string, w: string, h: string): BgLayer => ({
  image,
  size: `${w} ${h}`,
  position: "100% 0",
  repeat: "no-repeat",
  preview: "contain",
});

function hexagons(color: string): string {
  // Pointy-top hexagons on a honeycomb; the tile holds every centre whose
  // outline crosses it, and the tile's own edge clips the rest.
  const r = 10;
  const w = r * Math.sqrt(3);
  const outline = (cx: number, cy: number) =>
    [-90, -30, 30, 90, 150, 210]
      .map((a, i) => {
        const t = (a * Math.PI) / 180;
        return `${i ? "L" : "M"}${(cx + r * Math.cos(t)).toFixed(2)} ${(cy + r * Math.sin(t)).toFixed(2)}`;
      })
      .join("") + "Z";
  const d = [
    [0, 0],
    [w, 0],
    [w / 2, 15],
    [0, 30],
    [w, 30],
  ]
    .map(([x, y]) => outline(x, y))
    .join("");
  return svg(+w.toFixed(2), 30, `<path d='${d}' fill='none' stroke='${color}' stroke-opacity='.16' stroke-width='.7'/>`);
}

function topography(color: string): string {
  // Closed contours inside the tile, so no line has to meet itself across an edge.
  const loops = [
    "M40 60c10-28 52-34 70-12s4 52-24 56-56-16-46-44z",
    "M52 62c8-16 36-20 46-6s2 32-16 34-36-12-30-28z",
    "M64 63c4-7 17-8 21-2s0 14-8 15-16-6-13-13z",
    "M150 150c16-30 66-30 80-4s-6 56-40 56-56-22-40-52z",
    "M166 152c10-16 40-16 48 0s-4 32-24 32-34-14-24-32z",
    "M182 154c4-6 16-6 18 1s-2 12-10 12-12-6-8-13z",
    "M20 200c20-14 52-10 58 10s-16 34-38 30-34-28-20-40z",
    "M186 34c12-10 34-6 36 8s-12 24-26 20-20-18-10-28z",
  ];
  return svg(
    240,
    240,
    loops.map((d) => `<path d='${d}' fill='none' stroke='${color}' stroke-opacity='.15' stroke-width='.8'/>`).join(""),
  );
}

function pageLayers(id: ResumeBackdrop, c: string): BgLayer[] {
  switch (id) {
    case "dots":
      return [tile(svg(18, 18, `<circle cx='9' cy='9' r='1.1' fill='${c}' fill-opacity='.24'/>`), 18, 18)];
    case "grid":
      return [tile(svg(22, 22, `<path d='M22 .5H.5V22' fill='none' stroke='${c}' stroke-opacity='.11' stroke-width='.8'/>`), 22, 22)];
    case "diagonal":
      return [
        tile(
          svg(14, 14, `<path d='M-2 16L16-2M-2 2L2-2M12 16l4-4' stroke='${c}' stroke-opacity='.12' stroke-width='.8'/>`),
          14,
          14,
        ),
      ];
    case "hexagons":
      return [tile(hexagons(c), 17.32, 30)];
    case "topography":
      return [tile(topography(c), 240, 240)];
    case "waves":
      return [tile(svg(40, 16, `<path d='M0 8q10-8 20 0t20 0' fill='none' stroke='${c}' stroke-opacity='.15' stroke-width='.8'/>`), 40, 16)];
    case "triangles":
      return [
        tile(svg(28, 24, `<path d='M2 22 14 2l12 20z' fill='none' stroke='${c}' stroke-opacity='.11' stroke-width='.7'/>`), 28, 24),
      ];
    case "plus":
      return [
        tile(
          svg(32, 32, `<path d='M8 5v6M5 8h6M24 21v6M21 24h6' stroke='${c}' stroke-opacity='.22' stroke-width='1' stroke-linecap='round'/>`),
          32,
          32,
        ),
      ];
    case "edge":
      return [{ image: `linear-gradient(${c}, ${c})`, size: "3mm 100%", position: "0 0", repeat: "repeat-y", preview: "4px 100%" }];
    case "cream":
      return [{ image: "linear-gradient(#fbf6ec, #fbf6ec)", size: "100% 100%", position: "0 0", repeat: "repeat-y" }];
    default:
      return [];
  }
}

function cornerLayers(id: ResumeBackdrop, c: string): BgLayer[] {
  switch (id) {
    case "wash":
      return [
        {
          image: `linear-gradient(180deg, ${c}1f, ${c}00)`,
          size: "100% 110mm",
          position: "0 0",
          repeat: "no-repeat",
          preview: "100% 70%",
        },
      ];
    case "rainbow": {
      const colours = ["#f87171", "#fb923c", "#facc15", "#4ade80", "#60a5fa", "#a78bfa"];
      const lines = colours
        .map((k, i) => `<path d='M${70 + i * 22} 210 L${190 + i * 22} -10' stroke='${k}' stroke-width='9' stroke-linecap='round' stroke-opacity='.8'/>`)
        .join("");
      return [corner(svg(320, 200, lines), "62mm", "39mm")];
    }
    case "arcs":
      return [
        corner(
          svg(
            240,
            240,
            Array.from({ length: 9 }, (_, i) => `<circle cx='240' cy='0' r='${40 + i * 22}' fill='none' stroke='${c}' stroke-opacity='${(0.26 - i * 0.022).toFixed(3)}' stroke-width='1'/>`).join(""),
          ),
          "64mm",
          "64mm",
        ),
      ];
    case "circles":
      return [
        corner(
          svg(
            260,
            220,
            `<circle cx='220' cy='30' r='120' fill='${c}' fill-opacity='.07'/><circle cx='120' cy='40' r='46' fill='${c}' fill-opacity='.06'/><circle cx='250' cy='170' r='34' fill='${c}' fill-opacity='.08'/>`,
          ),
          "68mm",
          "58mm",
        ),
      ];
    case "lines":
      return [
        corner(
          svg(
            240,
            180,
            Array.from({ length: 7 }, (_, i) => `<path d='M${60 + i * 18} 190 L${200 + i * 18} -10' stroke='${c}' stroke-opacity='${(0.08 + i * 0.03).toFixed(2)}' stroke-width='3' stroke-linecap='round'/>`).join(""),
          ),
          "60mm",
          "45mm",
        ),
      ];
    default:
      return [];
  }
}

/**
 * How strongly a background pattern is drawn, against what each was tuned
 * at: half. A pattern keeps the accent — the colour the author picked, which
 * is also the headings' — but at full strength it sat too bright behind the
 * text it decorates. Every kind, full-page and corner alike.
 */
const PATTERN_STRENGTH = 0.5;

/** Every opacity in a layer — an SVG's, or a colour's alpha — scaled down. */
function softened(layer: BgLayer): BgLayer {
  let image = layer.image;
  if (image.startsWith("url(")) {
    // The SVG is URI-encoded: `fill-opacity='.24'` reads `fill-opacity%3D'.24'`.
    image = image.replace(
      /(opacity%3D')([\d.]+)(')/g,
      (_, a: string, v: string, b: string) => `${a}${+(parseFloat(v) * PATTERN_STRENGTH).toFixed(3)}${b}`,
    );
  } else if (image !== "linear-gradient(#fbf6ec, #fbf6ec)") {
    // A gradient in the accent: halve each colour's alpha, a bare #rrggbb
    // counting as fully opaque. Cream paper is a tint, not the accent.
    image = image.replace(/#([0-9a-f]{6})([0-9a-f]{2})?\b/gi, (_, rgb: string, al?: string) => {
      const alpha = Math.round((al ? parseInt(al, 16) : 255) * PATTERN_STRENGTH);
      return `#${rgb}${alpha.toString(16).padStart(2, "0")}`;
    });
  }
  return { ...layer, image };
}

export function backdropLayers(id: ResumeBackdrop, accent: string): { page: BgLayer[]; corner: BgLayer[] } {
  return { page: pageLayers(id, accent).map(softened), corner: cornerLayers(id, accent).map(softened) };
}

/** The paper ground (`paperGround()`) as a bottom layer, so decoration can sit over it. */
export function groundLayer(ground: string): BgLayer[] {
  return ground.startsWith("linear-gradient")
    ? // Repeats: on the printed page "100%" is one page tall, not the document.
      [{ image: ground, size: "100% 100%", position: "0 0", repeat: "repeat-y" }]
    : [];
}

/** Layers as the four background properties, plus the colour under them. */
export function layerStyle(layers: BgLayer[], color = "#fff", preview = false) {
  if (layers.length === 0)
    return { backgroundColor: color, backgroundImage: "none", backgroundSize: "auto", backgroundPosition: "0 0", backgroundRepeat: "no-repeat" };
  return {
    backgroundColor: color,
    backgroundImage: layers.map((l) => l.image).join(", "),
    backgroundSize: layers.map((l) => (preview && l.preview) || l.size).join(", "),
    backgroundPosition: layers.map((l) => l.position).join(", "),
    backgroundRepeat: layers.map((l) => l.repeat).join(", "),
  };
}

/** The same, as a declaration block for a `<style>` rule. */
export function layerCss(layers: BgLayer[], color = "#fff"): string {
  const s = layerStyle(layers, color);
  return [
    `background-color: ${s.backgroundColor} !important;`,
    `background-image: ${s.backgroundImage} !important;`,
    `background-size: ${s.backgroundSize} !important;`,
    `background-position: ${s.backgroundPosition} !important;`,
    `background-repeat: ${s.backgroundRepeat} !important;`,
  ].join(" ");
}

/** Every layer behind a resume, top first, ending with its paper ground. */
export function sheetLayers(resume: Resume): BgLayer[] {
  const { page, corner } = backdropLayers(resume.style.backdrop, resume.style.accent);
  return [...corner, ...page, ...groundLayer(paperGround(resume))];
}
