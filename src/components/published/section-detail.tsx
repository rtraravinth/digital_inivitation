"use client";

import Link from "next/link";
import type { Portfolio, Section } from "@/lib/types";
import {
  Media,
  SectionAside,
  SectionLinks,
  groundStyle,
  headline,
  usePageHref,
  visibleSections,
} from "./shared";

/* ── 1d Section detail — one entry on its own page ────────────────────── */

export function SectionDetail({ p, section }: { p: Portfolio; section: Section }) {
  const pageHref = usePageHref(p);
  const index = visibleSections(p).findIndex((s) => s.id === section.id);
  const total = visibleSections(p).length;

  return (
    <div style={groundStyle(p)}>
      <div
        className="flex items-center gap-2.5 px-4 py-3"
        style={{ borderBottom: "2px solid var(--color-divider)" }}
      >
        <Link href={pageHref} className="btn btn-secondary">
          ← Back
        </Link>
        <span
          className="ml-auto text-[12px]"
          style={{ color: "var(--color-neutral-700)" }}
        >
          {index >= 0 ? `Entry ${index + 1} / ${total}` : p.header.name}
        </span>
      </div>

      <div className="mx-auto w-full max-w-[720px]">
        <Media asset={section.image} className="h-[180px] w-full md:h-[280px]" />

        <div className="px-4 py-5 md:px-6">
          <span className="card-kicker">{section.tab}</span>
          <h1 className="m-0 mb-2.5 mt-2 leading-tight" style={headline("clamp(28px, 5vw, 40px)")}>
            {section.title}
          </h1>
          <p className="m-0 text-[15px]" style={{ color: "var(--color-neutral-800)" }}>
            {section.description}
          </p>
        </div>

        <div className="px-4 py-4 md:px-6">
          <div className="flex flex-col gap-3">
            <SectionAside p={p} section={section} />
            <SectionLinks p={p} section={section} />
          </div>
        </div>
      </div>
    </div>
  );
}

