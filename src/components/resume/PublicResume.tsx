"use client";

import { useSearchParams } from "next/navigation";
import { ResumeStage, usePrintWhenReady, useResumeTitle } from "./ResumePrint";
import { resumeFileName } from "@/lib/resume";
import type { Portfolio } from "@/lib/types";

/**
 * A published resume, for anyone with the link: the sheet under a bar with
 * one button, which opens the browser's own Save as PDF. The print behaviour
 * is `ResumePrint`'s, shared — real text, the author's paper size, the file
 * name from the person's name. `?print=1` opens the dialog on load.
 */
export function PublicResume({ p }: { p: Portfolio }) {
  const auto = useSearchParams().get("print") === "1";
  useResumeTitle(p);
  usePrintWhenReady(auto);

  return (
    <>
      <header
        className="no-print sticky top-0 z-30 flex min-h-14 items-center gap-3 px-3 py-2 sm:px-6"
        style={{
          background: "color-mix(in srgb, var(--color-bg) 86%, transparent)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <span className="mr-auto min-w-0 truncate text-[13.5px] font-semibold" style={{ color: "var(--color-ink)" }}>
          {resumeFileName(p)}
        </span>
        <button type="button" className="btn btn-primary" style={{ marginTop: 0 }} onClick={() => window.print()}>
          Download PDF
        </button>
      </header>
      <ResumeStage p={p} />
    </>
  );
}
