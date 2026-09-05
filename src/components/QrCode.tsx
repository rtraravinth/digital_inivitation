"use client";

import { useMemo } from "react";
import { QUIET_ZONE, qrMatrix, qrPath } from "@/lib/qr";

/**
 * A real, scannable QR code rendered as one SVG path — see lib/qr.ts for the
 * encoder. Downloading rasterises the same matrix to a canvas, so the PNG and
 * the on-screen code are the same code.
 */
export function QrCode({
  text,
  size = 104,
  downloadName,
  downloadVariant = "label",
}: {
  text: string;
  size?: number;
  downloadName?: string;
  /**
   * Where the download control goes. "label" is a plain button under the
   * code; "attached" docks it inside the code's own frame, below the
   * modules — never over them, so nothing a scanner reads is covered.
   */
  downloadVariant?: "label" | "attached";
}) {
  // Encoding is pure, so the failure is a value rather than a state update —
  // setState during render is exactly what the React Compiler lint rejects.
  const code = useMemo(() => {
    try {
      const matrix = qrMatrix(text);
      return {
        matrix,
        path: qrPath(matrix),
        span: matrix.length + QUIET_ZONE * 2,
        error: null as string | null,
      };
    } catch (err) {
      return {
        matrix: null,
        path: "",
        span: 0,
        error: err instanceof Error ? err.message : "That address is too long to encode.",
      };
    }
  }, [text]);

  function download() {
    const matrix = code.matrix;
    if (!matrix) return;
    const scale = 8;
    const span = (matrix.length + QUIET_ZONE * 2) * scale;
    const canvas = document.createElement("canvas");
    canvas.width = span;
    canvas.height = span;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // A quiet zone of light modules is part of the code, not a margin.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, span, span);
    ctx.fillStyle = "#000000";
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix.length; c++) {
        if (matrix[r][c]) {
          ctx.fillRect(
            (c + QUIET_ZONE) * scale,
            (r + QUIET_ZONE) * scale,
            scale,
            scale,
          );
        }
      }
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName ?? "facet-qr.png";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  if (code.error) {
    return (
      <div
        className="flex items-center justify-center p-3 text-[11px]"
        style={{
          width: size,
          height: size,
          boxShadow: "inset 0 0 0 2px var(--color-divider)",
        }}
      >
        {code.error}
      </div>
    );
  }

  const svg = (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${code.span} ${code.span}`}
      role="img"
      aria-label={`QR code for ${text}`}
      shapeRendering="crispEdges"
      style={{ background: "#fff" }}
    >
      <g transform={`translate(${QUIET_ZONE} ${QUIET_ZONE})`}>
        <path d={code.path} fill="#000" />
      </g>
    </svg>
  );

  if (downloadVariant === "attached") {
    return (
      // One framed block: the code, then its own action bar under it. The
      // button never sits over the modules — a covered module is a code that
      // may not scan, and the quiet zone around it is part of the code too.
      <div
        className="inline-flex flex-col"
        style={{ boxShadow: "inset 0 0 0 2px var(--color-divider)" }}
      >
        <div className="p-2.5">{svg}</div>
        {downloadName && (
          <button
            type="button"
            aria-label="Download the code as a PNG"
            title="Download PNG"
            onClick={download}
            className="hover:bg-accent hover:text-bg flex h-11 cursor-pointer items-center justify-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.06em] transition-colors"
            style={{ boxShadow: "inset 0 2px 0 var(--color-divider)" }}
          >
            <DownloadGlyph />
            PNG
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {svg}
      {downloadName && (
        <button type="button" className="btn btn-secondary text-xs" onClick={download}>
          Download PNG
        </button>
      )}
    </div>
  );
}

/** A tray with an arrow into it. Drawn, not a font glyph, so it lines up. */
function DownloadGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden focusable="false">
      <path
        d="M7 1v7.5M3.5 6L7 9.5 10.5 6M1.5 12.5h11"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
