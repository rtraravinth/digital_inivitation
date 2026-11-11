"use client";

import { ICON, Icon, TiltPanel } from "../ui";

/* ── cards ────────────────────────────────────────────────────────────── */

/**
 * A card that reads like the page until it is opened, then holds the form.
 * Closed, the whole card is one big button; open, it is a form with a Done.
 */
export function Card({
  id,
  open,
  onOpen,
  label,
  tools,
  preview,
  children,
  dim,
}: {
  id: string;
  open: boolean;
  onOpen: () => void;
  label: React.ReactNode;
  tools?: React.ReactNode;
  preview: React.ReactNode;
  children: React.ReactNode;
  dim?: boolean;
}) {
  return (
    <TiltPanel
      max={open ? 0 : 2.5}
      lift={open ? 0 : 3}
      className="scroll-mt-20 rounded-2xl"
      style={open ? { border: "1.5px solid var(--color-ink)" } : undefined}
    >
      <div id={`card-${id}`} className="scroll-mt-20" />
      <div className="flex items-center gap-2 px-5 pt-4 sm:px-6">
        <span className="min-w-0 flex-1 text-[12px] font-medium" style={{ color: "var(--color-neutral-600)" }}>
          {label}
        </span>
        {tools}
      </div>
      {open ? (
        <div className="relative px-5 pt-3 pb-5 sm:px-6">{children}</div>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          aria-label="Edit"
          className="relative block w-full cursor-pointer px-5 pt-2 pb-5 text-left sm:px-6"
          style={{ opacity: dim ? 0.55 : 1 }}
        >
          {preview}
          <span
            className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium"
            style={{ color: "var(--color-neutral-700)" }}
          >
            <Icon d={ICON.pencil} size={12} />
            Click to edit
          </span>
        </button>
      )}
    </TiltPanel>
  );
}

export function Placeholder({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "var(--color-neutral-500)" }}>{children}</span>;
}
