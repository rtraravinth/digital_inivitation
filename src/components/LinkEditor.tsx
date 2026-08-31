"use client";

import { newId } from "@/lib/store";
import type { LinkItem } from "@/lib/types";

export function LinkEditor({
  links,
  onChange,
}: {
  links: LinkItem[];
  onChange: (links: LinkItem[]) => void;
}) {
  function update(id: string, patch: Partial<LinkItem>) {
    onChange(links.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  return (
    <div className="flex flex-col gap-1.5">
      {links.map((link) => (
        <div key={link.id} className="flex items-start gap-1.5">
          <div className="grid flex-1 gap-1.5 sm:grid-cols-[170px_1fr]">
            <input
              className="input"
              value={link.label}
              placeholder="Label"
              aria-label="Link label"
              onChange={(e) => update(link.id, { label: e.target.value })}
            />
            <input
              className="input"
              value={link.url}
              placeholder="Address"
              aria-label="Link address"
              onChange={(e) => update(link.id, { url: e.target.value })}
            />
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            aria-label={`Remove link ${link.label || "untitled"}`}
            onClick={() => onChange(links.filter((l) => l.id !== link.id))}
          >
            ✕
          </button>
        </div>
      ))}

      <button
        type="button"
        className="btn btn-secondary self-start"
        style={{ fontSize: 12, padding: "4px 10px" }}
        onClick={() => onChange([...links, { id: newId(), label: "", url: "" }])}
      >
        + Add link
      </button>
    </div>
  );
}
