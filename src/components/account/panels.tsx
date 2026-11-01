"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LinkEditor } from "../LinkEditor";
import { PasswordField } from "../PasswordField";
import { QrCode } from "../QrCode";
import { TagEditor } from "../TagEditor";
import { UploadButton } from "../UploadButton";
import { ICON, Icon, TiltPanel } from "../ui";
import {
  beginTwoStep,
  clearAccountError,
  changePassword,
  confirmTwoStep,
  deleteAccount,
  disableTwoStep,
  generateRecoveryCodes,
  listSessions,
  revokeOtherSessions,
  revokeSession,
  setCustomDomain,
  setPlan,
  updateNotifications,
  updatePrivacy,
  updateProfile,
  updateSecurity,
  type DeviceSession,
  type TwoStepSetup,
} from "@/lib/account";
import { resetAnalytics, type Analytics } from "@/lib/analytics";
import { messageFor } from "@/lib/api";
import { readImageAsset } from "@/lib/assets";
import { signOut } from "@/lib/session";
import { displayUrl, liveUrl } from "@/lib/slug";
import { usePortfolios } from "@/lib/store";
import {
  NEEDS_SERVER,
  NOTIFICATIONS,
  PASSWORD_MIN,
  PLANS,
  PRIVACY_SETTINGS,
  assetSrc,
  type AccountProfile,
  type AccountSettings,
  type Portfolio,
} from "@/lib/types";

/* ── Account panels ───────────────────────────────────────────────────────
   One panel per settings group, each built from the same few pieces: a
   header, cards that group related settings, rows inside them, a real
   on/off switch. Every control here does what it says — the three groups
   that need a service this build does not have say so on screen.
   ──────────────────────────────────────────────────────────────────────── */

export type PanelProps = {
  account: AccountSettings;
  portfolios: Portfolio[];
  analytics: Analytics;
};

const EASE = [0.16, 1, 0.3, 1] as const;

/** Mirrors HANDLE_PATTERN in backend/app/schemas/account.py. */
const HANDLE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

export function handleProblem(value: string): string | null {
  if (!value) return "Choose a handle — it is the start of every page address.";
  if (value.length < 3) return "At least three characters.";
  if (value.length > 32) return "At most 32 characters.";
  if (/^-|-$/.test(value)) return "Can’t start or end with a hyphen.";
  if (!HANDLE.test(value)) return "Lowercase letters, numbers and hyphens only.";
  return null;
}

/* ── shared pieces ────────────────────────────────────────────────────── */

function PanelHeader({ title, desc }: { title: string; desc: React.ReactNode }) {
  return (
    <header className="mb-5">
      <h2 className="m-0 text-[20px] tracking-[-0.02em]">{title}</h2>
      <p className="m-0 mt-1.5 max-w-[62ch] text-[14px] leading-relaxed text-muted">{desc}</p>
    </header>
  );
}

/** A group of related settings. */
function Card({
  title,
  desc,
  children,
  danger,
}: {
  title?: string;
  desc?: React.ReactNode;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className="mb-4 rounded-2xl p-5"
      style={{
        background: "var(--color-bg)",
        border: danger ? "1.5px solid var(--color-ink)" : "1px solid var(--color-divider)",
      }}
    >
      {title && <h3 className="m-0 text-[15px] tracking-[-0.01em]">{title}</h3>}
      {desc && <p className="m-0 mt-1 text-[13px] leading-relaxed text-muted">{desc}</p>}
      {(title || desc) && <div className="h-4" />}
      {children}
    </section>
  );
}

/** One setting: what it is and what it does on the left, its control on the right. */
function SettingRow({
  title,
  desc,
  children,
}: {
  title: string;
  desc: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 py-3.5 first:pt-0 last:pb-0 [&+&]:border-t [&+&]:border-[var(--color-divider)]">
      <span className="flex min-w-0 max-w-[52ch] flex-1 basis-[240px] flex-col gap-0.5">
        <span className="text-[14px] font-medium">{title}</span>
        <span className="text-[12.5px] leading-snug text-muted">{desc}</span>
      </span>
      {children && <span className="ml-auto flex flex-none items-center gap-3">{children}</span>}
    </div>
  );
}

