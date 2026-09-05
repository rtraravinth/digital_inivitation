"use client";

import { useEffect, useState } from "react";
import type { StartFrom } from "@/lib/store";
import { PAGE_DOMAIN, type Portfolio } from "@/lib/types";
import { useAccount } from "@/lib/account";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CreatePortfolioDialog({
  portfolios,
  onCancel,
  onCreate,
}: {
  portfolios: Portfolio[];
  onCancel: () => void;
  onCreate: (
    name: string,
    slug: string,
    startFrom: StartFrom,
    summary: string,
  ) => void;
}) {
  const handle = useAccount().account.profile.handle;
  const [name, setName] = useState("Investor one-pager");
  // One segment: the handle in front is the namespace now.
  const [slug, setSlug] = useState("investors");
  const [slugTouched, setSlugTouched] = useState(false);
  const [summary, setSummary] = useState("");
  const [kind, setKind] = useState<StartFrom["kind"]>("blank");
  const [copyId, setCopyId] = useState(portfolios[0]?.id ?? "");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function changeName(value: string) {
    setName(value);
    if (!slugTouched) setSlug(`rohan/${slugify(value)}`);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const startFrom: StartFrom =
      kind === "copy" ? { kind: "copy", id: copyId } : { kind };
    onCreate(name.trim(), slug.trim(), startFrom, summary.trim());
  }

  const source = portfolios.find((p) => p.id === copyId);

  return (
    <div
      className="dialog-backdrop z-50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Create a portfolio"
        onSubmit={submit}
      >
        <div className="dialog-title">Create a portfolio</div>

        <div>
          <div className="field mb-3.5">
            <label htmlFor="cp-name">Name it (only you see this)</label>
            <input
              id="cp-name"
              autoFocus
              className="input"
              value={name}
              onChange={(e) => changeName(e.target.value)}
            />
          </div>

          <div className="field mb-3.5">
            <label htmlFor="cp-slug">Page address</label>
            <div className="flex items-center gap-0">
              <span className="text-muted shrink-0 pr-1 text-sm">
                {PAGE_DOMAIN}/{handle}/
              </span>
              <input
                id="cp-slug"
                className="input"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
              />
            </div>
          </div>

          <div className="field mb-3.5">
            <label htmlFor="cp-summary">Card note (optional)</label>
            <input
              id="cp-summary"
              className="input"
              placeholder="One line about this page — which room it is for"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
            <span className="text-neutral-700 text-[11px]">
              Shown on the portfolio card, never on the page itself.
            </span>
          </div>

          <div className="text-neutral-700 mb-2 text-xs">Start from</div>
          <div className="flex flex-col gap-2.5">
            <label className="radio">
              <input
                type="radio"
                name="startFrom"
                checked={kind === "blank"}
                onChange={() => setKind("blank")}
              />
              <span className="dot" />
              Blank — a header and one empty section
            </label>

            <label className="radio">
              <input
                type="radio"
                name="startFrom"
                checked={kind === "copy"}
                onChange={() => setKind("copy")}
                disabled={portfolios.length === 0}
              />
              <span className="dot" />
              {source ? `Copy “${source.name}”` : "Copy an existing portfolio"}
            </label>

            {kind === "copy" && portfolios.length > 1 && (
              <select
                className="input ml-6"
                aria-label="Portfolio to copy"
                value={copyId}
                onChange={(e) => setCopyId(e.target.value)}
              >
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}

            <label className="radio">
              <input
                type="radio"
                name="startFrom"
                checked={kind === "founder"}
                onChange={() => setKind("founder")}
              />
              <span className="dot" />
              Suggested sections for a founder
            </label>
          </div>
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
