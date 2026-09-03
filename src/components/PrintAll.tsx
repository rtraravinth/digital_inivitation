"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { PublishedBody } from "./published/themes";
import { usePortfolios } from "@/lib/store";

/**
 * Every page, stacked with a page break between, for the browser's own
 * "Save as PDF". That is the honest form of the canvas's "Download all pages
 * as PDF": generating a real PDF in-browser would need a library, and the
 * print pipeline already renders these themes correctly.
 */
export function PrintAll() {
  const { portfolios, ready } = usePortfolios();
  const params = useSearchParams();
  const only = params.get("p");

  const pages = only ? portfolios.filter((p) => p.id === only) : portfolios;

  // ?auto=1 opens straight into the print dialog, which is what the button
  // on /account uses. Wait a tick so fonts and images are laid out first.
  useEffect(() => {
    if (!ready || pages.length === 0 || params.get("auto") !== "1") return;
    const t = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(t);
  }, [ready, pages.length, params]);

  return (
    <>
      <div className="no-print nav bg-bg gap-3">
        <Link href="/account" className="font-heading text-[13px] font-extrabold">
          ← Account
        </Link>
        <span className="nav-brand mr-auto text-[15px]">
          {pages.length} {pages.length === 1 ? "page" : "pages"} to print
        </span>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>

      <p className="no-print text-neutral-700 m-0 px-4 py-3 text-[13px] sm:px-6">
        Your browser&rsquo;s print dialog has a <strong>Save as PDF</strong> destination.
        Each portfolio starts on a new page.
      </p>

      {pages.map((p) => (
        <section key={p.id} className="page-break">
          <PublishedBody p={p} />
        </section>
      ))}

      {ready && pages.length === 0 && (
        <p className="p-10">Nothing to print — no portfolios yet.</p>
      )}
    </>
  );
}
