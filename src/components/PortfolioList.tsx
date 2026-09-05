"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CreatePortfolioDialog } from "./CreatePortfolioDialog";
import { ShareDialog } from "./ShareDialog";
import { messageFor } from "@/lib/api";
import { usePortfolios, type StartFrom } from "@/lib/store";
import { STATUS_LABEL, pageAddress, previewPath, type Portfolio } from "@/lib/types";
import { useAccount } from "@/lib/account";

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
        className="text-neutral-600 hover:text-ink cursor-pointer px-1 font-extrabold"
      >
        ⋯
      </button>
      {open && (
        <div
          className="border-divider bg-bg absolute right-0 top-6 z-10 border-2"
          style={{ boxShadow: "var(--shadow-md)" }}
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

function PortfolioCard({
  portfolio,
  onDelete,
  onPublish,
  onUnpublish,
}: {
  portfolio: Portfolio;
  onDelete: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
}) {
  const handle = useAccount().account.profile.handle;
  const live = portfolio.status === "live";
  return (
    <div
      className="bg-bg flex min-h-[230px] flex-col gap-2.5 p-[22px]"
      // An inset ring rather than a border: a live card has to stand out of
      // the grid without moving the cell it sits in.
      style={live ? { boxShadow: "inset 0 0 0 2px var(--color-accent)" } : undefined}
    >
      <div className="flex items-center gap-2">
        {/* The one place the card states its status. "empty" and "draft"
            read the same to the owner — neither is on the internet — so the
            tag says only whether the page is published. */}
        <span className={`status ${live ? "status-live" : "status-draft"}`}>
          {live ? STATUS_LABEL.live : STATUS_LABEL.draft}
        </span>
        <CardMenu id={portfolio.id} live={live} onDelete={onDelete} />
      </div>

      <div className="font-heading text-[22px] font-extrabold leading-[1.15]">
        {portfolio.name}
      </div>
      <div className="text-neutral-700 text-xs">{pageAddress(handle, portfolio.slug)}</div>

      <div
        className={`h-1 w-full ${live ? "bg-accent" : "bg-neutral-400"}`}
        aria-hidden
      />

      {portfolio.summary && (
        <div className="text-neutral-800 text-[13px]">{portfolio.summary}</div>
      )}

      <div className="border-divider mt-auto flex items-center gap-2 border-t pt-3">
        <span className="text-neutral-600 text-[11px]">{portfolio.meta}</span>
        {/* Both states read the same way: preview the page, then the one
            verb that changes whether visitors can see it. */}
        <Link
          href={previewPath(portfolio.id)}
          className="font-heading ml-auto text-xs font-extrabold"
          target="_blank"
          rel="noopener noreferrer"
        >
          Preview
        </Link>
        <button
          type="button"
          className="font-heading cursor-pointer text-xs font-extrabold"
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
        <span className="nav-brand">FACET</span>
        <Link href="/" aria-current="page">
          Portfolios
        </Link>
        <Link href="/stats">Stats</Link>
        <Link href="/account">Account</Link>
      </div>

      {(createError ?? storageError) && (
        <div
          className="border-accent bg-surface border-l-2 px-6 py-3 text-[13px] sm:px-10"
          role="alert"
        >
          {createError ?? storageError}
        </div>
      )}

      <div className="border-divider border-b px-6 pb-6 pt-8 sm:px-10">
        <h1 className="mb-2.5 text-[32px] sm:text-[40px]">Your portfolios</h1>
        <p className="m-0 max-w-[56ch] text-base">
          Each one is a page with a header and as many sections as you need. Keep a
          full one for everything you do, and short ones for the rooms where only
          part of it matters.
        </p>
      </div>

      {/* Cell borders, not gap-bleed — a partly-filled last row would
          otherwise leave empty grey blocks where the ground shows through. */}
      <div className="border-divider grid border-t sm:grid-cols-2 lg:grid-cols-3 [&>*]:border-b [&>*]:border-r [&>*]:border-[var(--color-divider)]">
        {portfolios.map((p) => (
          <PortfolioCard
            key={p.id}
            portfolio={p}
            onDelete={() => deletePortfolio(p.id)}
            onPublish={() =>
              updatePortfolio(p.id, (prev) => ({ ...prev, status: "live" }))
            }
            onUnpublish={() =>
              updatePortfolio(p.id, (prev) => ({ ...prev, status: "draft" }))
            }
          />
        ))}

        <div className="bg-surface flex min-h-[230px] flex-col gap-2.5 p-[22px] shadow-[inset_0_0_0_2px_var(--color-divider)]">
          <div className="text-accent font-heading text-[34px] font-extrabold leading-none">
            +
          </div>
          <div className="font-heading text-xl font-extrabold">Create portfolio</div>
          <p className="text-neutral-800 m-0 text-[13px]">
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
