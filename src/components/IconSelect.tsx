"use client";

import { useEffect, useRef, useState } from "react";
import { ICONS, ICON_LIST, LinkIcon, iconFor } from "@/lib/icons";
import type { LinkItem } from "@/lib/types";

/**
 * The icon for one link. The first entry is always Automatic, which shows
 * whatever the address currently resolves to — choosing it stores "", which
 * is how an override is undone.
 *
 * `resolved` is computed from `link` on every render rather than cached in
 * state, so the trigger tracks the address field as it's typed with no
 * further action from the author.
 *
 * Closes on a backdrop rather than a listener on `document`, matching
 * `FontSelect`: a listener there is the thing that breaks the moment a panel
 * is opened over an iframe. `LinkEditor` never sits over the canvas iframe,
 * but the idiom stays consistent across the builder.
 */
export function IconSelect({
  link,
  onChange,
}: {
  link: LinkItem;
  onChange: (icon: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const resolved = iconFor(link);
  const overridden = Boolean(link.icon);

  const shown = query.trim()
    ? ICON_LIST.filter((id) => {
        const q = query.trim().toLowerCase();
        return id.includes(q) || ICONS[id].name.toLowerCase().includes(q);
      })
    : ICON_LIST;

  // Escape closes, from wherever focus happens to be. A subscription to
  // something outside React, which is what an effect is for; the state
  // change happens in the handler rather than in the effect body.
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

  function pick(icon: string) {
    onChange(icon);
    setOpen(false);
    setQuery("");
    trigger.current?.focus();
  }

  return (
    <div className="relative">
      <button
        ref={trigger}
        type="button"
        className="btn btn-secondary btn-icon"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Icon: ${overridden ? ICONS[resolved].name : `${ICONS[resolved].name}, automatic`}`}
        onClick={() => setOpen((v) => !v)}
      >
        <LinkIcon id={resolved} />
      </button>

      {open && (
        <>
          {/* A backdrop rather than a listener on `document`: most of the
              builder is the live canvas, and that canvas is an iframe. A
              pointerdown inside another document never reaches this one, so
              a document listener leaves a panel open when you click the page
              you are styling. `LinkEditor` is not over that iframe, but the
              idiom stays consistent with `FontSelect`. */}
          <div
            className="fixed inset-0 z-20"
            onPointerDown={() => setOpen(false)}
            aria-hidden
          />
          <div
            className="absolute left-0 z-30 mt-1 w-[260px] p-2"
            role="listbox"
            aria-label="Icon"
            style={{
              background: "var(--color-surface)",
              border: "2px solid var(--color-ink)",
            }}
          >
            <input
              className="input mb-2 w-full"
              value={query}
              placeholder="Search icons"
              aria-label="Search icons"
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="grid max-h-[220px] grid-cols-4 overflow-y-auto">
              {!query.trim() && (
                <button
                  type="button"
                  role="option"
                  aria-selected={!overridden}
                  className="col-span-4 flex cursor-pointer items-center gap-2 px-2 py-2 text-left text-xs"
                  style={{
                    borderBottom: "1px solid var(--color-divider)",
                    color: overridden ? "inherit" : "var(--color-accent)",
                  }}
                  onClick={() => pick("")}
                >
                  <LinkIcon id={resolved} />
                  Automatic — {ICONS[resolved].name}
                </button>
              )}
              {shown.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="option"
                  aria-selected={link.icon === id}
                  title={ICONS[id].name}
                  aria-label={ICONS[id].name}
                  className="flex cursor-pointer flex-col items-center gap-1 px-1 py-2 text-[10px]"
                  style={{ color: link.icon === id ? "var(--color-accent)" : "inherit" }}
                  onClick={() => pick(id)}
                >
                  <LinkIcon id={id} size={20} />
                  <span className="w-full truncate text-center">{ICONS[id].name}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
