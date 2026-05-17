/**
 * Leaderboard sort/pagination — mirrored from lib/leaderboard/paginate.ts for Lambda bundle.
 */

export interface LeaderboardRow {
  userSub: string;
  displayName: string;
  requestsCompleted: number;
  hoursContributed: number;
}

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

const PAGE_SIZE = 10;
const MAX_PAGES = 10;

export function sortLeaderboardRows<T extends LeaderboardRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (b.hoursContributed !== a.hoursContributed) {
      return b.hoursContributed - a.hoursContributed;
    }
    return b.requestsCompleted - a.requestsCompleted;
  });
}

export function parseLeaderboardPage(
  raw: string | null | undefined,
): number {
  if (raw == null || raw.trim() === "") return 1;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

export function parseLeaderboardLimit(
  raw: string | null | undefined,
): number {
  if (raw == null || raw.trim() === "") return PAGE_SIZE;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return PAGE_SIZE;
  return Math.min(n, PAGE_SIZE);
}

export function paginateLeaderboardEntries(
  sorted: LeaderboardRow[],
  options: { page?: number; limit?: number; maxPages?: number } = {},
): { entries: LeaderboardEntry[]; pagination: LeaderboardPagination } {
  const limit = options.limit ?? PAGE_SIZE;
  const maxPages = options.maxPages ?? MAX_PAGES;
  const totalCount = sorted.length;
  const uncappedPages =
    totalCount === 0 ? 0 : Math.ceil(totalCount / limit);
  const totalPages = Math.min(uncappedPages, maxPages);

  let page = options.page ?? 1;
  if (totalPages === 0) {
    page = 1;
  } else if (page > totalPages) {
    page = totalPages;
  } else if (page < 1) {
    page = 1;
  }

  const start = (page - 1) * limit;
  const slice = sorted.slice(start, start + limit);

  const entries: LeaderboardEntry[] = slice.map((row, index) => ({
    rank: start + index + 1,
    userSub: row.userSub,
    displayName: row.displayName,
    requestsCompleted: row.requestsCompleted,
    hoursContributed: row.hoursContributed,
  }));

  return {
    entries,
    pagination: {
      page,
      pageSize: limit,
      totalCount,
      totalPages,
      hasNext: totalPages > 0 && page < totalPages,
      hasPrevious: totalPages > 0 && page > 1,
    },
  };
}
