"use client";

import { useMemo, useState } from "react";
import { getMockLeaderboard } from "@/lib/leaderboard/mockData";
import type { LeaderboardPeriod } from "@/lib/types/leaderboard";

type LeaderboardPanelProps = {
  /** Geofence id from profile / location resolution; changing this refetches rows. */
  neighborhood: string;
};

const PERIOD_OPTIONS: { value: LeaderboardPeriod; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "week", label: "This week" },
];

export function LeaderboardPanel({ neighborhood }: LeaderboardPanelProps) {
  const [period, setPeriod] = useState<LeaderboardPeriod>("all");

  const data = useMemo(
    () => getMockLeaderboard(neighborhood, period),
    [neighborhood, period],
  );

  return (
    <section className="flex h-full min-h-0 flex-col border-t border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
            Leaderboard
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            {data.neighborhoodLabel}
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

      <div className="min-h-0 flex-1 overflow-auto px-4 py-2 sm:px-6">
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
            {data.entries.map((row) => (
              <tr
                key={`${period}-${row.userSub}`}
                className="border-b border-slate-50 last:border-0"
              >
                <td className="py-2.5 pr-4 font-medium text-slate-900">
                  {row.rank}
                </td>
                <td className="py-2.5 pr-4 text-slate-800">{row.displayName}</td>
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
        <p className="mt-3 pb-3 text-xs text-slate-500">
          {period === "week" && data.weekId
            ? `Week ${data.weekId} · `
            : null}
          Updates when you change neighborhood — Phase 6 API
        </p>
      </div>
    </section>
  );
}
