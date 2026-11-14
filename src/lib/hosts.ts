/**
 * Which address a request arrived on, and where a published page lives.
 *
 * A published page is `<subdomain>.<root>/<slug>` — `rohan.facetfolio.com/
 * founder` — and, once an owner points a domain they bought at us and it
 * verifies, `<their domain>/<slug>` as well. The app itself (sign-in, editor,
 * builder, previews) stays on the root.
 *
 * `NEXT_PUBLIC_ROOT_DOMAIN` names the root, port included when there is one
 * (`localhost:3000` in development: browsers resolve every `*.localhost` to
 * this machine, so `rohan.localhost:3000/founder` works with no hosts file).
 * It is build-time, like every `NEXT_PUBLIC_` value. Left empty, nothing is
 * served by host and pages stay at `/p/<subdomain>/<slug>` on whatever
 * address the app is opened from, which is what a LAN phone test needs.
 */

const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "")
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, "")
  .replace(/\/+$/, "");

/** Mirrors SUBDOMAIN_PATTERN in backend/app/schemas/account.py. */
const SUBDOMAIN = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

/** Which rule a typed subdomain breaks, or null when it is a valid one. */
export function subdomainProblem(value: string): string | null {
  if (!value) return "Choose a subdomain — it is the start of every page address.";
  if (value.length < 3) return "At least three characters.";
  if (value.length > 32) return "At most 32 characters.";
  if (/^-|-$/.test(value)) return "Can’t start or end with a hyphen.";
  if (!SUBDOMAIN.test(value)) return "Lowercase letters, numbers and hyphens only.";
  return null;
}

/** Labels under the root that are the app, never somebody's pages. */
const APP_LABELS = new Set(["www", "app"]);

/** Plain http only for a development root; every real one is https. */
function protocol(): string {
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(ROOT_DOMAIN) || ROOT_DOMAIN.endsWith(".localhost")
    ? "http:"
    : "https:";
}

/** The origin a subdomain's pages are served from, or "" with no root set. */
export function subdomainOrigin(subdomain: string): string {
  return ROOT_DOMAIN ? `${protocol()}//${subdomain}.${ROOT_DOMAIN}` : "";
}

/**
 * The input on the account page sits between these two: the subdomain is the
 * front of the host, so the fixed text is after it — or, with no root
 * configured, it is a path segment with the app's own address before it.
 */
export function subdomainFrame(): { before: string; after: string } {
  if (ROOT_DOMAIN) return { before: "", after: `.${ROOT_DOMAIN}` };
  const host = typeof window === "undefined" ? "" : window.location.host;
  return { before: `${host}/p/`, after: "" };
}

type HostKind =
  | { kind: "app" }
  | { kind: "subdomain"; subdomain: string }
  | { kind: "custom"; domain: string };

const IP_OR_LOCAL = /^(\[[0-9a-f:]+\]|\d{1,3}(\.\d{1,3}){3}|localhost)(:\d+)?$/;

/**
 * What a request's Host header names.
 *
 * `appHosts` are other names the app answers to as itself — the host's own
 * `*.onrender.com` address, say — which would otherwise read as somebody's
 * custom domain. With no root configured every host is the app.
 */
export function classifyHost(rawHost: string | null, appHosts: readonly string[]): HostKind {
  const host = (rawHost ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!ROOT_DOMAIN || !host) return { kind: "app" };
  if (host === ROOT_DOMAIN) return { kind: "app" };

  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    const label = host.slice(0, -(ROOT_DOMAIN.length + 1));
    if (!SUBDOMAIN.test(label) || APP_LABELS.has(label)) return { kind: "app" };
    return { kind: "subdomain", subdomain: label };
  }

  if (IP_OR_LOCAL.test(host) || host.endsWith(".localhost") || appHosts.includes(host)) {
    return { kind: "app" };
  }
  // A custom domain is matched without its port: DNS points the name, not a
  // port, and a browser only sends one for a non-default port anyway.
  return { kind: "custom", domain: host.replace(/:\d+$/, "") };
}
