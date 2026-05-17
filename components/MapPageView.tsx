"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { CreateRequestForm } from "@/components/CreateRequestForm";
import { LeaderboardPanel } from "@/components/LeaderboardPanel";
import { RequestListPanel } from "@/components/RequestListPanel";
import { getProfileMe, putProfileMe } from "@/lib/api/client";
import { getIdToken } from "@/lib/auth/session";
import { geofenceLabel, resolveGeofenceKey } from "@/lib/geofence";
import type { ResolvedLocation } from "@/lib/location/resolve";
import type { Coordinates, PublicHelpRequest, UserProfile } from "@/lib/types/domain";

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

export function MapPageView() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [location, setLocation] = useState<ResolvedLocation | null>(null);
  const [mapCenter, setMapCenter] = useState<Coordinates | null>(null);
  const [pickedPin, setPickedPin] = useState<Coordinates | null>(null);
  const [pickMode, setPickMode] = useState(false);
  const [requests, setRequests] = useState<PublicHelpRequest[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const geofence = resolveGeofenceKey(profile, location, pickedPin ?? mapCenter);

  const refreshRequests = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const token = await getIdToken();
        const p = await getProfileMe(token);
        setProfile(p);
      } catch {
        /* profile loads on login */
      }
    })();
  }, []);

  const handleLocationResolved = useCallback(
    async (resolved: ResolvedLocation) => {
      setLocation(resolved);
      const center = { lat: resolved.lat, lng: resolved.lng };
      setMapCenter(center);
      setPickedPin(center);

      try {
        const token = await getIdToken();
        const updated = await putProfileMe(token, {
          lat: resolved.lat,
          lng: resolved.lng,
          zipCode: resolved.zipCode,
          neighborhood: resolved.neighborhood,
        });
        setProfile(updated);
      } catch {
        /* non-blocking */
      }
    },
    [],
  );

  const handleCreated = useCallback(() => {
    setPickMode(false);
    refreshRequests();
  }, [refreshRequests]);

  const requestLocation = pickedPin ?? mapCenter;

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
            Click the map to place a pin, then post your request. Neighbors only
            see an approximate area.
          </p>
          <div className="mt-4 min-h-0 flex-1">
            <NeighborhoodMap
              requests={requests}
              onLocationResolved={handleLocationResolved}
              onRequestsChange={setRequests}
              onRequestsError={setRequestsError}
              geofence={geofence}
              refreshKey={refreshKey}
              pinPickEnabled={pickMode}
              pickedPin={pickedPin}
              onPickPin={setPickedPin}
            />
          </div>
        </section>

        <section className="flex min-h-0 flex-col border-b border-slate-200 p-6 lg:border-b-0">
          <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
            Requests
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Neighborhood help
          </h2>
          {requestsError && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              API: {requestsError}. Sign out and back in after sandbox redeploy, then
              restart dev.
            </p>
          )}
          <div className="mt-4 shrink-0">
            <CreateRequestForm
              location={requestLocation}
              pickMode={pickMode}
              onOpenChange={setPickMode}
              onCreated={handleCreated}
            />
          </div>
          <div className="mt-4 min-h-0 flex-1 overflow-hidden">
            <RequestListPanel
              geofence={geofence}
              refreshKey={refreshKey}
              onRefresh={refreshRequests}
            />
          </div>
        </section>
      </div>

      <div className="h-[min(50vh,28rem)] min-h-64 shrink-0">
        <LeaderboardPanel
          neighborhood={geofence}
          neighborhoodLabel={geofenceLabel(profile, geofence)}
          refreshKey={refreshKey}
        />
      </div>
    </div>
  );
}
