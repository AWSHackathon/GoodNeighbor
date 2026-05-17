import { defineAuth } from "@aws-amplify/backend";

/**
 * Cognito User Pool + Identity Pool (guest + authenticated).
 * Google OAuth is configured in Phase 1 via Hosted UI secrets.
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
});
