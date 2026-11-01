"use client";

import type { CSSProperties } from "react";
import type { ThemeId } from "@/lib/types";

/* ── theme thumbnails ─────────────────────────────────────────────────────
   A small moving picture of each theme's one piece of depth, drawn in CSS so
   the gallery costs no screenshots and follows the author's accent. Every
   loop carries `.fx-loop`, which the reduced-motion rule in globals.css
   stops.
   ──────────────────────────────────────────────────────────────────────── */

export function ThemeThumb({
  theme,
  accent,
  size = "sm",
}: {
  theme: ThemeId;
  accent: string;
  /** "fill" takes its parent's box — a card preview sizes it by aspect. */
  size?: "sm" | "md" | "lg" | "fill";
}) {
  const box =
    size === "fill"
      ? "h-full w-full"
      : size === "lg"
        ? "h-[190px] w-full"
        : size === "md"
          ? "h-[96px] w-full"
          : "h-[44px] w-[56px] flex-none";
  const style = { "--thumb-accent": accent } as CSSProperties;

  return (
    <span
      aria-hidden
      className={`thumb relative block overflow-hidden ${box}`}
      data-thumb={theme}
      data-size={size}
      style={style}
    >
      {theme === "aurora" && (
        <>
          <span className="thumb-orb fx-loop" style={{ left: "-10%", top: "-30%" }} />
          <span className="thumb-orb fx-loop" style={{ right: "-15%", top: "20%", animationDelay: "-4s", opacity: 0.6 }} />
          <span className="thumb-glass thumb-bob fx-loop" />
        </>
      )}
      {theme === "meridian" && (
        <>
          <span className="thumb-plate" style={{ background: "var(--thumb-accent)", transform: "rotate(-6deg) translateX(-8%)" }} />
          <span className="thumb-plate thumb-bob fx-loop" style={{ background: "#e7e2d8" }} />
          <span className="thumb-lines">
            <i style={{ width: "70%" }} />
            <i style={{ width: "50%" }} />
            <i style={{ width: "60%" }} />
          </span>
        </>
      )}
      {theme === "stage" && (
        <>
          <span className="thumb-billboard" />
          <span className="thumb-rail">
            <span className="thumb-rail-track fx-loop">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <i key={i} style={{ opacity: i % 3 === 0 ? 1 : 0.55 }} />
              ))}
            </span>
          </span>
        </>
      )}
      {theme === "arcade" && (
        <>
          <span className="thumb-sun" />
          <span className="thumb-floor-wrap">
            <span className="thumb-floor arcade-floor fx-loop" />
          </span>
        </>
      )}
      {theme === "journey" && (
        <>
          <span className="thumb-card" style={{ transform: "translate(-50%, 0) scale(0.84)", top: "18%", opacity: 0.5 }} />
          <span className="thumb-card" style={{ transform: "translate(-50%, 0) scale(0.92)", top: "28%", opacity: 0.75 }} />
          <span className="thumb-card thumb-rise fx-loop" style={{ top: "38%" }} />
          <span className="thumb-ring fx-loop" />
        </>
      )}
    </span>
  );
}
