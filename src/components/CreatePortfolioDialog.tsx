"use client";

import { useState } from "react";
import { ICON, Icon, Modal } from "./ui";
import { useAccount } from "@/lib/account";
import { Glyph } from "@/lib/glyphs";
import { displayUrl, isSlug, liveUrl, slugify } from "@/lib/slug";
import type { StartFrom } from "@/lib/store";
import type { Portfolio } from "@/lib/types";

/**
 * Making a new page: what to call it, where it will live, and what it starts
 * with. Rendered inside an `<AnimatePresence>` by the caller.
 *
 * The caller owns the request, because the server mints the id and the page
 * navigates to it; this only waits for the answer, keeps itself open while
 * it is pending, and shows the server's reason if it says no.
 */
export function CreatePortfolioDialog({
  portfolios,
  error,
  onCancel,
  onCreate,
}: {
  portfolios: Portfolio[];
  /** The server's answer to the last attempt, shown in the dialog. */
  error?: string | null;
  onCancel: () => void;
  onCreate: (name: string, slug: string, startFrom: StartFrom, summary: string) => Promise<void> | void;
}) {
  const handle = useAccount().account.profile.handle;
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [summary, setSummary] = useState("");
  const [kind, setKind] = useState<StartFrom["kind"]>("blank");
  const [copyId, setCopyId] = useState(portfolios[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  const taken = portfolios.some((p) => p.slug === slug);
  const slugError = !slug
    ? null
    : slug.length < 2
      ? "At least two characters."
      : slug.endsWith("-")
        ? "Can’t end with a hyphen."
        : !isSlug(slug)
          ? "Lowercase letters, numbers and hyphens only."
          : taken
            ? "You already have a page at this address."
            : null;
  const ready = name.trim() !== "" && isSlug(slug) && !taken && !busy;

  function changeName(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    const startFrom: StartFrom = kind === "copy" ? { kind: "copy", id: copyId } : { kind };
    setBusy(true);
    try {
      await onCreate(name.trim(), slug, startFrom, summary.trim());
    } finally {
      setBusy(false);
    }
  }

  const options: Array<{ id: StartFrom["kind"]; title: string; desc: string; icon: React.ReactNode; disabled?: boolean }> = [
    {
      id: "blank",
      title: "Blank",
      desc: "A header and one empty section.",
      icon: <Glyph id="plus" size={16} />,
    },
    {
      id: "copy",
      title: "Copy a page",
      desc: portfolios.length ? "Start from one you have, then cut it down." : "You have no pages to copy yet.",
      icon: <Icon d={ICON.copy} size={16} />,
      disabled: portfolios.length === 0,
    },
    {
      id: "founder",
      title: "Founder",
      desc: "Suggested sections for a founder.",
      icon: <Icon d={<path d="M4 20V9l8-5 8 5v11M9 20v-6h6v6" />} size={16} />,
    },
  ];

  return (
    <Modal
      title="New portfolio"
      description="A page with a header and as many sections as you need. You can change all of this later."
      onClose={onCancel}
      width={520}
      footer={
        <>
          <button type="button" className="btn btn-secondary" style={{ marginTop: 0 }} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" form="create-portfolio" className="btn btn-primary" style={{ marginTop: 0 }} disabled={!ready}>
            {busy ? "Creating…" : "Create portfolio"}
          </button>
        </>
      }
    >
      <form id="create-portfolio" onSubmit={submit} className="flex flex-col gap-4">
        {error && (
          <p
            role="alert"
            className="m-0 flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px]"
            style={{ border: "1px solid var(--color-ink)" }}
          >
            <span
              aria-hidden
              className="mt-px grid h-[18px] w-[18px] flex-none place-items-center rounded-full text-[11px] font-bold"
              style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
            >
              !
            </span>
            {error}
          </p>
        )}

        <div className="field">
          <label htmlFor="cp-name">Name</label>
          <input
            id="cp-name"
            autoFocus
            className="input"
            placeholder="Investor one-pager"
            value={name}
            onChange={(e) => changeName(e.target.value)}
          />
          <p className="m-0 mt-1.5 text-[12px] text-muted">Only you see this — it names the card on Portfolios.</p>
        </div>

        <div className="field">
          <label htmlFor="cp-slug">Address</label>
          <div
            className="flex items-center overflow-hidden rounded-[var(--radius-md)]"
            style={{ border: "1px solid var(--color-divider)", background: "var(--color-surface)" }}
          >
            <span className="max-w-[55%] flex-none truncate py-2 pl-3 font-mono text-[12.5px]" style={{ color: "var(--color-neutral-600)" }}>
              {displayUrl(liveUrl(handle || "your-handle", ""))}
            </span>
            <input
              id="cp-slug"
              className="min-w-0 flex-1 bg-transparent py-2 pr-3 font-mono text-[13px] outline-none"
              style={{ color: "var(--color-ink)", border: 0 }}
              placeholder="investors"
              value={slug}
              aria-invalid={!!slugError || undefined}
              onChange={(e) => {
                setSlugTouched(true);
                // Cleaned as typed, not slugified: slugify trims a trailing
                // hyphen, which would make "my-page" impossible to type.
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-{2,}/g, "-").replace(/^-+/, "").slice(0, 120));
              }}
            />
          </div>
          <p className="m-0 mt-1.5 text-[12px] text-muted">
            {slugError ?? "Filled in from the name. Not public until you publish."}
          </p>
        </div>

        <div className="field">
          <label htmlFor="cp-summary">Note for yourself (optional)</label>
          <input
            id="cp-summary"
            className="input"
            placeholder="Who this version is for"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </div>

        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="mb-2 p-0 text-[12.5px] font-medium" style={{ color: "var(--color-neutral-700)" }}>
            Start from
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {options.map((o) => {
              const on = kind === o.id;
              return (
                <label
                  key={o.id}
                  className={`relative flex flex-col gap-1.5 rounded-xl p-3 transition-colors ${o.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-[var(--color-surface)]"}`}
                  style={{ boxShadow: on ? "inset 0 0 0 1.5px var(--color-ink)" : "inset 0 0 0 1px var(--color-divider)" }}
                >
                  <input
                    type="radio"
                    name="startFrom"
                    className="peer sr-only"
                    checked={on}
                    disabled={o.disabled}
                    onChange={() => setKind(o.id)}
                  />
                  <span
                    className="grid h-8 w-8 place-items-center rounded-lg peer-focus-visible:outline-2"
                    style={on ? { background: "var(--color-ink)", color: "var(--color-bg)" } : { background: "var(--color-surface)" }}
                  >
                    {o.icon}
                  </span>
                  <span className="text-[13.5px] font-medium">{o.title}</span>
                  <span className="text-[12px] leading-snug text-muted">{o.desc}</span>
                </label>
              );
            })}
          </div>
          {kind === "copy" && portfolios.length > 0 && (
            <div className="field mt-3">
              <label htmlFor="cp-copy">Page to copy</label>
              <select id="cp-copy" className="input" value={copyId} onChange={(e) => setCopyId(e.target.value)}>
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </fieldset>
      </form>
    </Modal>
  );
}
