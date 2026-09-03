"use client";

import { useSyncExternalStore } from "react";
import { ApiError, api, messageFor } from "./api";
import { defaultAccount, type AccountSettings } from "./types";

/* ══════════════════════════════════════════════════════════════════════════
   The same external-store shape as lib/store.tsx, for the same reason.

   Unlike the old build, the API has one endpoint per settings group rather
   than one blob write — so instead of a single `updateAccount(recipe)` that
   would have to guess which group changed, each group has its own action.

   What is real and what is not has changed too. Sign-in, password, two-step,
   recovery codes and the device list are enforced by the server now. Billing,
   custom domains and outbound email still are not: they need a payment
   processor, DNS and a mail service, none of which this build has. Those
   groups still render a <ServerNotice> saying so.
   ══════════════════════════════════════════════════════════════════════ */

let state: AccountSettings = defaultAccount();
let ready = false;
let syncError: string | null = null;
const listeners = new Set<() => void>();

const SERVER_SNAPSHOT = defaultAccount();

function notify() {
  for (const listener of listeners) listener();
}

/** The API's shape is the UI's shape, so this is a merge, not a translation. */
function adopt(payload: Partial<AccountSettings>) {
  const base = defaultAccount();
  state = {
    profile: { ...base.profile, ...(payload.profile ?? {}) },
    security: { ...base.security, ...(payload.security ?? {}) },
    plan: payload.plan ?? base.plan,
    customDomain: payload.customDomain ?? base.customDomain,
    notifications: { ...base.notifications, ...(payload.notifications ?? {}) },
    privacy: { ...base.privacy, ...(payload.privacy ?? {}) },
  };
  notify();
}

let loadStarted = false;

async function load() {
  try {
    adopt(await api.get<Partial<AccountSettings>>("/account"));
    syncError = null;
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) {
      syncError = messageFor(error);
    }
  } finally {
    ready = true;
    notify();
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (!loadStarted) {
    loadStarted = true;
    void load();
  }
  return () => {
    listeners.delete(onChange);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => SERVER_SNAPSHOT;
const getSyncError = () => syncError;
const noSyncError = () => null;
const getReady = () => ready;
const notReady = () => false;

/**
 * Apply the change locally, then persist it. On failure show the API's own
 * message and take the server's answer as the truth.
 */
async function save(
  optimistic: Partial<AccountSettings>,
  request: () => Promise<Partial<AccountSettings>>,
) {
  const previous = state;
  syncError = null;
  adopt({ ...state, ...optimistic });

  try {
    adopt(await request());
  } catch (error) {
    state = previous;
    if (!(error instanceof ApiError && error.status === 401)) {
      syncError = messageFor(error);
    }
    notify();
    throw error;
  }
}

/* ── the settings groups ──────────────────────────────────────────────── */

type Profile = AccountSettings["profile"];
type Security = AccountSettings["security"];

export async function updateProfile(patch: Partial<Profile>) {
  await save({ profile: { ...state.profile, ...patch } }, () =>
    api.patch<AccountSettings>("/account/profile", {
      name: patch.name,
      handle: patch.handle || undefined,
      current: patch.current,
      about: patch.about,
      tags: patch.tags,
      links: patch.links,
      ...(patch.portrait === null
        ? { clearPortrait: true }
        : patch.portrait?.id
          ? { portraitAssetId: patch.portrait.id }
          : {}),
    }),
  );
}

export async function updateSecurity(patch: { phone?: string; google?: boolean }) {
  await save({ security: { ...state.security, ...patch } as Security }, () =>
    api.patch<AccountSettings>("/account/security", patch),
  );
}

export async function setPlan(plan: AccountSettings["plan"]) {
  await save({ plan }, () => api.patch<AccountSettings>("/account/plan", { plan }));
}

export async function setCustomDomain(customDomain: string) {
  await save({ customDomain }, () =>
    api.patch<AccountSettings>("/account/domain", { customDomain }),
  );
}

export async function updateNotifications(
  patch: Partial<AccountSettings["notifications"]>,
) {
  await save({ notifications: { ...state.notifications, ...patch } }, () =>
    api.patch<AccountSettings>("/account/notifications", patch),
  );
}

export async function updatePrivacy(patch: Partial<AccountSettings["privacy"]>) {
  await save({ privacy: { ...state.privacy, ...patch } }, () =>
    api.patch<AccountSettings>("/account/privacy", patch),
  );
}

/* ── security actions, all of them real now ───────────────────────────── */

export async function changePassword(currentPassword: string, newPassword: string) {
  await api.post("/auth/password", { currentPassword, newPassword });
  // The server revoked every other device; reflect that in the list.
  await load();
}

export type TwoStepSetup = { secret: string; otpauthUri: string };

export async function beginTwoStep(): Promise<TwoStepSetup> {
  return api.post<TwoStepSetup>("/auth/two-step/enable");
}

export async function confirmTwoStep(code: string) {
  await api.post("/auth/two-step/verify", { code });
  await load();
}

export async function disableTwoStep(code: string) {
  await api.post("/auth/two-step/disable", { code });
  await load();
}

/**
 * Ten one-time codes, readable exactly once. The server stores only hashes,
 * so there is no second chance to read them — the UI has to say so.
 */
export async function generateRecoveryCodes(): Promise<string[]> {
  const { codes } = await api.post<{ codes: string[] }>("/auth/recovery-codes");
  await load();
  return codes;
}

export type DeviceSession = {
  id: string;
  device: string;
  place: string;
  when: string;
  current: boolean;
};

export async function listSessions(): Promise<DeviceSession[]> {
  return api.get<DeviceSession[]>("/auth/sessions");
}

export async function revokeSession(id: string) {
  await api.del(`/auth/sessions/${id}`);
}

export async function revokeOtherSessions(): Promise<number> {
  const { revoked } = await api.del<{ revoked: number }>("/auth/sessions");
  return revoked;
}

export async function deleteAccount() {
  await api.del("/account");
}

export async function refreshAccount() {
  await load();
}

export function useAccount() {
  const account = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const error = useSyncExternalStore(subscribe, getSyncError, noSyncError);
  const isReady = useSyncExternalStore(subscribe, getReady, notReady);

  return {
    account,
    ready: isReady,
    /** Kept under its original name so the existing banner still renders. */
    storageError: error,
    syncError: error,
    updateProfile,
    updateSecurity,
    setPlan,
    setCustomDomain,
    updateNotifications,
    updatePrivacy,
    refreshAccount,
  };
}
