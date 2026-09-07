"use client";

import { useEffect, useRef, useState } from "react";
import { ICONS, ICON_LIST, LinkIcon, iconFor, isIconId, type IconDef } from "@/lib/icons";
import type { LinkItem } from "@/lib/types";

/** The grid's column count, and the size of one vertical arrow-key step. */
const COLS = 4;

/**
 * The icon for one link. The first entry is always Automatic, which shows
 * whatever the address currently resolves to — choosing it stores "", which
 * is how an override is undone.
 *
 * `resolved` is computed from `link` on every render rather than cached in
 * state, so the trigger tracks the address field as it's typed with no
 * further action from the author.
 *
 * The listbox is the grid, not the panel: a listbox owns its options, and the
 * panel's other child is the search field — a textbox a listbox may not
 * contain. The options are out of the Tab order and moved between with the
 * arrow keys, like `FontSelect`, so an open panel costs one tab stop rather
 * than thirty-two.
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
  const list = useRef<HTMLDivElement>(null);
  const resolved = iconFor(link);
  // An override this build cannot draw is not an override: `iconFor` has
  // already fallen back to the address, and saying "automatic" is what the
  // trigger is showing.
  const stored = link.icon?.trim() ?? "";
  const overridden = Boolean(stored) && isIconId(stored);

  const q = query.trim().toLowerCase();
  const shown = q
    ? ICON_LIST.filter((id) => {
        const def: IconDef = ICONS[id];
        return (
          id.includes(q) ||
          def.name.toLowerCase().includes(q) ||
          (def.alias?.some((a) => a.includes(q)) ?? false)
        );
      })
    : ICON_LIST;
  // Automatic only shows on the unfiltered list, so it is an option — and an
  // arrow-key row — only then.
  const hasAuto = !q;

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

  // Opening puts focus on the icon already in use, so the arrow keys start
  // from where the list actually is rather than from the top.
  useEffect(() => {
    if (!open) return;
    const panel = list.current;
    const target =
      panel?.querySelector<HTMLButtonElement>('[aria-selected="true"]') ??
      panel?.querySelector<HTMLButtonElement>("[role=option]");
    target?.focus();
  }, [open]);

  /** Roving focus over real buttons, so there is no activedescendant to keep
   *  in step with what the browser thinks is focused. Left and right walk the
   *  list in order, up and down cross a row, because these options are laid
   *  out as a grid rather than a column. Vertical moves clamp instead of
   *  wrapping, which is what puts Automatic one ArrowUp above the first row. */
  const move = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const opts = Array.from(
      list.current?.querySelectorAll<HTMLButtonElement>("[role=option]") ?? [],
    );
    const from = opts.indexOf(e.currentTarget);
    if (from < 0) return;
    let next: number;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const step = e.key === "ArrowRight" ? 1 : -1;
      next = (from + step + opts.length) % opts.length;
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      // Automatic spans the full width, so it is a row of one: stepping down
      // off it is one place, not a column's worth.
      const down = e.key === "ArrowDown";
      const step = down ? (hasAuto && from === 0 ? 1 : COLS) : -COLS;
      next = Math.min(Math.max(from + step, 0), opts.length - 1);
    } else {
      return;
    }
    e.preventDefault();
    opts[next]?.focus();
  };

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
              onKeyDown={(e) => {
                // The options are out of the Tab order, so ArrowDown is how a
                // search gets from the field to what it found.
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  list.current
                    ?.querySelector<HTMLButtonElement>("[role=option]")
                    ?.focus();
                }
              }}
            />
            <div
              ref={list}
              role="listbox"
              aria-label="Icon"
              className="grid max-h-[220px] grid-cols-4 overflow-y-auto"
            >
              {hasAuto && (
                <button
                  type="button"
                  role="option"
                  aria-selected={!overridden}
                  tabIndex={-1}
                  className="col-span-4 flex cursor-pointer items-center gap-2 px-2 py-2 text-left text-xs"
                  style={{
                    borderBottom: "1px solid var(--color-divider)",
                    color: overridden ? "inherit" : "var(--color-accent)",
                  }}
                  onClick={() => pick("")}
                  onKeyDown={move}
                >
                  <LinkIcon id={resolved} />
                  Automatic — {ICONS[resolved].name}
                </button>
              )}
              {shown.map((id) => {
                // `resolved` is the override itself whenever there is one, so
                // the trigger and the grid cannot disagree about what is on.
                const on = overridden && resolved === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    tabIndex={-1}
                    title={ICONS[id].name}
                    aria-label={ICONS[id].name}
                    className="flex cursor-pointer flex-col items-center gap-1 px-1 py-2 text-[10px]"
                    style={{ color: on ? "var(--color-accent)" : "inherit" }}
                    onClick={() => pick(id)}
                    onKeyDown={move}
                  >
                    <LinkIcon id={id} size={20} />
                    <span className="w-full truncate text-center">{ICONS[id].name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
