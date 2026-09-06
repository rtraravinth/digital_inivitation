"use client";

import type { Portfolio } from "@/lib/types";
import { Broadsheet } from "./themes/broadsheet";
import { Dossier } from "./themes/dossier";
import { Editorial } from "./themes/editorial";
import { IndexRail } from "./themes/index-rail";
import { Ledger } from "./themes/ledger";
import { Links } from "./themes/links";
import { Poster } from "./themes/poster";
import { Resume } from "./themes/resume";
import { Site } from "./themes/site";

export * from "./shared";
export { SectionDetail } from "./section-detail";
export { Broadsheet, Dossier, Editorial, IndexRail, Ledger, Links, Poster, Resume, Site };

export function PublishedBody({ p }: { p: Portfolio }) {
  switch (p.theme) {
    case "index":
      return <IndexRail p={p} />;
    case "poster":
      return <Poster p={p} />;
    case "links":
      return <Links p={p} />;
    case "ledger":
      return <Ledger p={p} />;
    case "dossier":
      return <Dossier p={p} />;
    case "broadsheet":
      return <Broadsheet p={p} />;
    case "resume":
      return <Resume p={p} />;
    case "site":
      return <Site p={p} />;
    default:
      return <Editorial p={p} />;
  }
}
