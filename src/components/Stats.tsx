"use client";

import Link from "next/link";
import { useState } from "react";
import { useAnalytics } from "@/lib/analytics";
import { usePortfolios } from "@/lib/store";

export function Stats() {
  const { portfolios, ready } = usePortfolios();
  const analytics = useAnalytics();
  const [id, setId] = useState<string | null>(null);
  const p = portfolios.find((x) => x.id === id) ?? portfolios[0];

  if (!p) {
    return (
      <div className="p-10">
        <h2>{ready ? "No portfolios yet." : "Loading…"}</h2>
        {ready && <Link href="/">← Back to portfolios</Link>}
      </div>
    );
  }

  const views = analytics.views[p.slug] ?? 0;
  const perSection = analytics.clicks[p.slug] ?? {};
  const sourceCounts = analytics.sources[p.slug] ?? {};

  const rows = p.sections.map((s) => ({
    id: s.id,
    title: s.title || "Untitled",
    role: s.tags[0] ?? "—",
    hasLink: s.links.length > 0,
    clicks: perSection[s.id] ?? 0,
  }));
  const clicks = rows.reduce((n, r) => n + r.clicks, 0);
  const rate = views > 0 ? `${((clicks / views) * 100).toFixed(0)}%` : "—";

  const sources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);
  const maxSource = Math.max(1, ...sources.map(([, n]) => n));
  const top = [...rows].sort((a, b) => b.clicks - a.clicks)[0];
  const hasData = views > 0 || clicks > 0;

  return (
    <>
      <div className="nav bg-bg">
        <span className="nav-brand">FACET</span>
        <Link href="/">Portfolios</Link>
        <Link href="/stats" aria-current="page">
          Stats
        </Link>
        <Link href="/account">Account</Link>
      </div>

      <div className="border-divider flex flex-wrap items-center gap-4 border-b-2 px-6 py-3">
        <select
          className="input w-auto"
          aria-label="Portfolio"
          value={p.id}
          onChange={(e) => setId(e.target.value)}
        >
          {portfolios.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <span className="tag tag-neutral">Counted in this browser</span>
      </div>

      <div className="grid items-start gap-5 p-5 lg:grid-cols-[390px_1fr]">
        {/* ── share ─────────────────────────────────────────────── */}
        <div className="border-divider bg-bg border-2">
          <div className="border-divider border-b-2 px-4 py-4">
            <h2 className="m-0 text-[22px]">Share your page</h2>
          </div>

          <div className="border-divider flex flex-col gap-3.5 border-b-2 px-4 py-4">
            <div className="border-divider flex flex-wrap items-center gap-2.5 border-2 px-3 py-2.5">
              <span className="font-heading text-sm font-extrabold">
                facet.page/{p.slug}
              </span>
              <button
                type="button"
                className="btn btn-primary ml-auto"
                style={{ fontSize: 12, padding: "6px 10px" }}
                onClick={() =>
                  navigator.clipboard?.writeText(`https://facet.page/${p.slug}`)
                }
              >
                Copy
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div
                className="h-[104px] w-[104px] flex-none"
                aria-hidden
                style={{
                  background:
                    "repeating-conic-gradient(#201e1d 0 25%, #f3f2f2 0 50%) 0 0/16px 16px",
                  boxShadow: "inset 0 0 0 2px var(--color-divider)",
                }}
              />
              <div>
                <div className="font-heading mb-1 text-[13px] font-extrabold">
                  Print code
                </div>
                <p className="text-neutral-700 m-0 mb-2 text-[11px]">
                  For business cards, event badges and the back of a menu.
                </p>
                <Link
                  href={`/p/${p.slug}`}
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: "6px 10px" }}
                >
                  Open page
                </Link>
              </div>
            </div>
          </div>

          <div className="p-4">
            <h6 className="mb-2.5">Who&rsquo;s coming from where</h6>
            {sources.length === 0 ? (
              <p className="text-neutral-700 m-0 text-[13px]">
                No visits recorded yet.
              </p>
            ) : (
              sources.map(([name, n]) => (
                <div
                  key={name}
                  className="border-divider flex items-center gap-2.5 border-b py-2"
                >
                  <span className="w-[110px] text-[13px]">{name}</span>
                  <span
                    className="bg-accent h-2"
                    style={{ width: `${Math.round((n / maxSource) * 120)}px` }}
                  />
                  <span className="font-heading ml-auto text-xs font-extrabold">
                    {n.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── this month ────────────────────────────────────────── */}
        <div className="border-divider bg-bg border-2">
          <div className="border-divider border-b-2 px-5 py-4">
            <h2 className="m-0 text-[22px]">All time</h2>
          </div>

          <div
            className="border-divider grid grid-cols-3 border-b-2"
            style={{ background: "var(--color-bg)" }}
          >
            {[
              { n: views.toLocaleString(), l: "Page views", accent: false },
              { n: clicks.toLocaleString(), l: "Section clicks", accent: false },
              { n: rate, l: "Click rate", accent: true },
            ].map((t) => (
              <div
                key={t.l}
                className="p-[18px]"
                style={{ borderRight: "1px solid var(--color-divider)" }}
              >
                <div
                  className="font-heading text-[30px] font-extrabold leading-none"
                  style={t.accent ? { color: "var(--color-accent)" } : undefined}
                >
                  {t.n}
                </div>
                <div className="text-neutral-700 text-[11px]">{t.l}</div>
              </div>
            ))}
          </div>

          {!hasData && (
            <div className="px-5 py-6">
              <p className="text-neutral-800 m-0 mb-3 text-[13px]">
                Nothing recorded yet. Views and clicks are counted when someone
                opens the published page in this browser — there is no server
                collecting them.
              </p>
              <Link href={`/p/${p.slug}`} className="btn btn-primary">
                Open the published page
              </Link>
            </div>
          )}

          {hasData && (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Section</th>
                    <th style={{ width: 130 }}>Role</th>
                    <th style={{ width: 90 }}>Clicks</th>
                    <th style={{ width: 80 }}>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="font-extrabold">{r.title}</td>
                      <td>
                        <span className="tag tag-neutral">{r.role}</span>
                      </td>
                      <td>{r.clicks}</td>
                      <td>
                        {views > 0 ? `${((r.clicks / views) * 100).toFixed(0)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hasData && top && top.clicks > 0 && (
            <div
              className="flex flex-wrap items-center gap-4 px-5 py-[18px]"
              style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
            >
              <div className="font-heading max-w-[34ch] text-lg font-extrabold leading-tight">
                {top.hasLink
                  ? `“${top.title}” gets the most clicks — keep it near the top.`
                  : `“${top.title}” gets the most clicks and has no link.`}
              </div>
              <Link
                href={`/editor/${p.id}`}
                className="btn ml-auto"
                style={{ background: "var(--color-bg)", color: "var(--color-ink)" }}
              >
                {top.hasLink ? "Open editor" : "Add one"}
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
