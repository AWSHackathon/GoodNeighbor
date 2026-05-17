"use client";

import { getCurrentUser, signOut } from "aws-amplify/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getProfileMe } from "@/lib/api/client";
import { getIdToken } from "@/lib/auth/session";

export function UserMenu() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        await getCurrentUser();
        setSignedIn(true);
        try {
          const token = await getIdToken();
          const profile = await getProfileMe(token);
          setDisplayName(profile.displayName);
        } catch {
          setDisplayName(null);
        }
      } catch {
        setSignedIn(false);
        setDisplayName(null);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  if (checking) {
    return <span className="text-sm text-slate-400">…</span>;
  }

  if (!signedIn) {
    return (
      <Link href="/login" className="text-slate-500 hover:text-slate-700">
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {displayName ? (
        <span className="hidden text-sm text-slate-600 sm:inline">
          {displayName}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="text-slate-500 hover:text-slate-700"
      >
        Sign out
      </button>
    </div>
  );
}
