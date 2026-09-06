"use client";

import type { Portfolio } from "@/lib/types";
import { Editorial } from "./themes/editorial";
import { Links } from "./themes/links";
import { Poster } from "./themes/poster";
import { Resume } from "./themes/resume";
import { Site } from "./themes/site";

export * from "./shared";
export { SectionDetail } from "./section-detail";
export { Editorial, Links, Poster, Resume, Site };

export function PublishedBody({ p }: { p: Portfolio }) {
  switch (p.theme) {
    case "resume":
      return <Resume p={p} />;
    case "poster":
      return <Poster p={p} />;
    case "links":
      return <Links p={p} />;
    case "site":
      return <Site p={p} />;
    default:
      return <Editorial p={p} />;
  }
}
