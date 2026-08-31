"use client";

import { useRef, useState } from "react";

/**
 * A real button driving a hidden file input — a bare <label> would not be
 * keyboard focusable, and the design system styles buttons, not labels.
 */
export function UploadButton({
  label,
  accept,
  onPick,
  onError,
}: {
  label: string;
  accept: string;
  onPick: (file: File) => Promise<void>;
  onError: (message: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={busy}
        onClick={() => ref.current?.click()}
      >
        {busy ? "Reading…" : label}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // let the same file be picked again after a removal
          if (!file) return;
          setBusy(true);
          onError("");
          try {
            await onPick(file);
          } catch (err) {
            onError(err instanceof Error ? err.message : "That file could not be read.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
