"use client";

import { useSyncExternalStore } from "react";
import { api, onUnauthenticated, refreshSession, setAccessToken } from "./api";

/* ══════════════════════════════════════════════════════════════════════════
   Who is signed in.

   The same external-store shape as lib/store.tsx, for the same reason: the
   session lives outside React, and useSyncExternalStore is how React wants
   to read that. The one-shot refresh fires on first subscribe rather than in
   an effect — the React Compiler lint rule rejects setState-in-useEffect,
   and subscribe-time is the correct moment anyway.
   ══════════════════════════════════════════════════════════════════════ */

type SessionUser = {
  id: string;
  /** Null for an account made with a phone number. */
  email: string | null;
  name: string;
  handle: string | null;
};

type SessionStatus = "loading" | "in" | "out";

type AuthResponse = {
  user: SessionUser;
  token: { accessToken: string; tokenType: string; expiresIn: number };
};

type State = {
  user: SessionUser | null;
  status: SessionStatus;
};

let state: State = { user: null, status: "loading" };
const listeners = new Set<() => void>();

const SERVER_STATE: State = { user: null, status: "loading" };

function emit(next: State) {
  state = next;
  for (const listener of listeners) listener();
}

/**
 * Runs once, the first time anything subscribes. A returning visitor still
 * holds the httpOnly refresh cookie, so this is what signs them back in
 * without the access token ever having been persisted.
 */
let bootstrapped = false;

function bootstrap() {
  if (bootstrapped) return;
  bootstrapped = true;

  refreshSession()
    .then(async (ok) => {
      if (!ok) return emit({ user: null, status: "out" });
      try {
        const account = await api.get<{
          profile: { name: string; handle: string | null };
          security: { email: string | null };
        }>("/account");
        emit({
          user: {
            id: "me",
            email: account.security.email,
            name: account.profile.name,
            handle: account.profile.handle,
          },
          status: "in",
        });
      } catch {
        emit({ user: null, status: "out" });
      }
    })
    .catch(() => emit({ user: null, status: "out" }));
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  bootstrap();
  return () => {
    listeners.delete(onChange);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => SERVER_STATE;

// A failed refresh anywhere in the app lands here.
onUnauthenticated(() => emit({ user: null, status: "out" }));

/* ── actions ──────────────────────────────────────────────────────────── */

function adopt(response: AuthResponse) {
  setAccessToken(response.token.accessToken);
  emit({ user: response.user, status: "in" });
}

/**
 * Trade a Firebase ID token for a FACET session.
 *
 * Firebase has proved who this is; the API decides which account that is.
 * A token nobody owns yet answers 422 `handle_required` — the sign-in page
 * then asks for a name and handle and calls this again with them.
 */
export async function exchange(
  idToken: string,
  newAccount?: { name: string; handle: string },
) {
  adopt(await api.post<AuthResponse>("/auth/firebase", { idToken, ...newAccount }));
}

export async function signOut() {
  try {
    await api.post("/auth/logout");
  } catch {
    // Already gone server-side; the local state still has to be cleared.
  }
  setAccessToken(null);
  emit({ user: null, status: "out" });
}

export function useSession() {
  const { user, status } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    user,
    status,
    signedIn: status === "in",
    exchange,
    signOut,
  };
}
