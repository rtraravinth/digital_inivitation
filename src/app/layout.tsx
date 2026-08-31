import type { Metadata } from "next";
import { Archivo, Fraunces, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Archivo is the body face everywhere and the Modernist default headline.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "600", "800"],
});

// Opt-in headline alternates, chosen per portfolio in the Theme panel.
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FACET",
  description:
    "One page with a header and as many sections as you need. Keep a full one for everything you do, and short ones for the rooms where only part of it matters.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${fraunces.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
