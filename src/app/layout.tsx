import type { Metadata } from "next";
import {
  Archivo,
  Bitter,
  DM_Sans,
  Fraunces,
  Inter,
  JetBrains_Mono,
  Lora,
  Manrope,
  Oswald,
  Playfair_Display,
  Roboto_Slab,
  Source_Serif_4,
  Space_Grotesk,
  Syne,
} from "next/font/google";
import "./globals.css";

// Archivo is the body face everywhere and the Modernist default headline, so
// it is the one face every page actually uses and the only one preloaded.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "600", "800"],
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

const fontVariables = [
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
]
  .map((face) => face.variable)
  .join(" ");

export const metadata: Metadata = {
  title: "FACET",
  description:
    "One page with a header and as many sections as you need. Keep a full one for everything you do, and short ones for the rooms where only part of it matters.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
