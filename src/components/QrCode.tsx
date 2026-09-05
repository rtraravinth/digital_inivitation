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
}: {
  text: string;
  size?: number;
  downloadName?: string;
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

  return (
    <div className="flex flex-col items-start gap-2">
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
      {downloadName && (
        <button type="button" className="btn btn-secondary text-xs" onClick={download}>
          Download PNG
        </button>
      )}
    </div>
  );
}
