import Link from "next/link";
import { RequestThreadView } from "@/components/RequestThreadView";

type ThreadPageProps = {
  params: Promise<{ id: string }>;
};

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
        Request thread
      </h1>
      <p className="mt-2 text-slate-600">
        Share exact meet-up location and time here. Only you and the accepted
        helper can see this chat.
      </p>
      <RequestThreadView requestId={id} />
    </div>
  );
}
