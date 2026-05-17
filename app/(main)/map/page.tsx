import Link from "next/link";
import { LeaderboardPanel } from "@/components/LeaderboardPanel";

/** Phase 4: from profile / location resolution. Stub id for demo leaderboard. */
const DEMO_NEIGHBORHOOD = "capitol-hill";

export default function MapPage() {
  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <section className="flex flex-col items-center justify-center border-b border-slate-200 bg-slate-100 p-6 lg:border-b-0 lg:border-r">
          <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
            Map
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Your neighborhood
          </h2>
          <p className="mt-2 max-w-sm text-center text-sm text-slate-600">
            Pins show an approximate area (buffer zone), not exact addresses —
            Phase 4+
          </p>
          <div className="mt-6 h-40 w-full max-w-md rounded-xl border-2 border-dashed border-slate-300 bg-slate-200/50" />
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
