/**
 * Leaderboard API client (GET /leaderboard).
 */

import type {
  LeaderboardPeriod,
  LeaderboardResponse,
} from "@/lib/types/leaderboard";

const NOT_CONFIGURED =
  "API base URL not configured. Set NEXT_PUBLIC_API_URL after Phase 1 deploy.";

function getApiBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) throw new Error(NOT_CONFIGURED);
  return base.replace(/\/$/, "");
}

export async function getLeaderboard(
  authToken: string,
  neighborhood: string,
  period: LeaderboardPeriod = "all",
): Promise<LeaderboardResponse> {
  const params = new URLSearchParams({
    neighborhood,
    period,
  });
  const res = await fetch(`${getApiBaseUrl()}/leaderboard?${params}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<LeaderboardResponse>;
}