/** A status label: filled when the thing is on, outlined when it is not. */
export function Pill({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex h-6 flex-none items-center rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap"
      style={
        on
          ? { background: "var(--color-ink)", color: "var(--color-bg)" }
          : { color: "var(--color-neutral-700)", boxShadow: "inset 0 0 0 1px var(--color-divider)" }
      }
    >
      {children}
    </span>
  );
}

/** A real switch: a track with a knob that slides, and its state in words beside it. */
function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className="flex cursor-pointer items-center gap-2.5"
    >
      <span className="w-7 text-right text-[12.5px] font-medium" style={{ color: "var(--color-neutral-700)" }}>
        {on ? "On" : "Off"}
      </span>
      <span
        className="flex h-6 w-11 items-center rounded-full p-0.5 transition-colors duration-200"
        style={{
          background: on ? "var(--color-ink)" : "var(--color-neutral-300)",
          justifyContent: on ? "flex-end" : "flex-start",
        }}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 600, damping: 36 }}
          className="block h-5 w-5 rounded-full"
          style={{ background: "var(--color-bg)", boxShadow: "0 1px 3px #0000004d" }}
        />
      </span>
    </button>
  );
}

/**
 * Said once per group whose behaviour would live on a server this build has
 * not chosen. The settings are stored and shown; nothing enforces them, and
 * pretending otherwise would be worse than not drawing the screen.
 */
export function ServerNotice({ what }: { what: string }) {
  return (
    <div
      role="note"
      className="mb-4 flex gap-3 rounded-xl px-4 py-3 text-[13px] leading-relaxed"
      style={{ border: "1px dashed color-mix(in srgb, var(--color-ink) 40%, transparent)", background: "var(--color-surface)" }}
    >
      <span
        aria-hidden
        className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full text-[11px] font-bold"
        style={{ boxShadow: "inset 0 0 0 1.5px currentColor" }}
      >
        i
      </span>
      <span>
        <strong className="font-semibold">Saved, but not active yet.</strong> {what} What you
        set here is stored on your account and takes effect once that service is added.
      </span>
    </div>
  );
}

function Message({ kind, children }: { kind: "error" | "ok"; children: React.ReactNode }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      role={kind === "error" ? "alert" : "status"}
      className="m-0 mb-4 flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px]"
      style={
        kind === "error"
          ? { border: "1px solid var(--color-ink)", background: "var(--color-bg)" }
          : { background: "var(--color-surface)" }
      }
    >
      <span
        aria-hidden
        className="mt-px grid h-[18px] w-[18px] flex-none place-items-center rounded-full text-[11px] font-bold"
        style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
      >
        {kind === "error" ? "!" : <Icon d={ICON.check} size={11} />}
      </span>
      <span>{children}</span>
    </motion.p>
  );
}

/** Up to two initials, for an account with no photo. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ profile, size }: { profile: AccountProfile; size: number }) {
  return (
    <span
      className="grid flex-none place-items-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: "var(--color-ink)",
        color: "var(--color-bg)",
        fontSize: size * 0.36,
        fontWeight: 600,
      }}
    >
      {profile.portrait ? (
        // An API URL — nothing for next/image to optimise.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={assetSrc(profile.portrait)} alt="" className="h-full w-full object-cover" />
      ) : (
        initialsOf(profile.name)
      )}
    </span>
  );
}

/* ── 1. profile ───────────────────────────────────────────────────────── */

