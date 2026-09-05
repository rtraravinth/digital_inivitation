"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAnalytics } from "@/lib/analytics";
import { usePortfolios } from "@/lib/store";
import { previewPath } from "@/lib/types";

/**
 * The nav, drawn the same in every state.
 *
 * The empty state used to return before this existed, so an account with no
 * portfolios got a bare sentence on a blank page with no way out of it but
 * the browser's back button. There is deliberately no page heading: the nav
 * marks Stats as the current page, and the panels carry their own titles.
 */
function StatsFrame({ children }: { children: React.ReactNode }) {
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

      {children}
    </>
  );
}

export function Stats() {
  const { portfolios, ready } = usePortfolios();
  const analytics = useAnalytics();
  const params = useSearchParams();
  const [id, setId] = useState<string | null>(null);
  // ?p= lets the block manager and the builder deep-link to one page's stats.
  const p =
    portfolios.find((x) => x.id === (id ?? params.get("p"))) ?? portfolios[0];

  if (!p) {
    return (
      <StatsFrame>
        <div className="px-6 py-8">
          {ready ? (
            <>
              <h2 className="m-0 text-[22px]">No portfolios yet.</h2>
              <p className="text-neutral-700 mt-2 max-w-[56ch] text-[14px]">
                Views and clicks are counted once a page is published. Make one and
                its figures show up here.
              </p>
              <Link href="/" className="btn btn-primary mt-4 inline-flex">
                Go to portfolios
              </Link>
            </>
          ) : (
            <p className="text-neutral-700 m-0 text-[14px]">Loading…</p>
          )}
        </div>
      </StatsFrame>
    );
  }

  const views = analytics.views[p.slug] ?? 0;
  const perSection = analytics.clicks[p.slug] ?? {};
  const sourceCounts = analytics.sources[p.slug] ?? {};

  const rows = p.sections.map((s) => ({
    id: s.id,
    title: s.title || "Untitled",
    tab: s.tab,
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
    <StatsFrame>
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
        <span className="tag tag-neutral">Counted across every visitor</span>
      </div>

      <div className="grid items-start gap-5 p-5 lg:grid-cols-[390px_1fr]">
        {/* ── where visitors come from ──────────────────────────── */}
        <div className="border-divider bg-bg border-2">
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
                opens the published page, wherever they are. Nothing here is
                estimated — an empty page means nobody has visited yet.
              </p>
              {/* The owner's preview, not the visitor address: a portfolio
                  with no views yet is often one that is not published, and
                  that address answers 404 until it is. */}
              <Link href={previewPath(p.id)} className="btn btn-primary">
                Open the page
              </Link>
            </div>
          )}

          {hasData && (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Section</th>
                    <th style={{ width: 130 }}>Tab</th>
                    <th style={{ width: 90 }}>Clicks</th>
                    <th style={{ width: 80 }}>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="font-extrabold">{r.title}</td>
                      <td>
                        <span className="tag tag-neutral">{r.tab}</span>
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
    </StatsFrame>
  );
}
