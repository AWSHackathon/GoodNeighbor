"use client";

import { fetchAuthSession } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";

function oauthErrorMessage(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "Google sign-in failed. Please try again.";
  }
  const err = (data as { error?: unknown }).error;
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Google sign-in failed. Please try again.";
}

function isRecoverableSessionError(data: unknown): boolean {
  const message = oauthErrorMessage(data);
  return message.includes("Unable to get user session following successful sign-in");
}

let completedOAuthCode: string | null = null;

/** Wait for Cognito to exchange ?code=... on /login, then run onSuccess. */
export function waitForOAuthRedirect(
  oauthCode: string,
  onSuccess: () => void | Promise<void>,
  onFailure: (message: string) => void,
): () => void {
  if (completedOAuthCode === oauthCode) {
    void onSuccess();
    return () => {};
  }

  let settled = false;

  const trySuccess = async (): Promise<boolean> => {
    if (settled) return true;
    try {
      const session = await fetchAuthSession();
      if (!session.tokens?.idToken) return false;
      settled = true;
      completedOAuthCode = oauthCode;
      await onSuccess();
      return true;
    } catch {
      return false;
    }
  };

  const unsub = Hub.listen("auth", ({ payload }) => {
    if (
      payload.event === "signInWithRedirect" ||
      payload.event === "signedIn"
    ) {
      void trySuccess();
    }
    if (payload.event === "signInWithRedirect_failure") {
      void (async () => {
        // Amplify may emit failure after tokens are cached; check session first.
        if (await trySuccess()) return;
        // Cookie write can lag behind Hub failure on local http — keep polling.
        if (isRecoverableSessionError(payload.data)) return;
        if (!settled) {
          settled = true;
          onFailure(oauthErrorMessage(payload.data));
        }
      })();
    }
  });

  void (async () => {
    for (let i = 0; i < 60 && !settled; i++) {
      if (await trySuccess()) return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!settled) {
      settled = true;
      onFailure("Sign-in timed out. Please try again.");
    }
  })();

  return unsub;
}
