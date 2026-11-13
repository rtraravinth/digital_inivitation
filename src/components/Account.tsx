"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { AppHeader } from "./AppHeader";
import { Avatar, GROUPS, GroupGlyph, groupFlag, type GroupId } from "./account/panels";
import { Ring } from "./stats/charts";
import { ICON, Icon, TiltPanel } from "./ui";
import { clearAccountError, useAccount } from "@/lib/account";
import { useAnalytics } from "@/lib/analytics";
import { signOut } from "@/lib/session";
import { displayUrl, liveUrl } from "@/lib/slug";
import { usePortfolios } from "@/lib/store";
import { PLANS } from "@/lib/types";

/* ── Account ──────────────────────────────────────────────────────────────
   Artboards 5a and 5b, rebuilt like Portfolios and Stats: the same header,
   backdrop and 3D surfaces. A profile card says who you are and what is
   left to set up; a rail of groups sits beside one panel on a desk, and
   becomes a row of chips over the panel on a phone.
   ──────────────────────────────────────────────────────────────────────── */

const EASE = [0.16, 1, 0.3, 1] as const;

export function Account() {
  const { portfolios } = usePortfolios();
  const { account, storageError, ready } = useAccount();
  const analytics = useAnalytics();
  const reduced = useReducedMotion();
  const [groupId, setGroupId] = useState<GroupId>("profile");
  const [direction, setDirection] = useState(1);

  const index = GROUPS.findIndex((g) => g.id === groupId);
  const group = GROUPS[index] ?? GROUPS[0];
  const panelProps = { account, portfolios, analytics };
  const planName = PLANS.find((p) => p.id === account.plan)?.name ?? "Free";
  const live = portfolios.filter((p) => p.status === "live").length;
  const handle = account.profile.handle;

  // What is left to set up, from what the account actually has.
  const checklist: Array<{ id: GroupId; label: string; done: boolean }> = [
    { id: "profile", label: "Choose a handle", done: !!handle },
    { id: "profile", label: "Add a photo", done: !!account.profile.portrait },
  ];
  const done = checklist.filter((c) => c.done).length;

  const pick = (id: GroupId) => {
    const next = GROUPS.findIndex((g) => g.id === id);
    setDirection(next >= index ? 1 : -1);
    setGroupId(id);
    clearAccountError();
  };

  return (
    <>
      <div aria-hidden className="app-backdrop" />
      <div
        className="flex min-h-dvh flex-col"
        onPointerMove={(e) => {
          if (reduced || e.pointerType !== "mouse") return;
          document.documentElement.style.setProperty("--mx", `${e.clientX}px`);
          document.documentElement.style.setProperty("--my", `${e.clientY}px`);
        }}
      >
        <AppHeader current="account" />

        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-8 pb-20 sm:px-6 sm:pt-12" style={{ perspective: 1600 }}>
          <AnimatePresence>
            {storageError && (
              <motion.div
                role="alert"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-6 flex items-start gap-3 rounded-xl px-4 py-3 text-[13.5px]"
                style={{ border: "1px solid var(--color-ink)", background: "var(--color-bg)" }}
              >
                <span
                  aria-hidden
                  className="mt-px grid h-5 w-5 flex-none place-items-center rounded-full text-[12px] font-bold"
                  style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
                >
                  !
                </span>
                <span className="min-w-0 flex-1">{storageError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── title row ───────────────────────────────────────── */}
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <div className="min-w-0">
              <motion.h1
                initial={reduced ? false : { opacity: 0, y: 14, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.6, ease: EASE }}
                className="m-0 text-[28px] leading-tight tracking-[-0.03em] sm:text-[34px]"
              >
                Account
              </motion.h1>
              <motion.p
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="m-0 mt-1.5 max-w-[60ch] text-[14px] text-muted"
              >
                Your profile, how you sign in, your page addresses and your data.
                Anything about one portfolio lives in that portfolio’s editor.
              </motion.p>
            </div>
            <motion.button
              type="button"
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
              className="btn btn-secondary ml-auto"
              style={{ background: "var(--color-bg)" }}
              onClick={() => void signOut()}
            >
              <Icon d={<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" />} size={15} />
              Sign out
            </motion.button>
          </div>

          {/* ── who you are, and what is left ───────────────────── */}
          <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <motion.div
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, rotateX: -12 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.65, ease: EASE }}
              style={{ transformOrigin: "50% 100%" }}
            >
              <TiltPanel max={4} className="flex h-full flex-wrap items-center gap-5 rounded-2xl p-5 sm:p-6">
                {ready ? (
                  <Avatar profile={account.profile} size={76} />
                ) : (
                  <span className="h-[76px] w-[76px] animate-pulse rounded-full" style={{ background: "var(--color-neutral-200)" }} />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-[20px] font-semibold tracking-[-0.02em]">
                    {account.profile.name || "Your name"}
                  </span>
                  {handle ? (
                    <span className="truncate font-mono text-[12.5px]">{displayUrl(liveUrl(handle, ""))}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => pick("profile")}
                      className="w-fit cursor-pointer text-left text-[13px] underline underline-offset-2"
                    >
                      No handle yet — choose one
                    </button>
                  )}
                  <span className="text-[12.5px] text-muted">{account.security.email ?? account.security.phone}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Fact label="Plan" value={planName} />
                  <Fact label="Live pages" value={String(live)} />
                </div>
              </TiltPanel>
            </motion.div>

            <motion.div
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, rotateX: -12 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.65, delay: 0.08, ease: EASE }}
              style={{ transformOrigin: "50% 100%" }}
            >
              <TiltPanel max={4} className="flex h-full items-center gap-4 rounded-2xl p-5 sm:p-6">
                <span className="relative grid place-items-center">
                  <Ring share={done / checklist.length} size={64} />
                  <span className="absolute font-mono text-[13px] font-medium">
                    {done}/{checklist.length}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-[14px] font-medium">
                    {done === checklist.length ? "Your account is all set" : "Finish setting up"}
                  </span>
                  <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
                    {checklist.map((c) => (
                      <li key={c.label}>
                        <button
                          type="button"
                          onClick={() => pick(c.id)}
                          className="flex cursor-pointer items-center gap-2 text-left text-[12.5px]"
                          style={{
                            color: c.done ? "var(--color-neutral-600)" : "var(--color-ink)",
                            textDecoration: c.done ? "line-through" : undefined,
                          }}
                        >
                          <span
                            aria-hidden
                            className="grid h-4 w-4 flex-none place-items-center rounded-full"
                            style={
                              c.done
                                ? { background: "var(--color-ink)", color: "var(--color-bg)" }
                                : { boxShadow: "inset 0 0 0 1.5px var(--color-neutral-500)" }
                            }
                          >
                            {c.done && <Icon d={ICON.check} size={10} />}
                          </span>
                          <span className="sr-only">{c.done ? "Done:" : "To do:"}</span>
                          {c.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </TiltPanel>
            </motion.div>
          </div>

          {/* ── groups and the open one ─────────────────────────── */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
            <nav aria-label="Account settings" className="lg:sticky lg:top-20 lg:self-start">
              {/* A row of chips on a phone, a rail on a desk. */}
              <ul className="fx-rail -mx-4 m-0 flex list-none gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
                {GROUPS.map((g) => {
                  const on = g.id === groupId;
                  const flag = groupFlag(g.id, account);
                  return (
                    <li key={g.id} className="flex-none">
                      <button
                        type="button"
                        aria-current={on ? "page" : undefined}
                        onClick={() => pick(g.id)}
                        className="relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left"
                        style={{ color: on ? "var(--color-ink)" : "var(--color-neutral-700)" }}
                      >
                        {on && (
                          <motion.span
                            layoutId="account-group"
                            aria-hidden
                            className="absolute inset-0 rounded-xl"
                            style={{ background: "var(--color-bg)", border: "1px solid var(--color-divider)", boxShadow: "var(--shadow-sm)" }}
                            transition={{ type: "spring", stiffness: 500, damping: 40 }}
                          />
                        )}
                        <span className="relative flex-none">
                          <GroupGlyph id={g.id} />
                        </span>
                        <span className="relative flex min-w-0 flex-1 flex-col">
                          <span className="text-[13.5px] font-medium whitespace-nowrap">{g.label}</span>
                          {/* A group that wants attention says why in place of
                              its subtitle, rather than as a badge squeezed onto
                              the label. */}
                          <span
                            className={`hidden truncate text-[11.5px] lg:block ${flag ? "font-medium" : "text-muted"}`}
                            style={flag ? { color: "var(--color-ink)" } : undefined}
                          >
                            {flag || g.sub}
                          </span>
                        </span>
                        {flag && (
                          <span
                            aria-label={flag}
                            className="relative h-2 w-2 flex-none rounded-full"
                            style={{ background: "var(--color-ink)", boxShadow: "0 0 0 3px color-mix(in srgb, var(--color-ink) 15%, transparent)" }}
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="min-w-0">
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                <motion.div
                  key={group.id}
                  custom={direction}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 * direction, rotateX: -8 * direction }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10 * direction, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.4, ease: EASE }}
                  style={{ transformOrigin: "50% 0%" }}
                >
                  <group.Panel {...panelProps} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col rounded-xl px-3 py-2" style={{ background: "var(--color-surface)" }}>
      <span className="text-[11px] text-muted">{label}</span>
      <span className="text-[14px] font-medium">{value}</span>
    </span>
  );
}
