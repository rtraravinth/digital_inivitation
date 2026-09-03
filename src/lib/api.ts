/**
 * The one place that talks to the FACET API.
 *
 * Holds the access token in memory, never in localStorage — a token in
 * localStorage is readable by any script that gets injected. The refresh
 * token is an httpOnly cookie the browser sends on its own, which is why
 * every request goes out with `credentials: "include"`.
 *
 * A 401 is retried exactly once, after a silent refresh. Concurrent 401s
 * share that one refresh rather than firing one each.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

const PREFIX = "/api/v1";

/** Every failure the API can report, in the shape it reports it. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
    readonly requestId = "",
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** The message for one field of a 422, if the API named it. */
  fieldError(field: string): string | null {
    const fields = this.details.fields;
    if (!Array.isArray(fields)) return null;
    const match = fields.find(
      (item) => typeof item === "object" && item !== null && (item as { field?: string }).field === field,
    ) as { message?: string } | undefined;
    return match?.message ?? null;
  }
}

/* ── the access token ──────────────────────────────────────────────────── */

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

let onSignedOut: (() => void) | null = null;

/** Called when a refresh fails, so the session store can clear itself. */
export function onUnauthenticated(handler: () => void) {
  onSignedOut = handler;
}

/* ── requests ─────────────────────────────────────────────────────────── */

/** Codes that mean "try refreshing", as opposed to "you are not allowed". */
const RETRYABLE = new Set(["token_expired", "invalid_token", "session_revoked"]);

async function toApiError(response: Response): Promise<ApiError> {
  const requestId = response.headers.get("X-Request-ID") ?? "";
  try {
    const body = await response.json();
    const error = body?.error;
    if (error?.code) {
      return new ApiError(
        response.status,
        error.code,
        error.message ?? "Something went wrong.",
        error.details ?? {},
        error.request_id || requestId,
      );
    }
  } catch {
    // A proxy error page, or no body at all. Fall through.
  }
  return new ApiError(response.status, "network_error", "Could not reach the server.", {}, requestId);
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  return fetch(`${API_BASE}${PREFIX}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
}

/** Shared so that ten concurrent 401s cause one refresh, not ten. */
let refreshInFlight: Promise<boolean> | null = null;

export async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${API_BASE}${PREFIX}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        if (!response.ok) return false;
        const body = await response.json();
        setAccessToken(body.token.accessToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function request<T>(method: string, path: string, init: RequestInit = {}): Promise<T> {
  let response = await send(path, { ...init, method });

  if (response.status === 401) {
    const error = await toApiError(response.clone());
    if (RETRYABLE.has(error.code) && (await refreshSession())) {
      response = await send(path, { ...init, method });
    } else {
      setAccessToken(null);
      onSignedOut?.();
      throw error;
    }
  }

  if (!response.ok) throw await toApiError(response);

  // 204, and any other empty body.
  if (response.status === 204 || response.headers.get("Content-Length") === "0") {
    return undefined as T;
  }
  return (await response.json()) as T;
}

function json(body: unknown): RequestInit {
  return {
    body: JSON.stringify(body ?? {}),
    headers: { "Content-Type": "application/json" },
  };
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, json(body)),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, json(body)),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, json(body)),
  del: <T = void>(path: string) => request<T>("DELETE", path),
  /** Multipart. No Content-Type header — the browser sets the boundary. */
  upload: <T>(path: string, form: FormData) => request<T>("POST", path, { body: form }),
};

/** Turn any thrown value into something safe to show a person. */
export function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong.";
}

/**
 * Asset URLs come back relative, so they work behind whatever host serves
 * the API. The browser needs them absolute.
 */
export function assetUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith("http") ? url : `${API_BASE}${url}`;
}
