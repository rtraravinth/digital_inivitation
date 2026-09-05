"use client";

import { useSyncExternalStore } from "react";
import { ApiError, api, messageFor } from "./api";
import { normalize, type BlockKind, type Portfolio, type Section } from "./types";

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2, 10)}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   An external store, read through useSyncExternalStore. The backend is the
   FACET API, and this module is the only part of the app that knows that.

   Do **not** move this to setState-in-useEffect — the React Compiler lint
   rule rejects it, which is why the one-shot load fires on first subscribe
   rather than from an effect.

   Every write is optimistic: the change lands locally and listeners fire
   before the request goes out, so typing never waits on a round trip. Text
   fields fire per keystroke, which was free against localStorage and is not
   free against an API, so the request itself is debounced.

   When a write fails, the store re-reads from the server rather than
   restoring a snapshot — by the time a debounced save fails, that snapshot
   is several keystrokes stale, and reverting to it would throw away edits
   that were fine. `syncError` carries the API's own message, which the
   editor and /account already render as a banner: a failed save is never
   silent.
   ══════════════════════════════════════════════════════════════════════ */

let state: Portfolio[] = [];
let ready = false;
let syncError: string | null = null;
const listeners = new Set<() => void>();

const EMPTY: Portfolio[] = [];

function notify() {
  for (const listener of listeners) listener();
}

function setState(next: Portfolio[]) {
  state = next;
  notify();
}

/* ── loading ──────────────────────────────────────────────────────────── */

let loadStarted = false;

async function fetchAll(): Promise<Portfolio[]> {
  // expand=sections because /print stacks whole pages and /stats labels
  // clicks by section — one request rather than one per portfolio.
  const rows = await api.get<Portfolio[]>("/portfolios?expand=sections");
  return rows.map(normalize);
}

async function load() {
  try {
    state = await fetchAll();
    syncError = null;
  } catch (error) {
    // Being signed out is the session store's business — it is already
    // redirecting to /signin, and a banner here would just be noise.
    if (!(error instanceof ApiError && error.status === 401)) {
      syncError = messageFor(error);
    }
    state = [];
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
const getServerSnapshot = () => EMPTY;
const getSyncError = () => syncError;
const noSyncError = () => null;
const getReady = () => ready;
const notReady = () => false;

/** Re-read everything from the server, discarding local state. */
export async function refreshPortfolios() {
  await load();
}

function clearError() {
  if (syncError !== null) {
    syncError = null;
    notify();
  }
}

/** Run a write; on failure show why and converge on what the server has. */
async function persist(work: () => Promise<void>) {
  clearError();
  try {
    await work();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return;
    syncError = messageFor(error);
    notify();
    await load();
  }
}

/* ── local helpers ────────────────────────────────────────────────────── */

function mapPortfolio(id: string, recipe: (p: Portfolio) => Portfolio): Portfolio[] {
  return state.map((p) => (p.id === id ? recipe(p) : p));
}

function replace(updated: Portfolio) {
  const normalized = normalize(updated);
  state = state.map((p) => (p.id === normalized.id ? normalized : p));
  notify();
}

/* ── debounced saving ─────────────────────────────────────────────────── */

const SAVE_DELAY_MS = 500;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const queued = new Map<string, () => Promise<void>>();

function schedule(key: string, save: () => Promise<void>) {
  queued.set(key, save);
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);

  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      const work = queued.get(key);
      queued.delete(key);
      if (work) void work();
    }, SAVE_DELAY_MS),
  );
}

/** Send anything still waiting. Called on unload and before a hard exit. */
export async function flushPendingSaves(): Promise<void> {
  const work = [...queued.values()];
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  queued.clear();
  await Promise.all(work.map((run) => run()));
}

if (typeof window !== "undefined") {
  // A save still inside the debounce window must not be lost to a reload.
  window.addEventListener("pagehide", () => void flushPendingSaves());
}

/* ── portfolio writes ─────────────────────────────────────────────────── */

export type StartFrom = { kind: "blank" } | { kind: "copy"; id: string } | { kind: "founder" };

export async function createPortfolioAsync(
  name: string,
  slug: string,
  startFrom: StartFrom,
  summary = "",
): Promise<Portfolio> {
  clearError();
  const created = normalize(
    await api.post<Portfolio>("/portfolios", { name, slug, summary, startFrom }),
  );
  setState([created, ...state]);
  return created;
}

function assetFields(asset: { id?: string } | null, idKey: string, clearKey: string) {
  if (asset === null) return { [clearKey]: true };
  if (asset?.id) return { [idKey]: asset.id };
  // An asset from before the API (a data URI, no id) has nothing to send.
  return {};
}

/**
 * The one write every editor screen uses. Which endpoints it needs is
 * derived from what actually changed, so no caller has to know that the
 * header is its own row or that publishing is its own verb.
 */
function updatePortfolio(id: string, recipe: (p: Portfolio) => Portfolio) {
  const before = state.find((p) => p.id === id);
  const next = mapPortfolio(id, recipe);
  setState(next);

  const after = next.find((p) => p.id === id);
  if (!before || !after) return;

  schedule(`portfolio:${id}`, () =>
    persist(async () => {
      // A live portfolio refuses every edit, so the order of these calls is
      // load-bearing: unpublish first to open the page up, publish last so
      // the edits in the same batch land while it is still a draft.
      if (before.status === "live" && after.status !== "live") {
        replace(await api.post<Portfolio>(`/portfolios/${id}/unpublish`));
      }

      if (coreChanged(before, after)) {
        replace(
          await api.patch<Portfolio>(`/portfolios/${id}`, {
            name: after.name,
            slug: after.slug,
            summary: after.summary,
            theme: after.theme,
            accent: after.accent,
            ground: after.ground,
            font: after.font,
            layout: after.layout,
          }),
        );
      }

      if (JSON.stringify(before.header) !== JSON.stringify(after.header)) {
        const { name, current, description, tags, links, portrait } = after.header;
        replace(
          await api.patch<Portfolio>(`/portfolios/${id}/header`, {
            name,
            current,
            description,
            tags,
            links,
            ...assetFields(portrait, "portraitAssetId", "clearPortrait"),
          }),
        );
      }

      if (before.status !== "live" && after.status === "live") {
        replace(await api.post<Portfolio>(`/portfolios/${id}/publish`));
      }
    }),
  );
}

