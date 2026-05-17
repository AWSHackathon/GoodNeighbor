"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { LeaderboardPanel } from "@/components/LeaderboardPanel";

const NeighborhoodMap = dynamic(
  () =>
    import("@/components/NeighborhoodMap").then((m) => m.NeighborhoodMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[280px] items-center justify-center rounded-xl bg-slate-100">
        <p className="text-sm text-slate-600">Loading map…</p>
      </div>
    ),
  },
);

/** Phase 4: from profile / location resolution. Stub id for demo leaderboard. */
const DEMO_NEIGHBORHOOD = "capitol-hill";

export function MapPageView() {
  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <section className="flex min-h-0 flex-col border-b border-slate-200 p-4 lg:border-b-0 lg:border-r lg:p-6">
          <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
            Map
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Your neighborhood
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Powered by Amazon Location Service. Pins show an approximate area
            (buffer zone), not exact addresses.
          </p>
          <div className="mt-4 min-h-0 flex-1">
            <NeighborhoodMap />
          </div>
        </section>

        <section className="flex flex-col border-b border-slate-200 p-6 lg:border-b-0">
          <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
            Requests
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Neighborhood help
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Create a request, respond, accept one helper, then coordinate in a
            private thread.
          </p>
          <ul className="mt-6 space-y-2">
            {[
              "Sample: Need groceries pickup · ~400m area pin",
              "Sample: Yard work · meet near community garden",
            ].map((item) => (
              <li
                key={item}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
              >
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            <Link
              href="/requests/sample-id/thread"
              className="font-medium text-teal-700 hover:underline"
            >
              /requests/[id]/thread
            </Link>
          </p>
        </section>
      </div>

      <div className="h-[min(50vh,28rem)] min-h-64 shrink-0">
        <LeaderboardPanel neighborhood={DEMO_NEIGHBORHOOD} />
      </div>
    </div>
  );
}
