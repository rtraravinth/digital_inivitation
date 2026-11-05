"use client";

import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, messageFor } from "@/lib/api";
import { completeTwoStep, register, signIn } from "@/lib/session";
import { displayUrl, isSlug, liveUrl } from "@/lib/slug";
import { PASSWORD_MIN } from "@/lib/types";
import { ThemeSwitch } from "./AppHeader";
import { PasswordField } from "./PasswordField";
import { ICON, Icon, Segmented } from "./ui";

type Mode = "in" | "up";

/** Set once the password step passed and a second factor is outstanding. */
type Challenge = { token: string; email: string };

/* ── the sign-in screen ───────────────────────────────────────────────────
   Two halves on a wide screen: what Facet makes, drawn as a stack of pages
   that turns with the pointer, and the form. A phone gets the form alone —
   the showcase is decoration, and a phone's first screen is for the fields.
   ──────────────────────────────────────────────────────────────────────── */

export function SignIn() {
  const router = useRouter();
  const reduced = useReducedMotion();

  const [mode, setMode] = useState<Mode>("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  /* Sign-up only. Signing in has one password field and nothing to compare
     it against, so neither check applies there. */
  const mismatch =
    mode === "up" && confirmPassword.length > 0 && password !== confirmPassword;
  // Says which rule the handle breaks, once there is something to judge.
  const handleProblem = !handle
    ? null
    : handle.length < 2
      ? "A handle needs at least two characters."
      : handle.endsWith("-")
        ? "A handle can’t end with a hyphen."
        : !isSlug(handle)
          ? "Use lowercase letters, numbers and hyphens only."
          : null;
  const signUpReady =
    isSlug(handle) && password.length >= PASSWORD_MIN && password === confirmPassword;

  /** The API names the offending field on a 422; show it where it happened. */
  const fieldError = (field: string) =>
    error instanceof ApiError ? error.fieldError(field) : null;
  const formError =
    error &&
    !fieldError("email") &&
    !fieldError("password") &&
    !fieldError("name") &&
    !fieldError("handle")
      ? messageFor(error)
      : null;

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    // Sign-in has no second field, so a confirmation left over from an
    // abandoned sign-up would block the button on the way back.
    setConfirmPassword("");
    setError(null);
  }

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (caught) {
      setError(caught as Error);
    } finally {
      setBusy(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();

    if (challenge) {
      return run(async () => {
        await completeTwoStep(challenge.token, code.trim());
        router.push("/");
      });
    }

    return run(async () => {
      if (mode === "up") {
        await register(email.trim(), password, name.trim(), handle.trim().toLowerCase());
        router.push("/");
        return;
      }

      const pending = await signIn(email.trim(), password);
      if (pending) {
        setChallenge({ token: pending, email: email.trim() });
        return;
      }
      router.push("/");
    });
  }

  const step = challenge ? "code" : mode;
  const title = challenge ? "One more step" : mode === "in" ? "Welcome back" : "Create your account";
  const lede = challenge
    ? `Enter the six-digit code from your authenticator app for ${challenge.email}. A recovery code works too.`
    : mode === "in"
      ? "Sign in to edit, publish and share your pages."
      : "One page per role you play — a header, then as many sections as you need.";

  return (
    <>
      <div aria-hidden className="app-backdrop" />
      <div
        className="flex min-h-dvh flex-col"
        onPointerMove={(e) => {
          if (reduced || e.pointerType !== "mouse") return;
          const root = document.documentElement;
          root.style.setProperty("--mx", `${e.clientX}px`);
          root.style.setProperty("--my", `${e.clientY}px`);
        }}
      >
        <header className="flex h-14 flex-none items-center gap-2.5 px-4 sm:px-6">
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-md text-[13px] font-bold"
            style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
          >
            F
          </span>
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Facet</span>
          <div className="ml-auto">
            <ThemeSwitch />
          </div>
        </header>

        <main className="mx-auto grid w-full max-w-[1160px] flex-1 grid-cols-1 items-center gap-10 px-4 pt-6 pb-16 sm:px-6 lg:grid-cols-[1.05fr_minmax(0,440px)] lg:gap-16 lg:pt-0">
          <Showcase />

          <motion.section
            aria-labelledby="signin-title"
            initial={reduced ? false : { opacity: 0, y: 16, rotateX: 6 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto w-full max-w-[440px] rounded-2xl p-5 sm:p-7"
            style={{
              background: "var(--color-bg)",
              border: "1px solid var(--color-divider)",
              boxShadow: "var(--shadow-lg)",
              transformPerspective: 1200,
            }}
          >
            {!challenge && (
              <div className="mb-6 flex">
                <Segmented
                  label="Account"
                  id="signin-mode"
                  value={mode}
                  onChange={switchMode}
                  options={[
                    { id: "in", label: "Sign in" },
                    { id: "up", label: "Create account" },
                  ]}
                />
              </div>
            )}

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={reduced ? { opacity: 0 } : { opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, x: -18 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                {challenge && (
                  <span
                    aria-hidden
                    className="mb-4 grid h-11 w-11 place-items-center rounded-xl"
                    style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
                  >
                    <Icon d={<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>} size={19} />
                  </span>
                )}
                <h1 id="signin-title" className="m-0 text-[26px] leading-[1.15] font-semibold tracking-[-0.02em]">
                  {title}
                </h1>
                <p className="text-muted mt-2 mb-6 text-[14px] leading-relaxed">{lede}</p>

                <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
                  {challenge ? (
                    <div className="field">
                      <label htmlFor="code">Verification code</label>
                      <input
                        id="code"
                        className="input text-center font-mono text-[20px] tracking-[0.35em]"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        autoComplete="one-time-code"
                        inputMode="text"
                        placeholder="000000"
                        autoFocus
                        required
                      />
                    </div>
                  ) : (
                    <>
                      {mode === "up" && (
                        <div className="field">
                          <label htmlFor="name">Your name</label>
                          <input
                            id="name"
                            className="input"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoComplete="name"
                            autoFocus
                          />
                          <FieldNote error={fieldError("name")} />
                        </div>
                      )}

                      {mode === "up" && (
                        <div className="field">
                          <label htmlFor="handle">Handle</label>
                          {/* Asked for here because it is the base of every page this
                              account will publish. Leaving it until /account is what
                              let accounts exist with no address at all. */}
                          <div
                            className="flex items-center overflow-hidden rounded-[var(--radius-md)] focus-within:ring-2 focus-within:ring-[var(--color-ink)]"
                            style={{ border: "1px solid var(--color-divider)", background: "var(--color-surface)" }}
                          >
                            <span
                              className="flex-none py-2 pr-0.5 pl-3 font-mono text-[12.5px]"
                              style={{ color: "var(--color-neutral-600)" }}
                            >
                              /p/
                            </span>
                            <input
                              id="handle"
                              className="min-w-0 flex-1 bg-transparent py-2 pr-3 font-mono text-[14px] outline-none"
                              style={{ color: "var(--color-ink)", border: 0, minHeight: 40 }}
                              value={handle}
                              // Cleaned as typed; the server judges the finished value.
                              onChange={(e) =>
                                setHandle(
                                  e.target.value
                                    .toLowerCase()
                                    .replace(/[^a-z0-9-]+/g, "-")
                                    .replace(/-{2,}/g, "-")
                                    .replace(/^-+/, ""),
                                )
                              }
                              autoComplete="username"
                              placeholder="your-name"
                              aria-describedby="handle-note"
                              required
                            />
                          </div>
                          <FieldNote
                            id="handle-note"
                            error={fieldError("handle") ?? handleProblem}
                            hint={
                              <>
                                Your pages live under it —{" "}
                                <span className="font-mono" style={{ color: "var(--color-ink)" }}>
                                  {displayUrl(liveUrl(handle || "your-name", "your-page"))}
                                </span>
                              </>
                            }
                          />
                        </div>
                      )}

                      <div className="field">
                        <label htmlFor="email">Email</label>
                        <input
                          id="email"
                          className="input"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          autoComplete="email"
                          autoFocus={mode === "in"}
                          placeholder="you@example.com"
                          required
                        />
                        <FieldNote error={fieldError("email")} />
                      </div>

                      <div className="field">
                        <label htmlFor="password">Password</label>
                        <PasswordField
                          id="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete={mode === "in" ? "current-password" : "new-password"}
                          required
                        />
                        {mode === "up" && !fieldError("password") ? (
                          <Strength password={password} />
                        ) : (
                          <FieldNote error={fieldError("password")} />
                        )}
                      </div>

                      {mode === "up" && (
                        <div className="field">
                          <label htmlFor="confirm-password">Confirm password</label>
                          <PasswordField
                            id="confirm-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            autoComplete="new-password"
                            aria-invalid={mismatch || undefined}
                            required
                          />
                          {/* Only once they have typed something to compare — an alarm
                              on the first keystroke of a field still being filled is
                              noise. */}
                          <FieldNote
                            error={mismatch ? "Those two don’t match." : null}
                            hint={
                              confirmPassword && !mismatch && password.length >= PASSWORD_MIN ? (
                                <span className="inline-flex items-center gap-1" style={{ color: "var(--color-ink)" }}>
                                  <Icon d={ICON.check} size={13} /> Matches
                                </span>
                              ) : null
                            }
                          />
                        </div>
                      )}
                    </>
                  )}

                  <AnimatePresence initial={false}>
                    {formError && (
                      <motion.div
                        key="error"
                        role="alert"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13.5px] leading-snug"
                        style={{
                          background: "var(--color-surface)",
                          border: "1px solid color-mix(in srgb, var(--color-ink) 40%, transparent)",
                        }}
                      >
                        <span className="mt-px flex-none">
                          <Icon d={<><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></>} size={16} />
                        </span>
                        {formError}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button
                    className="btn btn-primary btn-block"
                    type="submit"
                    style={{ minHeight: 44 }}
                    whileTap={reduced ? undefined : { scale: 0.98 }}
                    disabled={busy || (mode === "up" && !challenge && !signUpReady)}
                  >
                    {busy && <Spinner />}
                    {busy
                      ? "Working…"
                      : challenge
                        ? "Verify"
                        : mode === "in"
                          ? "Sign in"
                          : "Create account"}
                  </motion.button>
                </form>

                <div className="mt-6 pt-5 text-center text-[13.5px]" style={{ borderTop: "1px solid var(--color-divider)" }}>
                  {challenge ? (
                    <button
                      className="cursor-pointer font-medium underline underline-offset-2"
                      type="button"
                      onClick={() => {
                        setChallenge(null);
                        setCode("");
                        setError(null);
                      }}
                    >
                      Use a different account
                    </button>
                  ) : (
                    <span className="text-muted">
                      {mode === "in" ? "New to Facet?" : "Already have an account?"}{" "}
                      <button
                        className="cursor-pointer font-medium underline underline-offset-2"
                        type="button"
                        style={{ color: "var(--color-ink)" }}
                        onClick={() => switchMode(mode === "in" ? "up" : "in")}
                      >
                        {mode === "in" ? "Create an account" : "Sign in"}
                      </button>
                    </span>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.section>
        </main>
      </div>
    </>
  );
}

/* ── pieces ─────────────────────────────────────────────────────────────── */

/** One line under a field: the server's complaint if it has one, else a hint. */
function FieldNote({ id, error, hint }: { id?: string; error: string | null; hint?: React.ReactNode }) {
  if (error)
    return (
      <p id={id} className="m-0 mt-1.5 flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color: "var(--color-alert)" }}>
        <Icon d={<><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></>} size={13} />
        {error}
      </p>
    );
  if (!hint) return null;
  return (
    <p id={id} className="text-muted m-0 mt-1.5 text-[12.5px] leading-relaxed break-words">
      {hint}
    </p>
  );
}

/**
 * A four-step meter, in ink rather than traffic-light colours: length does
 * most of the work, a mix of character kinds the rest. It guides; the server
 * only enforces the minimum.
 */
function Strength({ password }: { password: string }) {
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  const score =
    password.length < PASSWORD_MIN
      ? password.length > 0 ? 1 : 0
      : Math.min(4, 2 + (password.length >= 14 ? 1 : 0) + (kinds >= 3 ? 1 : 0));
  const words = ["", "Too short", "Fair", "Good", "Strong"];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: "var(--color-neutral-200)" }}>
            <motion.span
              className="block h-full rounded-full"
              style={{ background: "var(--color-ink)", originX: 0 }}
              initial={false}
              animate={{ scaleX: score >= n ? 1 : 0 }}
              transition={{ duration: 0.25 }}
            />
          </span>
        ))}
      </div>
      <p className="text-muted m-0 mt-1.5 text-[12.5px]">
        {score > 0 ? <span style={{ color: "var(--color-ink)" }} className="font-medium">{words[score]}. </span> : null}
        At least {PASSWORD_MIN} characters — a passphrase is easier to remember and harder to guess.
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <motion.span
      aria-hidden
      className="mr-2 inline-block h-3.5 w-3.5 rounded-full"
      style={{ border: "2px solid currentColor", borderTopColor: "transparent" }}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
    />
  );
}

/* ── the showcase ─────────────────────────────────────────────────────────
   Three pages fanned in depth, turning toward the pointer. Drawn from
   skeleton bars rather than a real portfolio: a sign-in screen has no
   account to render yet, and a sample with someone's name on it reads as
   somebody else's page.
   ──────────────────────────────────────────────────────────────────────── */

const PROFESSIONS = ["Doctors", "Founders", "Advocates", "Musicians", "Developers", "Students"];

function Showcase() {
  const reduced = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rx = useSpring(useTransform(py, [-0.5, 0.5], [10, -10]), { stiffness: 120, damping: 18 });
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-14, 14]), { stiffness: 120, damping: 18 });
  const shine = useMotionTemplate`radial-gradient(420px circle at ${useTransform(px, [-0.5, 0.5], [0, 100])}% ${useTransform(py, [-0.5, 0.5], [0, 100])}%, color-mix(in srgb, var(--color-ink) 8%, transparent), transparent 60%)`;

  return (
    <section aria-label="What Facet makes" className="hidden flex-col gap-8 lg:flex">
      <div>
        <motion.h2
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="m-0 max-w-[15ch] text-[44px] leading-[1.04] font-semibold tracking-[-0.035em] xl:text-[52px]"
        >
          One person. Every role. A page for each.
        </motion.h2>
        <p className="text-muted mt-4 mb-0 max-w-[46ch] text-[15.5px] leading-relaxed">
          Build a portfolio for each side of your work, style it in minutes, and share a link
          that opens on any device.
        </p>
        <ul className="m-0 mt-5 flex list-none flex-wrap gap-1.5 p-0">
          {PROFESSIONS.map((p, i) => (
            <motion.li
              key={p}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.05 }}
              className="rounded-full px-3 py-1 text-[12.5px] font-medium"
              style={{ border: "1px solid var(--color-divider)", background: "var(--color-bg)" }}
            >
              {p}
            </motion.li>
          ))}
        </ul>
      </div>

      <div
        className="relative h-[340px]"
        style={{ perspective: 1400 }}
        onPointerMove={(e) => {
          if (reduced) return;
          const r = e.currentTarget.getBoundingClientRect();
          px.set((e.clientX - r.left) / r.width - 0.5);
          py.set((e.clientY - r.top) / r.height - 0.5);
        }}
        onPointerLeave={() => {
          px.set(0);
          py.set(0);
        }}
      >
        <motion.div
          aria-hidden
          className="absolute inset-0"
          style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        >
          {[
            { x: 210, y: 18, z: -140, w: 250, delay: 0.3 },
            { x: 110, y: 46, z: -60, w: 270, delay: 0.2 },
            { x: 0, y: 74, z: 30, w: 300, delay: 0.1 },
          ].map((c, i) => (
            <motion.div
              key={i}
              className="absolute top-0 left-0"
              initial={reduced ? false : { opacity: 0, y: c.y + 40 }}
              animate={
                reduced
                  ? { opacity: 1, y: c.y }
                  : { opacity: 1, y: [c.y, c.y - 8, c.y] }
              }
              transition={
                reduced
                  ? undefined
                  : {
                      opacity: { delay: c.delay, duration: 0.5 },
                      y: { delay: c.delay, duration: 5 + i, repeat: Infinity, ease: "easeInOut" },
                    }
              }
              style={{ x: c.x, z: c.z, width: c.w }}
            >
              <MiniPage front={i === 2} variant={i} />
            </motion.div>
          ))}
          <motion.div className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: shine }} />
        </motion.div>
      </div>
    </section>
  );
}

