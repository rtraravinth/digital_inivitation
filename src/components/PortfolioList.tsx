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
import { useEffect, useRef, useState } from "react";
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

   The app is black and white; each card's preview is the author's real page,
   shown in greyscale until the card is hovered, when it comes up in colour.

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
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <div className="min-w-0">
              <motion.h1
                initial={reduced ? false : { opacity: 0, y: 14, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.6, ease: EASE }}
                className="m-0 text-[28px] leading-tight tracking-[-0.03em] sm:text-[34px]"
              >
                Portfolios
              </motion.h1>
              <motion.p
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="m-0 mt-1.5 text-[14px] text-muted"
              >
                {ready ? (
                  <>
                    {counts.all} {counts.all === 1 ? "page" : "pages"} · {live} live
                  </>
                ) : (
                  "Loading…"
                )}
              </motion.p>
            </div>
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
              className="ml-auto flex items-center gap-2"
            >
              {portfolios.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ background: "var(--color-bg)" }}
                  onClick={() =>
                    setSharing(portfolios.find((p) => p.status === "live")?.id ?? portfolios[0].id)
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

          {/* ── toolbar ─────────────────────────────────────────── */}
          {portfolios.length > 0 && (
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.18, ease: EASE }}
              className="mt-8 flex flex-wrap items-center gap-2"
            >
              <label className="relative flex min-w-0 flex-1 basis-[240px] items-center sm:max-w-[340px]">
                <span className="sr-only">Search portfolios</span>
                <span
                  className="pointer-events-none absolute left-3"
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
                    paddingLeft: 34,
                    paddingRight: 36,
                    minHeight: 36,
                    fontSize: 14,
                    background: "var(--color-bg)",
                  }}
                />
                {!query && (
                  <kbd
                    aria-hidden
                    className="pointer-events-none absolute right-2.5 rounded px-1.5 font-mono text-[11px]"
                    style={{
                      color: "var(--color-neutral-600)",
                      boxShadow: "inset 0 0 0 1px var(--color-divider)",
                    }}
                  >
                    /
                  </kbd>
                )}
              </label>

              <Segmented
                label="Show"
                id="filter"
                value={filter}
                onChange={setFilter}
                options={[
                  { id: "all", label: "All", count: counts.all },
                  { id: "live", label: "Live", count: counts.live },
                  { id: "draft", label: "Drafts", count: counts.draft },
                ]}
              />

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

/* ── grid ─────────────────────────────────────────────────────────────── */

