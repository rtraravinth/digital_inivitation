import { NextResponse, type NextRequest } from "next/server";

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

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not the API (it sets its own), not static files, and not
      // next/link prefetches, which render nothing a policy applies to.
      source: "/((?!api|health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
