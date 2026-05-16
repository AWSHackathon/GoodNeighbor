import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <Logo size={80} showText={false} />
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900">
          Good Neighbor
        </h1>
        <p className="mt-3 text-lg text-slate-600">
          Help and get help in your neighborhood. Post requests on the map and
          respond when neighbors need a hand.
        </p>
        <Link
          href="/login"
          className="mt-10 inline-flex items-center justify-center rounded-xl bg-teal-600 px-8 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
        >
          Sign in
        </Link>
        <p className="mt-4 text-sm text-slate-500">
          Phase 0 — Cognito auth coming in Phase 1
        </p>
      </div>
    </main>
  );
}
