"use client";

import { withPageBlocks } from "@/lib/resume";
import type { Portfolio } from "@/lib/types";
import { Arcade } from "./themes/arcade";
import { Aurora } from "./themes/aurora";
import { Journey } from "./themes/journey";
import { Meridian } from "./themes/meridian";
import { Stage } from "./themes/stage";

export * from "./shared";
export { SectionDetail } from "./section-detail";
export { Arcade, Aurora, Journey, Meridian, Stage };

/**
 * Every theme, the builder canvas, the card previews and /print come through
 * here, so this is where the structured blocks switched on for the page join
 * the sections — once, for all five themes.
 */
export function PublishedBody({ p: raw }: { p: Portfolio }) {
  const p = withPageBlocks(raw);
  switch (p.theme) {
    case "meridian":
      return <Meridian p={p} />;
    case "stage":
      return <Stage p={p} />;
    case "arcade":
      return <Arcade p={p} />;
    case "journey":
      return <Journey p={p} />;
    default:
      return <Aurora p={p} />;
  }
}
