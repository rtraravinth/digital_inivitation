/**
 * The theme's storage key, its device query, and the script that applies the
 * stored choice before first paint.
 *
 * A plain module, not "use client": app/layout.tsx is a server component and
 * inlines `THEME_BOOT` into <head>, and a value imported from a client module
 * reaches a server component as a reference rather than as the string. The
 * client half of the theme, which keeps it current after load, is
 * lib/theme.ts — it imports the key and query from here so the two cannot
 * disagree.
 */
export const THEME_KEY = "facet-theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

export const THEME_BOOT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)});var d=p==="dark"||(p!=="light"&&matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches);var r=document.documentElement;r.dataset.theme=d?"dark":"light";r.style.colorScheme=d?"dark":"light"}catch(e){}})()`;
