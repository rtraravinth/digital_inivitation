"use client";

import { useSyncExternalStore } from "react";
import { DARK_QUERY, THEME_KEY } from "./theme-boot";

/**
 * Light, dark, or whatever the device says.
 *
 * The preference lives in localStorage and the resolved theme lives on
 * `<html data-theme>`, where the CSS reads it. The inline script in
 * app/layout.tsx applies it before first paint — this module only keeps it
 * current afterwards: on a pick, on another tab's pick, and on the device
 * switching while the preference is "system".
 *
 * An external store rather than state in a component, for the same reason as
 * lib/store.tsx: it is shared by every header on every page, and the React
 * Compiler lint rejects syncing it from an effect.
 */
export type ThemePref = "light" | "dark" | "system";

const listeners = new Set<() => void>();

function read(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    // Storage can be off (a locked-down browser); the device decides then.
    return "system";
  }
}

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && matchMedia(DARK_QUERY).matches);
  const root = document.documentElement;
  root.dataset.theme = dark ? "dark" : "light";
  root.style.colorScheme = dark ? "dark" : "light";
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("storage", onStorage);
    matchMedia(DARK_QUERY).addEventListener("change", onDevice);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", onStorage);
      matchMedia(DARK_QUERY).removeEventListener("change", onDevice);
    }
  };
}

function onStorage(e: StorageEvent) {
  if (e.key !== THEME_KEY) return;
  apply(read());
  emit();
}

function onDevice() {
  if (read() === "system") apply("system");
  emit();
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    // Not stored, but still applied for this page.
  }
  apply(pref);
  emit();
}

/** The stored preference. "system" on the server and until hydration. */
export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, read, () => "system");
}

