"use client";

import { useEffect, useState } from "react";
import { QrCode } from "./QrCode";
import { useAccount } from "@/lib/account";
import { pageAddress, type Portfolio } from "@/lib/types";

/**
 * Sharing one page: its address, a scannable code, and the four places
 * people actually paste it.
 *
 * This used to be a column on /stats, wedged next to the numbers it has
 * nothing to do with. It belongs where the pages are listed, so it opens
 * from the list and asks which page when there is more than one.
 */
export function ShareDialog({
  portfolios,
  initialId,
  onClose,
}: {
  portfolios: Portfolio[];
  initialId: string;
  onClose: () => void;
}) {
  const handle = useAccount().account.profile.handle;
  const [id, setId] = useState(initialId);
  const [note, setNote] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const p = portfolios.find((x) => x.id === id) ?? portfolios[0];
  if (!p) return null;

  const address = pageAddress(handle, p.slug);
  const url = `https://${address}`;
  const signature = `${p.header.name || p.name}\n${p.header.current}\n${url}`;

  async function copyText(text: string, said: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNote(said);
      window.setTimeout(() => setNote(""), 2400);
    } catch {
      // Say so rather than claim a copy that never happened.
      setNote("This browser blocked the clipboard — copy the address by hand.");
    }
  }

  return (
    <div
      className="dialog-backdrop z-50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="dialog gap-0 p-0"
        role="dialog"
        aria-modal="true"
        aria-label="Share your page"
      >
        {/* ── title ─────────────────────────────────────────────── */}
        <div className="border-divider flex items-center gap-3 border-b-2 px-4 py-3.5">
          <div className="dialog-title">Share your page</div>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={onClose}
            className="hover:bg-accent hover:text-bg ml-auto flex h-11 w-11 flex-none cursor-pointer items-center justify-center transition-colors"
            style={{ boxShadow: "inset 0 0 0 2px var(--color-divider)" }}
          >
            <CloseGlyph />
          </button>
        </div>

        {/* ── which page ────────────────────────────────────────── */}
        <div className="border-divider flex items-center gap-3 border-b-2 px-4 py-3">
          <label htmlFor="share-page" className="font-heading text-xs font-extrabold">
            Page
          </label>
          <select
            id="share-page"
            className="input w-auto flex-1"
            value={p.id}
            onChange={(e) => setId(e.target.value)}
          >
            {portfolios.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>

        {/* ── the address ───────────────────────────────────────── */}
        <div className="border-divider border-b-2 px-4 py-4">
          {/* One box holds the address and the act of taking it, so the two
              read as one control rather than a label beside a button. */}
          <div
            className="flex items-stretch"
            style={{ boxShadow: "inset 0 0 0 2px var(--color-divider)" }}
          >
            <span className="font-heading min-w-0 flex-1 self-center break-all px-3 py-2.5 text-[15px] font-extrabold leading-snug">
              {address}
            </span>
            <button
              type="button"
              aria-label="Copy the address"
              title="Copy address"
              onClick={() => copyText(url, "Address copied.")}
              className="hover:bg-accent hover:text-bg flex w-12 flex-none cursor-pointer items-center justify-center transition-colors"
              style={{ boxShadow: "inset 2px 0 0 var(--color-divider)" }}
            >
              <CopyGlyph />
            </button>
          </div>

          {p.status !== "live" && (
            <p className="text-neutral-700 m-0 mt-2.5 text-[11px]">
              Not published yet, so this address answers “no page here” until you
              publish it.
            </p>
          )}

          {/* The same address for a phone camera, big enough to scan off a
              screen across a table. */}
          <div className="mt-3.5 flex justify-center">
            <QrCode
              text={url}
              size={176}
              downloadName={`facet-${p.slug}.png`}
              downloadVariant="attached"
            />
          </div>
        </div>

        {/* ── where it goes ─────────────────────────────────────── */}
        <div className="px-4 py-4">
          <h6 className="mb-2.5">Send it somewhere</h6>
          <div className="grid gap-2 sm:grid-cols-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(url)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-block no-underline"
            >
              WhatsApp ↗
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-block no-underline"
            >
              LinkedIn ↗
            </a>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => copyText(signature, "Email signature copied.")}
            >
              Copy email signature
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => copyText(url, "Address copied — paste it in your bio.")}
            >
              Copy for your bio
            </button>
          </div>

          {/* One line, always present, so nothing below it moves when a copy
              lands. */}
          <p
            className="m-0 mt-3 min-h-[15px] text-[11px] font-extrabold"
            role="status"
            style={{ color: "var(--color-accent-700)" }}
          >
            {note}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Two offset sheets. Drawn rather than a font glyph, so it stays aligned. */
function CopyGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden focusable="false">
      <path
        d="M4.5 4.5h8v8h-8zM1.5 9.5v-8h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

/** A cross at the same weight as the dividers around it. */
function CloseGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden focusable="false">
      <path d="M2 2l10 10M12 2L2 12" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
