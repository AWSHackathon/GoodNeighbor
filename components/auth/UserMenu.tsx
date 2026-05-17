"use client";

import { getCurrentUser, signOut } from "aws-amplify/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function UserMenu() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    void getCurrentUser()
      .then(() => setSignedIn(true))
      .catch(() => setSignedIn(false))
      .finally(() => setChecking(false));
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
    <button
      type="button"
      onClick={() => void handleSignOut()}
      className="text-slate-500 hover:text-slate-700"
    >
      Sign out
    </button>
  );
}
