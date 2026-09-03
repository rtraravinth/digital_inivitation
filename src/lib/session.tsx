"use client";

import { useSyncExternalStore } from "react";
import { ApiError, api, onUnauthenticated, refreshSession, setAccessToken } from "./api";

/* ══════════════════════════════════════════════════════════════════════════
   Who is signed in.

   The same external-store shape as lib/store.tsx, for the same reason: the
   session lives outside React, and useSyncExternalStore is how React wants
   to read that. The one-shot refresh fires on first subscribe rather than in
   an effect — the React Compiler lint rule rejects setState-in-useEffect,
   and subscribe-time is the correct moment anyway.
   ══════════════════════════════════════════════════════════════════════ */

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  handle: string | null;
  twoStep: boolean;
};

export type SessionStatus = "loading" | "in" | "out";

type AuthResponse = {
  user: SessionUser;
  token: { accessToken: string; tokenType: string; expiresIn: number };
};

type TwoStepResponse = { twoStepRequired: true; challenge: string };

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
          security: { email: string; twoStep: boolean };
        }>("/account");
        emit({
          user: {
            id: "me",
            email: account.security.email,
            name: account.profile.name,
            handle: account.profile.handle,
            twoStep: account.security.twoStep,
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

export async function register(email: string, password: string, name: string) {
  adopt(await api.post<AuthResponse>("/auth/register", { email, password, name }));
}

/**
 * Returns a challenge string when the account has two-step on — the password
 * was right, but no session exists until the code is too.
 */
export async function signIn(email: string, password: string): Promise<string | null> {
  const response = await api.post<AuthResponse | TwoStepResponse>("/auth/login", {
    email,
    password,
  });

  if ("twoStepRequired" in response) return response.challenge;
  adopt(response);
  return null;
}

export async function completeTwoStep(challenge: string, code: string) {
  adopt(await api.post<AuthResponse>("/auth/login/two-step", { challenge, code }));
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

/** After a profile edit, so the nav shows the new name without a reload. */
export function updateSessionUser(patch: Partial<SessionUser>) {
  if (!state.user) return;
  emit({ ...state, user: { ...state.user, ...patch } });
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function useSession() {
  const { user, status } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    user,
    status,
    signedIn: status === "in",
    register,
    signIn,
    completeTwoStep,
    signOut,
  };
}
