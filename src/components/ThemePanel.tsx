"use client";

import Link from "next/link";
import {
  ColourControl,
  LayoutControl,
  MotionControl,
  ProfessionControl,
  ThemeControl,
  TypeControl,
} from "./builder/controls";
import type { Portfolio } from "@/lib/types";

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
      className="border-divider bg-bg fixed right-0 top-0 z-40 flex h-full w-full flex-col overflow-y-auto border-l sm:w-[336px]"
      aria-label="Theme"
    >
      <div className="border-divider flex items-center border-b px-4 py-3">
        <span className="font-heading text-[15px]">Theme</span>
        <button type="button" className="btn btn-ghost ml-auto" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="p-[18px]">
        <ProfessionControl p={portfolio} onChange={onChange} />
        <ThemeControl p={portfolio} onChange={onChange} />

        <div className="mt-3">
          <Link href={`/themes/${portfolio.id}`} className="btn btn-secondary btn-block">
            Open the theme gallery
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
          <MotionControl p={portfolio} onChange={onChange} />
        </div>

        <div className="border-divider mt-6 border-t pt-4">
          <LayoutControl p={portfolio} onChange={onChange} />
        </div>
      </div>
    </aside>
  );
}
