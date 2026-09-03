import { api } from "./api";
import type { Asset } from "./types";

/**
 * Uploads go to the API, which stores the bytes, downscales images and
 * strips their EXIF metadata on the way in.
 *
 * The browser used to do that work itself, because localStorage was the only
 * backend and a data URI had to fit inside a ~5MB origin budget. It no longer
 * does: the server resizes better, a phone photo's GPS coordinates never
 * reach a public page, and the old size ceilings are gone.
 */

/** Still shown next to attachments in the editor and on /account. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function upload(file: File, kind: "image" | "file"): Promise<Asset> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);

  // The API answers with a human-readable message for every refusal it can
  // make — too large, wrong type — so callers show `error.message` verbatim.
  return api.upload<Asset>("/assets", form);
}

export async function readImageAsset(file: File): Promise<Asset> {
  if (!file.type.startsWith("image/")) {
    // Caught here so the obvious mistake does not need a round trip.
    throw new Error("That isn't an image.");
  }
  return upload(file, "image");
}

export async function readFileAsset(file: File): Promise<Asset> {
  return upload(file, "file");
}
