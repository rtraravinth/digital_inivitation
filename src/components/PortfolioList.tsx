"use client";

import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AppHeader } from "./AppHeader";
import { ICON, Icon, IconButton, Modal, NoHandleNotice, Segmented, StatusPill } from "./ui";
import { CreatePortfolioDialog } from "./CreatePortfolioDialog";
import { PagePreview } from "./PagePreview";
import { ShareDialog } from "./ShareDialog";
import { messageFor } from "@/lib/api";
import { Glyph } from "@/lib/glyphs";
import { displayUrl, isSlug, liveUrl } from "@/lib/slug";
import { usePortfolios, type StartFrom } from "@/lib/store";
import { previewPath, type Portfolio } from "@/lib/types";
import { useAccount } from "@/lib/account";

/* ── Portfolios ───────────────────────────────────────────────────────────
   The home screen, as a tool: a title row with the two things you come here
   to do (make a page, share one), a toolbar to find a page once there are
   more than a few, and the pages themselves as a grid or a list.

   The app is black and white; each card frames the author's real page in a
   browser window, greyscale until the card is hovered, when it comes up in
   colour and scrolls. The counts at the top are the filter.

   Only links navigate. A card's name, its preview and its body are not
   links: the address under the name opens the page, and every other action
   is a labelled button. Clicking a name to rename it and landing on a
   different screen instead was the confusion this replaced.
   ──────────────────────────────────────────────────────────────────────── */

type Filter = "all" | "live" | "draft";
type View = "grid" | "list";

const VIEW_KEY = "facet-portfolio-view";
const EASE = [0.16, 1, 0.3, 1] as const;

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

/* ── the page ─────────────────────────────────────────────────────────── */

