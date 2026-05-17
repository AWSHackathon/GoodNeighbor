/**
 * Neighborhood leaderboard types (docs/PLAN.md#leaderboard).
 */

export type LeaderboardPeriod = "all" | "week";

export const LEADERBOARD_PAGE_SIZE = 10;
export const LEADERBOARD_MAX_PAGES = 10;
export const LEADERBOARD_MAX_RECORDS =
  LEADERBOARD_PAGE_SIZE * LEADERBOARD_MAX_PAGES;

export interface LeaderboardEntry {
  rank: number;
  userSub: string;
  displayName: string;
  requestsCompleted: number;
  hoursContributed: number;
}

export interface LeaderboardPagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface LeaderboardResponse {
  neighborhood: string;
  neighborhoodLabel: string;
  period: LeaderboardPeriod;
  /** ISO week id when period is week, e.g. 2026-W20 */
  weekId?: string;
  entries: LeaderboardEntry[];
  pagination: LeaderboardPagination;
  updatedAt: string;
}

export interface LeaderboardQuery {
  neighborhood: string;
  period?: LeaderboardPeriod;
  page?: number;
  limit?: number;
}

/** Row shape before rank assignment (API / mock / seed). */
export interface LeaderboardRow {
  userSub: string;
  displayName: string;
  requestsCompleted: number;
  hoursContributed: number;
}

/** Written on fulfill — server aggregates into LEADER#ALL / LEADER#WEEK items. */
export interface ContributionRecord {
  userSub: string;
  neighborhood: string;
  requestId: string;
  hoursContributed: number;
  fulfilledAt: string;
}
