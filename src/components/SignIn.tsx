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
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type ConfirmationResult,
  type User,
  GithubAuthProvider,
  GoogleAuthProvider,
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  isSignInWithEmailLink,
  sendEmailVerification,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPhoneNumber,
  signInWithPopup,
  validatePassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { ApiError, messageFor } from "@/lib/api";
import {
  emailLinkReturnUrl,
  firebaseAuth,
  firebaseConfigured,
  firebaseMessage,
  forgetLinkEmail,
  isCancelled,
  recallLinkEmail,
  rememberLinkEmail,
} from "@/lib/firebase";
import { exchange } from "@/lib/session";
import { displayUrl, isSlug, liveUrl } from "@/lib/slug";
import { PASSWORD_MIN } from "@/lib/types";
import { LinkIcon } from "@/lib/icons";
import { ThemeSwitch } from "./AppHeader";
import { PasswordField } from "./PasswordField";
import { ICON, Icon } from "./ui";

type Mode = "in" | "up";

/** What the one identifier field leads to. The email link is a button below. */
type Method = "password" | "phone";

/** Digits, spaces, brackets, dots or dashes, optionally after a "+": a phone number. */
function looksLikePhone(value: string): boolean {
  const v = value.trim();
  return /^\+?[\d\s().-]{6,}$/.test(v) && (v.match(/\d/g)?.length ?? 0) >= 6;
}

/** Where the flow is. "choose" is the form; everything else is a step after it. */
type Step =
  | { kind: "choose" }
  | { kind: "verify-email"; email: string; canResend: boolean }
  | { kind: "reset-sent"; email: string }
  | { kind: "link-sent"; email: string }
  | { kind: "link-start" }
  | { kind: "link-email" }
  | { kind: "phone-code"; phone: string }
  | { kind: "handle" };

/* ── the sign-in screen ───────────────────────────────────────────────────
   Two halves on a wide screen: what Facet makes, drawn as a stack of pages
   that turns with the pointer, and the form. A phone gets the form alone —
   the showcase is decoration, and a phone's first screen is for the fields.

   Firebase does the proving — Google, GitHub, a password, an email link or a
   phone code — and `exchange()` trades the ID token it issues for a FACET
   session. A person Firebase knows but FACET does not is asked for a name
   and handle (the "handle" step) before the account is made.
   ──────────────────────────────────────────────────────────────────────── */

