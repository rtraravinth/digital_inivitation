"use client";

import { useState } from "react";
import { TAB_MAX_LENGTH } from "@/lib/types";

/**
 * The one tab a section files under. Required — a section is reached through
 * its tab and nowhere else, so there is no empty option and no way to clear
 * it.
 *
 * A select of the tabs already on the page, rather than a free text box:
 * "Advisory" typed twice with different capitals would otherwise become two
 * tabs, and the author would only find out on the published page. Naming a
 * new one is still one click away.
 */
export function TabField({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: string;
  /** Every tab already used on this page, in page order. */
  options: string[];
  onChange: (tab: string) => void;
}) {
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");

  // The section's own tab may not be in the page's list yet — it is while it
  // is the only section under it and the list is built from somewhere else.
  const choices = options.includes(value) ? options : [value, ...options];

  function commit() {
    const name = draft.trim();
    if (name) onChange(name.slice(0, TAB_MAX_LENGTH));
    setDraft("");
    setNaming(false);
  }

  if (naming) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          id={id}
          className="input"
          maxLength={TAB_MAX_LENGTH}
          placeholder="Tab name"
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
              setNaming(false);
            }
          }}
        />
        <button
          type="button"
          className="btn btn-secondary btn-icon"
          aria-label="Keep the current tab"
          onMouseDown={(e) => {
            // mousedown, not click: the input's blur would commit first.
            e.preventDefault();
            setDraft("");
            setNaming(false);
          }}
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        id={id}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {choices.map((tab) => (
          <option key={tab} value={tab}>
            {tab}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-secondary whitespace-nowrap"
        onClick={() => setNaming(true)}
      >
        + New tab
      </button>
    </div>
  );
}
