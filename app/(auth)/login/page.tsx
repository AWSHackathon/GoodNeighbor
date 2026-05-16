import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
      <p className="mt-2 text-slate-600">
        Sign in or create an account. AWS Cognito integration arrives in Phase 1.
      </p>

      <div className="mt-8 space-y-4">
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
          Sign in form (Cognito) — coming soon
        </div>
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
          Create account form — coming soon
        </div>
      </div>

      <Link
        href="/map"
        className="mt-6 flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Preview map (dev stub)
      </Link>

      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href="/" className="text-teal-600 hover:text-teal-700">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
