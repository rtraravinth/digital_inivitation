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

/**
 * Where this server reaches the API. Behind one address (see the
 * Dockerfile) the browser's base is "" — a relative URL, which means
 * nothing to a fetch made on the server — so the server is told separately.
 */
const SERVER_API_BASE = process.env.API_INTERNAL_URL?.replace(/\/$/, "") || API_BASE;

export type PublishedPrivacy = {
  noindex: boolean;
  badge: boolean;
  showContact: boolean;
};

export type Published = {
  /** The owner's, which analytics posts name the page by. */
  subdomain: string;
  portfolio: Portfolio;
  privacy: PublishedPrivacy;
};

type PublicPayload = Omit<Portfolio, "status" | "summary" | "meta"> & PublishedPrivacy;

export async function fetchPublished(
  subdomain: string,
  slug: string,
): Promise<Published | null> {
  let response: Response;
  try {
    response = await fetch(`${SERVER_API_BASE}/api/v1/public/p/${encodeURIComponent(subdomain)}/${encodeURIComponent(slug)}`, {
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
    subdomain,
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

/**
 * A published page on its owner's own domain. The API answers only for a
 * domain whose owner has verified it, so pointing DNS at us is not enough
 * to put a name in front of somebody else's pages.
 */
export async function fetchPublishedOnDomain(domain: string, slug: string): Promise<Published | null> {
  let response: Response;
  try {
    response = await fetch(`${SERVER_API_BASE}/api/v1/public/domains/${encodeURIComponent(domain)}`, {
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const { subdomain } = (await response.json()) as { subdomain: string };
  return fetchPublished(subdomain, slug);
}

/**
 * A published resume, shaped as a whole Portfolio so `ResumeDocument` draws
 * it unchanged. The payload carries only what the resume prints: the
 * header, the sections on it and a resume whose unticked contact fields are
 * already empty.
 */
export async function fetchPublishedResume(subdomain: string, slug: string): Promise<Portfolio | null> {
  let response: Response;
  try {
    response = await fetch(
      `${SERVER_API_BASE}/api/v1/public/p/${encodeURIComponent(subdomain)}/${encodeURIComponent(slug)}/resume`,
      { cache: "no-store" },
    );
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const payload = (await response.json()) as Partial<Portfolio>;
  return normalize({
    id: "",
    summary: "",
    meta: "",
    ...payload,
    status: "draft",
    resumeStatus: "live",
  } as Portfolio);
}

/** The same, on the owner's verified custom domain. */
export async function fetchPublishedResumeOnDomain(domain: string, slug: string): Promise<Portfolio | null> {
  let response: Response;
  try {
    response = await fetch(`${SERVER_API_BASE}/api/v1/public/domains/${encodeURIComponent(domain)}`, {
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const { subdomain } = (await response.json()) as { subdomain: string };
  return fetchPublishedResume(subdomain, slug);
}
