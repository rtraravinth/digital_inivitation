"use client";

import Link from "next/link";
import { useAccount } from "@/lib/account";
import { usePortfolios } from "@/lib/store";
import { pageAddress, pagePath, previewPath, type Portfolio } from "@/lib/types";

/**
 * What every editing screen shows in place of itself while the portfolio is
 * live. The page a visitor is reading is frozen: the API answers 409 to any
 * write, so offering the controls would only produce error banners. Preview
 * and Unpublish are the two things that still make sense here.
 */
export function PublishedLock({ portfolio }: { portfolio: Portfolio }) {
  const { updatePortfolio, storageError } = usePortfolios();
  const handle = useAccount().account.profile.handle;

  const unpublish = () =>
    updatePortfolio(portfolio.id, (prev) => ({ ...prev, status: "draft" }));

  return (
    <>
      <div className="nav bg-bg gap-3.5">
        <Link href="/" className="font-heading text-[13px] font-extrabold">
          ← Portfolios
        </Link>
        <span className="nav-brand mr-0 hidden text-[15px] sm:inline">{portfolio.name}</span>
        <span className="status status-live mr-auto">Published</span>
        <Link
          href={previewPath(portfolio.id)}
          className="btn btn-secondary"
          target="_blank"
          rel="noopener noreferrer"
        >
          Preview
        </Link>
        <button type="button" className="btn btn-primary" onClick={unpublish}>
          Unpublish
        </button>
      </div>

      {storageError && (
        <div
          role="alert"
          className="px-4 py-2.5 text-[13px] font-extrabold"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        >
          {storageError}
        </div>
      )}

      <div className="border-divider border-b px-6 pb-10 pt-10 sm:px-10">
        <span className="status status-live mb-4 inline-flex">Published</span>
        <h1 className="mb-2.5 text-[32px] sm:text-[40px]">{portfolio.name} is published</h1>
        <p className="m-0 max-w-[56ch] text-base">
          It is at {pageAddress(handle, portfolio.slug)}, and anyone with the address
          can read it. A published page cannot be edited or deleted — unpublish it
          first, make the changes, then publish again.
        </p>

        <div className="mt-7 flex flex-wrap gap-2.5">
          <Link
            href={previewPath(portfolio.id)}
            className="btn btn-secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            Preview the page
          </Link>
          {/* The visitor's own address, which exists only while this is
              live — the one place in the app where that is the right link. */}
          <Link
            href={pagePath(handle, portfolio.slug)}
            className="btn btn-secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            Published page ↗
          </Link>
          <button type="button" className="btn btn-primary" onClick={unpublish}>
            Unpublish to edit
          </button>
          <Link href={`/stats?p=${portfolio.id}`} className="btn btn-ghost">
            Views and clicks
          </Link>
        </div>
      </div>
    </>
  );
}
