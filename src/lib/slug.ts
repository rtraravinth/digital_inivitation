import { subdomainOrigin } from "./hosts";

/**
 * A page's address segment: lowercase letters, digits and inner hyphens, one
 * segment, 2–120 characters. Mirrors SLUG_PATTERN in
 * backend/app/schemas/portfolio.py — the subdomain in front of it is the
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
 * `<subdomain>.<root>/<slug>` once a root domain is configured
 * (`NEXT_PUBLIC_ROOT_DOMAIN`, see `lib/hosts.ts`), and the app's own
 * `/p/<subdomain>/<slug>` route until then.
 */
export function liveUrl(subdomain: string, slug: string): string {
  const origin = subdomainOrigin(subdomain);
  if (origin) return `${origin}/${slug}`;
  const here = typeof window === "undefined" ? "" : window.location.origin;
  return `${here}/p/${subdomain}/${slug}`;
}

/** `liveUrl` without the protocol, for display. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "");
}