function Grid({
  portfolios,
  showCreate,
  onCreate,
  actions,
}: {
  portfolios: Portfolio[];
  showCreate: boolean;
  onCreate: () => void;
  actions: Actions;
}) {
  const reduced = useReducedMotion();
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" style={{ perspective: 1600 }}>
      <AnimatePresence mode="popLayout" initial={true}>
        {portfolios.map((p, i) => (
          <motion.div
            key={p.id}
            layout={!reduced}
            // Each card swings up into place off its bottom edge, a beat
            // behind the one before it.
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28, rotateX: -14 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
            transition={{ duration: 0.7, delay: Math.min(i, 8) * 0.06, ease: EASE }}
            style={{ transformOrigin: "50% 100%" }}
            className="flex"
          >
            <Card portfolio={p} actions={actions} />
          </motion.div>
        ))}
        {showCreate && (
          <motion.button
            key="create"
            layout={!reduced}
            type="button"
            onClick={onCreate}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28, rotateX: -14 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.7, delay: Math.min(portfolios.length, 8) * 0.06, ease: EASE }}
            whileHover={reduced ? undefined : { y: -4 }}
            className="group flex min-h-[340px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl text-center"
            style={{
              border: "1.5px dashed var(--color-neutral-400)",
              color: "var(--color-neutral-700)",
              background: "color-mix(in srgb, var(--color-bg) 70%, transparent)",
            }}
          >
            <span
              className="grid h-12 w-12 place-items-center rounded-full transition-all duration-300 group-hover:rotate-90 group-hover:bg-[var(--color-ink)] group-hover:text-[var(--color-bg)]"
              style={{ boxShadow: "inset 0 0 0 1px var(--color-divider)" }}
            >
              <Glyph id="plus" size={20} />
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

/** Live or draft, said so it reads across the room and without colour. */

/**
 * A card that leans toward the pointer.
 *
 * Springs, so it settles rather than snapping when the pointer leaves, and a
 * soft highlight that tracks the pointer across the surface. Mouse only and
 * never under reduced motion: a touch drag over a card is a scroll.
 */
function Card({ portfolio: p, actions }: { portfolio: Portfolio; actions: Actions }) {
  const handle = useAccount().account.profile.handle;
  const reduced = useReducedMotion();
  const live = p.status === "live";
  const rx = useSpring(0, { stiffness: 180, damping: 20 });
  const ry = useSpring(0, { stiffness: 180, damping: 20 });
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const glare = useMotionTemplate`radial-gradient(420px circle at ${gx}% ${gy}%, color-mix(in srgb, var(--color-ink) 7%, transparent), transparent 60%)`;
  const [hot, setHot] = useState(false);

  return (
    <motion.article
      data-card=""
      className="group relative flex w-full flex-col rounded-2xl"
      style={{
        rotateX: rx,
        rotateY: ry,
        transformPerspective: 1200,
        border: "1px solid var(--color-divider)",
        background: "var(--color-bg)",
      }}
      animate={{
        y: hot && !reduced ? -6 : 0,
        boxShadow: hot
          ? "0 30px 60px -28px #00000066, 0 0 0 1px color-mix(in srgb, var(--color-ink) 22%, transparent)"
          : "0 1px 2px #0000000f",
      }}
      transition={{ duration: 0.3, ease: EASE }}
      onPointerEnter={() => setHot(true)}
      onPointerMove={(e) => {
        if (reduced || e.pointerType !== "mouse") return;
        const box = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - box.left) / box.width;
        const py = (e.clientY - box.top) / box.height;
        ry.set((px - 0.5) * 8);
        rx.set((0.5 - py) * 8);
        gx.set(px * 100);
        gy.set(py * 100);
      }}
      onPointerLeave={() => {
        setHot(false);
        rx.set(0);
        ry.set(0);
      }}
    >
      {/* The page itself. Greyscale at rest, colour on hover: the app shows
          no colour of its own until you are looking at your own work. */}
      <div
        className="relative aspect-[16/10] overflow-hidden rounded-t-2xl"
        style={{ borderBottom: "1px solid var(--color-divider)", background: "var(--color-surface)" }}
      >
        <motion.div
          className="absolute inset-0"
          animate={{
            filter: hot ? "grayscale(0) contrast(1)" : "grayscale(1) contrast(1.04)",
            scale: hot && !reduced ? 1.035 : 1,
          }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <PagePreview p={p} handle={handle} />
        </motion.div>
        <div className="absolute top-3 left-3">
          <StatusPill live={live} floating />
        </div>
      </div>

      {/* The pointer's light on the card. */}
      {!reduced && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{ background: glare, opacity: hot ? 1 : 0, transition: "opacity 300ms" }}
        />
      )}

      <div className="relative flex flex-1 flex-col p-4 pt-3.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 data-card-title="" className="m-0 truncate text-[16px] leading-snug tracking-[-0.015em]">{p.name}</h2>
            <PageLink p={p} handle={handle} />
          </div>
          <IconButton label={`Edit details of ${p.name}`} onClick={() => actions.onEdit(p)}>
            <Icon d={ICON.pencil} size={15} />
          </IconButton>
          <CardMenu portfolio={p} actions={actions} />
        </div>

        {p.summary && (
          <p className="m-0 mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted">{p.summary}</p>
        )}

        <div className="mt-auto flex items-center gap-2 pt-4">
          <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: "var(--color-neutral-600)" }}>
            {p.meta}
          </span>
          {live ? (
            <a
              href={previewPath(p.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ minHeight: 32, padding: "0.35rem 0.75rem", fontSize: 13 }}
            >
              <Icon d={ICON.eye} size={14} />
              Preview
            </a>
          ) : (
            <Link
              href={`/builder/${p.id}`}
              className="btn btn-primary"
              style={{ minHeight: 32, padding: "0.35rem 0.85rem", fontSize: 13 }}
            >
              Open builder
            </Link>
          )}
        </div>
      </div>
    </motion.article>
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

