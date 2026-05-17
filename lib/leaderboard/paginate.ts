import {
  LEADERBOARD_MAX_PAGES,
  LEADERBOARD_PAGE_SIZE,
  type LeaderboardEntry,
  type LeaderboardPagination,
  type LeaderboardPeriod,
  type LeaderboardResponse,
  type LeaderboardRow,
} from "@/lib/types/leaderboard";

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
  if (raw == null || raw.trim() === "") return LEADERBOARD_PAGE_SIZE;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return LEADERBOARD_PAGE_SIZE;
  return Math.min(n, LEADERBOARD_PAGE_SIZE);
}

export function paginateLeaderboardEntries(
  sorted: LeaderboardRow[],
  options: {
    page?: number;
    limit?: number;
    maxPages?: number;
  } = {},
): { entries: LeaderboardEntry[]; pagination: LeaderboardPagination } {
  const limit = options.limit ?? LEADERBOARD_PAGE_SIZE;
  const maxPages = options.maxPages ?? LEADERBOARD_MAX_PAGES;
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

/** Ensures pagination exists (legacy APIs returned all entries in one response). */
export function normalizeLeaderboardResponse(
  raw: LeaderboardResponse & { pagination?: LeaderboardPagination },
  page: number,
  limit: number = LEADERBOARD_PAGE_SIZE,
): LeaderboardResponse {
  if (raw.pagination) {
    return {
      ...raw,
      entries: raw.entries ?? [],
      pagination: raw.pagination,
    };
  }

  const rows: LeaderboardRow[] = (raw.entries ?? []).map((entry) => ({
    userSub: entry.userSub,
    displayName: entry.displayName,
    requestsCompleted: entry.requestsCompleted,
    hoursContributed: entry.hoursContributed,
  }));
  const { entries, pagination } = paginateLeaderboardEntries(
    sortLeaderboardRows(rows),
    { page, limit },
  );

  return {
    neighborhood: raw.neighborhood,
    neighborhoodLabel: raw.neighborhoodLabel,
    period: raw.period as LeaderboardPeriod,
    weekId: raw.weekId,
    entries,
    pagination,
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}
