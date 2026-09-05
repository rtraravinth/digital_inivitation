"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, messageFor } from "@/lib/api";
import { completeTwoStep, register, signIn } from "@/lib/session";
import { PAGE_DOMAIN, PASSWORD_MIN, pageAddress } from "@/lib/types";
import { PasswordField } from "./PasswordField";

type Mode = "in" | "up";

/** Set once the password step passed and a second factor is outstanding. */
type Challenge = { token: string; email: string };

export function SignIn() {
  const router = useRouter();

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
  const signUpReady =
    password.length >= PASSWORD_MIN && password === confirmPassword;

  /** The API names the offending field on a 422; show it where it happened. */
  const fieldError = (field: string) =>
    error instanceof ApiError ? error.fieldError(field) : null;

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

  return (
    <main className="mx-auto w-full max-w-[420px] px-6 py-16">
      <p className="mono-label">Facet</p>
      <h1 className="mt-2 text-[32px] leading-[1.1] font-extrabold">
        {challenge ? "One more step" : mode === "in" ? "Sign in" : "Create an account"}
      </h1>
      <p className="text-muted mt-3 text-[14px]">
        {challenge
          ? `Enter the six-digit code from your authenticator app for ${challenge.email}. A recovery code works too.`
          : mode === "in"
            ? "Your portfolios, on every device you sign in from."
            : "One page with a header and as many sections as you need."}
      </p>

      <hr className="hr" />

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {challenge ? (
          <div className="field">
            <label htmlFor="code">Verification code</label>
            <input
              id="code"
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              inputMode="text"
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
                {fieldError("name") && (
                  <p className="mt-1 text-[12px]" style={{ color: "var(--color-accent)" }}>
                    {fieldError("name")}
                  </p>
                )}
              </div>
            )}

            {mode === "up" && (
              <div className="field">
                <label htmlFor="handle">Your Handle</label>
                {/* Asked for here because it is the base of every page this
                    account will publish. Leaving it until /account is what
                    let accounts exist with no address at all. */}
                <div className="flex items-center">
                  <span className="text-muted shrink-0 pr-1 text-sm">{PAGE_DOMAIN}/</span>
                  <input
                    id="handle"
                    className="input"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    autoComplete="username"
                    placeholder="your-name"
                    required
                  />
                </div>
                {fieldError("handle") ? (
                  <p className="mt-1 text-[12px]" style={{ color: "var(--color-accent)" }}>
                    {fieldError("handle")}
                  </p>
                ) : (
                  <p className="text-muted mt-1 text-[12px]">
                    Lowercase letters, numbers and hyphens. Your pages live under it —{" "}
                    <strong>
                      {pageAddress(handle.trim().toLowerCase() || "your-name", "your-page")}
                    </strong>.
                  </p>
                )}
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
                required
              />
              {fieldError("email") && (
                <p className="mt-1 text-[12px]" style={{ color: "var(--color-accent)" }}>
                  {fieldError("email")}
                </p>
              )}
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
              {mode === "up" && !fieldError("password") && (
                <p className="text-muted mt-1 text-[12px]">
                  At least {PASSWORD_MIN} characters. A passphrase is easier to
                  remember and harder to guess.
                </p>
              )}
              {fieldError("password") && (
                <p className="mt-1 text-[12px]" style={{ color: "var(--color-accent)" }}>
                  {fieldError("password")}
                </p>
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
                {mismatch && (
                  <p className="mt-1 text-[12px]" style={{ color: "var(--color-accent)" }}>
                    Those two do not match.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {error &&
          !fieldError("email") &&
          !fieldError("password") &&
          !fieldError("name") &&
          !fieldError("handle") && (
          <p
            className="border-l-2 py-2 pl-3 text-[13px]"
            style={{ borderColor: "var(--color-accent)" }}
            role="alert"
          >
            {messageFor(error)}
          </p>
        )}

        <button
          className="btn btn-primary btn-block"
          type="submit"
          disabled={busy || (mode === "up" && !challenge && !signUpReady)}
        >
          {busy
            ? "Working…"
            : challenge
              ? "Verify"
              : mode === "in"
                ? "Sign in"
                : "Create account"}
        </button>
      </form>

      <hr className="hr" />

      {challenge ? (
        <button
          className="btn btn-ghost"
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
        <p className="text-muted text-[13px]">
          {mode === "in" ? "No account yet?" : "Already have one?"}{" "}
          <button
            className="underline"
            type="button"
            style={{ color: "var(--color-ink)" }}
            onClick={() => {
              setMode(mode === "in" ? "up" : "in");
              // Sign-in has no second field, so a confirmation left over from
              // an abandoned sign-up would block the button on the way back.
              setConfirmPassword("");
              setError(null);
            }}
          >
            {mode === "in" ? "Create one" : "Sign in"}
          </button>
        </p>
      )}
    </main>
  );
}
