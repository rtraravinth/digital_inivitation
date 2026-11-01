"use client";

import { useEffect, useRef, useState } from "react";
import { FontSample } from "@/components/builder/FontSample";
import { FONTS, type FontId } from "@/lib/types";

/**
 * One face, as a dropdown. The Type panel renders two: headline and body.
 *
 * Not a `<select>`. The whole point of this control is seeing the face before
 * you commit to it, and `font-family` on an `<option>` is ignored on macOS
 * and unreliable in Chrome — a native list would name fourteen fonts in the
 * system font and show none of them.
 *
 * Closed, it costs one face. The options are only mounted while it is open,
 * so `FontSample`'s deferral still applies inside the scrolling panel and a
 * face is fetched when you scroll to it, not when the Type tab is opened.
 */
export function FontSelect({
  id,
  label,
  value,
  specimen = "Aa",
  onPick,
}: {
  id: string;
  /** Which face this picks. There are two of these on the panel at once, so
   *  the accessible names have to say which is which. */
  label: string;
  value: FontId;
  /** What each row is drawn with. The mobile sheet passes the author's name,
   *  which is the text they are actually choosing a face for. */
  specimen?: string;
  onPick: (id: FontId) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const current = FONTS.find((f) => f.id === value) ?? FONTS[0];

  // Escape closes, from wherever focus happens to be. A subscription to
  // something outside React, which is what an effect is for; the state change
  // happens in the handler rather than in the effect body.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Opening puts focus on the face already in use, so the arrow keys start
  // from where the list actually is rather than from the top.
  useEffect(() => {
    if (!open) return;
    list.current
      ?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
      ?.focus();
  }, [open]);

  /** Roving focus over real buttons, so there is no activedescendant to keep
   *  in step with what the browser thinks is focused. */
  const move = (e: React.KeyboardEvent, from: number) => {
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const next = (from + step + FONTS.length) % FONTS.length;
    list.current
      ?.querySelectorAll<HTMLButtonElement>("[role=option]")
      [next]?.focus();
  };

  return (
    <div className="relative">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        id={id}
        aria-label={`${label}: ${current.name}`}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="input flex w-full cursor-pointer items-center gap-3 text-left"
      >
        <FontSample
          cssVar={current.cssVar}
          eager
          className="text-xl leading-none"
        >
          {specimen}
        </FontSample>
        <span className="font-heading truncate text-sm">
          {current.name}
        </span>
        <span
          aria-hidden
          className="ml-auto flex-none pl-2 transition-transform duration-200"
          style={{ color: "var(--color-neutral-600)", transform: open ? "rotate(180deg)" : "none" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      {open && (
        <>
          {/* A backdrop rather than a listener on `document`: most of the
              builder is the live canvas, and that canvas is an iframe. A
              pointerdown inside another document never reaches this one, so
              a document listener leaves the dropdown open when you click the
              page you are styling — which is most of the screen. */}
          <div
            className="fixed inset-0 z-10"
            onPointerDown={() => setOpen(false)}
            aria-hidden
          />
          <div
            ref={list}
            role="listbox"
            aria-label={label}
            className="picker-pop absolute z-20 max-h-[320px] w-full overflow-y-auto rounded-xl p-1"
            style={{
              top: "calc(100% + 6px)",
              background: "var(--color-bg)",
              border: "1px solid var(--color-divider)",
              boxShadow: "var(--shadow-lg)",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {FONTS.map((face, index) => {
              const on = face.id === value;
              return (
                <button
                  key={face.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  tabIndex={-1}
                  onClick={() => {
                    onPick(face.id);
                    setOpen(false);
                    trigger.current?.focus();
                  }}
                  onKeyDown={(e) => move(e, index)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg p-2.5 text-left hover:bg-[var(--color-surface)] focus-visible:bg-[var(--color-surface)]"
                  style={{
                    background: on ? "var(--color-surface)" : undefined,
                  }}
                >
                  {/* "Aa", not the specimen: a row's sample column is 38px,
                      and a full name overflowed it into the face's own label.
                      The trigger above still sets the specimen at length. */}
                  <FontSample
                    cssVar={face.cssVar}
                    eager={on}
                    className="w-[38px] flex-none text-xl leading-none"
                  >
                    Aa
                  </FontSample>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-heading truncate text-sm">
                      {face.name}
                    </span>
                    <span className="text-neutral-700 truncate text-[11px]">
                      {face.sample}
                    </span>
                  </span>
                  <span
                    className="ml-auto flex-none pl-2"
                    style={{
                      color: on ? "var(--color-foil)" : "transparent",
                    }}
                  >
                    ✓
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
