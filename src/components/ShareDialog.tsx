"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { QrCode } from "./QrCode";
import { ICON, Icon, Modal } from "./ui";
import { useAccount } from "@/lib/account";
import { LinkIcon, iconFor } from "@/lib/icons";
import { displayUrl, liveUrl } from "@/lib/slug";
import type { Portfolio } from "@/lib/types";

/**
 * Sharing one page: its address, a code a phone can scan, and the places
 * people actually paste it. Rendered inside an `<AnimatePresence>`.
 *
 * Only live pages are offered: a draft's address answers 404 until it is
 * published, so there is nothing to send.
 *
 * Every link here is the page's real address — the route that serves it.
 * It used to be built from the facet.page vanity domain, which serves
 * nothing, so every copied link, QR code and share it produced was dead.
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
  const [copied, setCopied] = useState(false);

  const shareable = portfolios.filter((x) => x.status === "live");
  const p = shareable.find((x) => x.id === id) ?? shareable[0];
  if (!p) return null;

  const url = handle ? liveUrl(handle, p.slug) : "";
  const canShare = !!url;
  const signature = `${p.header.name || p.name}\n${p.header.current}\n${url}`;
  const nativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copyText(text: string, said: string, mark = false) {
    try {
      await navigator.clipboard.writeText(text);
      setNote(said);
      if (mark) {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }
      window.setTimeout(() => setNote(""), 2400);
    } catch {
      // Say so rather than claim a copy that never happened.
      setNote("This browser blocked the clipboard — select the address and copy it by hand.");
    }
  }

  const targets: Array<{ label: string; href?: string; onClick?: () => void; icon: React.ReactNode }> = [
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(url)}`,
      icon: <LinkIcon id={iconFor({ url: "https://wa.me" })} size={17} />,
    },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      icon: <LinkIcon id={iconFor({ url: "https://linkedin.com" })} size={17} />,
    },
    {
      label: "X",
      href: `https://x.com/intent/post?url=${encodeURIComponent(url)}`,
      icon: <LinkIcon id={iconFor({ url: "https://x.com" })} size={17} />,
    },
    {
      label: "Email",
      href: `mailto:?subject=${encodeURIComponent(p.header.name || p.name)}&body=${encodeURIComponent(url)}`,
      icon: <LinkIcon id={iconFor({ url: "someone@example.com" })} size={17} />,
    },
    {
      label: "Email signature",
      onClick: () => void copyText(signature, "Signature copied — paste it into your email settings."),
      icon: <Icon d={<path d="M4 18c3-6 5-6 6-3s3 3 5-1 3-4 5 1" />} size={17} />,
    },
    ...(nativeShare
      ? [
          {
            label: "More…",
            onClick: () => void navigator.share({ title: p.header.name || p.name, url }).catch(() => {}),
            icon: <Icon d={ICON.share} size={17} />,
          },
        ]
      : []),
  ];

  return (
    <Modal title="Share your page" description="Send people straight to it." onClose={onClose} width={520}>
      <div className="flex flex-col gap-4">
        {shareable.length > 1 && (
          <div className="field">
            <label htmlFor="share-page">Page</label>
            <select id="share-page" className="input" value={p.id} onChange={(e) => setId(e.target.value)}>
              {shareable.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {!handle ? (
          <Notice>
            Your account has no handle, so your pages have no address yet.{" "}
            <Link href="/account" className="font-medium underline underline-offset-2" style={{ color: "var(--color-ink)" }}>
              Choose a handle
            </Link>
          </Notice>
        ) : null}

        {/* The address and the act of taking it, as one control. */}
        <div
          className="flex items-center gap-2 rounded-xl py-1.5 pr-1.5 pl-3.5"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-divider)",
            opacity: canShare ? 1 : 0.5,
          }}
        >
          <span className="min-w-0 flex-1 truncate font-mono text-[13px]" title={url}>
            {url ? displayUrl(url) : "No address yet"}
          </span>
          <button
            type="button"
            disabled={!canShare}
            className="btn btn-primary"
            style={{ marginTop: 0, minHeight: 34, padding: "0.35rem 0.8rem", fontSize: 13 }}
            onClick={() => copyText(url, "Link copied.", true)}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={copied ? "done" : "copy"}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.12 }}
                className="flex items-center gap-1.5"
              >
                <Icon d={copied ? ICON.check : ICON.copy} size={14} />
                {copied ? "Copied" : "Copy link"}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>

        {canShare && (
          <>
            {/* The same address for a phone camera, big enough to scan off a
                screen across a table. */}
            <div
              className="flex flex-col items-center gap-3 rounded-xl p-4 sm:flex-row sm:items-center"
              style={{ border: "1px solid var(--color-divider)" }}
            >
              {/* The code paints its own white quiet zone; a second white
                  backing here hid its download button on a dark ground. */}
              <QrCode text={url} size={132} downloadName={`facet-${p.slug}.png`} downloadVariant="attached" />
              <span className="text-center text-[13px] leading-relaxed text-muted sm:text-left">
                <span className="mb-1 block text-[14px] font-medium" style={{ color: "var(--color-ink)" }}>
                  Scan to open
                </span>
                Point a phone’s camera at it. Download it for a slide, a card or a printed CV.
              </span>
            </div>

            <div>
              <span className="mb-2 block text-[12.5px] font-medium" style={{ color: "var(--color-neutral-700)" }}>
                Send it
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {targets.map((t) =>
                  t.href ? (
                    <a
                      key={t.label}
                      href={t.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-[44px] items-center gap-2.5 rounded-xl px-3 text-[13.5px] font-medium no-underline transition-colors hover:bg-[var(--color-surface)]"
                      style={{ border: "1px solid var(--color-divider)", color: "var(--color-ink)" }}
                    >
                      {t.icon}
                      {t.label}
                    </a>
                  ) : (
                    <button
                      key={t.label}
                      type="button"
                      onClick={t.onClick}
                      className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl px-3 text-left text-[13.5px] font-medium transition-colors hover:bg-[var(--color-surface)]"
                      style={{ border: "1px solid var(--color-divider)" }}
                    >
                      {t.icon}
                      {t.label}
                    </button>
                  ),
                )}
              </div>
            </div>
          </>
        )}

        {/* One line, always present, so nothing moves when a copy lands. */}
        <p className="m-0 min-h-[18px] text-[12.5px]" role="status" style={{ color: "var(--color-neutral-700)" }}>
          {note}
        </p>
      </div>
    </Modal>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl px-3.5 py-3 text-[13.5px] leading-relaxed" style={{ border: "1px dashed color-mix(in srgb, var(--color-ink) 45%, transparent)" }}>
      {children}
    </div>
  );
}
