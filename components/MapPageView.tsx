"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CreateRequestForm } from "@/components/CreateRequestForm";
import { LeaderboardPanel } from "@/components/LeaderboardPanel";
import { RequestListPanel } from "@/components/RequestListPanel";
import { getProfileMe, putProfileMe } from "@/lib/api/client";
import { getIdToken } from "@/lib/auth/session";
import {
  collectRequestGeofenceKeys,
  coordinatesSignature,
  geofenceKeysSignature,
  geofenceLabel,
  resolveBrowseCenter,
  resolveLeaderboardGeofenceKey,
} from "@/lib/geofence";
import { filterRequestsNearby } from "@/lib/location/nearby";
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
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [extraGeofenceKeys, setExtraGeofenceKeys] = useState<string[]>([]);
  const [profileReady, setProfileReady] = useState(false);

  const browseCenter = useMemo(
    () => resolveBrowseCenter(profile, location, pickedPin, mapCenter),
    [
      profile?.lat,
      profile?.lng,
      location?.lat,
      location?.lng,
      pickedPin?.lat,
      pickedPin?.lng,
      mapCenter?.lat,
      mapCenter?.lng,
    ],
  );
  const geofenceKeys = useMemo(
    () =>
      collectRequestGeofenceKeys(
        profile,
        location,
        pickedPin,
        mapCenter,
        extraGeofenceKeys,
      ),
    [profile, location, pickedPin, mapCenter, extraGeofenceKeys],
  );
  const leaderboardGeofence = resolveLeaderboardGeofenceKey(profile, location);

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
      } finally {
        setProfileReady(true);
      }
    })();
  }, []);

  const handleLocationResolved = useCallback(
    async (resolved: ResolvedLocation, _mapCenter: Coordinates) => {
      setLocation(resolved);
      setMapCenter({ lat: resolved.lat, lng: resolved.lng });
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              locationSource: resolved.source,
              ...(resolved.source === "gps"
                ? { lat: resolved.lat, lng: resolved.lng }
                : { lat: undefined, lng: undefined }),
              ...(resolved.zipCode != null ? { zipCode: resolved.zipCode } : {}),
              ...(resolved.neighborhood != null
                ? { neighborhood: resolved.neighborhood }
                : {}),
            }
          : prev,
      );

      try {
        const token = await getIdToken();
        const patch: Partial<UserProfile> = {
          locationSource: resolved.source,
        };
        if (resolved.source === "gps") {
          patch.lat = resolved.lat;
          patch.lng = resolved.lng;
        }
        if (resolved.zipCode) patch.zipCode = resolved.zipCode;
        if (resolved.neighborhood) patch.neighborhood = resolved.neighborhood;
        await putProfileMe(token, patch);
      } catch {
        /* non-blocking persist */
      }
    },
    [],
  );

  const handleCreated = useCallback(
    (created: PublicHelpRequest, postedAt: Coordinates) => {
      setPickMode(false);
      const withOwn: PublicHelpRequest = { ...created, isOwn: true };
      if (created.geofence) {
        setExtraGeofenceKeys((prev) =>
          prev.includes(created.geofence!) ? prev : [...prev, created.geofence!],
        );
      }
      setRequests((prev) => {
        const merged = [withOwn, ...prev.filter((r) => r.id !== created.id)];
        return filterRequestsNearby(
          merged,
          resolveBrowseCenter(profile, location, postedAt, mapCenter),
        );
      });
      refreshRequests();
    },
    [profile, location, mapCenter, refreshRequests],
  );

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
            Click the map to place your request pin, then post — only an approximate area is shown.
          </p>
          <div className="mt-4 min-h-0 flex-1">
            <NeighborhoodMap
              profile={profile}
              profileReady={profileReady}
              requests={requests}
              onLocationResolved={handleLocationResolved}
              onRequestsChange={setRequests}
              onRequestsError={setRequestsError}
              onRequestsLoadingChange={setRequestsLoading}
              geofenceKeys={geofenceKeys}
              geofenceKeysSignature={geofenceKeysSignature(geofenceKeys)}
              nearbyCenterSignature={coordinatesSignature(browseCenter)}
              nearbyCenter={browseCenter}
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
              requests={requests}
              browseCenter={browseCenter}
              loading={requestsLoading}
              error={requestsError}
              refreshKey={refreshKey}
              onRefresh={refreshRequests}
            />
          </div>
        </section>
      </div>

      <div className="h-[min(50vh,28rem)] min-h-64 shrink-0">
        <LeaderboardPanel
          neighborhood={leaderboardGeofence}
          neighborhoodLabel={geofenceLabel(profile, leaderboardGeofence)}
          refreshKey={refreshKey}
        />
      </div>
    </div>
  );
}
