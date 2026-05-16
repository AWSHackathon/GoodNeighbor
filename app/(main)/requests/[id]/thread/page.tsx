import Link from "next/link";

type ThreadPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Private coordination after requester accepts a helper offer.
 * Exact address and meet-up time — not shown on the public map.
 */
export default async function RequestThreadPage({ params }: ThreadPageProps) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-lg p-8">
      <Link
        href="/map"
        className="text-sm font-medium text-teal-700 hover:text-teal-800"
      >
        ← Back to map
      </Link>
      <p className="mt-6 text-sm font-medium uppercase tracking-wide text-teal-700">
        Private coordination
      </p>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">
        Request {id}
      </h1>
      <p className="mt-2 text-slate-600">
        After you accept a neighbor&apos;s offer, this thread opens so you can
        confirm the exact meet-up location and time. Only you and the accepted
        helper can see messages here.
      </p>
      <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
        Thread UI and API — Phase 5 (
        <code className="text-xs">GET/POST /requests/:id/thread</code>)
      </div>
    </div>
  );
}
