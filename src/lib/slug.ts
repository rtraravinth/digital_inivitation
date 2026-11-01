/**
 * A page's address segment: lowercase letters, digits and inner hyphens, one
 * segment, 2–120 characters. Mirrors SLUG_PATTERN in
 * backend/app/schemas/portfolio.py — the handle in front of it is the
 * namespace, so a slug never nests.
 */
const SLUG = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function isSlug(value: string): boolean {
  return value.length >= 2 && value.length <= 120 && SLUG.test(value);
}

/** The nearest valid slug to whatever was typed. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
}

/**
 * The address a visitor actually opens, as it reads in a browser bar:
 * this app's own host and the real published route. The `facet.page`
 * vanity domain does not serve anything yet, so it is not what a card
 * should hand out as the link.
 */
export function liveUrl(handle: string, slug: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/p/${handle}/${slug}`;
}

/** `liveUrl` without the protocol, for display. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "");
}
