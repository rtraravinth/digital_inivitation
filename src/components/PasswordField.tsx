"use client";

import { useState, type InputHTMLAttributes } from "react";

/**
 * A password input with hold-to-reveal.
 *
 * The characters show only while the eye is *held* — press and they appear,
 * let go and they are covered again. A toggle that stays on is the one that
 * leaves a password sitting uncovered on a screen its owner walked away from,
 * which is the thing the dots are there to prevent.
 *
 * Releasing is every way of letting go: pointer up, the pointer leaving the
 * button, the key coming back up, and the button losing focus.
 *
 * `type` is owned here and cannot be passed in — a password field that can be
 * handed `type="text"` is not a password field.
 */
export function PasswordField({
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [revealed, setRevealed] = useState(false);
  const hide = () => setRevealed(false);

  return (
    <span className="relative block">
      <input
        {...props}
        type={revealed ? "text" : "password"}
        className={`input pr-10 ${className}`.trim()}
      />
      <button
        type="button"
        // Not a form control and not a toggle: it reports what holding it does.
        aria-label={revealed ? "Password shown while held" : "Hold to show password"}
        className="text-neutral-600 absolute inset-y-0 right-0 flex w-9 cursor-pointer items-center justify-center"
        onPointerDown={() => setRevealed(true)}
        onPointerUp={hide}
        onPointerLeave={hide}
        onPointerCancel={hide}
        onKeyDown={(event) => {
          if (event.key === " " || event.key === "Enter") setRevealed(true);
        }}
        onKeyUp={hide}
        onBlur={hide}
      >
        {revealed ? <EyeOff /> : <Eye />}
      </button>
    </span>
  );
}

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Eye() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M1.8 12S5.4 5.4 12 5.4 22.2 12 22.2 12 18.6 18.6 12 18.6 1.8 12 1.8 12Z" {...STROKE} />
      <circle cx="12" cy="12" r="3.2" {...STROKE} />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M9.9 5.7A8.9 8.9 0 0 1 12 5.4c6.6 0 10.2 6.6 10.2 6.6a17 17 0 0 1-3 3.9" {...STROKE} />
      <path d="M6.3 6.5A16.7 16.7 0 0 0 1.8 12S5.4 18.6 12 18.6a9.4 9.4 0 0 0 4.1-.9" {...STROKE} />
      <path d="M9.8 9.9a3.2 3.2 0 0 0 4.4 4.4" {...STROKE} />
      <path d="M3.2 3.2 20.8 20.8" {...STROKE} />
    </svg>
  );
}
