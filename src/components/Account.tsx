"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { resetAnalytics, useAnalytics } from "@/lib/analytics";
import { formatBytes } from "@/lib/assets";
import { usePortfolios } from "@/lib/store";

/** A browser gives one origin a few megabytes; 5MB is the usual ceiling. */
const STORAGE_BUDGET = 5 * 1024 * 1024;

function StatTile({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div
      className="p-[18px]"
      style={{ borderRight: "1px solid var(--color-divider)" }}
    >
      <div
        className="font-heading text-[30px] font-extrabold leading-none"
        style={accent ? { color: "var(--color-accent)" } : undefined}
      >
        {value}
      </div>
      <div className="text-neutral-700 text-[11px]">{label}</div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-divider bg-bg border-2">
      <div className="border-divider border-b-2 px-4 py-3">
        <h6 className="m-0">{title}</h6>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function Account() {
  const { portfolios, resetToSeed, exportAll, importAll, ready } = usePortfolios();
  const analytics = useAnalytics();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const bytes = ready ? new Blob([exportAll()]).size : 0;
  const used = Math.min(100, Math.round((bytes / STORAGE_BUDGET) * 100));
  const live = portfolios.filter((p) => p.status === "live").length;
  const totalViews = Object.values(analytics.views).reduce((n, v) => n + v, 0);

  function download() {
    const blob = new Blob([exportAll()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "facet-portfolios.json";
    a.click();
    URL.revokeObjectURL(url);
    setError("");
    setMessage(`Exported ${portfolios.length} portfolios.`);
  }

  return (
    <>
      <div className="nav bg-bg">
        <span className="nav-brand">FACET</span>
        <Link href="/">Portfolios</Link>
        <Link href="/stats">Stats</Link>
        <Link href="/account" aria-current="page">
          Account
        </Link>
      </div>

      <div className="border-divider border-b-2 px-6 pb-6 pt-8 sm:px-10">
        <h1 className="mb-2.5 text-[32px] sm:text-[40px]">Account</h1>
        <p className="m-0 max-w-[56ch] text-base">
          Your pages, and where they live. Everything is kept in this browser, so
          export before you clear site data or move to another machine.
        </p>
      </div>

      {/* Cell borders, not gap-bleed — the grid shows without grey blocks. */}
      <div
        className="border-divider grid grid-cols-2 border-b-2 sm:grid-cols-4"
        style={{ background: "var(--color-bg)" }}
      >
        <StatTile value={String(portfolios.length)} label="Portfolios" />
        <StatTile value={String(live)} label="Live pages" accent />
        <StatTile value={totalViews.toLocaleString()} label="Recorded views" />
        <StatTile value={formatBytes(bytes)} label="Stored in this browser" />
      </div>

      <div className="grid max-w-[1100px] gap-5 p-5 sm:p-8 lg:grid-cols-[1fr_360px]">
        {/* ── pages ─────────────────────────────────────────────── */}
        <div className="border-divider bg-bg border-2">
          <div className="border-divider border-b-2 px-4 py-3">
            <h6 className="m-0">Your pages</h6>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Address</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 90 }}>Sections</th>
                  <th style={{ width: 80 }}>Views</th>
                  <th style={{ width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {portfolios.map((p) => (
                  <tr key={p.id}>
                    <td className="font-extrabold">facet.page/{p.slug}</td>
                    <td>
                      <span
                        className={`tag ${p.status === "live" ? "tag-accent" : "tag-neutral"}`}
                      >
                        {p.status === "live" ? "Live" : "Not published"}
                      </span>
                    </td>
                    <td>{p.sections.length}</td>
                    <td>{analytics.views[p.slug] ?? 0}</td>
                    <td>
                      <Link
                        href={`/editor/${p.id}`}
                        className="font-heading text-xs font-extrabold"
                      >
                        Edit →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {portfolios.length === 0 && (
            <p className="text-neutral-700 m-0 px-4 py-6 text-[13px]">
              {ready ? "No portfolios yet." : "Loading…"}
            </p>
          )}
        </div>

        {/* ── storage + data ────────────────────────────────────── */}
        <div className="flex flex-col gap-5">
          <Panel title="Storage">
            <div
              className="border-divider mb-2 h-3 w-full border"
              role="img"
              aria-label={`${used}% of the browser storage budget used`}
            >
              <div className="bg-accent h-full" style={{ width: `${used}%` }} />
            </div>
            <p className="text-neutral-800 m-0 text-[13px]">
              {formatBytes(bytes)} of about {formatBytes(STORAGE_BUDGET)} used.
              Images are downscaled on upload because that budget is all a browser
              gives this page.
            </p>
          </Panel>

          <Panel title="Your data">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" onClick={download}>
                Export JSON
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fileRef.current?.click()}
              >
                Import JSON
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    const count = importAll(await file.text());
                    setError("");
                    setMessage(`Imported ${count} portfolios.`);
                  } catch (err) {
                    setMessage("");
                    setError(err instanceof Error ? err.message : "Import failed.");
                  }
                }}
              />
            </div>

            {message && (
              <p className="mt-3 text-[13px] font-extrabold" role="status">
                {message}
              </p>
            )}
            {error && (
              <p
                className="mt-3 text-[13px] font-extrabold"
                style={{ color: "var(--color-accent-700)" }}
                role="alert"
              >
                {error}
              </p>
            )}
          </Panel>

          <Panel title="Start over">
            <p className="text-neutral-800 m-0 mb-3 text-[13px]">
              Resetting discards your edits and restores the five seeded
              portfolios. Export first if you want them back.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  resetToSeed();
                  setError("");
                  setMessage("Portfolios reset to the seed data.");
                }}
              >
                Reset portfolios
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  resetAnalytics();
                  setError("");
                  setMessage("View and click counts cleared.");
                }}
              >
                Clear analytics
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
