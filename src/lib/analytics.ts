"use client";

import { useSyncExternalStore } from "react";

/**
 * Real analytics, recorded in this browser. Not a backend — numbers reflect
 * visits made on this device only — but they are counted, never invented.
 */
export type Analytics = {
  views: Record<string, number>;
  clicks: Record<string, Record<string, number>>;
  sources: Record<string, Record<string, number>>;
};

const STORAGE_KEY = "facet.analytics.v1";
const EMPTY: Analytics = { views: {}, clicks: {}, sources: {} };

let state: Analytics = EMPTY;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...EMPTY, ...(JSON.parse(raw) as Analytics) };
  } catch {
    // Corrupt storage: start from empty rather than throwing on every read.
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => EMPTY;

function commit(next: Analytics) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Out of quota: keep counting in memory for this session.
  }
  for (const l of listeners) l();
}

/** Where a visit came from, read off the referrer. */
function sourceFromReferrer(referrer: string): string {
  if (!referrer) return "Direct";
  let host = "";
  try {
    host = new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return "Direct";
  }
  if (host.includes("whatsapp")) return "WhatsApp";
  if (host.includes("linkedin")) return "LinkedIn";
  if (host.includes("t.co") || host.includes("twitter") || host === "x.com") return "X";
  if (host.includes("mail") || host.includes("gmail")) return "Email";
  if (host.includes("localhost") || host.includes("facet.page")) return "Direct";
  return host;
}

/**
 * StrictMode mounts effects twice in development; this keeps one page load
 * from counting as two views.
 */
const recordedThisLoad = new Set<string>();

export function recordView(slug: string) {
  if (recordedThisLoad.has(slug)) return;
  recordedThisLoad.add(slug);

  const source = sourceFromReferrer(typeof document === "undefined" ? "" : document.referrer);
  commit({
    ...state,
    views: { ...state.views, [slug]: (state.views[slug] ?? 0) + 1 },
    sources: {
      ...state.sources,
      [slug]: { ...state.sources[slug], [source]: (state.sources[slug]?.[source] ?? 0) + 1 },
    },
  });
}

export function recordClick(slug: string, sectionId: string) {
  commit({
    ...state,
    clicks: {
      ...state.clicks,
      [slug]: {
        ...state.clicks[slug],
        [sectionId]: (state.clicks[slug]?.[sectionId] ?? 0) + 1,
      },
    },
  });
}

export function resetAnalytics() {
  commit(EMPTY);
}

export function useAnalytics(): Analytics {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