export function SignIn() {
  const router = useRouter();
  const reduced = useReducedMotion();

  const [mode, setMode] = useState<Mode>("in");
  const [step, setStep] = useState<Step>({ kind: "choose" });

  /** One field takes an email or a phone number; what was typed decides the flow. */
  const [email, setEmail] = useState("");
  const phone = email;
  /** The email-link section's own address — never the main field's. */
  const [linkEmail, setLinkEmail] = useState("");
  const linkEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(linkEmail.trim());
  const method: Method = looksLikePhone(email) ? "phone" : "password";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  /** The pending phone sign-in, between sending the code and typing it. */
  const confirmation = useRef<ConfirmationResult | null>(null);
  const recaptcha = useRef<RecaptchaVerifier | null>(null);

  /** The new password checked against the Firebase project's live policy. */
  const [policy, setPolicy] = useState<PasswordStatus | null>(null);
  const policyCheck = useRef(0);

  /**
   * Validate as the person types, against the rules Firebase will enforce —
   * read from the project, so a changed minimum or maximum shows here with no
   * code change. Only the latest keystroke's answer is kept.
   */
  function checkPassword(value: string, forMode: Mode = mode) {
    if (forMode !== "up" || !firebaseConfigured) return;
    const ticket = ++policyCheck.current;
    validatePassword(firebaseAuth(), value)
      .then((status) => {
        if (ticket === policyCheck.current) setPolicy(status);
      })
      .catch(() => {
        // Offline: fall back to the strength meter; Firebase still enforces.
      });
  }

  const mismatch = mode === "up" && confirmPassword.length > 0 && password !== confirmPassword;
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

  /** The API names the offending field on a 422; show it where it happened. */
  const fieldError = (field: string) => (error instanceof ApiError ? error.fieldError(field) : null);
  const formError = error && !fieldError("name") && !fieldError("handle") ? messageFor(error) : null;

  /* ── the one way out of Firebase and into FACET ─────────────────────── */

  /**
   * Trade this Firebase sign-in for a FACET session. Firebase's own sign-in
   * is dropped once FACET has one: its token is in memory only, and nothing
   * after this page needs it.
   */
  async function finish(user: User, newAccount?: { name: string; handle: string }) {
    try {
      await exchange(await user.getIdToken(), newAccount);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "handle_required") {
        // Firebase knows them; FACET does not yet. Keep the Firebase sign-in
        // in memory for the second call.
        const suggested = caught.details.name;
        if (typeof suggested === "string" && !name) setName(suggested);
        setStep({ kind: "handle" });
        return;
      }
      if (caught instanceof ApiError && caught.code === "email_unverified") {
        setStep({ kind: "verify-email", email: user.email ?? email, canResend: true });
        return;
      }
      throw caught;
    }
    await firebaseSignOut(firebaseAuth()).catch(() => {});
    router.push("/");
  }

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (caught) {
      if (isCancelled(caught)) return;
      const friendly = firebaseMessage(caught);
      setError(friendly ? new Error(friendly) : (caught as Error));
    } finally {
      setBusy(false);
    }
  }

  /* ── an email link, opened ──────────────────────────────────────────── */

  // When this page is the one an email link opened, finish that sign-in.
  // Every state change here happens after an await, never in the effect body.
  useEffect(() => {
    if (!firebaseConfigured) return;
    const href = window.location.href;
    const auth = firebaseAuth();
    if (!isSignInWithEmailLink(auth, href)) return;

    const remembered = recallLinkEmail();
    void (async () => {
      if (!remembered) {
        // Opened on another device or browser: ask which address it was.
        await Promise.resolve();
        setStep({ kind: "link-email" });
        return;
      }
      await run(async () => {
        const result = await signInWithEmailLink(auth, remembered, href);
        forgetLinkEmail();
        window.history.replaceState(null, "", "/signin");
        await finish(result.user);
      });
    })();
    // Runs once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── the actions ────────────────────────────────────────────────────── */

  function withProvider(kind: "google" | "github") {
    return run(async () => {
      const provider = kind === "google" ? new GoogleAuthProvider() : new GithubAuthProvider();
      if (provider instanceof GoogleAuthProvider) provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(firebaseAuth(), provider);
      await finish(result.user);
    });
  }

  function submitPassword() {
    return run(async () => {
      const auth = firebaseAuth();
      if (mode === "up") {
        // Checked against the project's live policy first, so the message can
        // name the rule that failed rather than just "not strong enough".
        const unmet = policyProblems(await validatePassword(auth, password));
        if (unmet) throw new Error(unmet);
        const created = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await sendEmailVerification(created.user, { url: `${window.location.origin}/signin` });
        await firebaseSignOut(auth);
        setStep({ kind: "verify-email", email: email.trim(), canResend: false });
        return;
      }
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (!result.user.emailVerified) {
        // The API would refuse it; say why without the round trip.
        setStep({ kind: "verify-email", email: email.trim(), canResend: true });
        return;
      }
      await finish(result.user);
    });
  }

  function resetPassword() {
    if (!email.trim()) {
      setError(new Error("Enter your email address first."));
      return;
    }
    return run(async () => {
      await sendPasswordResetEmail(firebaseAuth(), email.trim(), {
        url: `${window.location.origin}/signin`,
      });
      setStep({ kind: "reset-sent", email: email.trim() });
    });
  }

  function resendVerification() {
    return run(async () => {
      const user = firebaseAuth().currentUser;
      if (!user) throw new Error("Sign in again to get a new link.");
      await sendEmailVerification(user, { url: `${window.location.origin}/signin` });
      await firebaseSignOut(firebaseAuth());
      setStep((s) => (s.kind === "verify-email" ? { ...s, canResend: false } : s));
    });
  }

  /** Open the email-link section: one field, one button, nothing else. */
  function openLinkSection() {
    setError(null);
    setStep({ kind: "link-start" });
  }

  function sendLink() {
    const address = linkEmail.trim();
    return run(async () => {
      await sendSignInLinkToEmail(firebaseAuth(), address, {
        url: emailLinkReturnUrl(),
        handleCodeInApp: true,
      });
      rememberLinkEmail(address);
      setStep({ kind: "link-sent", email: address });
    });
  }

  function completeLink() {
    return run(async () => {
      const href = window.location.href;
      const result = await signInWithEmailLink(firebaseAuth(), linkEmail.trim(), href);
      forgetLinkEmail();
      window.history.replaceState(null, "", "/signin");
      await finish(result.user);
    });
  }

  function sendCode() {
    return run(async () => {
      const auth = firebaseAuth();
      // Invisible: Firebase asks for a challenge only when it suspects a bot.
      recaptcha.current?.clear();
      recaptcha.current = new RecaptchaVerifier(auth, "recaptcha-anchor", { size: "invisible" });
      const number = phone.replace(/[\s()-]/g, "");
      confirmation.current = await signInWithPhoneNumber(auth, number, recaptcha.current);
      setCode("");
      setStep({ kind: "phone-code", phone: number });
    });
  }

  function confirmCode() {
    return run(async () => {
      if (!confirmation.current) throw new Error("Ask for a new code.");
      const result = await confirmation.current.confirm(code.trim());
      recaptcha.current?.clear();
      recaptcha.current = null;
      await finish(result.user);
    });
  }

  function claimHandle() {
    return run(async () => {
      const user = firebaseAuth().currentUser;
      if (!user) {
        setStep({ kind: "choose" });
        throw new Error("That sign-in expired. Please sign in again.");
      }
      await finish(user, { name: name.trim(), handle: handle.trim().toLowerCase() });
    });
  }

  function back() {
    // After an inbox step the account exists (or the person asked to sign
    // in), so "Back to sign in" lands on Sign in, not on the form they left.
    if (step.kind === "verify-email" || step.kind === "reset-sent" || step.kind === "link-sent") {
      setMode("in");
      setConfirmPassword("");
    }
    setStep({ kind: "choose" });
    setError(null);
    setCode("");
    void firebaseSignOut(firebaseAuth()).catch(() => {});
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!firebaseConfigured) return;
    switch (step.kind) {
      case "handle":
        return claimHandle();
      case "phone-code":
        return confirmCode();
      case "link-start":
        return sendLink();
      case "link-email":
        return completeLink();
      case "choose":
        return method === "phone" ? sendCode() : submitPassword();
      default:
        return;
    }
  }

  /* ── what to say ────────────────────────────────────────────────────── */

  const passwordReady =
    email.trim().length > 3 &&
    (mode === "in"
      ? password.length > 0
      : (policy ? policy.isValid : password.length >= PASSWORD_MIN) &&
        password === confirmPassword);

  const ready = (() => {
    switch (step.kind) {
      case "handle":
        return isSlug(handle);
      case "phone-code":
        return code.trim().length >= 6;
      case "link-start":
      case "link-email":
        return linkEmailValid;
      case "choose":
        if (method === "phone") return phone.replace(/\D/g, "").length >= 8;
        return passwordReady;
      default:
        return false;
    }
  })();

  const copy: Record<Step["kind"], { title: string; lede: string; action?: string }> = {
    choose: {
      title: mode === "in" ? "Welcome back" : "Create your account",
      lede:
        mode === "in"
          ? "Sign in to edit, publish and share your pages."
          : "One page per role you play — a header, then as many sections as you need.",
      action:
        method === "password"
          ? mode === "in"
            ? "Sign in"
            : "Create account"
          : "Text me a code",
    },
    "verify-email": {
      title: "Check your inbox",
      lede: `We sent a link to ${"email" in step ? step.email : ""}. Open it to confirm the address, then come back and sign in.`,
    },
    "reset-sent": {
      title: "Check your inbox",
      lede: `If ${"email" in step ? step.email : ""} has an account, a link to choose a new password is on its way.`,
    },
    "link-sent": {
      title: "Check your inbox",
      lede: `We sent a sign-in link to ${"email" in step ? step.email : ""}. Open it on this device to sign in — no password needed.`,
    },
    "link-start": {
      title: mode === "up" ? "Create account with email" : "Sign in with email",
      lede: "We’ll email you a one-time link. Open it on this device and you’re in — no password to remember.",
      action: mode === "up" ? "Create account" : "Email me a sign-in link",
    },
    "link-email": {
      title: "Confirm your email",
      lede: "This link was opened somewhere other than where it was asked for. Enter the address it was sent to.",
      action: "Sign in",
    },
    "phone-code": {
      title: "Enter the code",
      lede: `We texted a six-digit code to ${"phone" in step ? step.phone : ""}.`,
      action: "Verify",
    },
    handle: {
      title: "One last thing",
      lede: "Pick the address your pages will live at. You can change your name later.",
      action: "Create my account",
    },
  };
  const { title, lede, action } = copy[step.kind];
  const waiting = step.kind === "verify-email" || step.kind === "reset-sent" || step.kind === "link-sent";

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
            {step.kind === "choose" && (
              <ModeTabs
                value={mode}
                reduced={!!reduced}
                onChange={(next) => {
                  setMode(next);
                  checkPassword(password, next);
                  setConfirmPassword("");
                  setError(null);
                }}
              />
            )}

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step.kind}
                initial={reduced ? { opacity: 0 } : { opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, x: -18 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                {step.kind !== "choose" && (
                  <span
                    aria-hidden
                    className="mb-4 grid h-11 w-11 place-items-center rounded-xl"
                    style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
                  >
                    {waiting || step.kind === "link-start" ? (
                      <Icon d={<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>} size={19} />
                    ) : (
                      <Icon d={<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>} size={19} />
                    )}
                  </span>
                )}
                <h1 id="signin-title" className="m-0 text-[26px] leading-[1.15] font-semibold tracking-[-0.02em]">
                  {title}
                </h1>
                <p className="text-muted mt-2 mb-6 text-[14px] leading-relaxed">{lede}</p>

                {!firebaseConfigured && (
                  <Alert>Sign-in is not set up on this build: the NEXT_PUBLIC_FIREBASE_* values are missing.</Alert>
                )}



                {!waiting && (
                  <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
                    {step.kind === "handle" && (
                      <>
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

                        <div className="field">
                          <label htmlFor="handle">Handle</label>
                          {/* Asked for before the account exists because it is the base
                              of every page the account will publish. Leaving it until
                              /account is what let accounts exist with no address. */}
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
                      </>
                    )}

                    {(step.kind === "link-start" || step.kind === "link-email") && (
                      <div className="field">
                        <label htmlFor="link-email">Email</label>
                        <input
                          id="link-email"
                          className="input"
                          type="email"
                          value={linkEmail}
                          onChange={(e) => setLinkEmail(e.target.value)}
                          autoComplete="email"
                          autoCapitalize="none"
                          spellCheck={false}
                          placeholder="you@example.com"
                          autoFocus
                          required
                        />
                      </div>
                    )}

                    {step.kind === "choose" && (
                      <div className="field">
                        <label htmlFor="email">Email or phone number</label>
                        <input
                          id="email"
                          className="input"
                          type="text"
                          inputMode="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          autoComplete="username"
                          autoCapitalize="none"
                          spellCheck={false}
                          placeholder="you@example.com or +91 98450 12345"
                          aria-describedby={method === "phone" ? "identifier-note" : undefined}
                          required
                        />
                        {step.kind === "choose" && method === "phone" && (
                          <FieldNote
                            id="identifier-note"
                            error={null}
                            hint="We’ll text a six-digit code to this number. Include the country code."
                          />
                        )}
                      </div>
                    )}

                    {step.kind === "choose" && method === "password" && (
                      <div className="field">
                        <label htmlFor="password">Password</label>
                        <PasswordField
                          id="password"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            checkPassword(e.target.value);
                          }}
                          autoComplete={mode === "in" ? "current-password" : "new-password"}
                          required
                        />
                        {mode === "up" &&
                          (policy ? (
                            <PolicyChecklist status={policy} touched={password.length > 0} length={password.length} />
                          ) : (
                            <Strength password={password} />
                          ))}
                        {mode === "in" && (
                          <button
                            type="button"
                            className="mt-2 ml-auto block cursor-pointer text-[12.5px] text-muted underline-offset-2 hover:underline"
                            style={{ color: "var(--color-neutral-700)" }}
                            onClick={() => void resetPassword()}
                          >
                            Forgot password?
                          </button>
                        )}
                      </div>
                    )}

                    {step.kind === "choose" && method === "password" && mode === "up" && (
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
                            confirmPassword && !mismatch ? (
                              <span className="inline-flex items-center gap-1" style={{ color: "var(--color-ink)" }}>
                                <Icon d={ICON.check} size={13} /> Matches
                              </span>
                            ) : null
                          }
                        />
                      </div>
                    )}

                    {step.kind === "phone-code" && (
                      <div className="field">
                        <label htmlFor="code">Verification code</label>
                        <input
                          id="code"
                          className="input text-center font-mono text-[20px] tracking-[0.35em]"
                          value={code}
                          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          autoComplete="one-time-code"
                          inputMode="numeric"
                          placeholder="000000"
                          autoFocus
                          required
                        />
                      </div>
                    )}

                    <AnimatePresence initial={false}>
                      {formError && (
                        <motion.div key="error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                          <Alert>{formError}</Alert>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.button
                      className="btn btn-primary btn-block"
                      type="submit"
                      style={{ minHeight: 44 }}
                      whileTap={reduced ? undefined : { scale: 0.98 }}
                      disabled={busy || !ready || !firebaseConfigured}
                    >
                      {busy && <Spinner />}
                      {busy ? "Working…" : action}
                    </motion.button>

                    {step.kind === "choose" && method === "password" && mode === "up" && !ready && password && (
                      <p className="m-0 -mt-1.5 text-center text-[12.5px] text-muted" aria-live="polite">
                        {policy && !policy.isValid
                          ? "Meet every password rule above to continue."
                          : confirmPassword !== password
                            ? "Type the same password twice to continue."
                            : "Add your email to continue."}
                      </p>
                    )}

                    {/* The invisible reCAPTCHA Firebase needs for phone sign-in
                        anchors here. */}
                    <div id="recaptcha-anchor" />
                  </form>
                )}

                {step.kind === "choose" && (
                  <>
                    <div className="my-5 flex items-center gap-3 text-[12px] text-muted" aria-hidden>
                      <span className="h-px flex-1" style={{ background: "var(--color-divider)" }} />
                      or continue with
                      <span className="h-px flex-1" style={{ background: "var(--color-divider)" }} />
                    </div>
                    {/* Three across from `sm`; below it, Google and GitHub share a row
                        and the email link takes its own, so no label is squeezed. */}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <ProviderButton
                        label="Continue with Google"
                        disabled={busy || !firebaseConfigured}
                        onClick={() => void withProvider("google")}
                      >
                        <GoogleMark /> Google
                      </ProviderButton>
                      <ProviderButton
                        label="Continue with GitHub"
                        disabled={busy || !firebaseConfigured}
                        onClick={() => void withProvider("github")}
                      >
                        <GitHubMark /> GitHub
                      </ProviderButton>
                      <ProviderButton
                        className="col-span-2 sm:col-span-1"
                        label="Use an email link instead — no password"
                        disabled={busy || !firebaseConfigured}
                        onClick={openLinkSection}
                      >
                        <Icon d={<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>} size={17} />
                        Email link
                      </ProviderButton>
                    </div>
                  </>
                )}

                {waiting && formError && <Alert>{formError}</Alert>}

                {step.kind === "verify-email" && step.canResend && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-block"
                    style={{ minHeight: 44 }}
                    disabled={busy}
                    onClick={() => void resendVerification()}
                  >
                    {busy && <Spinner />}
                    Send the link again
                  </button>
                )}

                {step.kind !== "choose" && (
                  <div className="mt-6 pt-5 text-center text-[13.5px]" style={{ borderTop: "1px solid var(--color-divider)" }}>
                    <button className="cursor-pointer font-medium underline underline-offset-2" type="button" onClick={back}>
                      {waiting
                        ? "Back to sign in"
                        : step.kind === "link-start"
                          ? mode === "up"
                            ? "Use another way to sign up"
                            : "Use another way to sign in"
                          : "Use a different account"}
                    </button>
                  </div>
                )}
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