function List({ portfolios, actions }: { portfolios: Portfolio[]; actions: Actions }) {
  const handle = useAccount().account.profile.handle;
  const reduced = useReducedMotion();
  return (
    <div
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
                  <IconButton label={`Edit details of ${p.name}`} onClick={() => actions.onEdit(p)}>
                    <Icon d={ICON.pencil} size={15} />
                  </IconButton>
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
    </div>
  );
}

/* ── the actions menu ─────────────────────────────────────────────────── */

function CardMenu({ portfolio: p, actions }: { portfolio: Portfolio; actions: Actions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const live = p.status === "live";

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item =
    "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px] no-underline transition-colors hover:bg-[var(--color-neutral-200)]";
  const close = () => setOpen(false);
  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  return (
    <div ref={ref} className="relative flex-none">
      <IconButton label={`More actions for ${p.name}`} onClick={() => setOpen((v) => !v)}>
        <Icon d={ICON.more} size={18} />
      </IconButton>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4, transition: { duration: 0.1 } }}
            transition={{ duration: 0.16, ease: EASE }}
            className="absolute top-9 right-0 z-30 w-[220px] origin-top-right rounded-xl p-1"
            style={{
              background: "var(--color-bg)",
              border: "1px solid var(--color-divider)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {/* A live page is frozen — the API refuses every edit — so the
                editing entries and delete only appear on a draft. */}
            {!live && (
              <>
                <Link role="menuitem" href={`/builder/${p.id}`} className={item} style={{ color: "var(--color-ink)" }} onClick={close}>
                  Open builder
                </Link>
                <Link role="menuitem" href={`/editor/${p.id}`} className={item} style={{ color: "var(--color-ink)" }} onClick={close}>
                  Edit content
                </Link>
              </>
            )}
            <button role="menuitem" type="button" className={item} onClick={run(() => actions.onEdit(p))}>
              Edit details…
            </button>
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
            <button role="menuitem" type="button" className={item} onClick={run(() => actions.onShare(p.id))}>
              Share…
            </button>
            <Link role="menuitem" href={`/stats?p=${p.id}`} className={item} style={{ color: "var(--color-ink)" }} onClick={close}>
              Views and clicks
            </Link>
            <div className="my-1 h-px" style={{ background: "var(--color-divider)" }} />
            {/* The resume is not on the page, so these stay open while it is live. */}
            <Link role="menuitem" href={`/builder/${p.id}?mode=resume`} className={item} style={{ color: "var(--color-ink)" }} onClick={close}>
              Resume templates
            </Link>
            <a
              role="menuitem"
              href={`/resume/${p.id}?print=1`}
              target="_blank"
              rel="noopener noreferrer"
              className={item}
              style={{ color: "var(--color-ink)" }}
              onClick={close}
            >
              Download resume (PDF)
            </a>
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
      </AnimatePresence>
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
          className="overflow-hidden rounded-2xl"
          style={{ border: "1px solid var(--color-divider)", background: "var(--color-bg)" }}
        >
          <div className="aspect-[16/10] animate-pulse" style={{ background: "var(--color-neutral-200)" }} />
          <div className="flex flex-col gap-2 p-4">
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
