"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { getProfileMe, putProfileMe } from "@/lib/api/client";
import { getIdToken } from "@/lib/auth/session";
import { geofenceLabel } from "@/lib/geofence";
import type { UserProfileWithMetrics } from "@/lib/types/domain";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function ProfilePageView() {
  const [profile, setProfile] = useState<UserProfileWithMetrics | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const data = await getProfileMe(token);
      setProfile(data);
      setDisplayName(data.displayName);
      setNeighborhood(data.neighborhood ?? "");
      setZipCode(data.zipCode ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const token = await getIdToken();
      const updated = await putProfileMe(token, {
        displayName: displayName.trim(),
        neighborhood: neighborhood.trim() || undefined,
        zipCode: zipCode.trim() || undefined,
      });
      setProfile(updated);
      setDisplayName(updated.displayName);
      setNeighborhood(updated.neighborhood ?? "");
      setZipCode(updated.zipCode ?? "");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-slate-600">Loading profile…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-red-600">{error ?? "Profile unavailable"}</p>
      </div>
    );
  }

  const metrics = profile.usageMetrics;
  const nh = profile.neighborhoodContribution;
  const nhLabel = nh ? geofenceLabel(profile, nh.neighborhood) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Your profile</h1>
        <p className="mt-1 text-sm text-slate-600">
          Account details and your activity in Good Neighbor.
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-medium text-slate-900">Account</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <p className="mt-1 text-sm text-slate-600">{profile.email}</p>
            </div>
            <div>
              <label
                htmlFor="displayName"
                className="block text-sm font-medium text-slate-700"
              >
                Display name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                required
              />
            </div>
            <p className="text-xs text-slate-500">
              Member since {formatDate(profile.createdAt)}
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-medium text-slate-900">Location</h2>
          <p className="mt-1 text-sm text-slate-600">
            Map pin and precise coordinates are updated on the{" "}
            <Link href="/map" className="font-medium text-teal-600 hover:text-teal-700">
              Map
            </Link>{" "}
            page.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="neighborhood"
                className="block text-sm font-medium text-slate-700"
              >
                Neighborhood
              </label>
              <input
                id="neighborhood"
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="e.g. Capitol Hill"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label
                htmlFor="zipCode"
                className="block text-sm font-medium text-slate-700"
              >
                ZIP code
              </label>
              <input
                id="zipCode"
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="e.g. 98102"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>
        </section>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="text-sm text-teal-700" role="status">
            Profile saved.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>

      <section>
        <h2 className="text-lg font-medium text-slate-900">Your activity</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <MetricCard label="Requests posted" value={metrics.requestsPosted} />
          <MetricCard
            label="Responses offered"
            value={metrics.responsesSubmitted}
          />
          <MetricCard label="Helps completed" value={metrics.helpsCompleted} />
          <MetricCard
            label="Hours contributed"
            value={metrics.hoursContributed}
            hint={
              metrics.lastActiveAt
                ? `Last active ${formatDate(metrics.lastActiveAt)}`
                : undefined
            }
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">
          In your neighborhood
        </h2>
        {nh ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-slate-600">
              Contribution in{" "}
              <span className="font-medium text-slate-800">{nhLabel}</span>{" "}
              (leaderboard geofence: {nh.neighborhood})
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium text-slate-700">All time</h3>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  <li>Requests completed: {nh.allTime.requestsCompleted}</li>
                  <li>Hours contributed: {nh.allTime.hoursContributed}</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-700">
                  This week ({nh.thisWeek.weekId})
                </h3>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  <li>Requests completed: {nh.thisWeek.requestsCompleted}</li>
                  <li>Hours contributed: {nh.thisWeek.hoursContributed}</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            Set your neighborhood or ZIP on the Map or above to see local
            contribution stats.
          </p>
        )}
      </section>
    </div>
  );
}
