import { getProfileMe } from "@/lib/api/client";
import { getIdToken } from "@/lib/auth/session";
import type { UserProfile } from "@/lib/types/domain";

/** Load or create the signed-in user's DynamoDB profile. */
export async function ensureUserProfile(): Promise<UserProfile> {
  const token = await getIdToken();
  return getProfileMe(token);
}