function coreChanged(before: Portfolio, after: Portfolio): boolean {
  return (
    before.name !== after.name ||
    before.slug !== after.slug ||
    before.summary !== after.summary ||
    before.theme !== after.theme ||
    before.accent !== after.accent ||
    before.ground !== after.ground ||
    before.font !== after.font ||
    JSON.stringify(before.layout) !== JSON.stringify(after.layout)
  );
}

function deletePortfolio(id: string) {
  setState(state.filter((p) => p.id !== id));
  void persist(async () => {
    await api.del(`/portfolios/${id}`);
  });
}

/* ── section writes ───────────────────────────────────────────────────── */

function sectionPayload(section: Section) {
  return {
    title: section.title,
    description: section.description,
    tags: section.tags,
    links: section.links,
    numbers: section.numbers,
    dates: section.dates,
    quote: section.quote,
    hidden: section.hidden,
    kind: section.kind,
    ...assetFields(section.image, "imageAssetId", "clearImage"),
    ...assetFields(section.file, "fileAssetId", "clearFile"),
  };
}

function updateSection(
  portfolioId: string,
  sectionId: string,
  recipe: (s: Section) => Section,
) {
  const next = mapPortfolio(portfolioId, (p) => ({
    ...p,
    sections: p.sections.map((s) => (s.id === sectionId ? recipe(s) : s)),
  }));
  setState(next);

  const section = next
    .find((p) => p.id === portfolioId)
    ?.sections.find((s) => s.id === sectionId);
  if (!section) return;

  schedule(`section:${sectionId}`, () =>
    persist(async () => {
      await api.patch<Section>(
        `/portfolios/${portfolioId}/sections/${sectionId}`,
        sectionPayload(section),
      );
    }),
  );
}

/**
 * The server mints section ids, so this returns the id of the section it
 * appends locally only after the request resolves. Callers that navigate to
 * a new section await `addBlockAsync`.
 */
export async function addBlockAsync(
  portfolioId: string,
  kind: BlockKind = "link",
): Promise<string | null> {
  clearError();
  try {
    const created = await api.post<Section>(`/portfolios/${portfolioId}/sections`, { kind });
    setState(mapPortfolio(portfolioId, (p) => ({ ...p, sections: [...p.sections, created] })));
    return created.id;
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) {
      syncError = messageFor(error);
      notify();
    }
    return null;
  }
}

function addBlock(portfolioId: string, kind: BlockKind): void {
  void addBlockAsync(portfolioId, kind);
}

function addSection(portfolioId: string): void {
  void addBlockAsync(portfolioId, "link");
}

function toggleSectionHidden(portfolioId: string, sectionId: string) {
  updateSection(portfolioId, sectionId, (s) => ({ ...s, hidden: !s.hidden }));
}

function deleteSection(portfolioId: string, sectionId: string) {
  setState(
    mapPortfolio(portfolioId, (p) => ({
      ...p,
      sections: p.sections.filter((s) => s.id !== sectionId),
    })),
  );

  void persist(async () => {
    await api.del(`/portfolios/${portfolioId}/sections/${sectionId}`);
  });
}

function moveSection(portfolioId: string, sectionId: string, delta: -1 | 1) {
  setState(
    mapPortfolio(portfolioId, (p) => {
      const from = p.sections.findIndex((s) => s.id === sectionId);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= p.sections.length) return p;
      const sections = [...p.sections];
      const [moved] = sections.splice(from, 1);
      sections.splice(to, 0, moved);
      return { ...p, sections };
    }),
  );

  void persist(async () => {
    replace(
      await api.post<Portfolio>(`/portfolios/${portfolioId}/sections/${sectionId}/move`, {
        delta,
      }),
    );
  });
}

/* ── transfer ─────────────────────────────────────────────────────────── */

async function exportAll(): Promise<string> {
  return JSON.stringify(await api.get<unknown[]>("/export"), null, 2);
}

async function importAll(json: string): Promise<number> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  if (!Array.isArray(parsed)) throw new Error("That file is not a FACET export.");

  const result = await api.post<{ imported: number }>("/import", {
    mode: "replace",
    portfolios: parsed,
  });
  await load();
  return result.imported;
}

/* ── the hook ─────────────────────────────────────────────────────────── */

export function usePortfolios() {
  const portfolios = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const error = useSyncExternalStore(subscribe, getSyncError, noSyncError);
  const isReady = useSyncExternalStore(subscribe, getReady, notReady);

  return {
    portfolios,
    ready: isReady,
    /** Kept under its original name so every existing banner still renders. */
    storageError: error,
    syncError: error,
    exportAll,
    importAll,
    getPortfolio: (id: string) => portfolios.find((p) => p.id === id),
    getBySlug: (slug: string) => portfolios.find((p) => p.slug === slug),
    createPortfolioAsync,
    updatePortfolio,
    updateSection,
    addSection,
    addBlock,
    addBlockAsync,
    toggleSectionHidden,
    deleteSection,
    moveSection,
    deletePortfolio,
    refreshPortfolios,
  };
}
