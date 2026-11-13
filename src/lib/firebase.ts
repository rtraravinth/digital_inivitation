"use client";

/**
 * Firebase Authentication — the proving half of signing in.
 *
 * Firebase holds every credential: passwords, the Google and GitHub grants,
 * email links and phone codes. Once it has said who someone is, the ID token
 * it issues is traded once for a FACET session (`exchange()` in session.tsx)
 * and the Firebase sign-in is dropped.
 *
 * **In-memory persistence, on purpose.** Firebase's default keeps its own
 * refresh token in IndexedDB, where any injected script can read it — the
 * exact thing `api.ts` avoids by keeping FACET's refresh token in an httpOnly
 * cookie. Nothing of Firebase's outlives the sign-in page. That is also why
 * Google and GitHub use a popup, not a redirect: a redirect reloads the page
 * and an in-memory sign-in would not survive it.
 *
 * Only the sign-in page and the "reset password" button import this, so the
 * SDK is not in any other page's bundle.
 */

import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import {
  type Auth,
  browserPopupRedirectResolver,
  getAuth,
  inMemoryPersistence,
  initializeAuth,
} from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

/** False when the build was made without the four NEXT_PUBLIC_FIREBASE_ values. */
export const firebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId);

let auth: Auth | null = null;

/** The one Auth instance. Browser only — never call it during render on the server. */
export function firebaseAuth(): Auth {
  if (auth) return auth;
  if (!firebaseConfigured) {
    throw new Error("Sign-in is not set up on this build.");
  }

  const app: FirebaseApp = getApps().length ? getApp() : initializeApp(config);
  try {
    auth = initializeAuth(app, {
      persistence: inMemoryPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    // Already initialised — dev hot reload re-runs this module.
    auth = getAuth(app);
  }
  return auth;
}

/**
 * Where an email link sends the person back to.
 *
 * **Never name a query parameter `link` (or `deep_link_id`) here.** Firebase
 * reads `link` as a nested action URL — the Dynamic Links shape — so a
 * return address of `/signin?link=1` made it parse "1" as the sign-in link,
 * fail, and report the real link as not a sign-in link at all. The page then
 * sat on "Welcome back" with the person's sign-in unused.
 */
export function emailLinkReturnUrl(): string {
  return `${window.location.origin}/signin?via=email-link`;
}

/** The address an email link was sent to, kept for when the link is opened. */
const LINK_EMAIL_KEY = "facet.emailForSignIn";

export function rememberLinkEmail(email: string) {
  try {
    window.localStorage.setItem(LINK_EMAIL_KEY, email);
  } catch {
    // Private mode: the person is asked for the address when they return.
  }
}

export function recallLinkEmail(): string | null {
  try {
    return window.localStorage.getItem(LINK_EMAIL_KEY);
  } catch {
    return null;
  }
}

export function forgetLinkEmail() {
  try {
    window.localStorage.removeItem(LINK_EMAIL_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Firebase's error codes, as a sentence a person can act on. */
export function firebaseMessage(error: unknown): string | null {
  const code = (error as { code?: unknown })?.code;
  if (typeof code !== "string" || !code.startsWith("auth/")) return null;

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "Those details do not match an account.";
    case "auth/email-already-in-use":
      return "An account already uses that email. Sign in instead.";
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return "Choose a stronger password: at least 8 characters, with upper and lower case, a number and a symbol.";
    case "auth/account-exists-with-different-credential":
      return "That email already signs in another way. Use the method you used before.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "Could not reach the sign-in service. Check your connection.";
    case "auth/operation-not-allowed":
      return "That sign-in method is not turned on yet.";
    case "auth/unauthorized-domain":
      return "Sign-in is not allowed from this address. Add it under Firebase → Authentication → Authorised domains.";
    case "auth/invalid-phone-number":
      return "Enter the number with its country code, like +91 98450 12345.";
    case "auth/invalid-verification-code":
    case "auth/code-expired":
      return "That code is not right, or it has expired.";
    case "auth/billing-not-enabled":
      return "Phone sign-in needs the Firebase project on the Blaze plan.";
    case "auth/invalid-action-code":
    case "auth/expired-action-code":
      return "That link has expired or was already used. Ask for a new one.";
    case "auth/missing-email":
      return "Enter your email address.";
    default:
      return "Sign-in failed. Please try again.";
  }
}

/** A closed popup is the person changing their mind, not an error to show. */
export function isCancelled(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  return code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";
}
