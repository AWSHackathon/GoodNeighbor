import { getProfileMe } from "@/lib/api/client";
import { getIdToken } from "@/lib/auth/session";
import type { UserProfileWithMetrics } from "@/lib/types/domain";

/** Load or create the signed-in user's DynamoDB profile. */
export async function ensureUserProfile(): Promise<UserProfileWithMetrics> {
  const token = await getIdToken();
  return getProfileMe(token);
}
