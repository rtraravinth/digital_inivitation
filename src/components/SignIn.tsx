"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, messageFor } from "@/lib/api";
import { completeTwoStep, register, signIn } from "@/lib/session";
import { PASSWORD_MIN } from "@/lib/types";
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
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

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
        await register(email.trim(), password, name.trim());
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
          </>
        )}

        {error && !fieldError("email") && !fieldError("password") && !fieldError("name") && (
          <p
            className="border-l-2 py-2 pl-3 text-[13px]"
            style={{ borderColor: "var(--color-accent)" }}
            role="alert"
          >
            {messageFor(error)}
          </p>
        )}

        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
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
