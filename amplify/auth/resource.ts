import { defineAuth, secret } from "@aws-amplify/backend";
import type { AmplifyAuthProps } from "@aws-amplify/backend-auth";
import { authCallbackUrls, authLogoutUrls } from "./urls";

type ExternalProviders = NonNullable<
  AmplifyAuthProps["loginWith"]["externalProviders"]
>;

/**
 * Cognito User Pool + Hosted UI (Google primary, email secondary).
 * Set secrets before sandbox: npx ampx sandbox secret set GOOGLE_CLIENT_ID
 */
const externalProviders = {
  google: {
    clientId: secret("GOOGLE_CLIENT_ID"),
    clientSecret: secret("GOOGLE_CLIENT_SECRET"),
    // Required so Cognito receives email (pool requires email attribute).
    scopes: ["openid", "email", "profile"],
    attributeMapping: {
      email: "email",
      givenName: "given_name",
      familyName: "family_name",
    },
  },
  // Required at runtime for Google OAuth; omitted from factory TS types.
  domainPrefix: "good-neighbor-hack2026",
  callbackUrls: authCallbackUrls(),
  logoutUrls: authLogoutUrls(),
} as ExternalProviders;

export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders,
  },
  userAttributes: {
    email: {
      required: true,
      mutable: true,
    },
    fullname: {
      required: false,
      mutable: true,
    },
  },
});
