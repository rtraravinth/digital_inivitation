"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  PreviewProvider,
  PublishedBody,
  PublishedHandleProvider,
} from "./published/themes";
import { ThemeSwitch } from "./AppHeader";
import { PageState } from "./ui";
import { useAccount } from "@/lib/account";
import { usePortfolios } from "@/lib/store";

/**
 * Every page, stacked with a page break between, for the browser's own
 * "Save as PDF". That is the honest form of the canvas's "Download all pages
 * as PDF": generating a real PDF in-browser would need a library, and the
 * print pipeline already renders these themes correctly.
 */
export function PrintAll() {
  const { portfolios, ready } = usePortfolios();
  const handle = useAccount().account.profile.handle;
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
      <header
        className="no-print sticky top-0 z-30 flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-6"
        style={{
          background: "color-mix(in srgb, var(--color-bg) 86%, transparent)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <Link
          href="/account"
          className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13.5px] font-medium no-underline hover:bg-[var(--color-neutral-200)]"
          style={{ color: "var(--color-ink)" }}
        >
          <span aria-hidden>←</span> Account
        </Link>
        <span className="mr-auto min-w-0 text-[13.5px]" style={{ color: "var(--color-neutral-700)" }}>
          <span className="font-semibold" style={{ color: "var(--color-ink)" }}>
            {pages.length} {pages.length === 1 ? "page" : "pages"}
          </span>{" "}
          <span className="hidden sm:inline">· each starts on a new sheet. Choose <strong>Save as PDF</strong> in the dialog.</span>
        </span>
        <ThemeSwitch />
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: 0 }}
          disabled={pages.length === 0}
          onClick={() => window.print()}
        >
          Print / Save as PDF
        </button>
      </header>

      {/* The owner's own copy of every page: no click belongs in the
          analytics, and nothing here is a visitor. */}
      <PreviewProvider value>
        <PublishedHandleProvider value={handle}>
          {pages.map((p) => (
            <section key={p.id} className="page-break">
              <PublishedBody p={p} />
            </section>
          ))}
        </PublishedHandleProvider>
      </PreviewProvider>

      {ready && pages.length === 0 && (
        <PageState title="Nothing to print yet" note="Create a portfolio and it will appear here, one page per sheet.">
          <Link href="/" className="btn btn-primary" style={{ marginTop: 0 }}>
            Go to portfolios
          </Link>
        </PageState>
      )}
    </>
  );
}