export function PortfolioList() {
  const {
    ready,
    portfolios,
    createPortfolioAsync,
    deletePortfolio,
    updatePortfolio,
    storageError,
  } = usePortfolios();
  const [creating, setCreating] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Portfolio | null>(null);
  const [editing, setEditing] = useState<Portfolio | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  // Read once, lazily: this screen only renders on the client, behind the
  // session check, so there is no server render to disagree with.
  const [view, setView] = useState<View>(readView);
  const search = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const reduced = useReducedMotion();
  const { account, ready: accountReady } = useAccount();

  const live = portfolios.filter((p) => p.status === "live").length;
  const counts: Record<Filter, number> = {
    all: portfolios.length,
    live,
    draft: portfolios.length - live,
  };

  const q = query.trim().toLowerCase();
  const shown = portfolios.filter((p) => {
    if (filter === "live" && p.status !== "live") return false;
    if (filter === "draft" && p.status === "live") return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q) ||
      p.summary.toLowerCase().includes(q)
    );
  });

  // "/" jumps to search, the way most tools do — unless you are already typing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      search.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const pickView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Remembered for this visit only.
    }
  };

  // The server mints the id, so the dialog stays open until it answers —
  // navigating to a provisional id would land on a page that does not exist.
  async function create(name: string, slug: string, startFrom: StartFrom, summary: string) {
    setCreateError(null);
    try {
      const created = await createPortfolioAsync(name, slug, startFrom, summary);
      setCreating(false);
      router.push(`/editor/${created.id}`);
    } catch (error) {
      // A taken address is the common one, and the API says so in words.
      setCreateError(messageFor(error));
    }
  }

  // A failed create is said inside its dialog, which stays open for it.
  const error = storageError;
  const actions: Actions = {
    onEdit: (p) => setEditing(p),
    onShare: (id) => setSharing(id),
    onDelete: (p) => setDeleting(p),
    onPublish: (id) => updatePortfolio(id, (prev) => ({ ...prev, status: "live" })),
    onUnpublish: (id) => updatePortfolio(id, (prev) => ({ ...prev, status: "draft" })),
  };

  return (
    <>
      {/* The backdrop: a dot grid and a light that follows the pointer. */}
      <div aria-hidden className="app-backdrop" />
      <div
        className="flex min-h-dvh flex-col"
        onPointerMove={(e) => {
          if (reduced || e.pointerType !== "mouse") return;
          const root = document.documentElement;
          root.style.setProperty("--mx", `${e.clientX}px`);
          root.style.setProperty("--my", `${e.clientY}px`);
        }}
      >
        <AppHeader current="portfolios" />

        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-8 pb-20 sm:px-6 sm:pt-12">
          <AnimatePresence>
            {error && (
              <motion.div
                role="alert"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-6 flex items-start gap-3 rounded-lg px-4 py-3 text-[13.5px]"
                style={{ border: "1px solid var(--color-ink)", background: "var(--color-bg)" }}
              >
                <span
                  aria-hidden
                  className="mt-px grid h-5 w-5 flex-none place-items-center rounded-full text-[12px] font-bold"
                  style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
                >
                  !
                </span>
                <span className="min-w-0 flex-1">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {accountReady && !account.profile.handle && live > 0 && (
            <NoHandleNotice live={live} />
          )}

          {/* ── title row ───────────────────────────────────────── */}
          <div className="flex flex-wrap items-end gap-x-6 gap-y-5">
            <div className="min-w-0">
              <motion.p
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="m-0 font-mono text-[12px] tracking-[0.02em]"
                style={{ color: "var(--color-neutral-600)" }}
              >
                {greeting()}
                {account.profile.name ? `, ${account.profile.name.split(" ")[0]}` : ""}
              </motion.p>
              <motion.h1
                initial={reduced ? false : { opacity: 0, y: 14, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.6, ease: EASE }}
                className="m-0 mt-2 text-[40px] leading-[0.95] tracking-[-0.045em] sm:text-[56px]"
              >
                Your <span style={{ color: "var(--color-neutral-500)" }}>portfolios</span>
              </motion.h1>
            </div>
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
              className="ml-auto flex items-center gap-2"
            >
              {/* A draft has no public address, so there is nothing to share
                  until something is live. */}
              {live > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ background: "var(--color-bg)" }}
                  onClick={() =>
                    setSharing(portfolios.find((p) => p.status === "live")!.id)
                  }
                >
                  <Icon d={ICON.share} size={15} />
                  Share
                </button>
              )}
              <motion.button
                type="button"
                whileHover={reduced ? undefined : { y: -1 }}
                whileTap={reduced ? undefined : { scale: 0.97 }}
                className="btn btn-primary"
                onClick={() => setCreating(true)}
              >
                <Glyph id="plus" size={15} />
                New portfolio
              </motion.button>
            </motion.div>
          </div>

          {/* ── the counts, which are also the filter ───────────── */}
          {portfolios.length > 0 && (
            <FilterTiles counts={counts} value={filter} onChange={setFilter} ready={ready} />
          )}

          {/* ── toolbar ─────────────────────────────────────────── */}
          {portfolios.length > 0 && (
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.22, ease: EASE }}
              className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2"
            >
              <label className="relative flex min-w-0 flex-1 basis-[240px] items-center sm:max-w-[360px]">
                <span className="sr-only">Search portfolios</span>
                <span
                  className="pointer-events-none absolute left-3.5"
                  style={{ color: "var(--color-neutral-600)" }}
                >
                  <Icon d={ICON.search} size={15} />
                </span>
                <input
                  ref={search}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setQuery("");
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder="Search by name or address"
                  className="input"
                  style={{
                    paddingLeft: 38,
                    paddingRight: 36,
                    minHeight: 40,
                    fontSize: 14,
                    borderRadius: 999,
                    background: "var(--color-bg)",
                  }}
                />
                {!query && (
                  <kbd
                    aria-hidden
                    className="pointer-events-none absolute right-3 rounded px-1.5 font-mono text-[11px]"
                    style={{
                      color: "var(--color-neutral-600)",
                      boxShadow: "inset 0 0 0 1px var(--color-divider)",
                    }}
                  >
                    /
                  </kbd>
                )}
              </label>

              <span className="hidden font-mono text-[12px] sm:inline" style={{ color: "var(--color-neutral-600)" }}>
                {shown.length === portfolios.length
                  ? `${shown.length} ${shown.length === 1 ? "page" : "pages"}`
                  : `${shown.length} of ${portfolios.length}`}
              </span>

              <div className="ml-auto">
                <Segmented
                  label="Layout"
                  id="view"
                  value={view}
                  onChange={pickView}
                  options={[
                    { id: "grid", label: "Grid view", icon: ICON.grid },
                    { id: "list", label: "List view", icon: ICON.list },
                  ]}
                />
              </div>
            </motion.div>
          )}

          {/* ── the pages ───────────────────────────────────────── */}
          <div className="mt-6">
            {!ready ? (
              <Skeleton />
            ) : portfolios.length === 0 ? (
              <Empty onCreate={() => setCreating(true)} />
            ) : shown.length === 0 ? (
              <NoMatch
                query={query}
                onClear={() => {
                  setQuery("");
                  setFilter("all");
                }}
              />
            ) : view === "grid" ? (
              <Grid
                portfolios={shown}
                // The newest page leads, twice the size — but only over the
                // whole list, where "first" means something.
                feature={!q && filter === "all" && shown.length >= 3}
                showCreate={!q && filter === "all"}
                onCreate={() => setCreating(true)}
                actions={actions}
              />
            ) : (
              <List portfolios={shown} actions={actions} />
            )}
          </div>
        </main>
      </div>

      <AnimatePresence>
        {creating && (
          <CreatePortfolioDialog
            key="create"
            portfolios={portfolios}
            error={createError}
            onCancel={() => {
              setCreating(false);
              setCreateError(null);
            }}
            onCreate={create}
          />
        )}
        {sharing && (
          <ShareDialog key="share" portfolios={portfolios} initialId={sharing} onClose={() => setSharing(null)} />
        )}
        {editing && (
          <EditDetails
            key="edit"
            portfolio={portfolios.find((p) => p.id === editing.id) ?? editing}
            taken={portfolios.filter((p) => p.id !== editing.id).map((p) => p.slug)}
            onCancel={() => setEditing(null)}
            onUnpublish={() => actions.onUnpublish(editing.id)}
            onSave={(fields) => {
              updatePortfolio(editing.id, (prev) => ({ ...prev, ...fields }));
              setEditing(null);
            }}
          />
        )}
        {deleting && (
          <ConfirmDelete
            key="delete"
            portfolio={deleting}
            onCancel={() => setDeleting(null)}
            onConfirm={() => {
              deletePortfolio(deleting.id);
              setDeleting(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

type Actions = {
  onEdit: (p: Portfolio) => void;
  onShare: (id: string) => void;
  onDelete: (p: Portfolio) => void;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
};

/* ── the counts ───────────────────────────────────────────────────────── */

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/**
 * All, Live and Drafts as three tiles that are also the filter: the number
 * you came to check and the way to narrow the grid are the same control.
 * Each carries a meter of its share of the whole, so "2 of 7 live" reads at
 * a glance without a chart.
 */
function FilterTiles({
  counts,
  value,
  onChange,
  ready,
}: {
  counts: Record<Filter, number>;
  value: Filter;
  onChange: (f: Filter) => void;
  ready: boolean;
}) {
  const reduced = useReducedMotion();
  const tiles: Array<{ id: Filter; label: string; note: string }> = [
    { id: "all", label: "All pages", note: "Everything you have made" },
    { id: "live", label: "Live", note: "Published and public" },
    { id: "draft", label: "Drafts", note: "Only you can see these" },
  ];
  return (
    <div role="group" aria-label="Show" className="mt-8 grid grid-cols-3 gap-2 sm:gap-3">
      {tiles.map((t, i) => {
        const on = value === t.id;
        const share = counts.all ? counts[t.id] / counts.all : 0;
        return (
          <motion.button
            key={t.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(t.id)}
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 + i * 0.05, ease: EASE }}
            whileTap={reduced ? undefined : { scale: 0.98 }}
            className="relative flex min-w-0 cursor-pointer flex-col items-start overflow-hidden rounded-2xl px-3.5 py-3 text-left transition-colors duration-300 sm:px-5 sm:py-4"
            style={{
              background: on ? "var(--color-ink)" : "var(--color-bg)",
              color: on ? "var(--color-bg)" : "var(--color-ink)",
              border: `1px solid ${on ? "var(--color-ink)" : "var(--color-divider)"}`,
            }}
          >
            <span className="flex w-full items-center gap-2 text-[12.5px] font-medium">
              {t.id === "live" && <span className="app-live-dot" aria-hidden />}
              <span className="truncate">{t.label}</span>
            </span>
            <span className="mt-1.5 font-mono text-[28px] leading-none tracking-[-0.04em] tabular-nums sm:text-[36px]">
              {ready ? counts[t.id] : "–"}
            </span>
            <span className="mt-2 hidden text-[12px] opacity-60 sm:block">{t.note}</span>
            <span
              aria-hidden
              className="mt-3 h-[3px] w-full overflow-hidden rounded-full"
              style={{ background: on ? "color-mix(in srgb, var(--color-bg) 22%, transparent)" : "var(--color-neutral-200)" }}
            >
              <motion.span
                className="block h-full rounded-full"
                style={{ background: "currentColor", transformOrigin: "0 50%" }}
                initial={reduced ? false : { scaleX: 0 }}
                animate={{ scaleX: share }}
                transition={{ duration: 0.9, delay: 0.25 + i * 0.05, ease: EASE }}
              />
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ── grid ─────────────────────────────────────────────────────────────── */

function Grid({
  portfolios,
  feature,
  showCreate,
  onCreate,
  actions,
}: {
  portfolios: Portfolio[];
  feature: boolean;
  showCreate: boolean;
  onCreate: () => void;
  actions: Actions;
}) {
  const reduced = useReducedMotion();
  return (
    // `grid-flow-dense`: with a double-size first card the next two fill the
    // column beside it instead of leaving a hole.
    <div className="portfolio-grid grid grid-flow-dense grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence mode="popLayout" initial={true}>
        {portfolios.map((p, i) => {
          const featured = feature && i === 0;
          return (
            <motion.div
              key={p.id}
              layout={!reduced}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
              transition={{ duration: 0.7, delay: Math.min(i, 8) * 0.06, ease: EASE }}
              className={`flex ${featured ? "sm:col-span-2 lg:row-span-2" : ""}`}
            >
              <Card portfolio={p} actions={actions} featured={featured} />
            </motion.div>
          );
        })}
        {showCreate && (
          <motion.button
            key="create"
            layout={!reduced}
            type="button"
            onClick={onCreate}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: Math.min(portfolios.length, 8) * 0.06, ease: EASE }}
            className="group relative flex min-h-[320px] cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-[22px] text-center transition-colors duration-300 hover:bg-[var(--color-surface)]"
            style={{
              border: "1.5px dashed var(--color-neutral-400)",
              color: "var(--color-neutral-700)",
              background: "color-mix(in srgb, var(--color-bg) 70%, transparent)",
            }}
          >
            <span
              className="grid h-14 w-14 place-items-center rounded-2xl transition-all duration-500 group-hover:rotate-90 group-hover:bg-[var(--color-ink)] group-hover:text-[var(--color-bg)]"
              style={{ boxShadow: "inset 0 0 0 1px var(--color-divider)" }}
            >
              <Glyph id="plus" size={22} />
            </span>
            <span className="text-[15px] font-medium" style={{ color: "var(--color-ink)" }}>
              New portfolio
            </span>
            <span className="max-w-[26ch] text-[13px]">
              Start blank, or copy one you have and cut it down.
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * A page, framed as the browser window it will open in.
 *
 * The preview is the author's real page, greyscale at rest. Hovering brings
 * it up in colour and slowly scrolls it down a screen, so a card shows more
 * than its hero; a light follows the pointer round the card's edge; and a
 * dock of the next things to do rises over the page. The dock is a shortcut
 * only — everything in it is also in the footer or the menu, so a touch
 * screen, which never hovers, loses nothing.
 */
function Card({
  portfolio: p,
  actions,
  featured,
}: {
  portfolio: Portfolio;
  actions: Actions;
  featured: boolean;
}) {
  const handle = useAccount().account.profile.handle;
  const reduced = useReducedMotion();
  const live = p.status === "live";
  const gx = useMotionValue(50);
  const gy = useMotionValue(0);
  const edge = useMotionTemplate`radial-gradient(280px circle at ${gx}% ${gy}%, color-mix(in srgb, var(--color-ink) 70%, transparent), transparent 70%)`;
  const now = useNow();
  const [hot, setHot] = useState(false);
  const address = live && handle ? displayUrl(liveUrl(handle, p.slug)) : live ? "no public address yet" : "draft · not public yet";

  return (
    <motion.article
      data-card=""
      className="group relative flex w-full flex-col rounded-[22px] p-px"
      style={{ background: "var(--color-divider)" }}
      animate={{
        y: hot && !reduced ? -4 : 0,
        boxShadow: hot ? "0 28px 56px -30px #00000080" : "0 1px 2px #0000000f",
      }}
      transition={{ duration: 0.35, ease: EASE }}
      onPointerEnter={() => setHot(true)}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const box = e.currentTarget.getBoundingClientRect();
        gx.set(((e.clientX - box.left) / box.width) * 100);
        gy.set(((e.clientY - box.top) / box.height) * 100);
      }}
      onPointerLeave={() => setHot(false)}
    >
      {/* The featured card's light keeps circling until the pointer arrives
          and the pointer's own light takes over. */}
      {featured && (
        <div aria-hidden className="card-orbit" style={{ opacity: hot ? 0 : 1, transition: "opacity 400ms" }} />
      )}

      {/* The light on the edge: a gradient under a 1px gap round the card. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[22px]"
        style={{ background: edge, opacity: hot ? 1 : 0, transition: "opacity 400ms" }}
      />

      <div className="relative flex flex-1 flex-col rounded-[21px] p-2" style={{ background: "var(--color-bg)" }}>
        {/* ── the window ── */}
        <div
          className="relative flex flex-col overflow-hidden rounded-[14px]"
          style={{
            border: "1px solid var(--color-divider)",
            background: "var(--color-surface)",
            flex: featured ? "1 1 auto" : undefined,
          }}
        >
          <div
            className="flex h-8 flex-none items-center gap-3 px-3"
            style={{ borderBottom: "1px solid var(--color-divider)" }}
          >
            <span aria-hidden className="flex gap-1.5">
              {[0, 1, 2].map((d) => (
                <span key={d} className="h-2 w-2 rounded-full" style={{ background: "var(--color-neutral-300)" }} />
              ))}
            </span>
            <span
              className="mx-auto flex h-5 min-w-0 max-w-[75%] items-center gap-1.5 rounded-md px-2.5 font-mono text-[10.5px]"
              style={{ background: "var(--color-bg)", color: "var(--color-neutral-700)" }}
            >
              {live && <span className="app-live-dot flex-none" aria-hidden />}
              <span className="truncate">{address}</span>
            </span>
            <span aria-hidden className="w-[30px] flex-none" />
          </div>

          <div
            className={`relative overflow-hidden ${featured ? "aspect-[16/10] lg:aspect-auto lg:min-h-[300px] lg:flex-1" : "aspect-[16/10]"}`}
          >
            <motion.div
              className="absolute inset-x-0 top-0 h-[200%]"
              animate={{
                y: hot && !reduced ? "-50%" : "0%",
                filter: hot ? "grayscale(0) contrast(1)" : "grayscale(1) contrast(1.04)",
              }}
              transition={{
                y: { duration: hot ? 3.6 : 0.9, ease: [0.45, 0, 0.2, 1] },
                filter: { duration: 0.5, ease: EASE },
              }}
            >
              {/* The pan moves one box height, so the page has to run to at
                  least two: a featured card's box is taller than 16:10. */}
              <PagePreview p={p} handle={handle} screens={featured ? 3 : 2} />
            </motion.div>

            {/* ── the dock ── */}
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center opacity-0 transition-all duration-300 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 [@media(hover:none)]:hidden">
              <div
                className="flex translate-y-2 items-center gap-0.5 rounded-full p-1 transition-transform duration-300 group-focus-within:translate-y-0 group-hover:translate-y-0"
                style={{
                  background: "color-mix(in srgb, var(--color-bg) 82%, transparent)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  boxShadow: "0 8px 24px -8px #00000059, inset 0 0 0 1px var(--color-divider)",
                }}
              >
                {live ? (
                  <>
                    <DockLink href={previewPath(p.id)} external icon={ICON.eye} label="Preview" />
                    <DockButton onClick={() => actions.onShare(p.id)} icon={ICON.share} label="Share" />
                    <DockLink href={`/stats?p=${p.id}`} icon={ICON.chart} label="Stats" />
                  </>
                ) : (
                  <>
                    <DockLink href={`/builder/${p.id}`} icon={ICON.grid} label="Builder" />
                    <DockLink href={`/editor/${p.id}`} icon={ICON.pencil} label="Content" />
                    <DockLink href={previewPath(p.id)} external icon={ICON.eye} label="Preview" />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── the details ── */}
        <div className="flex flex-col px-2 pt-3 pb-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h2
                className={`m-0 truncate leading-snug tracking-[-0.02em] ${featured ? "text-[18px] sm:text-[20px]" : "text-[16px]"}`}
              >
                {p.name}
              </h2>
              <PageLink p={p} handle={handle} />
            </div>
            {live && (
              <IconButton label={`Share ${p.name}`} onClick={() => actions.onShare(p.id)}>
                <Icon d={ICON.share} size={15} />
              </IconButton>
            )}
            {!live && (
              <IconButton label={`Edit details of ${p.name}`} onClick={() => actions.onEdit(p)}>
                <Icon d={ICON.pencil} size={15} />
              </IconButton>
            )}
            <CardMenu portfolio={p} actions={actions} />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <StatusPill live={live} />
            <span className="min-w-0 flex-1 truncate font-mono text-[11.5px]" style={{ color: "var(--color-neutral-600)" }}>
              {p.updatedAt && (
                <time dateTime={p.updatedAt} title={`Updated ${UPDATED.format(new Date(p.updatedAt))}`}>
                  {ago(p.updatedAt, now)}
                </time>
              )}
            </span>
            {live ? (
              <a
                href={previewPath(p.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ minHeight: 32, padding: "0.35rem 0.8rem", fontSize: 13, borderRadius: 999 }}
              >
                <Icon d={ICON.eye} size={14} />
                Preview
              </a>
            ) : (
              <Link
                href={`/builder/${p.id}`}
                className="btn btn-primary"
                style={{ minHeight: 32, padding: "0.35rem 0.9rem", fontSize: 13, borderRadius: 999 }}
              >
                Open builder
                <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}

/* A clock every card reads, ticking once a minute so "just now" moves on
   while the page stays open. An external store, because the React Compiler
   lint refuses `Date.now()` during render. */
let clock = Date.now();
const clockListeners = new Set<() => void>();
let clockTimer: number | undefined;
function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  clockTimer ??= window.setInterval(() => {
    clock = Date.now();
    clockListeners.forEach((l) => l());
  }, 60_000);
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0) {
      window.clearInterval(clockTimer);
      clockTimer = undefined;
    }
  };
}
function useNow(): number {
  return useSyncExternalStore(subscribeClock, () => clock, () => clock);
}

/** The full date and time, for the tooltip over the relative one. */
const UPDATED = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * "2 days ago" — the same steps as `relative_time()` in the backend's
 * portfolio service, plus years. Worked out here from `updatedAt` rather
 * than read off `meta`, which also carries the section count.
 */
function ago(iso: string, now: number): string {
  const seconds = (now - new Date(iso).getTime()) / 1000;
  const n = (count: number, unit: string) => `${count} ${unit}${count === 1 ? "" : "s"} ago`;
  if (seconds < 90) return "just now";
  if (seconds < 3600) return n(Math.floor(seconds / 60), "minute");
  if (seconds < 86_400) return n(Math.floor(seconds / 3600), "hour");
  const days = Math.floor(seconds / 86_400);
  if (days < 30) return n(days, "day");
  if (days < 365) return n(Math.floor(days / 30), "month");
  return n(Math.floor(days / 365), "year");
}

// The colour is a class, not an inline style: an inline `color` outranks
// every class, `hover:` included, so the label stayed ink on the ink pill.
const DOCK_ITEM =
  "flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium no-underline transition-colors text-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-[var(--color-bg)] focus-visible:bg-[var(--color-ink)] focus-visible:text-[var(--color-bg)]";

function DockLink({ href, icon, label, external }: { href: string; icon: React.ReactNode; label: string; external?: boolean }) {
  const content = (
    <>
      <Icon d={icon} size={13} />
      {label}
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={DOCK_ITEM}>
      {content}
    </a>
  ) : (
    <Link href={href} className={DOCK_ITEM}>
      {content}
    </Link>
  );
}

function DockButton({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} className={DOCK_ITEM}>
      <Icon d={icon} size={13} />
      {label}
    </button>
  );
}

/**
 * The page's address, as a link that opens it.
 *
 * A live page shows its real, working address and a copy button beside it.
 * A draft has no public address yet — it answers 404 until it is published —
 * so it says so and links its preview instead of printing a dead link.
 */
function PageLink({ p, handle }: { p: Portfolio; handle: string }) {
  const [copied, setCopied] = useState(false);
  const live = p.status === "live";

  if (!live) {
    return (
      <a
        href={previewPath(p.id)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-flex max-w-full items-center gap-1 text-[12.5px] underline-offset-2 hover:underline"
        style={{ color: "var(--color-neutral-700)" }}
      >
        <span className="truncate">Not public yet · preview draft</span>
        <Icon d={ICON.out} size={12} />
      </a>
    );
  }

  if (!handle) {
    return (
      <Link
        href="/account"
        className="mt-1 inline-flex max-w-full items-center gap-1 text-[12.5px] underline underline-offset-2"
        style={{ color: "var(--color-ink)" }}
      >
        <span className="truncate">No public address — choose a handle</span>
      </Link>
    );
  }

  const url = liveUrl(handle, p.slug);
  return (
    <div className="mt-1 flex min-w-0 items-center gap-1">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={url}
        className="inline-flex min-w-0 items-center gap-1 font-mono text-[12px] underline-offset-2 hover:underline"
        style={{ color: "var(--color-ink)" }}
      >
        <span className="truncate">{displayUrl(url)}</span>
        <span className="flex-none">
          <Icon d={ICON.out} size={12} />
        </span>
      </a>
      <button
        type="button"
        aria-label={copied ? "Link copied" : "Copy link"}
        title={copied ? "Copied" : "Copy link"}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          } catch {
            // Clipboard refused (an insecure origin, a denied permission):
            // the link beside it is still there to open or select.
          }
        }}
        className="relative grid h-6 w-6 flex-none cursor-pointer place-items-center rounded transition-colors hover:bg-[var(--color-neutral-200)]"
        style={{ color: "var(--color-neutral-700)" }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={copied ? "done" : "copy"}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.14 }}
          >
            <Icon d={copied ? ICON.check : ICON.copy} size={13} />
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  );
}

/* ── list ─────────────────────────────────────────────────────────────── */

/**
 * The rows, and a larger view of the page under the pointer that follows it
 * down the list. The row's own thumbnail is too small to tell two pages
 * apart; the floating one is big enough to, without opening anything. Mouse
 * only — on touch there is no hover to follow — and never under reduced
 * motion, where a panel chasing the pointer is exactly what was turned off.
 */
function List({ portfolios, actions }: { portfolios: Portfolio[]; actions: Actions }) {
  const handle = useAccount().account.profile.handle;
  const reduced = useReducedMotion();
  const [peek, setPeek] = useState<Portfolio | null>(null);
  const px = useSpring(0, { stiffness: 320, damping: 32 });
  const py = useSpring(0, { stiffness: 320, damping: 32 });
  const PEEK_W = 360;
  return (
    <div
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        // Beside the pointer, flipped to its left near the window's edge.
        const right = e.clientX + 28 + PEEK_W < window.innerWidth;
        px.set(right ? e.clientX + 28 : e.clientX - 28 - PEEK_W);
        py.set(Math.min(Math.max(e.clientY - PEEK_W * 0.3125, 12), window.innerHeight - PEEK_W * 0.625 - 12));
      }}
      onPointerLeave={() => setPeek(null)}
      className="overflow-visible rounded-2xl"
      style={{ border: "1px solid var(--color-divider)", background: "var(--color-bg)" }}
    >
      <div
        className="hidden grid-cols-[96px_minmax(0,1fr)_100px_200px] items-center gap-4 rounded-t-2xl px-4 py-2.5 text-[12px] font-medium md:grid"
        style={{
          background: "var(--color-surface)",
          color: "var(--color-neutral-700)",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <span>Preview</span>
        <span>Name</span>
        <span>Status</span>
        <span className="sr-only">Actions</span>
      </div>
      <ul className="m-0 list-none p-0">
        <AnimatePresence initial={true}>
          {portfolios.map((p, i) => {
            const live = p.status === "live";
            return (
              <motion.li
                key={p.id}
                layout={!reduced}
                initial={reduced ? { opacity: 0 } : { opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, delay: Math.min(i, 10) * 0.03, ease: EASE }}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") setPeek(p);
                }}
                className="group grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3 transition-colors hover:bg-[var(--color-surface)] md:grid-cols-[96px_minmax(0,1fr)_100px_200px]"
                style={{ borderTop: i === 0 ? "none" : "1px solid var(--color-divider)" }}
              >
                <div
                  className="relative aspect-[16/10] overflow-hidden rounded-md grayscale transition-[filter] duration-500 group-hover:grayscale-0"
                  style={{ border: "1px solid var(--color-divider)", background: "var(--color-surface)" }}
                >
                  <PagePreview p={p} handle={handle} />
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-[14px] font-medium">{p.name}</span>
                  <PageLink p={p} handle={handle} />
                </div>
                <span className="hidden md:block">
                  <StatusPill live={live} />
                </span>
                <div className="flex items-center justify-end gap-0.5">
                  {live && (
                    <IconButton label={`Share ${p.name}`} onClick={() => actions.onShare(p.id)}>
                      <Icon d={ICON.share} size={15} />
                    </IconButton>
                  )}
                  {!live && (
                    <IconButton label={`Edit details of ${p.name}`} onClick={() => actions.onEdit(p)}>
                      <Icon d={ICON.pencil} size={15} />
                    </IconButton>
                  )}
                  {live ? (
                    <a
                      href={previewPath(p.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost hidden sm:inline-flex"
                      style={{ minHeight: 32, padding: "0.35rem 0.7rem", fontSize: 13 }}
                    >
                      Preview
                    </a>
                  ) : (
                    <Link
                      href={`/builder/${p.id}`}
                      className="btn btn-ghost hidden sm:inline-flex"
                      style={{ minHeight: 32, padding: "0.35rem 0.7rem", fontSize: 13 }}
                    >
                      Open builder
                    </Link>
                  )}
                  <CardMenu portfolio={p} actions={actions} />
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {/* Portaled: a fixed panel inside a transformed ancestor is fixed to
          that ancestor, not the window. */}
      {!reduced &&
        createPortal(
          <AnimatePresence>
            {peek && (
              <motion.div
                aria-hidden
                className="pointer-events-none fixed top-0 left-0 z-40 [@media(hover:none)]:hidden"
                style={{ x: px, y: py, width: PEEK_W }}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.15 } }}
                transition={{ duration: 0.25, ease: EASE }}
              >
                <div
                  className="relative aspect-[16/10] overflow-hidden rounded-xl"
                  style={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-divider)",
                    boxShadow: "0 30px 60px -24px #00000080",
                  }}
                >
                  <AnimatePresence initial={false}>
                    <motion.div
                      key={peek.id}
                      className="absolute inset-0"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <PagePreview p={peek} handle={handle} />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

/* ── the actions menu ─────────────────────────────────────────────────── */

/** Where an open menu sits, in window coordinates. */
type MenuSpot = { right: number; top?: number; bottom?: number };

const MENU_ROOM = 280;

/**
 * The ••• menu.
 *
 * Portaled to the body and placed against the window, not the card: every
 * card is animated, so each is its own stacking context, and a menu drawn
 * inside one was painted under the next card in the grid however high its
 * z-index. It opens upward when there is no room below, and closes on
 * scroll or resize rather than drifting away from its button.
 */
function CardMenu({ portfolio: p, actions }: { portfolio: Portfolio; actions: Actions }) {
  const [spot, setSpot] = useState<MenuSpot | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const live = p.status === "live";
  const open = spot !== null;

  function toggle() {
    if (open || !ref.current) {
      setSpot(null);
      return;
    }
    const r = ref.current.getBoundingClientRect();
    const right = window.innerWidth - r.right;
    const up = r.bottom + MENU_ROOM > window.innerHeight && r.top > MENU_ROOM;
    setSpot(up ? { right, bottom: window.innerHeight - r.top + 6 } : { right, top: r.bottom + 6 });
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t) || menu.current?.contains(t)) return;
      setSpot(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSpot(null);
    }
    const shut = () => setSpot(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", shut, { passive: true });
    window.addEventListener("resize", shut);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", shut);
      window.removeEventListener("resize", shut);
    };
  }, [open]);

  const item =
    "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px] no-underline transition-colors hover:bg-[var(--color-neutral-200)]";
  const close = () => setSpot(null);
  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  return (
    <div ref={ref} className="relative flex-none" data-menu-open={open ? "" : undefined}>
      <IconButton label={`More actions for ${p.name}`} onClick={toggle}>
        <Icon d={ICON.more} size={18} />
      </IconButton>
      {createPortal(
        <AnimatePresence>
          {spot && (
            <motion.div
              ref={menu}
              role="menu"
              initial={{ opacity: 0, scale: 0.95, y: spot.top !== undefined ? -4 : 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
              transition={{ duration: 0.16, ease: EASE }}
              className={`fixed z-50 w-[220px] rounded-xl p-1 ${spot.top !== undefined ? "origin-top-right" : "origin-bottom-right"}`}
              style={{
                top: spot.top,
                bottom: spot.bottom,
                right: spot.right,
                background: "var(--color-bg)",
                border: "1px solid var(--color-divider)",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              {/* A live page is frozen — the API refuses every edit — so its
                  menu is only what you do with a published page: look at it,
                  share it, see how it is doing, or take it down to change it.
                  Editing and delete are for drafts. The resume lives in the
                  builder's Resume side, not here. */}
              {!live && (
                <>
                  <Link role="menuitem" href={`/builder/${p.id}`} className={item} style={{ color: "var(--color-ink)" }} onClick={close}>
                    Open builder
                  </Link>
                  <Link role="menuitem" href={`/editor/${p.id}`} className={item} style={{ color: "var(--color-ink)" }} onClick={close}>
                    Edit content
                  </Link>
                  <button role="menuitem" type="button" className={item} onClick={run(() => actions.onEdit(p))}>
                    Edit details…
                  </button>
                </>
              )}
              <a
                role="menuitem"
                href={previewPath(p.id)}
                target="_blank"
                rel="noopener noreferrer"
                className={item}
                style={{ color: "var(--color-ink)" }}
                onClick={close}
              >
                Preview
              </a>
              {live && (
                <button role="menuitem" type="button" className={item} onClick={run(() => actions.onShare(p.id))}>
                  Share…
                </button>
              )}
              {/* A draft has no visitors, so nothing to count yet. */}
              {live && (
                <Link role="menuitem" href={`/stats?p=${p.id}`} className={item} style={{ color: "var(--color-ink)" }} onClick={close}>
                  Views and clicks
                </Link>
              )}
              <div className="my-1 h-px" style={{ background: "var(--color-divider)" }} />
              <button
                role="menuitem"
                type="button"
                className={item}
                onClick={run(() => (live ? actions.onUnpublish(p.id) : actions.onPublish(p.id)))}
              >
                {live ? "Unpublish" : "Publish"}
              </button>
              {!live && (
                <button role="menuitem" type="button" className={`${item} font-medium`} onClick={run(() => actions.onDelete(p))}>
                  Delete…
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

/* ── dialogs ──────────────────────────────────────────────────────────── */

/**
 * Name, description and address — the card's own details, edited where the
 * card is. A published page is frozen by the API, so for one of those the
 * fields are read-only and the dialog offers the way out: unpublish first.
 */
function EditDetails({
  portfolio,
  taken,
  onCancel,
  onSave,
  onUnpublish,
}: {
  portfolio: Portfolio;
  taken: string[];
  onCancel: () => void;
  onSave: (fields: Pick<Portfolio, "name" | "summary" | "slug">) => void;
  onUnpublish: () => void;
}) {
  const handle = useAccount().account.profile.handle;
  const [name, setName] = useState(portfolio.name);
  const [summary, setSummary] = useState(portfolio.summary);
  const [slug, setSlug] = useState(portfolio.slug);
  const live = portfolio.status === "live";

  const nameError = name.trim() ? null : "Give it a name.";
  // Says which rule the address breaks, not just that it breaks one.
  const slugError =
    slug.length < 2
      ? "An address needs at least two characters."
      : slug.endsWith("-")
        ? "An address can’t end with a hyphen."
        : !isSlug(slug)
          ? "Use lowercase letters, numbers and hyphens only."
          : taken.includes(slug)
            ? "Another of your pages already uses this address."
            : null;
  const unchanged =
    name.trim() === portfolio.name && summary.trim() === portfolio.summary && slug === portfolio.slug;

  return (
    <Modal
      title="Edit details"
      description="How this page is listed here, and the address it publishes at."
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn btn-secondary" style={{ marginTop: 0 }} onClick={onCancel}>
            {live ? "Close" : "Cancel"}
          </button>
          {!live && (
            <button
              type="submit"
              form="edit-details"
              className="btn btn-primary"
              style={{ marginTop: 0 }}
              disabled={!!nameError || !!slugError || unchanged}
            >
              Save details
            </button>
          )}
        </>
      }
    >
      <form
        id="edit-details"
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (live || nameError || slugError || unchanged) return;
          onSave({ name: name.trim(), summary: summary.trim(), slug });
        }}
      >
        {live && (
          <div
            className="flex flex-wrap items-center gap-3 rounded-xl px-3.5 py-3 text-[13px]"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-divider)" }}
          >
            <span className="min-w-0 flex-1">
              This page is live, so it can’t change. Unpublish it to edit, then publish again.
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginTop: 0, minHeight: 30, padding: "0.3rem 0.7rem", fontSize: 13 }}
              onClick={onUnpublish}
            >
              Unpublish
            </button>
          </div>
        )}

        {/* `min-w-0`: a fieldset defaults to `min-width: min-content`, so the
            long address prefix pushed every field past the dialog's edge. */}
        <fieldset disabled={live} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0 disabled:opacity-60">
          <div className="field">
            <label htmlFor="ed-name">Name</label>
            <input
              id="ed-name"
              className="input"
              autoFocus={!live}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "ed-name-err" : undefined}
            />
            {nameError && (
              <p id="ed-name-err" className="m-0 mt-1.5 text-[12.5px]">
                {nameError}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="ed-summary">Note for yourself</label>
            <textarea
              id="ed-summary"
              className="input"
              rows={3}
              maxLength={2000}
              value={summary}
              placeholder="Who this version of the page is for. Only you see this."
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="ed-slug">Address</label>
            <div
              className="flex items-center overflow-hidden rounded-[var(--radius-md)]"
              style={{ border: "1px solid var(--color-divider)", background: "var(--color-surface)" }}
            >
              <span
                className="flex-none truncate py-2 pr-0.5 pl-3 font-mono text-[12.5px]"
                style={{ color: "var(--color-neutral-600)", maxWidth: "55%" }}
              >
                {displayUrl(liveUrl(handle || "your-handle", ""))}
              </span>
              <input
                id="ed-slug"
                className="min-w-0 flex-1 bg-transparent py-2 pr-3 font-mono text-[13px] outline-none"
                style={{ color: "var(--color-ink)", border: 0 }}
                value={slug}
                // Cleaned as typed, not slugified: slugify trims a trailing
                // hyphen, which would make "my-page" impossible to type.
                // Validation judges the finished value instead.
                onChange={(e) =>
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]+/g, "-")
                      .replace(/-{2,}/g, "-")
                      .replace(/^-+/, "")
                      .slice(0, 120),
                  )
                }
                aria-invalid={!!slugError}
                aria-describedby="ed-slug-hint"
              />
            </div>
            <p id="ed-slug-hint" className="m-0 mt-1.5 text-[12.5px] text-muted">
              {slugError ?? "Changing it breaks links you have already shared."}
            </p>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

// Focus lands on the safe choice: "Keep it" has autoFocus.
function ConfirmDelete({
  portfolio,
  onCancel,
  onConfirm,
}: {
  portfolio: Portfolio;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      role="alertdialog"
      title={<>Delete “{portfolio.name}”?</>}
      description="The page and every section in it are removed for good. This can’t be undone."
      onClose={onCancel}
      width={440}
      footer={
        <>
          <button type="button" className="btn btn-secondary" style={{ marginTop: 0 }} autoFocus onClick={onCancel}>
            Keep it
          </button>
          <button type="button" className="btn btn-primary" style={{ marginTop: 0 }} onClick={onConfirm}>
            Delete portfolio
          </button>
        </>
      }
    >
      <div className="flex items-center gap-3 rounded-xl px-3.5 py-3" style={{ background: "var(--color-surface)" }}>
        <span
          aria-hidden
          className="grid h-9 w-9 flex-none place-items-center rounded-full text-[15px] font-bold"
          style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
        >
          !
        </span>
        <span className="min-w-0 text-[13px] leading-snug">
          <span className="block truncate font-medium">{portfolio.name}</span>
          <span className="text-muted">{portfolio.meta}</span>
        </span>
      </div>
    </Modal>
  );
}

/* ── states ───────────────────────────────────────────────────────────── */

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-[22px] p-2"
          style={{ border: "1px solid var(--color-divider)", background: "var(--color-bg)" }}
        >
          <div className="overflow-hidden rounded-[14px]" style={{ border: "1px solid var(--color-divider)" }}>
            <div className="h-8" style={{ background: "var(--color-surface)" }} />
            <div className="aspect-[16/10] animate-pulse" style={{ background: "var(--color-neutral-200)" }} />
          </div>
          <div className="flex flex-col gap-2 px-2 pt-3.5 pb-2">
            <div className="h-4 w-2/3 animate-pulse rounded" style={{ background: "var(--color-neutral-200)" }} />
            <div className="h-3 w-1/2 animate-pulse rounded" style={{ background: "var(--color-neutral-200)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ onCreate }: { onCreate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="flex flex-col items-center rounded-2xl px-6 py-16 text-center"
      style={{ border: "1.5px dashed var(--color-neutral-400)", background: "var(--color-bg)" }}
    >
      <span
        aria-hidden
        className="mb-5 grid h-12 w-12 place-items-center rounded-xl"
        style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
      >
        <Glyph id="plus" size={20} />
      </span>
      <h2 className="m-0 text-[18px] tracking-[-0.01em]">Make your first portfolio</h2>
      <p className="m-0 mt-2 max-w-[44ch] text-[14px] text-muted">
        One page with a header and as many sections as you need. Pick what you do and
        it starts dressed for it — you can change everything later.
      </p>
      <button type="button" className="btn btn-primary mt-6" onClick={onCreate}>
        New portfolio
      </button>
    </motion.div>
  );
}

function NoMatch({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div
      className="rounded-2xl px-6 py-12 text-center"
      style={{ border: "1px solid var(--color-divider)", background: "var(--color-bg)" }}
    >
      <p className="m-0 text-[14px]">
        {query.trim() ? (
          <>
            Nothing matches <strong>“{query.trim()}”</strong>.
          </>
        ) : (
          "No portfolios here yet."
        )}
      </p>
      <button type="button" className="btn btn-ghost mt-3" onClick={onClear}>
        Show all portfolios
      </button>
    </div>
  );
}
