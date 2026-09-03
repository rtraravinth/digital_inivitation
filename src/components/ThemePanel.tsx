"use client";

import Link from "next/link";
import {
  ColourControl,
  LayoutControl,
  ThemeControl,
  TypeControl,
} from "./builder/controls";
import { THEMES, type Portfolio } from "@/lib/types";

/**
 * The document editor's own theme drawer. The three-pane builder at
 * /builder/[id] puts the same controls in a tabbed inspector beside a live
 * canvas; both read from components/builder/controls.tsx so the two can
 * never drift apart.
 */
export function ThemePanel({
  portfolio,
  onChange,
  onClose,
}: {
  portfolio: Portfolio;
  onChange: (recipe: (p: Portfolio) => Portfolio) => void;
  onClose: () => void;
}) {
  return (
    <aside
      className="border-divider bg-bg fixed right-0 top-0 z-40 flex h-full w-full flex-col overflow-y-auto border-l-2 sm:w-[336px]"
      aria-label="Theme"
    >
      <div className="border-divider flex items-center border-b-2 px-4 py-3">
        <span className="font-heading text-[15px] font-extrabold">Theme</span>
        <button type="button" className="btn btn-ghost ml-auto" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="p-[18px]">
        <ThemeControl p={portfolio} onChange={onChange} />

        <div className="mt-3">
          <Link href={`/themes/${portfolio.id}`} className="btn btn-secondary btn-block">
            Browse all {THEMES.length} themes
          </Link>
          <Link href={`/builder/${portfolio.id}`} className="btn btn-secondary btn-block">
            Open the visual builder
          </Link>
        </div>

        <div className="mt-6">
          <ColourControl p={portfolio} onChange={onChange} />
        </div>

        <div className="mt-6">
          <TypeControl p={portfolio} onChange={onChange} />
        </div>

        <div className="border-divider mt-6 border-t pt-4">
          <LayoutControl p={portfolio} onChange={onChange} />
        </div>
      </div>
    </aside>
  );
}