/** A portfolio page in outline: a header, a tab row and a few sections. */
function MiniPage({ front, variant }: { front: boolean; variant: number }) {
  const bar = (w: string, strong = false) => (
    <span
      className="block h-2 rounded-full"
      style={{
        width: w,
        background: strong
          ? "var(--color-ink)"
          : "color-mix(in srgb, var(--color-ink) 14%, transparent)",
      }}
    />
  );
  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{
        background: "var(--color-bg)",
        border: "1px solid var(--color-divider)",
        boxShadow: front ? "var(--shadow-lg)" : "var(--shadow-md, var(--shadow-lg))",
      }}
    >
      <div className="flex items-center gap-1.5 px-3 py-2" style={{ borderBottom: "1px solid var(--color-divider)" }}>
        {[0, 1, 2].map((d) => (
          <span key={d} className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-neutral-400, var(--color-divider))" }} />
        ))}
        <span className="ml-2 h-3 flex-1 rounded-full" style={{ background: "var(--color-surface)" }} />
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <span
            className="h-10 w-10 flex-none rounded-full"
            style={{
              background:
                variant === 2
                  ? "var(--color-ink)"
                  : "color-mix(in srgb, var(--color-ink) 22%, transparent)",
            }}
          />
          <span className="flex flex-1 flex-col gap-1.5">
            {bar("70%", true)}
            {bar("45%")}
          </span>
        </div>
        <div className="flex gap-1.5">
          {["34%", "26%", "30%"].map((w, i) => (
            <span
              key={i}
              className="h-5 rounded-full"
              style={{
                width: w,
                background: i === 0 ? "var(--color-ink)" : "transparent",
                border: "1px solid var(--color-divider)",
              }}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[0, 1].map((s) => (
            <span key={s} className="flex flex-col gap-1.5 rounded-lg p-2.5" style={{ background: "var(--color-surface)" }}>
              <span className="block h-10 rounded-md" style={{ background: "color-mix(in srgb, var(--color-ink) 9%, transparent)" }} />
              {bar("80%", true)}
              {bar("60%")}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
