"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { setThemePref, useThemePref, type ThemePref } from "@/lib/theme";

/* ── the application header ───────────────────────────────────────────────
   One header for every top-level screen — Portfolios, Stats, Account — where
   each used to type its own copy of the same three links. It carries the
   theme switch, so light and dark are one click from anywhere.
   ──────────────────────────────────────────────────────────────────────── */

type Section = "portfolios" | "stats" | "account";

const LINKS: Array<{ id: Section; href: string; label: string }> = [
  { id: "portfolios", href: "/", label: "Portfolios" },
  { id: "stats", href: "/stats", label: "Stats" },
  { id: "account", href: "/account", label: "Account" },
];

export function AppHeader({ current }: { current: Section }) {
  return (
    <header
      className="sticky top-0 z-30 flex h-14 flex-none items-center gap-2 px-3 sm:gap-4 sm:px-6"
      style={{
        background: "color-mix(in srgb, var(--color-bg) 86%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--color-divider)",
      }}
    >
      <Link
        href="/"
        className="flex flex-none items-center gap-2.5 rounded-md text-[15px] font-semibold tracking-[-0.01em] no-underline"
        style={{ color: "var(--color-ink)" }}
        aria-label="Facet — your portfolios"
      >
        <span
          aria-hidden
          className="grid h-7 w-7 place-items-center rounded-md text-[13px] font-bold"
          style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
        >
          F
        </span>
        <span className="hidden sm:inline">Facet</span>
      </Link>

      <nav aria-label="Main" className="flex min-w-0 items-center gap-0.5 sm:ml-2">
        {LINKS.map((l) => {
          const on = l.id === current;
          return (
            <Link
              key={l.id}
              href={l.href}
              aria-current={on ? "page" : undefined}
              className="relative flex h-8 items-center rounded-md px-2.5 text-[13.5px] font-medium no-underline transition-colors hover:text-[var(--color-ink)] sm:px-3"
              style={{ color: on ? "var(--color-ink)" : "var(--color-neutral-700)" }}
            >
              {on && (
                // Shared across pages, so moving between them slides the
                // marker rather than blinking it from one link to the next.
                <motion.span
                  layoutId="app-nav-current"
                  aria-hidden
                  className="absolute inset-0 rounded-md"
                  style={{ background: "var(--color-neutral-200)" }}
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <span className="relative">{l.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex-none">
        <ThemeSwitch />
      </div>
    </header>
  );
}

const THEMES: Array<{ id: ThemePref; label: string; icon: React.ReactNode }> = [
  {
    id: "light",
    label: "Light theme",
    icon: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
  },
  {
    id: "dark",
    label: "Dark theme",
    icon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
  },
  {
    id: "system",
    label: "Match this device",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </>
    ),
  },
];

/**
 * Light, dark, or the device's own setting. Three icon buttons in one
 * group, each with a label for assistive tech and a tooltip for the pointer.
 */
export function ThemeSwitch() {
  const pref = useThemePref();
  return (
    <div
      role="group"
      aria-label="Theme"
      className="flex items-center gap-0.5 rounded-lg p-0.5"
      style={{ background: "var(--color-neutral-200)" }}
    >
      {THEMES.map((t) => {
        const on = pref === t.id;
        return (
          <button
            key={t.id}
            type="button"
            aria-label={t.label}
            aria-pressed={on}
            title={t.label}
            onClick={() => setThemePref(t.id)}
            className="grid h-7 w-8 cursor-pointer place-items-center rounded-md transition-colors"
            style={{
              background: on ? "var(--color-bg)" : "transparent",
              color: on ? "var(--color-ink)" : "var(--color-neutral-600)",
              boxShadow: on ? "var(--shadow-sm)" : "none",
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              focusable="false"
            >
              {t.icon}
            </svg>
          </button>
        );
      })}
    </div>
  );
}
