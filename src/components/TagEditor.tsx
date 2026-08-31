"use client";

import { useState } from "react";

export function TagEditor({
  tags,
  onChange,
  accentFirst = false,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  /** The header's leading tag carries the accent; section tags are all neutral. */
  accentFirst?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  function commit() {
    const value = draft.trim();
    if (value && !tags.includes(value)) onChange([...tags, value]);
    setDraft("");
    setAdding(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag, i) => (
        <span
          key={tag}
          className={`tag ${accentFirst && i === 0 ? "tag-accent" : "tag-neutral"} gap-1.5`}
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            aria-label={`Remove tag ${tag}`}
            className="cursor-pointer opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </span>
      ))}

      {adding ? (
        <input
          autoFocus
          className="input w-40"
          style={{ minHeight: 26, padding: "2px 8px", fontSize: 12 }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
          placeholder="Tag name"
        />
      ) : (
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: 12, padding: "4px 10px" }}
          onClick={() => setAdding(true)}
        >
          + Add tag
        </button>
      )}
    </div>
  );
}
