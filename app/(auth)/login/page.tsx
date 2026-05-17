import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
      <p className="mt-2 text-slate-600">
        Sign in with Google or your email to help neighbors near you.
      </p>
      <div className="mt-8">
        <Suspense
          fallback={
            <p className="text-center text-sm text-slate-500">Loading…</p>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
