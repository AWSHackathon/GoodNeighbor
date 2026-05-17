/**
 * Neighborhood leaderboard types (docs/PLAN.md#leaderboard).
 */

export type LeaderboardPeriod = "all" | "week";

export interface LeaderboardEntry {
  rank: number;
  userSub: string;
  displayName: string;
  requestsCompleted: number;
  hoursContributed: number;
}

export interface LeaderboardResponse {
  neighborhood: string;
  neighborhoodLabel: string;
  period: LeaderboardPeriod;
  /** ISO week id when period is week, e.g. 2026-W20 */
  weekId?: string;
  entries: LeaderboardEntry[];
  updatedAt: string;
}

export interface LeaderboardQuery {
  neighborhood: string;
  period?: LeaderboardPeriod;
}

/** Written on fulfill — server aggregates into LEADER#ALL / LEADER#WEEK items. */
export interface ContributionRecord {
  userSub: string;
  neighborhood: string;
  requestId: string;
  hoursContributed: number;
  fulfilledAt: string;
}
