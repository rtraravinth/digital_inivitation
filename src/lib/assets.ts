import type { Asset } from "./types";

/**
 * There is no backend, so uploads live in localStorage as data URIs. That
 * budget is roughly 5MB for the whole origin, so images are downscaled hard
 * and other files are capped outright.
 */
export const IMAGE_MAX_DIM = 1400;
export const IMAGE_TARGET_BYTES = 420 * 1024;
export const FILE_MAX_BYTES = 800 * 1024;

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read that file."));
    r.readAsDataURL(file);
  });
}

/** Rough byte length of a data URI's payload. */
function dataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(",");
  return Math.round(((dataUrl.length - i - 1) * 3) / 4);
}

/**
 * Downscale to IMAGE_MAX_DIM and step the JPEG quality down until the result
 * fits the budget. SVGs pass through untouched — they're already small.
 */
export async function readImageAsset(file: File): Promise<Asset> {
  if (!file.type.startsWith("image/")) {
    throw new Error("That isn't an image.");
  }

  if (file.type === "image/svg+xml") {
    const dataUrl = await readAsDataUrl(file);
    const size = dataUrlBytes(dataUrl);
    if (size > FILE_MAX_BYTES) {
      throw new Error(`That SVG is ${formatBytes(size)} — the limit is ${formatBytes(FILE_MAX_BYTES)}.`);
    }
    return { name: file.name, mime: file.type, dataUrl, size };
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, IMAGE_MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't process images.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  let dataUrl = "";
  let size = Infinity;
  for (const quality of [0.72, 0.6, 0.48, 0.36, 0.25]) {
    dataUrl = canvas.toDataURL("image/jpeg", quality);
    size = dataUrlBytes(dataUrl);
    if (size <= IMAGE_TARGET_BYTES) break;
  }
  if (size > IMAGE_TARGET_BYTES * 2) {
    throw new Error("That image is too large to store even after compressing.");
  }

  return { name: file.name, mime: "image/jpeg", dataUrl, size };
}

/** Any other attachment — a PDF one-pager, say. Capped, not compressed. */
export async function readFileAsset(file: File): Promise<Asset> {
  if (file.size > FILE_MAX_BYTES) {
    throw new Error(
      `${formatBytes(file.size)} is over the ${formatBytes(FILE_MAX_BYTES)} limit for attachments.`,
    );
  }
  const dataUrl = await readAsDataUrl(file);
  return {
    name: file.name,
    mime: file.type || "application/octet-stream",
    dataUrl,
    size: dataUrlBytes(dataUrl),
  };
}
