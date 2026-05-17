"use client";

import {
  confirmSignUp,
  signIn,
  signInWithRedirect,
  signUp,
} from "aws-amplify/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { ensureUserProfile } from "@/lib/auth/profile";

type AuthMode = "signIn" | "signUp" | "confirm";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/map";

  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function finishSignIn() {
    await ensureUserProfile();
    router.push(nextPath);
  }

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    try {
      await signInWithRedirect({ provider: "Google" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setLoading(false);
    }
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "signUp") {
        await signUp({
          username: email.trim(),
          password,
          options: {
            userAttributes: {
              email: email.trim(),
              ...(displayName.trim()
                ? { name: displayName.trim() }
                : {}),
            },
          },
        });
        setMode("confirm");
        setLoading(false);
        return;
      }

      if (mode === "confirm") {
        await confirmSignUp({
          username: email.trim(),
          confirmationCode: confirmCode.trim(),
        });
        const result = await signIn({
          username: email.trim(),
          password,
        });
        if (result.isSignedIn) {
          await finishSignIn();
        }
        return;
      }

      const result = await signIn({
        username: email.trim(),
        password,
      });

      if (result.nextStep.signInStep === "CONFIRM_SIGN_UP") {
        setMode("confirm");
        setLoading(false);
        return;
      }

      if (result.isSignedIn) {
        await finishSignIn();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => void handleGoogle()}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-slate-500">or email</span>
        </div>
      </div>

      <form onSubmit={(e) => void handleEmailSubmit(e)} className="space-y-4">
        {mode === "signUp" && (
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Display name</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              autoComplete="name"
            />
          </label>
        )}

        <label className="block text-sm">
          <span className="font-medium text-slate-700">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            autoComplete="email"
          />
        </label>

        {mode !== "confirm" && (
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              autoComplete={
                mode === "signUp" ? "new-password" : "current-password"
              }
            />
          </label>
        )}

        {mode === "confirm" && (
          <label className="block text-sm">
            <span className="font-medium text-slate-700">
              Confirmation code
            </span>
            <input
              type="text"
              required
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              autoComplete="one-time-code"
            />
          </label>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
        >
          {loading
            ? "Please wait…"
            : mode === "signUp"
              ? "Create account"
              : mode === "confirm"
                ? "Confirm & sign in"
                : "Sign in with email"}
        </button>
      </form>

      <p className="text-center text-sm text-slate-600">
        {mode === "signIn" ? (
          <>
            New here?{" "}
            <button
              type="button"
              className="font-medium text-teal-700 hover:underline"
              onClick={() => setMode("signUp")}
            >
              Create account
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              className="font-medium text-teal-700 hover:underline"
              onClick={() => setMode("signIn")}
            >
              Sign in
            </button>
          </>
        )}
      </p>

      <p className="text-center text-xs text-slate-500">
        <Link href="/map" className="text-teal-600 hover:underline">
          Preview map without signing in
        </Link>{" "}
        (only when Cognito is not deployed)
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
