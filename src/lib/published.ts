import { API_BASE } from "./api";
import { normalize, type Portfolio } from "./types";

/**
 * Fetching a published page, on the server.
 *
 * The privacy switches arrive already applied: header links are absent when
 * the owner hides contact details, and hidden sections are not in the payload
 * at all. The page renders what it is given rather than deciding what to
 * conceal, which is the only way those switches can mean anything to someone
 * who is not signed in.
 */

export type PublishedPrivacy = {
  noindex: boolean;
  badge: boolean;
  showContact: boolean;
};

export type Published = {
  portfolio: Portfolio;
  privacy: PublishedPrivacy;
};

type PublicPayload = Omit<Portfolio, "status" | "summary" | "meta"> & PublishedPrivacy;

export async function fetchPublished(
  handle: string,
  slug: string,
): Promise<Published | null> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/v1/public/p/${encodeURIComponent(handle)}/${encodeURIComponent(slug)}`, {
      // Always current: a page edited a moment ago must not be served stale.
      cache: "no-store",
    });
  } catch {
    // The API is unreachable. Treat it as "no page" rather than a crash —
    // the route renders its own not-found.
    return null;
  }

  if (!response.ok) return null;

  const payload = (await response.json()) as PublicPayload;

  return {
    // The public payload has no editor-only fields; fill them in so every
    // theme can keep taking a whole Portfolio.
    portfolio: normalize({
      ...payload,
      status: "live",
      summary: "",
      meta: "",
    } as Portfolio),
    privacy: {
      noindex: payload.noindex,
      badge: payload.badge,
      showContact: payload.showContact,
    },
  };
}
