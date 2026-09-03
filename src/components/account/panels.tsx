"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LinkEditor } from "../LinkEditor";
import { TagEditor } from "../TagEditor";
import { UploadButton } from "../UploadButton";
import {
  beginTwoStep,
  changePassword,
  confirmTwoStep,
  disableTwoStep,
  generateRecoveryCodes,
  listSessions,
  revokeOtherSessions,
  revokeSession,
  deleteAccount,
  setCustomDomain,
  setPlan,
  updateNotifications,
  updatePrivacy,
  updateProfile,
  updateSecurity,
  type DeviceSession,
  type TwoStepSetup,
} from "@/lib/account";
import { signOut } from "@/lib/session";
import { QrCode } from "../QrCode";
import { resetAnalytics, type Analytics } from "@/lib/analytics";
import { messageFor } from "@/lib/api";
import { readImageAsset } from "@/lib/assets";
import { usePortfolios } from "@/lib/store";
import {
  NEEDS_SERVER,
  NOTIFICATIONS,
  PLANS,
  PRIVACY_SETTINGS,
  type AccountProfile,
  type AccountSettings,
  type Portfolio,
  assetSrc,
} from "@/lib/types";


export type PanelProps = {
  account: AccountSettings;
  portfolios: Portfolio[];
  analytics: Analytics;
};

/* ── shared bits ──────────────────────────────────────────────────────── */

/**
 * Said once per group whose behaviour would live on a server. The settings
 * below it are stored and shown; nothing enforces them, and pretending
 * otherwise would be the one thing worse than not building the screen.
 */
export function ServerNotice({ what }: { what: string }) {
  return (
    <p
      className="m-0 mb-4 px-3 py-2 text-[12px]"
      role="note"
      style={{
        background: "var(--color-surface)",
        boxShadow: "inset 3px 0 0 var(--color-accent)",
        color: "var(--color-neutral-800)",
      }}
    >
      <strong>Stored, enforced nowhere.</strong> {what} FACET has a server, but not
      that one — so what you set here is saved to your account and does not do
      anything yet.
    </p>
  );
}

export function Pill({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span
      className="font-heading ml-auto flex-none px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.06em]"
      style={
        on
          ? { background: "var(--color-accent)", color: "var(--color-bg)" }
          : {
              color: "var(--color-neutral-600)",
              boxShadow: "inset 0 0 0 1px var(--color-divider)",
            }
      }
    >
      {children}
    </span>
  );
}

function SettingRow({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-divider flex flex-wrap items-center gap-4 border-b py-3.5">
      <span className="flex max-w-[52ch] flex-col gap-0.5">
        <span className="font-heading text-sm font-extrabold">{title}</span>
        <span className="text-neutral-700 text-xs">{desc}</span>
      </span>
      {children}
    </div>
  );
}

function Toggle({
  on,
  onToggle,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className="ml-auto cursor-pointer"
    >
      <Pill on={on}>{on ? "On" : "Off"}</Pill>
    </button>
  );
}

/* ── 1. public identity ───────────────────────────────────────────────── */

