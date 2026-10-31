import type { Metadata } from "next";
import {
  Archivo,
  Bitter,
  Bodoni_Moda,
  DM_Sans,
  Fraunces,
  Inter,
  JetBrains_Mono,
  Lexend,
  Lora,
  Manrope,
  Oswald,
  Outfit,
  Playfair_Display,
  Roboto_Slab,
  Schibsted_Grotesk,
  Source_Serif_4,
  Space_Grotesk,
  Syne,
} from "next/font/google";
import "./globals.css";

/**
 * The two house faces of the Catalogue system, and the only two preloaded.
 *
 * Bodoni Moda sets half-titles and plate numbers: a catalogue's didone, with a
 * real optical-size axis, so the same family holds at a 12px plate number and
 * at a 120px half-title instead of going spindly at one end. Schibsted
 * Grotesk sets captions, body and every control — a newspaper grotesk whose
 * small sizes stay legible, which is what a caption is.
 *
 * Both are used on every route, which is the whole test for preloading:
 * preload is per-family, not per-page, so a face that only some portfolios
 * pick must not have it (see the alternates below).
 */
const bodoni = Bodoni_Moda({
  variable: "--font-bodoni-moda",
  subsets: ["latin"],
});
const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted-grotesk",
  subsets: ["latin"],
});

// Archivo was the Modernist body and headline face. The Catalogue world
// discards Modernist, so Archivo keeps only its place among the author-pickable
// alternates — and therefore loses its preload with everything else there.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  preload: false,
});

/**
 * Opt-in headline alternates, chosen per portfolio in the Type panel.
 *
 * `preload: false` on every one of them. Preloading is per-family, not
 * per-page, so with it on all fourteen would be fetched on every page load to
 * serve the one a portfolio actually picked — the three we had already cost
 * ~93KB that way. Without it a face is fetched only when text renders in it,
 * which is what `display: swap` (next/font's default) is for.
 *
 * The two house faces are the exception and are declared above with preload
 * on, because every page renders them whatever a portfolio picks. They are
 * also offered here as author choices, which is why they appear in `FONTS`
 * with the same `cssVar` names.
 *
 * No `weight` array: each of these is a variable font, so leaving it off
 * ships one file covering the whole axis instead of one file per weight.
 * Headings ask for 800 and the axis clamps where a family stops short —
 * Space Grotesk, Lora and Oswald top out at 700 — which is a real weight
 * rather than the smeared faux-bold a single-weight face would get.
 */
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], preload: false });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], preload: false });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], preload: false });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], preload: false });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], preload: false });
const playfair = Playfair_Display({ variable: "--font-playfair-display", subsets: ["latin"], preload: false });
const sourceSerif = Source_Serif_4({ variable: "--font-source-serif-4", subsets: ["latin"], preload: false });
const lora = Lora({ variable: "--font-lora", subsets: ["latin"], preload: false });
const robotoSlab = Roboto_Slab({ variable: "--font-roboto-slab", subsets: ["latin"], preload: false });
const bitter = Bitter({ variable: "--font-bitter", subsets: ["latin"], preload: false });
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"], preload: false });
const syne = Syne({ variable: "--font-syne", subsets: ["latin"], preload: false });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], preload: false });
const lexend = Lexend({ variable: "--font-lexend", subsets: ["latin"], preload: false });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], preload: false });

const fontVariables = [
  bodoni,
  schibsted,
  archivo,
  inter,
  dmSans,
  spaceGrotesk,
  manrope,
  fraunces,
  playfair,
  sourceSerif,
  lora,
  robotoSlab,
  bitter,
  oswald,
  syne,
  jetbrainsMono,
  lexend,
  outfit,
]
  .map((face) => face.variable)
  .join(" ");

export const metadata: Metadata = {
  title: "Facet",
  description:
    "One page with a header and as many sections as you need. Keep a full one for everything you do, and short ones for the rooms where only part of it matters.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/*
          The themes' reveal-on-scroll starts every block at `opacity: 0` and a
          client-side observer adds `.in`. `/p/[...slug]` is a server
          component on purpose and every other theme degrades to
          static-but-readable, so without this a visitor with JavaScript off
          — or a page whose hydration failed — got a sticky nav over a blank
          page. The reduced-motion and print escapes in globals.css are the
          same idea; this is the third. It needs no `!important`: `.reveal`
          lives in `@layer components`, and an unlayered rule beats a layered
          one whatever the specificity.
        */}
        <noscript>
          <style>
            {".reveal, .reveal.in, .fx-reveal, .fx-words .fx-w { opacity: 1; transform: none; filter: none; }"}
          </style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
