/**
 * Leaderboard API client (GET /leaderboard).
 */

import type {
  LeaderboardPeriod,
  LeaderboardResponse,
} from "@/lib/types/leaderboard";

import { resolveLocalMockApiBaseUrl } from "@/lib/api/config";

export async function getLeaderboard(
  authToken: string,
  neighborhood: string,
  period: LeaderboardPeriod = "all",
  page = 1,
  limit = 10,
): Promise<LeaderboardResponse> {
  const params = new URLSearchParams({
    neighborhood,
    period,
    page: String(page),
    limit: String(limit),
  });
  const res = await fetch(
    `${resolveLocalMockApiBaseUrl()}/leaderboard?${params}`,
    {
      headers: { Authorization: `Bearer ${authToken}` },
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<LeaderboardResponse>;
}