export function ProfilePanel({ account }: PanelProps) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  /**
   * Null means "no unsaved edits", so the fields always show stored data
   * until someone types — which also survives the pass where localStorage
   * arrives after hydration.
   */
  const [draft, setDraft] = useState<AccountProfile | null>(null);

  const p = draft ?? account.profile;
  const dirty = draft !== null;
  const set = (patch: Partial<AccountProfile>) => {
    setSaved(false);
    setDraft({ ...p, ...patch });
  };

  return (
    <div className="px-5 py-6 sm:px-8">
      <h6 className="mb-1.5">Public identity</h6>
      <p className="text-neutral-700 mb-5 max-w-[60ch] text-[13px]">
        This is the default header on every new portfolio. Each portfolio can
        override it in its own editor.
      </p>

      <div className="grid gap-7 sm:grid-cols-[150px_1fr]">
        <div>
          <div className="mb-2 h-[150px] w-[150px]">
            {p.portrait ? (
              // A data URI out of localStorage — nothing for next/image to do.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assetSrc(p.portrait)}
                alt={p.portrait.name}
                className="grayscale-photo h-full w-full object-cover"
              />
            ) : (
              <div
                className="grayscale-photo h-full w-full"
                style={{
                  background:
                    "repeating-linear-gradient(45deg,#d7d3d3 0 6px,#eae9e9 6px 12px)",
                }}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <UploadButton
              label={p.portrait ? "Replace photo" : "Add photo"}
              accept="image/*"
              onError={setError}
              onPick={async (file) => set({ portrait: await readImageAsset(file) })}
            />
            {p.portrait && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => set({ portrait: null })}
              >
                Remove
              </button>
            )}
          </div>
          {error && (
            <p
              className="mt-2 text-[12px] font-extrabold"
              role="alert"
              style={{ color: "var(--color-accent-700)" }}
            >
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="field">
              <label htmlFor="ac-name">Full name</label>
              <input
                id="ac-name"
                className="input"
                value={p.name}
                onChange={(e) => set({ name: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="ac-handle">Handle</label>
              <input
                id="ac-handle"
                className="input"
                value={p.handle}
                onChange={(e) => set({ handle: e.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="ac-current">Current position</label>
            <input
              id="ac-current"
              className="input"
              value={p.current}
              onChange={(e) => set({ current: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="ac-about">About you</label>
            <textarea
              id="ac-about"
              className="input"
              value={p.about}
              onChange={(e) => set({ about: e.target.value })}
            />
          </div>

          <div className="field">
            <label>Default tags</label>
            <TagEditor tags={p.tags} onChange={(tags) => set({ tags })} accentFirst />
          </div>

          <div className="field">
            <label>Default links</label>
            <LinkEditor links={p.links} onChange={(links) => set({ links })} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!dirty}
              onClick={() => {
                void updateProfile(p);
                setDraft(null);
                setSaved(true);
              }}
            >
              Save changes
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!dirty}
              onClick={() => {
                setDraft(null);
                setSaved(false);
              }}
            >
              Discard
            </button>
            {dirty && (
              <span className="text-neutral-700 text-[12px]">Unsaved changes</span>
            )}
            {saved && !dirty && (
              <span className="text-[12px] font-extrabold" role="status">
                Saved to this browser.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 2. sign-in & security ────────────────────────────────────────────── */

/** "Last changed fourteen months ago", from an ISO timestamp. */
function describeAge(iso: string | null): string {
  if (!iso) return "Never changed.";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "Changed today.";
  if (days === 1) return "Changed yesterday.";
  if (days < 30) return `Last changed ${days} days ago.`;
  const months = Math.round(days / 30);
  return `Last changed ${months} month${months === 1 ? "" : "s"} ago.`;
}

/**
 * Everything here is enforced by the server. It used to render a notice
 * saying it was not; that notice is gone because it would now be a lie.
 */
export function SecurityPanel({ account }: PanelProps) {
  const s = account.security;

  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // `setup` holds an enrolment in progress. An empty otpauthUri means the
  // opposite direction: a code is being collected to turn two-step off.
  const [setup, setSetup] = useState<TwoStepSetup | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  }

  function loadSessions() {
    return run(async () => setSessions(await listSessions()));
  }

  return (
    <div className="px-5 py-6 sm:px-8">
      <h6 className="mb-1.5">Sign-in &amp; security</h6>
      <p className="text-neutral-800 mb-4 text-[13px]">
        All of this is enforced by the server. Signing a device out ends its session
        straight away, not when its token happens to expire.
      </p>

      {error && (
        <p className="border-accent mb-4 border-l-2 py-2 pl-3 text-[13px]" role="alert">
          {error}
        </p>
      )}
      {note && (
        <p className="mb-4 text-[13px] font-extrabold" role="status">
          {note}
        </p>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <div className="field">
          <label htmlFor="ac-email">Email</label>
          <input id="ac-email" className="input" value={s.email} readOnly disabled />
          <p className="text-neutral-700 mt-1 text-[12px]">
            Your sign-in address. Changing it needs a mail service to confirm the new
            one, which this build does not have.
          </p>
        </div>
        <div className="field">
          <label htmlFor="ac-phone">Phone (for recovery)</label>
          <input
            id="ac-phone"
            className="input"
            defaultValue={s.phone}
            onBlur={(e) => void updateSecurity({ phone: e.target.value })}
          />
        </div>
      </div>

      <SettingRow title="Password" desc={describeAge(s.passwordChanged)}>
        <button
          type="button"
          className="btn btn-secondary flex-none"
          onClick={() => setChangingPassword((open) => !open)}
        >
          {changingPassword ? "Cancel" : "Change password"}
        </button>
      </SettingRow>

      {changingPassword && (
        <div className="border-divider mb-4 grid gap-3 border-2 p-4 sm:grid-cols-2">
          <div className="field">
            <label htmlFor="ac-current">Current password</label>
            <input
              id="ac-current"
              className="input"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="ac-new">New password</label>
            <input
              id="ac-new"
              className="input"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <p className="text-neutral-700 mt-1 text-[12px]">At least twelve characters.</p>
          </div>
          <div className="sm:col-span-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !currentPassword || newPassword.length < 12}
              onClick={() =>
                run(async () => {
                  await changePassword(currentPassword, newPassword);
                  setChangingPassword(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setSessions(null);
                  // The server signs every other device out on a change, so
                  // say so rather than leaving it to be discovered.
                  setNote("Password changed. Every other device has been signed out.");
                })
              }
            >
              {busy ? "Saving…" : "Change password"}
            </button>
          </div>
        </div>
      )}

      <SettingRow
        title="Two-step verification"
        desc="A code from your authenticator app in addition to your password."
      >
        <Pill on={s.twoStep}>{s.twoStep ? "On" : "Off"}</Pill>
        <button
          type="button"
          className="btn btn-secondary flex-none"
          disabled={busy}
          onClick={() =>
            run(async () => {
              setCode("");
              // Turning it off needs a current code too, so both directions
              // open the same panel — only the copy differs.
              setSetup(s.twoStep ? { secret: "", otpauthUri: "" } : await beginTwoStep());
            })
          }
        >
          {s.twoStep ? "Turn off" : "Set up"}
        </button>
      </SettingRow>

      {setup && (
        <div className="border-divider mb-4 border-2 p-4">
          {setup.otpauthUri ? (
            <div className="flex flex-col gap-4 sm:flex-row">
              {/* The same hand-rolled encoder the print code on /stats uses.
                  A CDN is not an option here and this has to actually scan. */}
              <QrCode text={setup.otpauthUri} size={148} />
              <div className="min-w-0">
                <p className="text-[13px]">
                  Scan this with your authenticator app, then enter the six-digit code
                  it shows.
                </p>
                <p className="text-neutral-700 mt-2 text-[12px] break-all">
                  Cannot scan? Enter this key by hand:{" "}
                  <span className="font-mono">{setup.secret}</span>
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[13px]">
              Enter a current code from your authenticator app to turn two-step off. A
              recovery code works too.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div className="field max-w-[180px] flex-1">
              <label htmlFor="ac-code">Code</label>
              <input
                id="ac-code"
                className="input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="one-time-code"
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || code.trim().length < 4}
              onClick={() =>
                run(async () => {
                  if (setup.otpauthUri) {
                    await confirmTwoStep(code.trim());
                    setNote("Two-step verification is on.");
                  } else {
                    await disableTwoStep(code.trim());
                    setNote("Two-step verification is off.");
                  }
                  setSetup(null);
                  setCode("");
                })
              }
            >
              {busy ? "Checking…" : "Confirm"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setSetup(null);
                setCode("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <SettingRow
        title="Recovery codes"
        desc="Ten one-time codes to print and keep, for when you cannot reach your authenticator."
      >
        <Pill on={s.recoveryCodesRemaining > 0}>
          {s.recoveryCodesRemaining > 0 ? `${s.recoveryCodesRemaining} left` : "None"}
        </Pill>
        <button
          type="button"
          className="btn btn-secondary flex-none"
          disabled={busy}
          onClick={() => run(async () => setCodes(await generateRecoveryCodes()))}
        >
          Generate
        </button>
      </SettingRow>

      {codes && (
        <div className="border-divider mt-4 border-2 p-4">
          <div className="mb-2 flex items-center">
            <span className="font-heading text-[13px] font-extrabold">
              Your recovery codes
            </span>
            <button
              type="button"
              className="btn btn-ghost ml-auto"
              onClick={() => setCodes(null)}
            >
              Hide
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5 font-mono text-[13px] sm:grid-cols-5">
            {codes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <p className="text-neutral-700 mt-3 text-[12px]">
            Copy these somewhere safe now. Only hashes are stored, so this is the one
            time they can be read, and generating a new set replaces them.
          </p>
        </div>
      )}

      <h6 className="mb-2.5 mt-7">Where you&rsquo;re signed in</h6>

      {sessions === null ? (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={loadSessions}
          disabled={busy}
        >
          {busy ? "Loading…" : "Show devices"}
        </button>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Device</th>
                  <th style={{ width: 170 }}>Place</th>
                  <th style={{ width: 180 }}>Last used</th>
                  <th style={{ width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td className="font-extrabold">{session.device}</td>
                    <td>{session.place}</td>
                    <td>{new Date(session.when).toLocaleString()}</td>
                    <td>
                      {session.current ? (
                        <span className="text-neutral-600 text-xs">This device</span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-ghost text-xs"
                          onClick={() =>
                            run(async () => {
                              await revokeSession(session.id);
                              setSessions(await listSessions());
                              setNote("That device has been signed out.");
                            })
                          }
                        >
                          Sign out
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={loadSessions}
              disabled={busy}
            >
              Refresh
            </button>
            {sessions.length > 1 && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const revoked = await revokeOtherSessions();
                    setSessions(await listSessions());
                    setNote(
                      `Signed out ${revoked} other ${revoked === 1 ? "device" : "devices"}.`,
                    );
                  })
                }
              >
                Sign out everywhere else
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── 3. page addresses ────────────────────────────────────────────────── */

export function AddressesPanel({ account, portfolios, analytics }: PanelProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [draftHandle, setDraftHandle] = useState<string | null>(null);
  // Null until edited, so the field follows stored data through hydration.
  const handle = draftHandle ?? account.profile.handle;
  const setHandle = setDraftHandle;

  async function copy(slug: string) {
    try {
      await navigator.clipboard.writeText(`https://facet.page/${slug}`);
      setCopied(slug);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      // Clipboard blocked — the address is on screen to copy by hand.
    }
  }

  return (
    <div className="px-5 py-6 sm:px-8">
      <h6 className="mb-1.5">Page addresses</h6>
      <p className="text-neutral-700 mb-4 max-w-[60ch] text-[13px]">
        Your handle is the base of every link you share. Each portfolio sets its own
        address in the create dialog.
      </p>

      {/* The handle is the base of every link already in the wild, so it is a
          deliberate change rather than a field that commits as you type. */}
      <div className="mb-2 flex flex-wrap items-end gap-2.5">
        <div className="field flex-1" style={{ minWidth: 220 }}>
          <label htmlFor="ac-base">Handle</label>
          <div className="flex items-center">
            <span className="text-muted shrink-0 pr-1 text-sm">facet.page/</span>
            <input
              id="ac-base"
              className="input"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
            />
          </div>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={handle.trim() === account.profile.handle || !handle.trim()}
          onClick={() =>
            void updateProfile({ handle: handle.trim() })
          }
        >
          Change
        </button>
      </div>
      <p className="text-neutral-700 mb-6 text-[12px]">
        {handle.trim() !== account.profile.handle
          ? "Not applied yet — press Change."
          : "Changing this does not rewrite the addresses below; each portfolio owns its own."}
      </p>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Portfolio</th>
              <th style={{ width: 230 }}>Address</th>
              <th style={{ width: 120 }}>Visibility</th>
              <th style={{ width: 80 }}>Views</th>
              <th style={{ width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {portfolios.map((p) => (
              <tr key={p.id}>
                <td className="font-extrabold">{p.name}</td>
                <td className="font-mono text-xs">facet.page/{p.slug}</td>
                <td>
                  <span
                    className={`tag ${p.status === "live" ? "tag-accent" : "tag-neutral"}`}
                  >
                    {p.status === "live" ? "Public" : "Link only"}
                  </span>
                </td>
                <td>{analytics.views[p.slug] ?? 0}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-ghost text-xs"
                    onClick={() => copy(p.slug)}
                  >
                    {copied === p.slug ? "Copied" : "Copy"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {portfolios.length === 0 && (
        <p className="text-neutral-700 m-0 py-6 text-[13px]">No portfolios yet.</p>
      )}

      <div className="border-divider mt-6 border-2 p-5">
        <div className="font-heading mb-1 text-[15px] font-extrabold">
          Use your own domain
        </div>
        <ServerNotice what={NEEDS_SERVER.domain} />
        <div className="flex flex-wrap items-end gap-2.5">
          <div className="field flex-1" style={{ minWidth: 220 }}>
            <label htmlFor="ac-domain">Domain</label>
            <input
              id="ac-domain"
              className="input"
              placeholder="rohanmehta.in"
              defaultValue={account.customDomain}
              onBlur={(e) => void setCustomDomain(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 4. plan & billing ────────────────────────────────────────────────── */

export function PlanPanel({ account }: PanelProps) {
  return (
    <div className="px-5 py-6 sm:px-8">
      <h6 className="mb-1.5">Plan &amp; billing</h6>
      <ServerNotice what={NEEDS_SERVER.billing} />

      <div className="border-divider mb-6 grid border-2 sm:grid-cols-2">
        {PLANS.map((plan) => {
          const current = account.plan === plan.id;
          return (
            <div
              key={plan.id}
              className="bg-bg flex flex-col gap-3 p-5"
              style={{
                borderRight: "1px solid var(--color-divider)",
                boxShadow: current ? "none" : "inset 3px 0 0 var(--color-accent)",
              }}
            >
              <div className="flex items-baseline gap-2">
                <span className="font-heading text-xl font-extrabold">{plan.name}</span>
                {current && (
                  <span
                    className="font-heading text-[10px] font-extrabold uppercase tracking-[0.06em]"
                    style={{ color: "var(--color-accent)" }}
                  >
                    Current
                  </span>
                )}
              </div>
              <div className="font-heading text-[30px] font-extrabold leading-none">
                {plan.price}
              </div>
              <div className="text-neutral-800 flex flex-col gap-1.5 text-[13px]">
                {plan.features.map((f) => (
                  <span key={f}>{f}</span>
                ))}
              </div>
              <button
                type="button"
                className={`btn btn-block mt-auto ${current ? "btn-secondary" : "btn-primary"}`}
                disabled={current}
                onClick={() => void setPlan(plan.id)}
              >
                {current ? "Your plan" : `Switch to ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      <h6 className="mb-2.5">Billing</h6>
      <SettingRow
        title="Payment method"
        desc="Nothing is charged, and nothing can be — there is no processor behind this."
      >
        <Pill on={false}>None on file</Pill>
      </SettingRow>
      <SettingRow title="Invoices and receipts" desc="Nothing to show.">
        <Pill on={false}>Empty</Pill>
      </SettingRow>
    </div>
  );
}

/* ── 5. notifications ─────────────────────────────────────────────────── */

export function NotificationsPanel({ account }: PanelProps) {
  return (
    <div className="px-5 py-6 sm:px-8">
      <h6 className="mb-1.5">Notifications</h6>
      <ServerNotice what={NEEDS_SERVER.email} />
      {NOTIFICATIONS.map((n) => (
        <SettingRow key={n.id} title={n.title} desc={n.desc}>
          <Toggle
            on={account.notifications[n.id]}
            label={n.title}
            onToggle={() =>
              void updateNotifications({ [n.id]: !account.notifications[n.id] })
            }
          />
        </SettingRow>
      ))}
    </div>
  );
}

/* ── 6. privacy & data ────────────────────────────────────────────────── */

export function PrivacyPanel({ account, portfolios }: PanelProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="px-5 py-6 sm:px-8">
      <h6 className="mb-1.5">Privacy</h6>
      <p className="text-neutral-700 mb-4 max-w-[60ch] text-[13px]">
        All four of these change what a published page actually renders — they are
        read by the page itself, not just stored.
      </p>

      {PRIVACY_SETTINGS.map((s) => (
        <SettingRow key={s.id} title={s.title} desc={s.desc}>
          <Toggle
            on={account.privacy[s.id]}
            label={s.title}
            onToggle={() =>
              void updatePrivacy({ [s.id]: !account.privacy[s.id] })
            }
          />
        </SettingRow>
      ))}

      <h6 className="mb-2.5 mt-7">Your data</h6>
      <DataTools
        portfolios={portfolios}
        onMessage={(m) => {
          setMessage(m);
          setError("");
        }}
        onError={(e) => {
          setError(e);
          setMessage("");
        }}
      />

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

      <div
        className="mt-7 p-5"
        style={{ boxShadow: "inset 0 0 0 2px var(--color-accent)" }}
      >
        <div
          className="font-heading mb-1 text-[15px] font-extrabold"
          style={{ color: "var(--color-accent-700)" }}
        >
          Delete everything
        </div>
        <p className="text-neutral-700 m-0 mb-3 max-w-[52ch] text-[12px]">
          Permanently removes your account, all {portfolios.length} portfolios, every
          upload, and the recorded views and clicks. Export first — this cannot be
          undone.
        </p>
        {confirming ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => {
                try {
                  await deleteAccount();
                  await signOut();
                  router.replace("/signin");
                } catch (caught) {
                  setError(messageFor(caught));
                  setConfirming(false);
                }
              }}
            >
              Yes, delete everything
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setConfirming(true)}
          >
            Delete everything
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Export and import — the tools that existed before there was a backend, and
 * still the reason this page can be trusted: your data can leave.
 */
function DataTools({
  portfolios,
  onMessage,
  onError,
}: {
  portfolios: Portfolio[];
  onMessage: (m: string) => void;
  onError: (e: string) => void;
}) {
  const { exportAll, importAll } = usePortfolios();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const blob = new Blob([await exportAll()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "facet-portfolios.json";
      a.click();
      URL.revokeObjectURL(url);
      onMessage(`Exported ${portfolios.length} portfolios.`);
    } catch (error) {
      onError(messageFor(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="text-neutral-800 mb-4 text-[13px]">
        {portfolios.length} {portfolios.length === 1 ? "portfolio" : "portfolios"} stored on
        the server. Export writes every one of them, with its sections, to a JSON file you
        keep. Importing replaces what is there.
      </p>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={download} disabled={busy}>
          {busy ? "Exporting…" : "Export JSON"}
        </button>

        <ImportButton onMessage={onMessage} onError={onError} importAll={importAll} />

        <button
          type="button"
          className="btn btn-secondary"
          onClick={async () => {
            try {
              await resetAnalytics();
              onMessage("View and click counts cleared.");
            } catch (error) {
              onError(messageFor(error));
            }
          }}
        >
          Clear analytics
        </button>

        {/* The canvas asks for "Download all pages as PDF". The browser's own
            print pipeline already renders these themes, so /print stacks them
            and its Save-as-PDF destination does the rest. */}
        <a href="/print?auto=1" target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
          Download all pages as PDF
        </a>
      </div>
    </>
  );
}

function ImportButton({
  importAll,
  onMessage,
  onError,
}: {
  importAll: (json: string) => Promise<number>;
  onMessage: (m: string) => void;
  onError: (e: string) => void;
}) {
  return (
    <UploadButton
      label="Import JSON"
      accept="application/json,.json"
      onError={onError}
      onPick={async (file) => {
        const count = await importAll(await file.text());
        onMessage(`Imported ${count} portfolios.`);
      }}
    />
  );
}

/* ── the group list ───────────────────────────────────────────────────── */

export type GroupId =
  | "profile"
  | "security"
  | "addresses"
  | "plan"
  | "notifications"
  | "privacy";

export const GROUPS: Array<{
  id: GroupId;
  label: string;
  sub: string;
  Panel: (props: PanelProps) => React.ReactElement;
}> = [
  {
    id: "profile",
    label: "Public identity",
    sub: "Name, photo, position, default tags",
    Panel: ProfilePanel,
  },
  {
    id: "security",
    label: "Sign-in & security",
    sub: "Email, two-step, devices",
    Panel: SecurityPanel,
  },
  {
    id: "addresses",
    label: "Page addresses",
    sub: "Handle, links, custom domain",
    Panel: AddressesPanel,
  },
  {
    id: "plan",
    label: "Plan & billing",
    sub: "What you are on, and what it costs",
    Panel: PlanPanel,
  },
  {
    id: "notifications",
    label: "Notifications",
    sub: "What we would email you about",
    Panel: NotificationsPanel,
  },
  {
    id: "privacy",
    label: "Privacy & data",
    sub: "Search, analytics, export, delete",
    Panel: PrivacyPanel,
  },
];

/** A one-line flag on the rail when a group wants attention. */
export function groupFlag(id: GroupId, account: AccountSettings): string {
  if (id === "security" && !account.security.twoStep) return "Set up 2-step";
  if (id === "plan" && account.plan === "free") return "Free";
  return "";
}
