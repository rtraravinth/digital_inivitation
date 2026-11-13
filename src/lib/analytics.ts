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
  /**
   * slug -> UTC day ("YYYY-MM-DD") -> that day's counts. Sparse: a day with
   * nothing on it is absent, and `dailySeries()` fills the window's gaps.
   */
  daily: Record<string, Record<string, { views: number; clicks: number }>>;
};

type Summary = Analytics & { totals: { views: number; clicks: number } };

const EMPTY: Analytics = { views: {}, clicks: {}, sources: {}, daily: {} };

/** The windows /stats offers. Each is a fresh count from the server. */
export const RANGES = [7, 30, 90] as const;
export type RangeDays = (typeof RANGES)[number];

let state: Analytics = EMPTY;
let ready = false;
let range: RangeDays = 30;
/** Bumped per request, so a slow answer for an old range cannot land last. */
let generation = 0;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

async function load() {
  const mine = ++generation;
  try {
    const summary = await api.get<Summary>(`/analytics/summary?days=${range}`);
    if (mine !== generation) return;
    state = {
      views: summary.views,
      clicks: summary.clicks,
      sources: summary.sources,
      daily: summary.daily ?? {},
    };
  } catch {
    if (mine !== generation) return;
    // Signed out, or the API is down. An empty state is the honest answer;
    // /stats says on screen that there is nothing to show.
    state = EMPTY;
  }
  ready = true;
  notify();
}

/** Switches the window and re-reads it. The figures stay until the new ones land. */
export function setAnalyticsRange(days: RangeDays) {
  if (days === range) return;
  range = days;
  notify();
  void load();
}

const getRange = () => range;
const defaultRange = (): RangeDays => 30;

export function useAnalyticsRange(): RangeDays {
  return useSyncExternalStore(subscribe, getRange, defaultRange);
}

/**
 * One portfolio's daily counts across the whole window, oldest first, with
 * the days nothing happened filled in as zero — the server sends only the
 * days that had events, and a trend line with missing days is a lie about
 * the shape.
 */
export function dailySeries(
  a: Analytics,
  slugs: string[],
  days: number,
  now = new Date(),
): Array<{ day: string; views: number; clicks: number }> {
  const out: Array<{ day: string; views: number; clicks: number }> = [];
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today - i * 86_400_000).toISOString().slice(0, 10);
    let views = 0;
    let clicks = 0;
    for (const slug of slugs) {
      const hit = a.daily[slug]?.[day];
      if (hit) {
        views += hit.views;
        clicks += hit.clicks;
      }
    }
    out.push({ day, views, clicks });
  }
  return out;
}

/**
 * Re-read every time something starts watching from nothing — in practice,
 * each time /stats opens. It used to load once per session and keep that
 * answer, so visits that arrived after the first look never appeared until a
 * full reload, and a page that had just started getting traffic read zero.
 */
function subscribe(cb: () => void) {
  listeners.add(cb);
  if (listeners.size === 1) void load();
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
export function recordView(handle: string, slug: string) {
  const referrer = typeof document === "undefined" ? "" : document.referrer;
  const key = `${handle}/${slug}`;
  void api
    .post(`/public/p/${handle}/${slug}/views`, { referrer, dedupeKey: dedupeKeyFor(key) })
    .catch(() => {});
}

export function recordClick(handle: string, slug: string, sectionId: string, url = "") {
  void api.post(`/public/p/${handle}/${slug}/clicks`, { sectionId, url }).catch(() => {});
}

/** Delete recorded views and clicks: one portfolio's, or all of them. */
export async function resetAnalytics(portfolioId?: string) {
  await api.del(portfolioId ? `/analytics?portfolio=${encodeURIComponent(portfolioId)}` : "/analytics");
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
