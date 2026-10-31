"use client";

import type { Portfolio } from "@/lib/types";
import { Arcade } from "./themes/arcade";
import { Aurora } from "./themes/aurora";
import { Journey } from "./themes/journey";
import { Meridian } from "./themes/meridian";
import { Stage } from "./themes/stage";

export * from "./shared";
export { SectionDetail } from "./section-detail";
export { Arcade, Aurora, Journey, Meridian, Stage };

export function PublishedBody({ p }: { p: Portfolio }) {
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
