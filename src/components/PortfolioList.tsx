"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CreatePortfolioDialog } from "./CreatePortfolioDialog";
import { messageFor } from "@/lib/api";
import { usePortfolios, type StartFrom } from "@/lib/store";
import { STATUS_LABEL, type Portfolio } from "@/lib/types";

function CardMenu({ id, onDelete }: { id: string; onDelete: () => void }) {
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
          <Link
            href={`/builder/${id}`}
            className="btn btn-ghost w-full justify-start whitespace-nowrap px-3"
          >
            Visual builder
          </Link>
          <Link
            href={`/themes/${id}`}
            className="btn btn-ghost w-full justify-start whitespace-nowrap px-3"
          >
            Change theme
          </Link>
          <Link
            href={`/blocks/${id}`}
            className="btn btn-ghost w-full justify-start whitespace-nowrap px-3"
          >
            Manage blocks
          </Link>
          <Link
            href={`/stats?p=${id}`}
            className="btn btn-ghost w-full justify-start whitespace-nowrap px-3"
          >
            Views and clicks
          </Link>
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
        </div>
      )}
    </div>
  );
}

function PortfolioCard({
  portfolio,
  onDelete,
}: {
  portfolio: Portfolio;
  onDelete: () => void;
}) {
  const live = portfolio.status === "live";
  return (
    <div className="bg-bg flex min-h-[230px] flex-col gap-2.5 p-[22px]">
      <div className="flex items-center gap-2">
        <span className={`tag ${live ? "tag-accent" : "tag-neutral"}`}>
          {STATUS_LABEL[portfolio.status]}
        </span>
        <CardMenu id={portfolio.id} onDelete={onDelete} />
      </div>

      <div className="font-heading text-[22px] font-extrabold leading-[1.15]">
        {portfolio.name}
      </div>
      <div className="text-neutral-700 text-xs">facet.page/{portfolio.slug}</div>

      <div
        className={`h-1 w-full ${live ? "bg-accent" : "bg-neutral-400"}`}
        aria-hidden
      />

      <div className="text-neutral-800 text-[13px]">{portfolio.summary}</div>

      <div className="border-divider mt-auto flex items-center gap-2 border-t pt-3">
        <span className="text-neutral-600 text-[11px]">{portfolio.meta}</span>
        <Link
          href={`/builder/${portfolio.id}`}
          className="font-heading ml-auto text-xs font-extrabold"
        >
          Builder
        </Link>
        <Link
          href={`/editor/${portfolio.id}`}
          className="font-heading text-xs font-extrabold"
        >
          Edit →
        </Link>
      </div>
    </div>
  );
}

export function PortfolioList() {
  const { portfolios, createPortfolioAsync, deletePortfolio, storageError } =
    usePortfolios();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const router = useRouter();

  // The server mints the id, so the dialog stays open until it answers —
  // navigating to a provisional id would land on a page that does not exist.
  async function create(name: string, slug: string, startFrom: StartFrom) {
    setCreateError(null);
    try {
      const created = await createPortfolioAsync(name, slug, startFrom);
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
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setCreating(true)}
        >
          + Create portfolio
        </button>
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

      {creating && (
        <CreatePortfolioDialog
          portfolios={portfolios}
          onCancel={() => setCreating(false)}
          onCreate={create}
        />
      )}
    </>
  );
}
