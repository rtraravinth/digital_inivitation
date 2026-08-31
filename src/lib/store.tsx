"use client";

import { useSyncExternalStore } from "react";
import { SEED_PORTFOLIOS } from "./seed";
import {
  emptyHeader,
  emptySection,
  normalize,
  SWATCHES,
  type Portfolio,
  type Section,
} from "./types";

const STORAGE_KEY = "facet.portfolios.v1";

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2, 10)}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   An external store, read through useSyncExternalStore. localStorage is an
   external system, so this is the shape React wants: the server and the
   hydration pass see the seed, and the stored data lands on the pass after.
   Swap `commit` and the initial read for API calls when there's a backend.
   ══════════════════════════════════════════════════════════════════════ */

let state: Portfolio[] = SEED_PORTFOLIOS;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    // normalize() backfills fields added since this data was stored.
    if (raw) state = (JSON.parse(raw) as Portfolio[]).map(normalize);
  } catch {
    // Corrupt or unavailable storage: fall through to the seed.
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Referentially stable between commits, as useSyncExternalStore requires. */
function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return SEED_PORTFOLIOS;
}

/** Surfaced in the editor so a failed save is never silent. */
let storageError: string | null = null;
const getStorageError = () => storageError;
const noStorageError = () => null;

function commit(next: Portfolio[]) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    storageError = null;
  } catch {
    storageError =
      "Changes could not be saved — this browser is out of storage. Remove an image or attachment, or export and reset from Account.";
    // Private mode or quota: the session still works, it just won't persist.
  }
  for (const listener of listeners) listener();
}

/* ── actions ──────────────────────────────────────────────────────────── */

/** The third option in the create dialog — a founder's starting sections. */
const FOUNDER_TEMPLATE: Array<Pick<Section, "title" | "description">> = [
  { title: "The company", description: "What it is, who it serves, and how far along it is." },
  { title: "What I did before", description: "The one or two things worth knowing." },
  { title: "How to work with me", description: "What you should get in touch about." },
];

export type StartFrom = { kind: "blank" } | { kind: "copy"; id: string } | { kind: "founder" };

function updatePortfolio(id: string, recipe: (p: Portfolio) => Portfolio) {
  commit(state.map((p) => (p.id === id ? recipe(p) : p)));
}

function updateSection(
  portfolioId: string,
  sectionId: string,
  recipe: (s: Section) => Section,
) {
  updatePortfolio(portfolioId, (p) => ({
    ...p,
    sections: p.sections.map((s) => (s.id === sectionId ? recipe(s) : s)),
  }));
}

function createPortfolio(name: string, slug: string, startFrom: StartFrom): string {
  const id = newId();
  let header = emptyHeader();
  let sections: Section[] = [emptySection(newId())];

  if (startFrom.kind === "copy") {
    const source = state.find((p) => p.id === startFrom.id);
    if (source) {
      header = structuredClone(source.header);
      sections = source.sections.map((s) => ({ ...structuredClone(s), id: newId() }));
    }
  } else if (startFrom.kind === "founder") {
    sections = FOUNDER_TEMPLATE.map((t) => ({ ...emptySection(newId()), ...t }));
  }

  const created: Portfolio = {
    id,
    name,
    slug,
    status: "empty",
    summary: "Not published yet.",
    meta: `${sections.length} section${sections.length === 1 ? "" : "s"} · just now`,
    theme: "editorial",
    accent: SWATCHES[0],
    ground: "light",
    font: "archivo",
    header,
    sections,
  };
  commit([created, ...state]);
  return id;
}

function addSection(portfolioId: string): string {
  const id = newId();
  updatePortfolio(portfolioId, (p) => ({
    ...p,
    sections: [...p.sections, emptySection(id)],
  }));
  return id;
}

function deleteSection(portfolioId: string, sectionId: string) {
  updatePortfolio(portfolioId, (p) => ({
    ...p,
    sections: p.sections.filter((s) => s.id !== sectionId),
  }));
}

function moveSection(portfolioId: string, sectionId: string, delta: -1 | 1) {
  updatePortfolio(portfolioId, (p) => {
    const from = p.sections.findIndex((s) => s.id === sectionId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= p.sections.length) return p;
    const sections = [...p.sections];
    const [moved] = sections.splice(from, 1);
    sections.splice(to, 0, moved);
    return { ...p, sections };
  });
}

function deletePortfolio(id: string) {
  commit(state.filter((p) => p.id !== id));
}

function resetToSeed() {
  commit(SEED_PORTFOLIOS);
}

/** Export and import exist because localStorage is the only backend. */
function exportAll(): string {
  return JSON.stringify(state, null, 2);
}

function importAll(json: string): number {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  if (!Array.isArray(parsed)) throw new Error("That file is not a FACET export.");
  const next = (parsed as Portfolio[]).map(normalize);
  commit(next);
  return next.length;
}

/* ── the hook ─────────────────────────────────────────────────────────── */

const alwaysTrue = () => true;
const alwaysFalse = () => false;

export function usePortfolios() {
  const portfolios = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const storageError = useSyncExternalStore(subscribe, getStorageError, noStorageError);
  /** False on the server and through hydration, true once stored data is live. */
  const ready = useSyncExternalStore(subscribe, alwaysTrue, alwaysFalse);

  return {
    portfolios,
    ready,
    storageError,
    exportAll,
    importAll,
    getPortfolio: (id: string) => portfolios.find((p) => p.id === id),
    getBySlug: (slug: string) => portfolios.find((p) => p.slug === slug),
    createPortfolio,
    resetToSeed,
    updatePortfolio,
    updateSection,
    addSection,
    deleteSection,
    moveSection,
    deletePortfolio,
  };
}
