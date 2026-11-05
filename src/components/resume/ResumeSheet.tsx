"use client";

import { useState } from "react";
import { ResumeDocument } from "./ResumeDocument";
import { MM, sheetMetrics } from "@/lib/resume";
import type { Portfolio } from "@/lib/types";

/**
 * The resume at the width of whatever holds it, with its page breaks marked.
 *
 * The sheet is laid out at true size (mm and pt) and scaled with a
 * transform, so what the preview wraps is what the PDF wraps. It is one
 * continuous sheet rather than separate pages: the printer splits it, and
 * where a break lands depends on which entries refuse to split. The dashed
 * lines are where each page's room runs out — close to where the PDF breaks,
 * and the page count beside them is exact enough to keep a resume to one.
 *
 * Both observers are wired in ref callbacks, not effects — setting state
 * straight from an effect body trips the React Compiler lint.
 */
export function ResumeSheet({
  p,
  maxScale = 1,
  onPages,
  shadow = true,
}: {
  p: Portfolio;
  maxScale?: number;
  /** Told how many pages the resume runs to, whenever that changes. */
  onPages?: (pages: number) => void;
  shadow?: boolean;
}) {
  const m = sheetMetrics(p.resume);
  const pageW = m.paper.w * MM;
  const pageH = m.paper.h * MM;
  const room = (m.paper.h - m.marginY * 2) * MM;

  const [width, setWidth] = useState(0);
  const [contentH, setContentH] = useState(0);

  const scale = width ? Math.min(maxScale, width / pageW) : 0;
  const pages = Math.max(1, Math.ceil((contentH - m.marginY * 2 * MM - 1) / room));
  const breaks = Array.from({ length: pages - 1 }, (_, i) => m.marginY * MM + room * (i + 1));

  return (
    <div
      ref={(node) => {
        if (!node) return;
        const view = node.ownerDocument.defaultView;
        if (!view?.ResizeObserver) return;
        const ro = new view.ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
        ro.observe(node);
        return () => ro.disconnect();
      }}
      className="w-full"
    >
      {scale > 0 && (
        <div className="mx-auto" style={{ width: pageW * scale, height: pages * pageH * scale }}>
          <div
            className="relative origin-top-left"
            style={{
              width: pageW,
              height: pages * pageH,
              transform: `scale(${scale})`,
              background: "#fff",
              boxShadow: shadow ? "0 1px 2px rgb(0 0 0 / 0.08), 0 12px 40px -12px rgb(0 0 0 / 0.28)" : undefined,
              borderRadius: 2,
            }}
          >
            <div
              ref={(node) => {
                if (!node) return;
                const view = node.ownerDocument.defaultView;
                if (!view?.ResizeObserver) return;
                const ro = new view.ResizeObserver(() => {
                  const h = node.offsetHeight;
                  // The builder mounts a desktop and a phone sheet at once and
                  // hides one; a hidden sheet measures 0 and must not report.
                  if (h === 0) return;
                  setContentH(h);
                  onPages?.(Math.max(1, Math.ceil((h - m.marginY * 2 * MM - 1) / room)));
                });
                ro.observe(node);
                return () => ro.disconnect();
              }}
            >
              <ResumeDocument p={p} />
            </div>
            {breaks.map((y, i) => (
              <div
                key={i}
                aria-hidden
                className="pointer-events-none absolute inset-x-0"
                style={{ top: y, borderTop: "1.5px dashed #a1a1aa" }}
              >
                <span
                  className="absolute right-3 -translate-y-1/2 rounded-full px-2.5 py-0.5"
                  style={{ background: "#18181b", color: "#fff", font: "600 11px/1.4 system-ui, sans-serif" }}
                >
                  Page {i + 2}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
