import {
  paginateLeaderboardEntries,
  sortLeaderboardRows,
} from "@/lib/leaderboard/paginate";
import type {
  LeaderboardPeriod,
  LeaderboardRow,
} from "@/lib/types/leaderboard";
import { LEADERBOARD_MAX_RECORDS } from "@/lib/types/leaderboard";

const NEIGHBORHOOD_LABELS: Record<string, string> = {
  "capitol-hill": "Capitol Hill",
  ballard: "Ballard",
  "west-seattle": "West Seattle",
};

const FIRST_NAMES = [
  "Alex",
  "Bob",
  "Casey",
  "Dana",
  "Ellis",
  "Finn",
  "Gray",
  "Harper",
  "Ivy",
  "Jordan",
  "Kai",
  "Logan",
  "Morgan",
  "Noah",
  "Parker",
  "Quinn",
  "Riley",
  "Sam",
  "Taylor",
  "Uma",
];

function buildMockPool(period: LeaderboardPeriod): LeaderboardRow[] {
  const rows: LeaderboardRow[] = [];
  for (let i = 0; i < LEADERBOARD_MAX_RECORDS; i++) {
    const rankIndex = LEADERBOARD_MAX_RECORDS - i;
    const baseHours = 5 + rankIndex * 0.45;
    const baseRequests = Math.max(1, Math.floor(rankIndex / 4));
    const scale = period === "week" ? 0.22 : 1;
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastInitial = String.fromCharCode(65 + (i % 26));
    rows.push({
      userSub: `mock-leader-${String(i + 1).padStart(3, "0")}`,
      displayName: `${first} ${lastInitial}.`,
      requestsCompleted: Math.max(1, Math.round(baseRequests * scale)),
      hoursContributed: Math.round(baseHours * scale * 10) / 10,
    });
  }
  return sortLeaderboardRows(rows);
}

const ALL_TIME_POOL = buildMockPool("all");
const WEEKLY_POOL = buildMockPool("week");

export function getMockLeaderboard(
  neighborhood: string,
  period: LeaderboardPeriod,
  page = 1,
  limit?: number,
) {
  const pool = period === "week" ? WEEKLY_POOL : ALL_TIME_POOL;
  const { entries, pagination } = paginateLeaderboardEntries(pool, {
    page,
    limit,
  });

  return {
    neighborhood,
    neighborhoodLabel:
      NEIGHBORHOOD_LABELS[neighborhood] ?? neighborhood.replace(/-/g, " "),
    period,
    weekId: period === "week" ? "2026-W20" : undefined,
    entries,
    pagination,
    updatedAt: new Date().toISOString(),
  };
}
