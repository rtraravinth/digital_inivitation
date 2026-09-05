"use client";

import Link from "next/link";
import { useState } from "react";
import { GROUPS, groupFlag, type GroupId } from "./account/panels";
import { useAccount } from "@/lib/account";
import { signOut } from "@/lib/session";
import { useAnalytics } from "@/lib/analytics";
import { usePortfolios } from "@/lib/store";
import { PLANS,
  assetSrc,
} from "@/lib/types";

/**
 * Artboards 5a and 5b. A rail of groups beside one panel on a desktop; on a
 * phone the same groups are a list you tap into and back out of.
 */
export function Account() {
  const { portfolios, ready } = usePortfolios();
  const { account, storageError } = useAccount();
  const analytics = useAnalytics();
  const [groupId, setGroupId] = useState<GroupId>("profile");
  /** Null on a phone means "showing the list rather than a panel". */
  const [mobileGroup, setMobileGroup] = useState<GroupId | null>(null);

  const group = GROUPS.find((g) => g.id === groupId) ?? GROUPS[0];
  const mobile = mobileGroup ? GROUPS.find((g) => g.id === mobileGroup) : undefined;
  const panelProps = { account, portfolios, analytics };
  const planName = PLANS.find((p) => p.id === account.plan)?.name ?? "Free";

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

      {storageError && (
        <div
          role="alert"
          className="px-4 py-2.5 text-[13px] font-extrabold"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        >
          {storageError}
        </div>
      )}

      {/* ══ desktop — rail beside one panel ═════════════════════════ */}
      <div className="hidden lg:block">
        <div className="border-divider border-b-2 px-10 pb-6 pt-7">
          {/* The plan sits with the heading, not in the nav: an `ml-auto` tag
              there met .nav-brand's own `margin-right: auto` and the pair of
              them split the free space, centring the links — which no other
              page does. */}
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="m-0 text-[38px]">Account</h1>
            {/* Outlined rather than filled: the accent fill is what a primary
                action looks like here, and this is a label, not a button. The
                2px rule is the one the dividers use. */}
            <span className="tag tag-outline font-heading border-2 text-[10px] font-extrabold uppercase tracking-[0.08em]">
              {planName} plan
            </span>
          </div>
          <p className="text-neutral-700 m-0 max-w-[56ch] text-[15px]">
            Who you are, how people reach your pages, and what this build can and
            cannot actually do. Anything about one portfolio lives in that
            portfolio&rsquo;s editor.
          </p>
        </div>

        <div className="grid min-h-[660px] grid-cols-[250px_1fr]">
          <div className="border-divider bg-surface border-r-2">
            {GROUPS.map((g) => {
              const on = g.id === groupId;
              const flag = groupFlag(g.id, account);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGroupId(g.id)}
                  className="border-divider flex w-full cursor-pointer items-center gap-2.5 border-b px-4 py-3.5 text-left"
                  style={{
                    background: on ? "var(--color-accent)" : "transparent",
                    color: on ? "var(--color-bg)" : "var(--color-ink)",
                  }}
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="font-heading text-[13px] font-extrabold">
                      {g.label}
                    </span>
                    <span
                      className="text-[11px]"
                      style={{
                        color: on ? "var(--color-bg)" : "var(--color-neutral-700)",
                      }}
                    >
                      {g.sub}
                    </span>
                  </span>
                  {flag && (
                    <span
                      className="font-heading ml-auto flex-none text-[10px] font-extrabold uppercase tracking-[0.06em]"
                      style={{
                        color: on ? "var(--color-bg)" : "var(--color-neutral-600)",
                      }}
                    >
                      {flag}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Ending your own session. Every control in the device table
                signs out somebody else — your own row is "This device" — so
                without this there is no way to sign yourself out at all. */}
            <div className="p-4">
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={() => void signOut()}
              >
                Sign out
              </button>
            </div>
          </div>

          <div>
            <group.Panel {...panelProps} />
          </div>
        </div>
      </div>

      {/* ══ mobile — a list you tap into ════════════════════════════ */}
      <div className="lg:hidden">
        {mobile ? (
          <>
            <div className="border-divider flex items-center gap-2.5 border-b-2 px-4 py-3">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setMobileGroup(null)}
              >
                ← Account
              </button>
              <span className="font-heading text-[15px] font-extrabold">
                {mobile.label}
              </span>
            </div>
            <mobile.Panel {...panelProps} />
          </>
        ) : (
          <>
            <div className="border-divider border-b-2 px-4 pb-5 pt-6">
              <h1 className="mb-2 text-[30px]">Account</h1>
              <p className="text-neutral-700 m-0 text-[14px]">
                Who you are, how people reach your pages, and what this build can and
                cannot actually do.
              </p>
            </div>

            <div className="border-divider bg-surface flex items-center gap-3.5 border-b-2 px-4 py-4">
              <span className="h-14 w-14 flex-none">
                {account.profile.portrait ? (
                  // A data URI out of localStorage — nothing for next/image to do.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={assetSrc(account.profile.portrait)}
                    alt={account.profile.portrait.name}
                    className="grayscale-photo h-full w-full object-cover"
                  />
                ) : (
                  <span
                    className="grayscale-photo block h-full w-full"
                    style={{
                      background:
                        "repeating-linear-gradient(45deg,#d7d3d3 0 5px,#eae9e9 5px 10px)",
                    }}
                  />
                )}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-heading truncate text-lg font-extrabold">
                  {account.profile.name || "Your name"}
                </span>
                <span className="text-neutral-700 truncate text-xs">
                  facet.page/{account.profile.handle} · {planName} plan
                </span>
              </span>
            </div>

            {GROUPS.map((g) => {
              const flag = groupFlag(g.id, account);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setMobileGroup(g.id)}
                  className="border-divider flex w-full cursor-pointer items-center gap-3 border-b px-4 py-3.5 text-left"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-heading text-sm font-extrabold">
                      {g.label}
                    </span>
                    <span className="text-neutral-700 text-[11px]">{g.sub}</span>
                  </span>
                  {flag && (
                    <span className="text-neutral-600 font-heading ml-auto flex-none text-[10px] font-extrabold uppercase tracking-[0.06em]">
                      {flag}
                    </span>
                  )}
                  <span
                    className="font-heading flex-none text-[13px] font-extrabold"
                    style={{ color: "var(--color-neutral-600)", marginLeft: flag ? 8 : "auto" }}
                    aria-hidden
                  >
                    ›
                  </span>
                </button>
              );
            })}

            {/* Real since the API arrived. It was drawn inert when there was
                no session to end; leaving it that way — and leaving the copy
                claiming this build has no accounts — outlasted the truth. */}
            <div className="p-4">
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={() => void signOut()}
              >
                Sign out
              </button>
              <p className="text-neutral-700 m-0 mt-2 text-[11px]">
                Ends this device&rsquo;s session straight away. Your pages stay on
                your account — sign back in from anywhere to reach them.
              </p>
            </div>

            {!ready && (
              <p className="text-neutral-700 m-0 px-4 py-6 text-[13px]">Loading…</p>
            )}
          </>
        )}
      </div>
    </>
  );
}