export function ProfilePanel({ account }: PanelProps) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  /**
   * Null means "no unsaved edits", so the fields always show stored data
   * until someone types.
   */
  const [draft, setDraft] = useState<AccountProfile | null>(null);

  const p = draft ?? account.profile;
  const dirty = draft !== null;
  const set = (patch: Partial<AccountProfile>) => {
    setSaved(false);
    setDraft({ ...p, ...patch });
  };
  const handleError = dirty && p.handle !== account.profile.handle ? handleProblem(p.handle) : null;

  // Waits for the server's answer. It used to clear the draft and say
  // "saved" straight away, so a taken handle lost what was typed and showed
  // success for a save that had failed.
  async function save() {
    setSaving(true);
    setError("");
    try {
      await updateProfile(p);
      setDraft(null);
      setSaved(true);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PanelHeader
        title="Profile"
        desc="Who you are. This fills the header of every new portfolio — each one can change it in its own editor."
      />
      {error && <Message kind="error">{error}</Message>}

      <Card>
        <div className="flex flex-wrap items-center gap-5">
          <Avatar profile={p} size={88} />
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-[14px] font-medium">Photo</span>
            <span className="text-[12.5px] text-muted">A square photo works best. It is shown round.</span>
            <div className="flex flex-wrap gap-2">
              <UploadButton
                label={p.portrait ? "Replace photo" : "Upload photo"}
                accept="image/*"
                onError={setError}
                onPick={async (file) => set({ portrait: await readImageAsset(file) })}
              />
              {p.portrait && (
                <button type="button" className="btn btn-ghost" onClick={() => set({ portrait: null })}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card title="About you">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="field">
            <label htmlFor="ac-name">Full name</label>
            <input id="ac-name" className="input" value={p.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ac-handle">Handle</label>
            <input
              id="ac-handle"
              className="input font-mono"
              value={p.handle}
              aria-invalid={!!handleError || undefined}
              aria-describedby="ac-handle-hint"
              onChange={(e) =>
                set({ handle: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32) })
              }
            />
            <p id="ac-handle-hint" className="m-0 mt-1.5 truncate text-[12px] text-muted">
              {handleError ?? (
                <>
                  Pages live at <span className="font-mono">{displayUrl(liveUrl(p.handle || "your-handle", "page"))}</span>
                </>
              )}
            </p>
          </div>
          <div className="field sm:col-span-2">
            <label htmlFor="ac-current">What you do now</label>
            <input
              id="ac-current"
              className="input"
              placeholder="Founder, Northwell Kitchens · Bengaluru"
              value={p.current}
              onChange={(e) => set({ current: e.target.value })}
            />
          </div>
          <div className="field sm:col-span-2">
            <label htmlFor="ac-about">About you</label>
            <textarea id="ac-about" className="input" rows={4} value={p.about} onChange={(e) => set({ about: e.target.value })} />
          </div>
        </div>
      </Card>

      <Card title="Starting tags and links" desc="Copied into each new portfolio’s header.">
        <div className="flex flex-col gap-4">
          <div className="field">
            <label>Tags</label>
            <TagEditor tags={p.tags} onChange={(tags) => set({ tags })} accentFirst />
          </div>
          <div className="field">
            <label>Links</label>
            <LinkEditor links={p.links} onChange={(links) => set({ links })} />
          </div>
        </div>
      </Card>

      <AnimatePresence>
        {saved && !dirty && (
          <Message kind="ok">Profile saved.</Message>
        )}
      </AnimatePresence>

      {/* The save bar rises when there is something to save, and stays in
          view at the bottom of the window while you scroll the form. */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="sticky bottom-4 z-20 mt-2 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3"
            style={{ background: "var(--color-ink)", color: "var(--color-bg)", boxShadow: "var(--shadow-lg)" }}
          >
            <span className="min-w-0 flex-1 text-[13.5px]">You have unsaved changes.</span>
            <button
              type="button"
              className="btn"
              style={{ color: "var(--color-bg)", minHeight: 34 }}
              onClick={() => {
                setDraft(null);
                setError("");
                clearAccountError();
              }}
            >
              Discard
            </button>
            <button
              type="button"
              className="btn"
              disabled={saving || !!handleError}
              style={{ background: "var(--color-bg)", color: "var(--color-ink)", minHeight: 34 }}
              onClick={save}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
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

/** Everything here is enforced by the server. */
export function SecurityPanel({ account }: PanelProps) {
  const s = account.security;

  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  /* The only two things worth checking before the request goes out: that the
     new one is long enough, and that it was typed the same way twice. Whether
     the *current* password is right is the server's answer, against the
     stored hash. */
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const newPasswordUsable = newPassword.length >= PASSWORD_MIN && newPassword === confirmPassword;

  function closePasswordForm() {
    setChangingPassword(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  // `setup` holds an enrolment in progress. An empty otpauthUri means the
  // opposite direction: a code is being collected to turn two-step off.
  const [setup, setSetup] = useState<TwoStepSetup | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNote(null);
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

  const small = { minHeight: 34, padding: "0.4rem 0.85rem", fontSize: 13 };

  return (
    <div>
      <PanelHeader
        title="Sign-in & security"
        desc="How you get into your account, and where you’re signed in. All of this is enforced by the server — signing a device out ends its session straight away."
      />
      {error && <Message kind="error">{error}</Message>}
      {note && <Message kind="ok">{note}</Message>}

      <Card title="Contact">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="field">
            <label htmlFor="ac-email">Email</label>
            <input id="ac-email" className="input" value={s.email} readOnly disabled />
            <p className="m-0 mt-1.5 text-[12px] text-muted">
              Your sign-in address. Changing it needs a mail service to confirm the new one.
            </p>
          </div>
          <div className="field">
            <label htmlFor="ac-phone">Phone, for recovery</label>
            <input
              id="ac-phone"
              className="input"
              type="tel"
              autoComplete="tel"
              defaultValue={s.phone}
              onBlur={(e) => void updateSecurity({ phone: e.target.value })}
            />
            <p className="m-0 mt-1.5 text-[12px] text-muted">Saved when you leave the field.</p>
          </div>
        </div>
      </Card>

      <Card title="Signing in">
        <SettingRow title="Password" desc={describeAge(s.passwordChanged)}>
          <button
            type="button"
            className="btn btn-secondary"
            style={small}
            onClick={() => (changingPassword ? closePasswordForm() : setChangingPassword(true))}
          >
            {changingPassword ? "Cancel" : "Change password"}
          </button>
        </SettingRow>

        <AnimatePresence initial={false}>
          {changingPassword && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="mb-3 grid grid-cols-1 gap-3 rounded-xl p-4 sm:grid-cols-2" style={{ background: "var(--color-surface)" }}>
                <div className="field sm:col-span-2">
                  <label htmlFor="ac-pw-current">Current password</label>
                  <PasswordField
                    id="ac-pw-current"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="ac-pw-new">New password</label>
                  <PasswordField
                    id="ac-pw-new"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <p className="m-0 mt-1.5 text-[12px] text-muted">
                    At least {PASSWORD_MIN} characters. A passphrase is easier to remember.
                  </p>
                </div>
                <div className="field">
                  <label htmlFor="ac-pw-confirm">Type it again</label>
                  <PasswordField
                    id="ac-pw-confirm"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    aria-invalid={mismatch || undefined}
                  />
                  {mismatch && <p className="m-0 mt-1.5 text-[12px] font-medium">Those two don’t match.</p>}
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || !currentPassword || !newPasswordUsable}
                    onClick={() =>
                      run(async () => {
                        await changePassword(currentPassword, newPassword);
                        closePasswordForm();
                        setSessions(null);
                        // The server signs every other device out on a change.
                        setNote("Password changed. Every other device has been signed out.");
                      })
                    }
                  >
                    {busy ? "Saving…" : "Change password"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <SettingRow
          title="Two-step verification"
          desc="Asks for a code from your authenticator app as well as your password."
        >
          <Pill on={s.twoStep}>{s.twoStep ? "On" : "Off"}</Pill>
          <button
            type="button"
            className={`btn ${s.twoStep ? "btn-secondary" : "btn-primary"}`}
            style={small}
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

        <AnimatePresence initial={false}>
          {setup && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="mb-3 rounded-xl p-4" style={{ background: "var(--color-surface)" }}>
                {setup.otpauthUri ? (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    {/* The hand-rolled encoder /stats also uses — a CDN is not an
                        option and this has to actually scan. */}
                    <span className="flex-none rounded-lg bg-white p-2">
                      <QrCode text={setup.otpauthUri} size={148} />
                    </span>
                    <div className="min-w-0 text-[13.5px]">
                      <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5">
                        <li>Open your authenticator app and add an account.</li>
                        <li>Scan this code.</li>
                        <li>Enter the six-digit code it shows below.</li>
                      </ol>
                      <p className="m-0 mt-3 text-[12px] break-all text-muted">
                        Can’t scan? Enter this key by hand: <span className="font-mono">{setup.secret}</span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="m-0 text-[13.5px]">
                    Enter a current code from your authenticator app to turn two-step off. A
                    recovery code works too.
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-end gap-2">
                  <div className="field w-[180px]">
                    <label htmlFor="ac-code">Code</label>
                    <input
                      id="ac-code"
                      className="input font-mono tracking-[0.2em]"
                      inputMode="numeric"
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
            </motion.div>
          )}
        </AnimatePresence>

        <SettingRow
          title="Recovery codes"
          desc="Ten one-time codes to keep somewhere safe, for when you can’t reach your authenticator."
        >
          <Pill on={s.recoveryCodesRemaining > 0}>
            {s.recoveryCodesRemaining > 0 ? `${s.recoveryCodesRemaining} left` : "None"}
          </Pill>
          <button
            type="button"
            className="btn btn-secondary"
            style={small}
            disabled={busy}
            onClick={() => run(async () => setCodes(await generateRecoveryCodes()))}
          >
            {s.recoveryCodesRemaining > 0 ? "Make new codes" : "Generate"}
          </button>
        </SettingRow>

        <AnimatePresence initial={false}>
          {codes && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 rounded-xl p-4" style={{ background: "var(--color-surface)" }}>
                <div className="mb-3 flex items-center">
                  <span className="text-[14px] font-medium">Your recovery codes</span>
                  <button type="button" className="btn btn-ghost ml-auto" onClick={() => setCodes(null)}>
                    Hide
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-[13px] sm:grid-cols-5">
                  {codes.map((c) => (
                    <span key={c} className="rounded-md px-2 py-1 text-center" style={{ background: "var(--color-bg)" }}>
                      {c}
                    </span>
                  ))}
                </div>
                <p className="m-0 mt-3 text-[12px] text-muted">
                  Copy these somewhere safe now. Only fingerprints of them are stored, so this
                  is the one time they can be read — and making new ones replaces these.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <Card title="Where you’re signed in" desc="Every browser and device that has a session on your account.">
        {sessions === null ? (
          <button type="button" className="btn btn-secondary" onClick={loadSessions} disabled={busy}>
            {busy ? "Loading…" : "Show devices"}
          </button>
        ) : (
          <>
            <ul className="m-0 list-none p-0">
              {sessions.map((session, i) => (
                <motion.li
                  key={session.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex flex-wrap items-center gap-3 py-3"
                  style={{ borderTop: i === 0 ? "none" : "1px solid var(--color-divider)" }}
                >
                  <span
                    aria-hidden
                    className="grid h-9 w-9 flex-none place-items-center rounded-lg"
                    style={{ background: "var(--color-surface)" }}
                  >
                    <Icon
                      d={
                        <>
                          <rect x="3" y="4" width="18" height="12" rx="2" />
                          <path d="M8 20h8M12 16v4" />
                        </>
                      }
                      size={16}
                    />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2 text-[14px] font-medium">
                      <span className="truncate">{session.device}</span>
                      {session.current && <Pill on>This device</Pill>}
                    </span>
                    <span className="text-[12.5px] text-muted">
                      {session.place} · {new Date(session.when).toLocaleString()}
                    </span>
                  </span>
                  {session.current ? (
                    // Signing out the row you are sitting on is a sign-out, not a
                    // revoke: the local token and session state go too.
                    <button type="button" className="btn btn-ghost" style={small} onClick={() => void signOut()}>
                      Sign out
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={small}
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
                </motion.li>
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn btn-ghost" onClick={loadSessions} disabled={busy}>
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
                      setNote(`Signed out ${revoked} other ${revoked === 1 ? "device" : "devices"}.`);
                    })
                  }
                >
                  Sign out everywhere else
                </button>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

/* ── 3. page addresses ────────────────────────────────────────────────── */

export function AddressesPanel({ account, portfolios, analytics }: PanelProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [draftHandle, setDraftHandle] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const stored = account.profile.handle;
  const handle = draftHandle ?? stored;
  const changed = handle !== stored;
  const problem = changed ? handleProblem(handle) : null;
  const live = portfolios.filter((p) => p.status === "live");
  const drafts = portfolios.filter((p) => p.status !== "live");

  async function copy(slug: string) {
    try {
      await navigator.clipboard.writeText(liveUrl(stored, slug));
      setCopied(slug);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      // Clipboard blocked — the address is on screen to copy by hand.
    }
  }

  async function saveHandle() {
    setSaving(true);
    setError("");
    try {
      await updateProfile({ handle });
      setDraftHandle(null);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PanelHeader
        title="Page addresses"
        desc="Your handle is the start of every page address. Each portfolio adds its own name after it."
      />
      {error && <Message kind="error">{error}</Message>}

      <Card title="Your handle">
        <div className="flex flex-wrap items-start gap-2.5">
          <div className="field min-w-[220px] flex-1">
            <label htmlFor="ac-base" className="sr-only">
              Handle
            </label>
            <div
              className="flex items-center overflow-hidden rounded-[var(--radius-md)]"
              style={{ border: "1px solid var(--color-divider)", background: "var(--color-surface)" }}
            >
              <span className="flex-none py-2 pl-3 font-mono text-[13px]" style={{ color: "var(--color-neutral-600)" }}>
                {displayUrl(liveUrl("", "")).replace(/\/p\/\/$/, "/p/")}
              </span>
              <input
                id="ac-base"
                className="min-w-0 flex-1 bg-transparent py-2 pr-3 font-mono text-[14px] outline-none"
                style={{ color: "var(--color-ink)", border: 0 }}
                value={handle}
                placeholder="your-handle"
                aria-invalid={!!problem || undefined}
                onChange={(e) =>
                  setDraftHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32))
                }
              />
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!changed || !!problem || saving}
            onClick={saveHandle}
          >
            {saving ? "Saving…" : "Save handle"}
          </button>
        </div>
        <p className="m-0 mt-2 text-[12.5px] text-muted">
          {problem ??
            (changed
              ? "Not saved yet. Every live page moves to the new address, and links you have already shared stop working."
              : stored
                ? "Every live page below uses this."
                : "You have no handle yet, so your live pages can’t be opened. Choose one above.")}
        </p>
      </Card>

      <Card title="Your pages" desc={`${live.length} live · ${drafts.length} ${drafts.length === 1 ? "draft" : "drafts"}. Views are for the last 30 days.`}>
        {portfolios.length === 0 ? (
          <p className="m-0 text-[13.5px] text-muted">No portfolios yet.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {[...live, ...drafts].map((p, i) => {
              const isLive = p.status === "live";
              const url = stored ? liveUrl(stored, p.slug) : "";
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3"
                  style={{ borderTop: i === 0 ? "none" : "1px solid var(--color-divider)" }}
                >
                  <span className="flex min-w-0 flex-1 basis-[220px] flex-col">
                    <span className="truncate text-[14px] font-medium">{p.name}</span>
                    {isLive && url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-1 font-mono text-[12px] underline-offset-2 hover:underline"
                        style={{ color: "var(--color-ink)" }}
                      >
                        <span className="truncate">{displayUrl(url)}</span>
                        <span className="flex-none">
                          <Icon d={ICON.out} size={11} />
                        </span>
                      </a>
                    ) : (
                      <span className="text-[12.5px] text-muted">
                        {isLive ? "Needs a handle to have an address" : "Draft — not public until published"}
                      </span>
                    )}
                  </span>
                  <Pill on={isLive}>{isLive ? "Live" : "Draft"}</Pill>
                  <span className="w-16 text-right font-mono text-[12.5px]">
                    {(analytics.views[p.slug] ?? 0).toLocaleString()}
                    <span className="block text-[11px]" style={{ color: "var(--color-neutral-600)" }}>
                      views
                    </span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ minHeight: 32, padding: "0.35rem 0.7rem", fontSize: 13, visibility: isLive && url ? "visible" : "hidden" }}
                    onClick={() => copy(p.slug)}
                  >
                    <Icon d={copied === p.slug ? ICON.check : ICON.copy} size={13} />
                    {copied === p.slug ? "Copied" : "Copy"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Your own domain" desc="Serve your pages from an address you own, like yourname.com.">
        <ServerNotice what={NEEDS_SERVER.domain} />
        <div className="field max-w-[360px]">
          <label htmlFor="ac-domain">Domain</label>
          <input
            id="ac-domain"
            className="input"
            placeholder="yourname.com"
            defaultValue={account.customDomain}
            onBlur={(e) => void setCustomDomain(e.target.value)}
          />
        </div>
      </Card>
    </div>
  );
}

/* ── 4. plan & billing ────────────────────────────────────────────────── */

export function PlanPanel({ account }: PanelProps) {
  return (
    <div>
      <PanelHeader title="Plan & billing" desc="What you’re on, and what each plan includes." />
      <ServerNotice what={NEEDS_SERVER.billing} />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2" style={{ perspective: 1200 }}>
        {PLANS.map((plan) => {
          const current = account.plan === plan.id;
          return (
            <TiltPanel
              key={plan.id}
              className="flex flex-col gap-3 rounded-2xl p-5"
              style={current ? { border: "1.5px solid var(--color-ink)" } : undefined}
            >
              <div className="flex items-center gap-2">
                <span className="text-[17px] font-semibold">{plan.name}</span>
                {current && <Pill on>Current plan</Pill>}
              </div>
              <div className="text-[30px] leading-none font-semibold tracking-[-0.03em]">{plan.price}</div>
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13.5px]">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-0.5 flex-none">
                      <Icon d={ICON.check} size={14} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`btn btn-block mt-auto ${current ? "btn-secondary" : "btn-primary"}`}
                disabled={current}
                onClick={() => void setPlan(plan.id)}
                style={{ justifyContent: "center" }}
              >
                {current ? "Your plan" : `Switch to ${plan.name}`}
              </button>
            </TiltPanel>
          );
        })}
      </div>

      <Card title="Billing">
        <SettingRow title="Payment method" desc="Nothing is charged, and nothing can be yet.">
          <Pill on={false}>None on file</Pill>
        </SettingRow>
        <SettingRow title="Invoices and receipts" desc="Nothing to show.">
          <Pill on={false}>Empty</Pill>
        </SettingRow>
      </Card>
    </div>
  );
}

/* ── 5. notifications ─────────────────────────────────────────────────── */

export function NotificationsPanel({ account }: PanelProps) {
  return (
    <div>
      <PanelHeader title="Notifications" desc="What we’d email you about." />
      <ServerNotice what={NEEDS_SERVER.email} />
      <Card>
        {NOTIFICATIONS.map((n) => (
          <SettingRow key={n.id} title={n.title} desc={n.desc}>
            <Switch
              on={account.notifications[n.id]}
              label={n.title}
              onToggle={() => void updateNotifications({ [n.id]: !account.notifications[n.id] })}
            />
          </SettingRow>
        ))}
      </Card>
    </div>
  );
}

/* ── 6. privacy & data ────────────────────────────────────────────────── */

export function PrivacyPanel({ account, portfolios }: PanelProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");

  return (
    <div>
      <PanelHeader
        title="Privacy & data"
        desc="These switches change what your published pages actually show — the page reads them, they aren’t just stored."
      />
      {message && <Message kind="ok">{message}</Message>}
      {error && <Message kind="error">{error}</Message>}

      <Card title="Privacy">
        {PRIVACY_SETTINGS.map((s) => (
          <SettingRow key={s.id} title={s.title} desc={s.desc}>
            <Switch
              on={account.privacy[s.id]}
              label={s.title}
              onToggle={() => void updatePrivacy({ [s.id]: !account.privacy[s.id] })}
            />
          </SettingRow>
        ))}
      </Card>

      <Card
        title="Your data"
        desc={`${portfolios.length} ${portfolios.length === 1 ? "portfolio" : "portfolios"} stored on the server. Export writes every one, with its sections, to a file you keep. Importing replaces what is there.`}
      >
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
      </Card>

      <Card danger title="Delete your account" desc={`Removes your account, all ${portfolios.length} portfolios, every upload, and every recorded view and click — for good. Export first.`}>
        <AnimatePresence mode="wait" initial={false}>
          {confirming ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-3"
            >
              <div className="field max-w-[320px]">
                <label htmlFor="ac-delete">
                  Type <span className="font-mono">delete</span> to confirm
                </label>
                <input id="ac-delete" className="input" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={typed.trim().toLowerCase() !== "delete"}
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
                  Delete my account
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setConfirming(false);
                    setTyped("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirming(true)}>
                Delete account…
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
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
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn btn-primary" onClick={download} disabled={busy}>
        {busy ? "Exporting…" : "Export as JSON"}
      </button>
      <UploadButton
        label="Import JSON"
        accept="application/json,.json"
        onError={onError}
        onPick={async (file) => {
          const count = await importAll(await file.text());
          onMessage(`Imported ${count} portfolios.`);
        }}
      />
      {/* The browser's own print pipeline already renders these themes, so
          /print stacks them and its Save-as-PDF destination does the rest. */}
      <a href="/print?auto=1" target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
        Download all pages as PDF
      </a>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={async () => {
          try {
            await resetAnalytics();
            onMessage("View and click counts cleared.");
          } catch (error) {
            onError(messageFor(error));
          }
        }}
      >
        Clear stats
      </button>
    </div>
  );
}

/* ── the group list ───────────────────────────────────────────────────── */

export type GroupId = "profile" | "security" | "addresses" | "plan" | "notifications" | "privacy";

const GLYPHS: Record<GroupId, React.ReactNode> = {
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
  security: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  addresses: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  plan: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  notifications: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  privacy: (
    <>
      <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
    </>
  ),
};

export function GroupGlyph({ id }: { id: GroupId }) {
  return <Icon d={GLYPHS[id]} size={16} />;
}

export const GROUPS: Array<{
  id: GroupId;
  label: string;
  sub: string;
  Panel: (props: PanelProps) => React.ReactElement;
}> = [
  { id: "profile", label: "Profile", sub: "Name, photo, handle, about you", Panel: ProfilePanel },
  { id: "security", label: "Sign-in & security", sub: "Password, two-step, devices", Panel: SecurityPanel },
  { id: "addresses", label: "Page addresses", sub: "Handle, links, your own domain", Panel: AddressesPanel },
  { id: "plan", label: "Plan & billing", sub: "What you’re on", Panel: PlanPanel },
  { id: "notifications", label: "Notifications", sub: "What we’d email you about", Panel: NotificationsPanel },
  { id: "privacy", label: "Privacy & data", sub: "Visibility, export, delete", Panel: PrivacyPanel },
];

/** A short flag on the rail when a group wants attention. */
export function groupFlag(id: GroupId, account: AccountSettings): string {
  if (id === "profile" && !account.profile.handle) return "Needs a handle";
  if (id === "addresses" && !account.profile.handle) return "No address";
  if (id === "security" && !account.security.twoStep) return "Set up 2-step";
  return "";
}
