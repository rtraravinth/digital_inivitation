"use client";

import { useCallback, useState } from "react";
import {
  PreviewProvider,
  PublishedBody,
  PublishedHandleProvider,
} from "./published/themes";
import type { Portfolio } from "@/lib/types";

/**
 * A portfolio's real first screen, in miniature.
 *
 * Not a screenshot and not a sketch of the theme: the published page itself,
 * rendered at a device width and scaled down to whatever box it is given, so
 * an edit shows on the card the moment it is saved.
 *
 * - **Still.** Rendered with motion off, so every reveal is already in place
 *   and nothing loops — a thumbnail that animates is a distraction, and a
 *   reveal that never fires would leave it blank.
 * - **Inert.** Nothing inside can be clicked, focused or read out; the card
 *   around it carries the real links. It is a picture of the page.
 * - **A preview.** `PreviewProvider` keeps it out of the analytics, the same
 *   as every other owner-side render.
 * - **Lazy.** It mounts when the card comes within a screen of the viewport,
 *   so a long list does not render every page up front.
 * - **Isolated.** `isolation: isolate` keeps the page's own z-indexed layers
 *   (a sticky nav at z-30) from stacking over the card's menu next door.
 *
 * The page lays out at a device width — desktop, or a phone's on a phone —
 * because its breakpoints answer to the window, and a desktop layout squeezed
 * into a phone's card would be neither.
 */
export function PagePreview({ p, handle }: { p: Portfolio; handle: string }) {
  const [width, setWidth] = useState(0);
  const [near, setNear] = useState(false);

  // A ref callback, not an effect: both observers report into state, which
  // the React Compiler lint refuses from an effect body.
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(node);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNear(true);
        io.disconnect();
      },
      { rootMargin: "100% 0px" },
    );
    io.observe(node);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  const device = typeof window !== "undefined" && window.innerWidth < 768 ? 390 : 1280;
  const scale = width > 0 ? width / device : 0;
  const still: Portfolio = { ...p, layout: { ...p.layout, motion: "off" } };

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden" style={{ isolation: "isolate" }}>
      {near && scale > 0 && (
        <div
          inert
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 origin-top-left overflow-hidden select-none"
          // Clipped to the first screen at the card's own 16:10. Without it
          // the layer is the whole page — 1280 × 6000px and up — under the
          // card's greyscale filter, which is a lot to paint for a glimpse,
          // and which a renderer without a GPU simply dropped.
          style={{ width: device, height: device * 0.625, transform: `scale(${scale})` }}
        >
          <PreviewProvider value>
            <PublishedHandleProvider value={handle}>
              <PublishedBody p={still} />
            </PublishedHandleProvider>
          </PreviewProvider>
        </div>
      )}
    </div>
  );
}
