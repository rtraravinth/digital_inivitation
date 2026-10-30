"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CreatePortfolioDialog } from "./CreatePortfolioDialog";
import { ShareDialog } from "./ShareDialog";
import { messageFor } from "@/lib/api";
import { usePortfolios, type StartFrom } from "@/lib/store";
import { STATUS_LABEL, pageAddress, previewPath, type Portfolio } from "@/lib/types";
import { useAccount } from "@/lib/account";

/**
 * The actions glyph, drawn rather than typed.
 *
 * It was the `⋯` character, which took whatever size, weight and baseline the
 * surrounding face gave it — and the surrounding face is now a didone, where
 * that character is a different shape again. Three dots at a fixed size are
 * three dots at a fixed size.
 */
function MoreGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden focusable="false">
      <circle cx="3" cy="9" r="1.4" />
      <circle cx="9" cy="9" r="1.4" />
      <circle cx="15" cy="9" r="1.4" />
    </svg>
  );
}

function CardMenu({
  id,
  live,
  onDelete,
}: {
  id: string;
  live: boolean;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        type="button"
        aria-label="Portfolio actions"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="hover:text-foil flex h-9 w-9 cursor-pointer items-center justify-center text-muted"
      >
        <MoreGlyph />
      </button>
      {open && (
        <div
          className="bg-surface absolute right-0 top-9 z-10"
          style={{
            boxShadow: "0 0 0 1px var(--color-divider), var(--shadow-md)",
          }}
        >
          {/* Published, the menu holds one entry: views and clicks. Editing
              and deleting are refused while the page is live, and preview
              and unpublish are on the card itself. The theme gallery and the
              block manager are not here either — both are one click deeper,
              from the builder and the editor's theme drawer. */}
          {!live && (
            <>
              <Link
                href={`/builder/${id}`}
                className="btn btn-ghost w-full justify-start whitespace-nowrap px-3"
              >
                Visual builder
              </Link>
              <Link
                href={`/editor/${id}`}
                className="btn btn-ghost w-full justify-start whitespace-nowrap px-3"
              >
                Document editor
              </Link>
            </>
          )}
          <Link
            href={`/stats?p=${id}`}
            className="btn btn-ghost w-full justify-start whitespace-nowrap px-3"
          >
            Views and clicks
          </Link>
          {!live && (
            <button
              type="button"
              className="btn btn-ghost border-divider w-full justify-start whitespace-nowrap border-t px-3"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              Delete portfolio
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * One page in the collection, set as a catalogue entry: its number, its
 * title, the address it prints at, and whether it is out there.
 *
 * The bar under the address is gone. It restated the status the stamp above
 * it had just given, in colour alone, as a 4px block — three strikes at once.
 */
function PortfolioCard({
  portfolio,
  index,
  onDelete,
  onPublish,
  onUnpublish,
}: {
  portfolio: Portfolio;
  /** 1-based entry number in the collection. */
  index: number;
  onDelete: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
}) {
  const handle = useAccount().account.profile.handle;
  const live = portfolio.status === "live";
  return (
    <div
      className="bg-bg flex min-h-[236px] flex-col gap-3 p-[22px]"
      // An inset hairline rather than a border: a live entry has to stand out
      // of the grid without moving the cell it sits in.
      style={live ? { boxShadow: "inset 0 0 0 1px var(--color-foil)" } : undefined}
    >
      <div className="flex items-center gap-2.5">
        <span className="plate-no text-[13px] text-muted">
          {String(index).padStart(2, "0")}
        </span>
        {/* The one place the entry states its status. "empty" and "draft"
            read the same to the owner — neither is on the internet — so the
            stamp says only whether the page is published. */}
        <span className={`status ${live ? "status-live" : "status-draft"}`}>
          {live ? STATUS_LABEL.live : STATUS_LABEL.draft}
        </span>
        <CardMenu id={portfolio.id} live={live} onDelete={onDelete} />
      </div>

      <div className="font-heading text-[24px] leading-[1.12]">{portfolio.name}</div>
      <div className="caption-credit">{pageAddress(handle, portfolio.slug)}</div>

      {portfolio.summary && (
        <p className="m-0 text-[13px] leading-[1.55] text-muted">{portfolio.summary}</p>
      )}

      <div className="border-divider mt-auto flex items-center gap-3 border-t pt-3.5">
        <span className="caption-credit">{portfolio.meta}</span>
        {/* Both states read the same way: preview the page, then the one
            verb that changes whether visitors can see it. */}
        <Link
          href={previewPath(portfolio.id)}
          className="btn btn-ghost ml-auto"
          target="_blank"
          rel="noopener noreferrer"
        >
          Preview
        </Link>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={live ? onUnpublish : onPublish}
        >
          {live ? "Unpublish" : "Publish"}
        </button>
      </div>
    </div>
  );
}

export function PortfolioList() {
  const {
    portfolios,
    createPortfolioAsync,
    deletePortfolio,
    updatePortfolio,
    storageError,
  } = usePortfolios();
  const [creating, setCreating] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const router = useRouter();
  const reduced = useReducedMotion();

  const live = portfolios.filter((p) => p.status === "live").length;

  // The server mints the id, so the dialog stays open until it answers —
  // navigating to a provisional id would land on a page that does not exist.
  async function create(
    name: string,
    slug: string,
    startFrom: StartFrom,
    summary: string,
  ) {
    setCreateError(null);
    try {
      const created = await createPortfolioAsync(name, slug, startFrom, summary);
      setCreating(false);
      router.push(`/editor/${created.id}`);
    } catch (error) {
      // A taken address is the common one, and the API says so in words.
      setCreateError(messageFor(error));
    }
  }

  return (
    <>
      <div className="nav bg-bg">
        <span className="nav-brand">Facet</span>
        <Link href="/" aria-current="page">
          Portfolios
        </Link>
        <Link href="/stats">Stats</Link>
        <Link href="/account">Account</Link>
      </div>

      {(createError ?? storageError) && (
        <div
          className="bg-surface px-6 py-3.5 text-[13px] sm:px-10"
          style={{
            color: "var(--color-alert)",
            borderBottom:
              "1px solid color-mix(in srgb, var(--color-alert) 45%, transparent)",
          }}
          role="alert"
        >
          {createError ?? storageError}
        </div>
      )}

      {/* The collection's own half-title. */}
      <div className="border-divider border-b px-6 pt-12 pb-7 sm:px-10">
        <h1
          className="font-heading m-0 text-[40px] leading-[0.95] sm:text-[56px]"
          style={{ letterSpacing: "-0.03em" }}
        >
          Your portfolios
        </h1>
        <p className="caption-credit mt-5 mb-0">
          {portfolios.length} {portfolios.length === 1 ? "page" : "pages"} ·{" "}
          {live} published
        </p>
        <p className="m-0 mt-6 max-w-[58ch] text-[15px] leading-[1.6] text-muted">
          Each one is a page with a header and as many sections as you need. Keep a
          full one for everything you do, and short ones for the rooms where only
          part of it matters.
        </p>
      </div>

      {/* Cell borders, not gap-bleed — a partly-filled last row would
          otherwise leave empty blocks where the ground shows through. */}
      <div className="border-divider grid border-t sm:grid-cols-2 lg:grid-cols-3 [&>*]:border-b [&>*]:border-r [&>*]:border-[var(--color-divider)]">
        {portfolios.map((p, i) => (
          // The collection settles in rather than appearing: each entry a
          // beat behind the one before it, capped at six so a long list does
          // not make the last card wait half a second.
          <motion.div
            key={p.id}
            className="flex"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, filter: "blur(5px)" }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={
              reduced
                ? { duration: 0.12 }
                : { duration: 0.46, delay: Math.min(i, 6) * 0.04, ease: [0.16, 1, 0.3, 1] }
            }
          >
            <PortfolioCard
              portfolio={p}
              index={i + 1}
              onDelete={() => deletePortfolio(p.id)}
              onPublish={() =>
                updatePortfolio(p.id, (prev) => ({ ...prev, status: "live" }))
              }
              onUnpublish={() =>
                updatePortfolio(p.id, (prev) => ({ ...prev, status: "draft" }))
              }
            />
          </motion.div>
        ))}

        <div className="bg-surface flex min-h-[236px] flex-col gap-3 p-[22px] shadow-[inset_0_0_0_1px_var(--color-divider)]">
          <div className="font-heading text-[24px] leading-[1.12]">Create portfolio</div>
          <p className="m-0 text-[13px] leading-[1.55] text-muted">
            Start blank, or copy one you already have and cut it down.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-block mt-auto"
            onClick={() => setCreating(true)}
          >
            Create
          </button>
        </div>
      </div>

      {/* The fixed Share button sits over the page, so the last row of cards
          needs room to scroll clear of it. */}
      {portfolios.length > 0 && <div className="h-[90px]" aria-hidden />}

      {/* Fixed to the bottom centre, so it stays reachable however far down
          a long list of cards you are. */}
      {portfolios.length > 0 && (
        <button
          type="button"
          className="btn btn-primary fixed bottom-6 left-1/2 z-40 -translate-x-1/2"
          style={{ boxShadow: "var(--shadow-lg)" }}
          onClick={() => setSharing(true)}
        >
          Share
        </button>
      )}

      {creating && (
        <CreatePortfolioDialog
          portfolios={portfolios}
          onCancel={() => setCreating(false)}
          onCreate={create}
        />
      )}

      {sharing && (
        <ShareDialog
          portfolios={portfolios}
          initialId={portfolios.find((p) => p.status === "live")?.id ?? portfolios[0].id}
          onClose={() => setSharing(false)}
        />
      )}
    </>
  );
}
