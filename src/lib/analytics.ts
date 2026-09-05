"use client";

import { useSyncExternalStore } from "react";
import { api } from "./api";

/**
 * Real analytics, counted by the server from real visits.
 *
 * They used to be per-browser, because there was nowhere else to put them.
 * Now every visitor counts, wherever they are. What has not changed is that
 * these are counted and never invented: when nothing has happened the result
 * is empty, and /stats shows an empty state rather than a plausible number.
 */
export type Analytics = {
  /** slug -> view count */
  views: Record<string, number>;
  /** slug -> section id -> click count */
  clicks: Record<string, Record<string, number>>;
  /** slug -> source label -> view count */
  sources: Record<string, Record<string, number>>;
};

type Summary = Analytics & { totals: { views: number; clicks: number } };

const EMPTY: Analytics = { views: {}, clicks: {}, sources: {} };

let state: Analytics = EMPTY;
let ready = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

let loadStarted = false;

async function load() {
  try {
    const summary = await api.get<Summary>("/analytics/summary?days=30");
    state = { views: summary.views, clicks: summary.clicks, sources: summary.sources };
  } catch {
    // Signed out, or the API is down. An empty state is the honest answer;
    // /stats says on screen that there is nothing to show.
    state = EMPTY;
  } finally {
    ready = true;
    notify();
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!loadStarted) {
    loadStarted = true;
    void load();
  }
  return () => {
    listeners.delete(cb);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => EMPTY;
const getReady = () => ready;
const notReady = () => false;

/**
 * One id per page load. StrictMode mounts effects twice in development and a
 * retried request would otherwise count again; the server collapses repeats
 * of the same key to a single view.
 */
const loadKeys = new Map<string, string>();

function dedupeKeyFor(slug: string): string {
  const existing = loadKeys.get(slug);
  if (existing) return existing;

  const key =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  loadKeys.set(slug, key);
  return key;
}

/** Recording must never surface to a visitor, so failures are swallowed. */
export function recordView(slug: string) {
  const referrer = typeof document === "undefined" ? "" : document.referrer;
  void api
    .post(`/public/p/${slug}/views`, { referrer, dedupeKey: dedupeKeyFor(slug) })
    .catch(() => {});
}

export function recordClick(slug: string, sectionId: string, url = "") {
  void api.post(`/public/p/${slug}/clicks`, { sectionId, url }).catch(() => {});
}

export async function resetAnalytics() {
  await api.del("/analytics");
  await load();
}

export async function refreshAnalytics() {
  await load();
}

export function useAnalytics(): Analytics {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useAnalyticsReady(): boolean {
  return useSyncExternalStore(subscribe, getReady, notReady);
}
