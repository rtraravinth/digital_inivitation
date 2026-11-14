import { NextResponse, type NextRequest } from "next/server";
import { classifyHost, subdomainOrigin } from "@/lib/hosts";

/**
 * The Content Security Policy, with a fresh script nonce per request.
 *
 * Scripts are locked down: only ones carrying this request's nonce run, and
 * `'strict-dynamic'` extends that to scripts they load (Firebase's sign-in
 * popup loader, for one). Next reads the nonce from this header and puts it
 * on its own scripts; `layout.tsx` puts it on the theme boot script.
 *
 * Styles allow `'unsafe-inline'` on purpose: every theme sets its colours,
 * faces and type scale in `style` attributes (`groundStyle()`, `headline()`),
 * and a nonce cannot cover an attribute. Styles cannot run code.
 *
 * A nonce means rendering per request, which every page here does anyway:
 * each one reads the session or the published page at request time.
 */

/** The API's origin when it is not this one (local dev, a LAN phone test). */
function apiOrigin(): string {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";
  try {
    return base ? new URL(base).origin : "";
  } catch {
    return "";
  }
}

/** What Firebase Authentication talks to from the browser. */
function firebaseSources() {
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  return {
    connect: [
      "https://identitytoolkit.googleapis.com",
      "https://securetoken.googleapis.com",
      "https://www.googleapis.com",
    ],
    // The popup's helper iframe is served from the project's auth domain.
    frame: authDomain ? [`https://${authDomain}`] : [],
  };
}

export function contentSecurityPolicy(nonce: string, dev: boolean): string {
  const api = apiOrigin();
  const firebase = firebaseSources();
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...(api ? [api] : [])],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...(api ? [api] : []), ...firebase.connect, ...(dev ? ["ws:", "wss:"] : [])],
    "frame-src": ["'self'", ...firebase.frame],
    "media-src": ["'self'", ...(api ? [api] : [])],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    // The app frames only itself (the builder's canvas). Nobody else may
    // frame any page: no clicking "Delete account" through a hidden iframe.
    "frame-ancestors": ["'self'"],
  };
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}

/**
 * Other names the app answers to as itself, beside the root: the host's own
 * address (`facet.onrender.com`), say. Comma-separated, read at run time.
 * Without this, once a root domain is set every unknown host is taken for a
 * custom domain and its pages 404.
 */
const APP_HOSTS = (process.env.FACET_APP_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

/** Set by this proxy alone: a client's own copy is removed first. */
const HOST_HEADER = "x-facet-host";

/**
 * Where a request goes, by the host it arrived on (see `lib/hosts.ts`):
 *
 * - `rohan.facetfolio.com/founder` is served by `/p/rohan/founder`.
 * - `rohan.com/founder` (a verified custom domain) by `/d/rohan.com/founder`,
 *   which asks the API whose domain it is.
 * - On the app's own host, `/p/rohan/founder` is redirected to the subdomain
 *   once there is one, so a link shared before keeps working and lands on
 *   the address the page now has.
 */
function route(request: NextRequest, headers: Headers): NextResponse {
  const host = classifyHost(request.headers.get("host"), APP_HOSTS);
  const { pathname, search } = request.nextUrl;

  if (host.kind === "app") {
    const old = /^\/p\/([^/]+)\/([^/]+)\/?$/.exec(pathname);
    const origin = old ? subdomainOrigin(old[1]) : "";
    if (old && origin) return NextResponse.redirect(`${origin}/${old[2]}${search}`, 308);
    return NextResponse.next({ request: { headers } });
  }

  headers.set(HOST_HEADER, host.kind);
  const base = host.kind === "subdomain" ? `/p/${host.subdomain}` : `/d/${host.domain}`;
  const url = request.nextUrl.clone();
  url.pathname = `${base}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url, { request: { headers } });
}

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(HOST_HEADER);

  // A prefetch renders nothing a policy applies to, but it still has to be
  // routed by host, or a link on a subdomain prefetches the app's 404.
  const prefetch =
    request.headers.has("next-router-prefetch") || request.headers.get("purpose") === "prefetch";
  if (prefetch) return route(request, requestHeaders);

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development");
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = route(request, requestHeaders);
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not the API (it sets its own) and not static files.
      // Prefetches come through so they are routed by host too; `proxy`
      // skips the policy for them.
      source: "/((?!api|health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
    },
  ],
};