type PasswordStatus = Awaited<ReturnType<typeof validatePassword>>;

/**
 * The password rules, read at a glance and then in one sentence.
 *
 * A row of chips — one per rule the project's policy sets — fills solid ink
 * as each is met, so the state is visible without reading. Under it, one
 * line says exactly what to do next ("Add a number and a symbol."), which is
 * the part a person actually acts on; a list of five equal rows made them
 * read all five to find it. Length breaking its limit replaces that line
 * with the error itself, character count included. Firebase leaves a rule
 * undefined when the policy does not set it, and such a rule is left out.
 *
 * The chips are decoration for sighted readers (`aria-hidden`); the sentence
 * is the live region, so a screen reader hears what is missing, once.
 */
function PolicyChecklist({
  status,
  touched,
  length,
}: {
  status: PasswordStatus;
  touched: boolean;
  length: number;
}) {
  const rules = status.passwordPolicy.customStrengthOptions;
  const min = rules.minPasswordLength;
  const max = rules.maxPasswordLength;
  const lengthOk = status.meetsMinPasswordLength !== false && status.meetsMaxPasswordLength !== false;

  const chips: Array<{ key: string; label: string; met: boolean | undefined; ask: string }> = [
    {
      key: "length",
      label: min && max ? `${min}–${max} characters` : min ? `${min}+ characters` : `Up to ${max} characters`,
      met: min || max ? lengthOk : undefined,
      ask: min && max ? `${min} to ${max} characters` : min ? `at least ${min} characters` : `at most ${max} characters`,
    },
    { key: "upper", label: "Uppercase", met: status.containsUppercaseLetter, ask: "an uppercase letter" },
    { key: "lower", label: "Lowercase", met: status.containsLowercaseLetter, ask: "a lowercase letter" },
    { key: "number", label: "Number", met: status.containsNumericCharacter, ask: "a number" },
    { key: "symbol", label: "Symbol", met: status.containsNonAlphanumericCharacter, ask: "a symbol like ! @ # %" },
  ].filter((chip) => chip.met !== undefined);

  const tooLong = touched && status.meetsMaxPasswordLength === false;
  const short = Math.max(0, (min ?? 0) - length);
  const more = `${short} more character${short === 1 ? "" : "s"}`;
  const missing = chips.filter((chip) => !chip.met && chip.key !== "length").map((chip) => chip.ask);
  const sentence = tooLong
    ? `Too long — ${length} characters. The limit is ${max}.`
    : !touched
      ? "Use a mix of letters, numbers and a symbol."
      : status.isValid
        ? "Strong password."
        : status.meetsMinPasswordLength === false && missing.length === 0
          ? `Keep going — ${more}.`
          : `Add ${joinWords(status.meetsMinPasswordLength === false ? [...missing, more] : missing)}.`;
  const state = tooLong ? "error" : status.isValid && touched ? "ok" : "todo";

  return (
    <div className="mt-2.5">
      <ul aria-hidden className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {chips.map((chip) => {
          const broken = chip.key === "length" && tooLong;
          const on = !!chip.met && touched;
          return (
            <motion.li
              key={chip.key}
              initial={false}
              animate={{ scale: on ? [1, 1.06, 1] : 1 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex items-center gap-1 rounded-full px-2.5 text-[12px] font-medium transition-colors duration-200"
              style={{
                minHeight: 26,
                background: on ? "var(--color-ink)" : "transparent",
                color: on ? "var(--color-bg)" : broken ? "var(--color-alert)" : "var(--color-neutral-700)",
                boxShadow: on
                  ? "none"
                  : broken
                    ? "inset 0 0 0 1.5px var(--color-alert)"
                    : "inset 0 0 0 1px var(--color-divider)",
              }}
            >
              {on ? (
                <Icon d={ICON.check} size={12} />
              ) : broken ? (
                <Icon d={<><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></>} size={12} />
              ) : null}
              {chip.label}
              {chip.key === "length" && touched && (
                <span className="tabular-nums" style={{ opacity: 0.7 }}>
                  · {length}
                </span>
              )}
            </motion.li>
          );
        })}
      </ul>
      <p
        aria-live="polite"
        className={`m-0 mt-2 flex items-center gap-1.5 text-[12.5px] ${state === "todo" ? "" : "font-medium"}`}
        style={{
          color:
            state === "error" ? "var(--color-alert)" : state === "ok" ? "var(--color-ink)" : "var(--color-neutral-700)",
        }}
      >
        {state === "error" && (
          <Icon d={<><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></>} size={14} />
        )}
        {state === "ok" && <Icon d={ICON.check} size={14} />}
        {sentence}
      </p>
    </div>
  );
}

/** "a, b and c" — the way the next-step line reads aloud. */
function joinWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/**
 * What a password is missing, in the Firebase project's own terms, or null
 * when it passes. Firebase leaves a check undefined when the policy does not
 * ask for it, so only an explicit `false` counts.
 */
function policyProblems(status: PasswordStatus): string | null {
  if (status.isValid) return null;
  const rules = status.passwordPolicy.customStrengthOptions;
  const missing = [
    status.meetsMinPasswordLength === false && `at least ${rules.minPasswordLength} characters`,
    status.meetsMaxPasswordLength === false && `no more than ${rules.maxPasswordLength} characters`,
    status.containsUppercaseLetter === false && "an uppercase letter",
    status.containsLowercaseLetter === false && "a lowercase letter",
    status.containsNumericCharacter === false && "a number",
    status.containsNonAlphanumericCharacter === false && "a symbol such as ! @ # or %",
  ].filter(Boolean);
  return missing.length
    ? `Your password needs ${missing.join(", ")}.`
    : "That password does not meet this site’s password rules.";
}

/**
 * Sign in / Create account, as two tabs across the card's full width with
 * one ink underline that travels between them. It is the box's one primary
 * choice, so it is drawn as the box's heading row.
 */
function ModeTabs({
  value,
  onChange,
  reduced,
}: {
  value: Mode;
  onChange: (next: Mode) => void;
  reduced: boolean;
}) {
  const tabs: Array<{ id: Mode; label: string }> = [
    { id: "in", label: "Sign in" },
    { id: "up", label: "Create account" },
  ];
  return (
    <div
      role="tablist"
      aria-label="Account"
      className="mb-7 grid grid-cols-2"
      style={{ boxShadow: "inset 0 -1px 0 var(--color-divider)" }}
    >
      {tabs.map((tab) => {
        const on = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(tab.id)}
            className="relative cursor-pointer pb-3 text-[14.5px] font-medium transition-colors"
            style={{ color: on ? "var(--color-ink)" : "var(--color-neutral-600)", minHeight: 44 }}
          >
            {tab.label}
            {on && (
              <motion.span
                layoutId="signin-mode-underline"
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full"
                style={{ background: "var(--color-ink)" }}
                transition={reduced ? { duration: 0 } : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The form's one error line, told by an icon and words rather than colour. */
function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13.5px] leading-snug"
      style={{
        background: "var(--color-surface)",
        border: "1px solid color-mix(in srgb, var(--color-ink) 40%, transparent)",
      }}
    >
      <span className="mt-px flex-none">
        <Icon d={<><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></>} size={16} />
      </span>
      {children}
    </div>
  );
}

function ProviderButton({
  children,
  label,
  className = "",
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  className?: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`btn btn-secondary btn-block min-w-0 justify-center gap-1.5 whitespace-nowrap ${className}`}
      // Three across a phone-width box: the label and its mark have to fit
      // in a third of it, so the side padding is the button's, not the
      // system's roomier default.
      style={{ minHeight: 44, paddingInline: 8 }}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/* The two brand marks the buttons need, drawn in the ink like every other
   glyph in the app. Google's "G" is Simple Icons' path (CC0); GitHub's is the
   one `icons.tsx` already carries for links. */
const GOOGLE_PATH =
  "M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z";

function GoogleMark() {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" aria-hidden focusable="false" className="flex-none">
      <path d={GOOGLE_PATH} fill="currentColor" />
    </svg>
  );
}

function GitHubMark() {
  return <LinkIcon id="github" size={17} />;
}
