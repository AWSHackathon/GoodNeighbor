"use client";

import "aws-amplify/auth/enable-oauth-listener";
import { Amplify } from "aws-amplify";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import { CookieStorage, parseAmplifyConfig } from "aws-amplify/utils";
import outputs from "@/amplify_outputs.json";
import { hasAmplifyGeo } from "@/lib/map/config";

function isAuthDeployed(config: unknown): boolean {
  const poolId = (config as { auth?: { user_pool_id?: string } }).auth
    ?.user_pool_id;
  return Boolean(poolId && !poolId.includes("REPLACE"));
}

function createAuthCookieStorage(): CookieStorage {
  // Default CookieStorage uses secure: true; browsers reject those cookies on http://localhost.
  return new CookieStorage({
    sameSite: "lax",
    secure: window.location.protocol === "https:",
  });
}

let configured = false;

/** Configure Amplify once on the client before OAuth callback handling runs. */
export function configureAmplifyClient(): void {
  if (configured || typeof window === "undefined") return;

  if (isAuthDeployed(outputs) || hasAmplifyGeo(outputs)) {
    Amplify.configure(
      parseAmplifyConfig(outputs as Parameters<typeof parseAmplifyConfig>[0]),
      { ssr: true },
    );
    cognitoUserPoolsTokenProvider.setKeyValueStorage(createAuthCookieStorage());
    configured = true;
  }
}

configureAmplifyClient();
