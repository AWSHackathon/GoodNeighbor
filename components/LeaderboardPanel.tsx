"use client";

import { useCallback, useEffect, useState } from "react";
import { getLeaderboard } from "@/lib/api/client";
import { getIdToken } from "@/lib/auth/session";
import { getMockLeaderboard } from "@/lib/leaderboard/mockData";
import { normalizeLeaderboardResponse } from "@/lib/leaderboard/paginate";
import type {
  LeaderboardPeriod,
  LeaderboardResponse,
} from "@/lib/types/leaderboard";
import { LEADERBOARD_PAGE_SIZE } from "@/lib/types/leaderboard";

type LeaderboardPanelProps = {
  neighborhood: string;
  neighborhoodLabel: string;
  refreshKey: number;
};

const PERIOD_OPTIONS: { value: LeaderboardPeriod; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "week", label: "This week" },
];

export function LeaderboardPanel({
  neighborhood,
  neighborhoodLabel,
  refreshKey,
}: LeaderboardPanelProps) {
  const [period, setPeriod] = useState<LeaderboardPeriod>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [usingMock, setUsingMock] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [neighborhood, period, refreshKey]);

  const load = useCallback(async () => {
    const nh =
      !neighborhood || neighborhood === "unknown"
        ? "capitol-hill"
        : neighborhood;

    if (!neighborhood || neighborhood === "unknown") {
      setData(
        getMockLeaderboard(nh, period, page, LEADERBOARD_PAGE_SIZE),
      );
      setUsingMock(true);
      return;
    }

    try {
      const token = await getIdToken();
      const apiData = await getLeaderboard(token, {
        neighborhood,
        period,
        page,
        limit: LEADERBOARD_PAGE_SIZE,
      });
      setData(
        normalizeLeaderboardResponse(
          {
            ...apiData,
            neighborhoodLabel:
              neighborhoodLabel || apiData.neighborhoodLabel,
          },
          page,
          LEADERBOARD_PAGE_SIZE,
        ),
      );
      setUsingMock(false);
    } catch {
      setData(
        getMockLeaderboard(neighborhood, period, page, LEADERBOARD_PAGE_SIZE),
      );
      setUsingMock(true);
    }
  }, [neighborhood, neighborhoodLabel, period, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const display = normalizeLeaderboardResponse(
    data ??
      getMockLeaderboard(
        neighborhood && neighborhood !== "unknown"
          ? neighborhood
          : "capitol-hill",
        period,
        page,
        LEADERBOARD_PAGE_SIZE,
      ),
    page,
    LEADERBOARD_PAGE_SIZE,
  );

  const { pagination } = display;

  return (
    <section className="flex h-full min-h-0 flex-col border-t border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
            Leaderboard
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            {display.neighborhoodLabel}
          </h2>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span className="sr-only">Time period</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as LeaderboardPeriod)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto px-4 py-2 sm:px-6">
          {display.entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No contributions yet. Fulfill a request to appear here.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Rank</th>
                  <th className="py-2 pr-4">Neighbor</th>
                  <th className="py-2 pr-4 text-right">Requests</th>
                  <th className="py-2 text-right">Hours</th>
                </tr>
              </thead>
              <tbody>
                {display.entries.map((row) => (
                  <tr
                    key={`${period}-${row.userSub}`}
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="py-2.5 pr-4 font-medium text-slate-900">
                      {row.rank}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-800">
                      {row.displayName}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-slate-700">
                      {row.requestsCompleted}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-slate-700">
                      {row.hoursContributed.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {pagination.totalCount > 0 ? (
          <nav
            className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 sm:px-6"
            aria-label="Leaderboard pagination"
          >
            <button
              type="button"
              disabled={!pagination.hasPrevious}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <div className="flex flex-wrap items-center justify-center gap-1">
              <span className="px-2 text-sm text-slate-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              {pagination.totalPages > 1 &&
                Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
                  (n) => (
                    <button
                      key={n}
                      type="button"
                      aria-current={n === pagination.page ? "page" : undefined}
                      onClick={() => setPage(n)}
                      className={`min-w-8 rounded px-2 py-1 text-sm font-medium ${
                        n === pagination.page
                          ? "bg-teal-600 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {n}
                    </button>
                  ),
                )}
            </div>
            <button
              type="button"
              disabled={!pagination.hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </nav>
        ) : null}

        <p className="shrink-0 px-4 pb-3 text-xs text-slate-500 sm:px-6">
          {period === "week" && display.weekId
            ? `Week ${display.weekId} · `
            : null}
          {pagination.totalCount > 0
            ? `${pagination.totalCount} neighbor${pagination.totalCount === 1 ? "" : "s"} ranked · `
            : null}
          {usingMock
            ? "Showing demo data until API is deployed"
            : "Updates when requests are fulfilled"}
        </p>
      </div>
    </section>
  );
}
