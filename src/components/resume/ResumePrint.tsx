"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ResumeDocument } from "./ResumeDocument";
import { ThemeSwitch } from "../AppHeader";
import { PageState } from "../ui";
import { PAPERS, resumeFileName, sheetMetrics, templateOf } from "@/lib/resume";
import { layerCss, sheetLayers } from "@/lib/resume-backdrops";
import { usePortfolios } from "@/lib/store";

/**
 * The resume alone, for the browser's own Save as PDF — the same route the
 * print-all page takes, for the same reason: the browser's PDF engine sets
 * real, selectable, linkable text, which is what an ATS reads, and a
 * library in the bundle would only produce a worse copy of it.
 *
 * The @page rule is written here per resume, because paper size and margin
 * are the author's choice. The document title becomes the PDF's file name.
 */
export function ResumePrint({ id }: { id: string }) {
  const { ready, getPortfolio } = usePortfolios();
  const auto = useSearchParams().get("print") === "1";
  const p = getPortfolio(id);

  useEffect(() => {
    if (!p) return;
    const previous = document.title;
    document.title = resumeFileName(p);
    return () => {
      document.title = previous;
    };
  }, [p]);

  // Wait for the faces and the photo, or the PDF is set in a fallback font.
  const loaded = !!p;
  useEffect(() => {
    if (!loaded || !auto) return;
    let cancelled = false;
    const images = [...document.querySelectorAll<HTMLImageElement>(".resume img")];
    void Promise.all([
      document.fonts.ready,
      ...images.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => img.addEventListener("load", r, { once: true })))),
    ]).then(() => {
      if (!cancelled) window.setTimeout(() => window.print(), 250);
    });
    return () => {
      cancelled = true;
    };
  }, [loaded, auto]);

  if (!p) {
    return ready ? (
      <PageState title="That resume doesn’t exist" note="It may have been deleted, or the link is from another account.">
        <Link href="/" className="btn btn-primary" style={{ marginTop: 0 }}>
          Back to portfolios
        </Link>
      </PageState>
    ) : (
      <PageState busy title="Preparing your resume…" />
    );
  }

  const m = sheetMetrics(p.resume);
  const template = templateOf(p.resume.style.template);
  // The paper ground (a solid column's colour) and any background graphic
  // are painted on the printed page, not the sheet: the page reaches every
  // edge of every page, where the sheet starts below each top margin and
  // stops where its text does. The gradient is horizontal and the patterns
  // repeat, so the page's height does not matter.
  const pageBackground = layerCss(sheetLayers(p.resume));

  return (
    <>
      {/* No page margin: the browser prints its own header and footer — date,
          title, address, page number — in that margin, and with none there is
          nowhere to put them, whatever its "Headers and footers" box says.
          Each page's top and bottom room comes from the table below instead. */}
      <style>{`
        @page { size: ${PAPERS[p.resume.style.paper].css}; margin: 0; }
        @media print { html { ${pageBackground} -webkit-print-color-adjust: exact; print-color-adjust: exact; } body { background: transparent !important; } }
      `}</style>

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
          href={`/builder/${p.id}?mode=resume`}
          className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13.5px] font-medium no-underline hover:bg-[var(--color-neutral-200)]"
          style={{ color: "var(--color-ink)" }}
        >
          <span aria-hidden>←</span> Builder
        </Link>
        <span className="mr-auto min-w-0 truncate text-[13.5px]" style={{ color: "var(--color-neutral-700)" }}>
          <span className="font-semibold" style={{ color: "var(--color-ink)" }}>
            {resumeFileName(p)}
          </span>
          <span className="hidden sm:inline">
            {" "}
            · {template.name} · {PAPERS[p.resume.style.paper].name}. Choose <strong>Save as PDF</strong> in the dialog.
          </span>
        </span>
        <ThemeSwitch />
        <button type="button" className="btn btn-primary" style={{ marginTop: 0 }} onClick={() => window.print()}>
          Save as PDF
        </button>
      </header>

      <main className="resume-print-stage flex justify-center overflow-x-auto px-4 py-8 print:block print:p-0">
        <div className="flex-none print:shadow-none" style={{ boxShadow: "0 12px 40px -12px rgb(0 0 0 / 0.3)" }}>
          {/* A table because its header and footer repeat on every printed
              page: the empty cells in them are each page's top and bottom
              margin, which the @page rule no longer supplies. */}
          <table className="resume-paper" style={{ "--r-page-margin": `${m.marginY}mm` } as React.CSSProperties}>
            <thead>
              <tr>
                <td>
                  <div className="resume-paper-gap" />
                </td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <ResumeDocument p={p} print />
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>
                  <div className="resume-paper-gap" />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </main>
    </>
  );
}
