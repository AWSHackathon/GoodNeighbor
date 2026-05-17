import type {
  LeaderboardEntry,
  LeaderboardPeriod,
} from "@/lib/types/leaderboard";

const ALL_TIME: LeaderboardEntry[] = [
  {
    rank: 1,
    userSub: "u1",
    displayName: "Jordan K.",
    requestsCompleted: 24,
    hoursContributed: 41.5,
  },
  {
    rank: 2,
    userSub: "u2",
    displayName: "Sam R.",
    requestsCompleted: 19,
    hoursContributed: 36,
  },
  {
    rank: 3,
    userSub: "u3",
    displayName: "Alex M.",
    requestsCompleted: 15,
    hoursContributed: 28.5,
  },
];

const WEEKLY: LeaderboardEntry[] = [
  {
    rank: 1,
    userSub: "u2",
    displayName: "Sam R.",
    requestsCompleted: 4,
    hoursContributed: 8,
  },
  {
    rank: 2,
    userSub: "u4",
    displayName: "Taylor P.",
    requestsCompleted: 3,
    hoursContributed: 6.5,
  },
  {
    rank: 3,
    userSub: "u1",
    displayName: "Jordan K.",
    requestsCompleted: 2,
    hoursContributed: 4,
  },
];

const NEIGHBORHOOD_LABELS: Record<string, string> = {
  "capitol-hill": "Capitol Hill",
  "ballard": "Ballard",
  "west-seattle": "West Seattle",
};

export function getMockLeaderboard(
  neighborhood: string,
  period: LeaderboardPeriod,
) {
  return {
    neighborhood,
    neighborhoodLabel:
      NEIGHBORHOOD_LABELS[neighborhood] ?? neighborhood.replace(/-/g, " "),
    period,
    weekId: period === "week" ? "2026-W20" : undefined,
    entries: period === "week" ? WEEKLY : ALL_TIME,
    updatedAt: new Date().toISOString(),
  };
}
