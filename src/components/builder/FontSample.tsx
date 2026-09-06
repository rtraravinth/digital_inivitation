"use client";

import { useState } from "react";

/**
 * A specimen that only fetches its face once you can see it.
 *
 * A font file is downloaded when text actually renders in it, so a list that
 * draws every face at once fetches every face at once — opening the Type
 * panel would pull all fourteen whether or not you scrolled far enough to
 * look at them. Until this is in view it renders in the inherited face and
 * names no family at all, which costs nothing.
 *
 * `eager` is for the face already in use: the canvas is rendering it anyway,
 * so there is nothing to defer and the selected row should not be the one
 * row showing the wrong face.
 *
 * The observer is wired up in a ref callback rather than an effect. The
 * React Compiler lint rejects `setState` called straight from an effect body
 * (`react-hooks/set-state-in-effect`), which the no-observer fallback below
 * has to do; a ref callback with a cleanup return does the same work without
 * that shape, and needs no dependency array to get right.
 */
export function FontSample({
  cssVar,
  eager = false,
  className,
  style,
  children,
}: {
  cssVar: string;
  eager?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const [shown, setShown] = useState(eager);

  const watch = (el: HTMLSpanElement | null) => {
    if (!el || shown) return;

    // No observer means no way to tell when this is in view, so show the face
    // rather than leave a list of identical fallbacks.
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // A little ahead of the fold, so a face has started loading by the
        // time it is scrolled to rather than swapping in under the cursor.
        if (entries.some((entry) => entry.isIntersecting)) setShown(true);
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  };

  return (
    <span
      ref={watch}
      className={className}
      style={{ ...style, fontFamily: shown ? `var(${cssVar})` : undefined }}
    >
      {children}
    </span>
  );
}
