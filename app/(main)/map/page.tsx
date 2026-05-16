import Link from "next/link";

export default function MapPage() {
  return (
    <div className="grid min-h-[calc(100vh-73px)] grid-cols-1 lg:grid-cols-2">
      <section className="flex flex-col items-center justify-center border-b border-slate-200 bg-slate-100 p-8 lg:border-b-0 lg:border-r">
        <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
          Map
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">
          Your neighborhood
        </h2>
        <p className="mt-2 max-w-sm text-center text-slate-600">
          Pins show an approximate area (buffer zone), not exact addresses —
          Amazon Location map — Phase 4+
        </p>
        <div className="mt-8 h-48 w-full max-w-md rounded-xl border-2 border-dashed border-slate-300 bg-slate-200/50" />
      </section>

      <section className="flex flex-col p-8">
        <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
          Requests
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">
          Neighborhood help
        </h2>
        <p className="mt-2 text-slate-600">
          Create a request with an optional meeting-place hint. Respond to
          others; accept one helper to open a private thread for exact meet-up
          details.
        </p>
        <ul className="mt-8 space-y-3">
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
        <p className="mt-6 text-xs text-slate-500">
          Demo thread route:{" "}
          <Link
            href="/requests/sample-id/thread"
            className="font-medium text-teal-700 hover:underline"
          >
            /requests/[id]/thread
          </Link>
        </p>
      </section>
    </div>
  );
}
