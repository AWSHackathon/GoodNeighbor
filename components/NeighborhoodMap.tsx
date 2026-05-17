"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import { listRequests } from "@/lib/api/client";
import { getUserSubFromIdToken } from "@/lib/auth/jwt";
import { getIdToken } from "@/lib/auth/session";
import { resolveUserDisplayPin } from "@/lib/location/displayPin";
import type { UserDisplayPin } from "@/lib/location/displayPin";
import {
  applyMapPinLayers,
  clearUserLocationLayer,
  createAmazonApiKeyMap,
  ensureMapLoaded,
} from "@/lib/map/amazonMap";
import { buildPinsFromRequests } from "@/lib/map/pins";
import {
  hasAmplifyGeo,
  isPlaceholderAmplifyOutputs,
  resolveApiKeyMapConfig,
  resolveMapConfig,
  type MapConfig,
} from "@/lib/map/config";
import {
  assertMapStyleAccess,
  assertMapTileAccess,
} from "@/lib/map/validateApiKey";
import {
  resolveLocationFromZip,
  resolveUserLocation,
  type ResolvedLocation,
} from "@/lib/location/resolve";
import type {
  Coordinates,
  PublicHelpRequest,
  UserProfile,
} from "@/lib/types/domain";

type MapStatus =
  | "loading"
  | "locating"
  | "ready"
  | "needs-location"
  | "needs-config"
  | "error";

const PIN_SOURCE_ID = "good-neighbor-requests";

type NeighborhoodMapProps = {
  profile?: UserProfile | null;
  geofence: string;
  refreshKey: number;
  requests: PublicHelpRequest[];
  pinPickEnabled?: boolean;
  pickedPin?: Coordinates | null;
  onPickPin?: (coords: Coordinates) => void;
  onLocationResolved?: (
    location: ResolvedLocation,
    displayPin: Coordinates,
  ) => void;
  onRequestsChange?: (requests: PublicHelpRequest[]) => void;
  onRequestsError?: (message: string | null) => void;
};

export function NeighborhoodMap({
  profile = null,
  geofence,
  refreshKey,
  requests,
  pinPickEnabled = false,
  pickedPin = null,
  onPickPin,
  onLocationResolved,
  onRequestsChange,
  onRequestsError,
}: NeighborhoodMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapReadyRef = useRef(false);
  const geofenceRef = useRef(geofence);
  const profileRef = useRef(profile);
  const onLocationResolvedRef = useRef(onLocationResolved);
  const onRequestsChangeRef = useRef(onRequestsChange);
  const onRequestsErrorRef = useRef(onRequestsError);
  const onPickPinRef = useRef(onPickPin);
  const pickedPinRef = useRef(pickedPin);
  const requestsRef = useRef(requests);
  const displayPinRef = useRef<UserDisplayPin | null>(null);
  const pinnedConfigRef = useRef<MapConfig | null>(null);
  const initInFlightRef = useRef(false);

  const [mapReady, setMapReady] = useState(false);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<ResolvedLocation | null>(null);
  const [displayPin, setDisplayPin] = useState<UserDisplayPin | null>(null);
  const [zipInput, setZipInput] = useState("");
  const [mapConfig, setMapConfig] = useState<MapConfig>({ mode: "none" });

  geofenceRef.current = geofence;
  profileRef.current = profile;
  onLocationResolvedRef.current = onLocationResolved;
  onRequestsChangeRef.current = onRequestsChange;
  onRequestsErrorRef.current = onRequestsError;
  onPickPinRef.current = onPickPin;
  pickedPinRef.current = pickedPin;
  requestsRef.current = requests;
  displayPinRef.current = displayPin;

  const refreshMapLayers = useCallback(
    (userPinOverride?: UserDisplayPin | null) => {
      const map = mapRef.current;
      if (!map || !mapReadyRef.current) return;

      const userPin = userPinOverride ?? displayPinRef.current;
      const draft = pickedPinRef.current;

      applyMapPinLayers(map, {
        requestPins: buildPinsFromRequests(requestsRef.current),
        requestSourceId: PIN_SOURCE_ID,
        userCoordinates: userPin ? [userPin.lng, userPin.lat] : null,
        draftCoordinates: draft ? [draft.lng, draft.lat] : null,
      });

      if (draft && map.loaded()) {
        map.easeTo({
          center: [draft.lng, draft.lat],
          duration: 400,
        });
      }
    },
    [],
  );

  useEffect(() => {
    refreshMapLayers();
  }, [requests, pickedPin, displayPin, refreshMapLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current || !pinPickEnabled) return;

    const canvas = map.getCanvas();
    canvas.style.cursor = "crosshair";

    const onClick = (e: MapMouseEvent) => {
      onPickPinRef.current?.({
        lat: e.lngLat.lat,
        lng: e.lngLat.lng,
      });
    };

    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
      canvas.style.cursor = "";
    };
  }, [pinPickEnabled, status]);

  const fetchRequests = useCallback(async (fence: string) => {
    if (!fence || fence === "unknown") {
      onRequestsChangeRef.current?.([]);
      onRequestsErrorRef.current?.(null);
      return;
    }
    try {
      const token = await getIdToken();
      const data = await listRequests(token, { geofence: fence });
      onRequestsChangeRef.current?.(data);
      onRequestsErrorRef.current?.(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not load requests";
      console.warn("Could not load map pins", message);
      onRequestsChangeRef.current?.([]);
      onRequestsErrorRef.current?.(message);
    }
  }, []);

  useEffect(() => {
    if (!mapReady || !geofence) return;
    void fetchRequests(geofence);
  }, [geofence, refreshKey, mapReady, fetchRequests]);

  const resolvePinnedMapConfig = useCallback(async (): Promise<MapConfig> => {
    if (pinnedConfigRef.current) return pinnedConfigRef.current;
    const config = await resolveMapConfig();
    pinnedConfigRef.current = config;
    setMapConfig(config);
    return config;
  }, []);

  const initMap = useCallback(
    async (
      center: Coordinates,
      config: MapConfig,
      userPin?: UserDisplayPin | null,
    ) => {
      if (!containerRef.current || initInFlightRef.current) return;

      initInFlightRef.current = true;
      pinnedConfigRef.current = config;
      setMapConfig(config);

      mapReadyRef.current = false;
      setMapReady(false);

      if (mapRef.current) {
        clearUserLocationLayer(mapRef.current);
        mapRef.current.remove();
        mapRef.current = null;
      }

      try {
        if (config.mode === "api-key") {
          try {
            await assertMapTileAccess(config.region, config.apiKey);
            await assertMapStyleAccess(
              config.region,
              config.styleName,
              config.apiKey,
            );

            const map = await createAmazonApiKeyMap(
              containerRef.current,
              center,
              config,
            );
            mapRef.current = map;
            await ensureMapLoaded(map, center, { strict: true });

            mapReadyRef.current = true;
            setMapReady(true);
            refreshMapLayers(userPin ?? displayPinRef.current);
            void fetchRequests(geofenceRef.current);
            setStatus("ready");
            return;
          } catch (apiKeyErr) {
            const mod = await import("@/amplify_outputs.json");
            const outputs = mod.default ?? mod;
            if (
              hasAmplifyGeo(outputs) &&
              !isPlaceholderAmplifyOutputs(outputs)
            ) {
              console.warn(
                "Amazon Location API key map failed; using sandbox Cognito map",
                apiKeyErr,
              );
              pinnedConfigRef.current = { mode: "amplify", hasGeo: true };
              initInFlightRef.current = false;
              return initMap(
                center,
                { mode: "amplify", hasGeo: true },
                userPin,
              );
            }
            throw apiKeyErr;
          }
        }

        if (config.mode === "amplify") {
          await import("@/lib/amplify/configure-client");
          const { fetchAuthSession } = await import("aws-amplify/auth");
          await fetchAuthSession();

          const { createMap } = await import("maplibre-gl-js-amplify");
          const map = await createMap({
            container: containerRef.current,
            center: [center.lng, center.lat],
            zoom: 13,
          });
          mapRef.current = map;

          await ensureMapLoaded(map, center, { strict: false });

          mapReadyRef.current = true;
          setMapReady(true);
          refreshMapLayers(userPin ?? displayPinRef.current);
          void fetchRequests(geofenceRef.current);
          setStatus("ready");
          return;
        }

        setStatus("needs-config");
      } finally {
        initInFlightRef.current = false;
      }
    },
    [refreshMapLayers, fetchRequests],
  );

  const resolvedFromProfile = useCallback(
    (p: UserProfile): ResolvedLocation => ({
      lat: p.lat!,
      lng: p.lng!,
      source: p.zipCode ? "zip" : "gps",
      zipCode: p.zipCode,
      neighborhood: p.neighborhood,
    }),
    [],
  );

  const syncProfileToMap = useCallback(
    async (p: UserProfile) => {
      if (p.lat == null || p.lng == null) return;

      const resolved = resolvedFromProfile(p);
      setLocation(resolved);

      let pin: UserDisplayPin;
      try {
        const token = await getIdToken();
        const userSub = getUserSubFromIdToken(token);
        pin = await resolveUserDisplayPin(resolved.lat, resolved.lng, userSub);
      } catch {
        pin = {
          lat: resolved.lat,
          lng: resolved.lng,
          bufferRadiusMeters: 0,
        };
      }

      displayPinRef.current = pin;
      setDisplayPin(pin);

      const map = mapRef.current;
      if (map && mapReadyRef.current) {
        const prev = displayPinRef.current;
        const samePin =
          prev &&
          Math.abs(prev.lat - pin.lat) < 1e-6 &&
          Math.abs(prev.lng - pin.lng) < 1e-6;

        refreshMapLayers(pin);
        if (!samePin && map.loaded()) {
          map.easeTo({
            center: [pin.lng, pin.lat],
            duration: 0,
          });
        }
        void fetchRequests(geofenceRef.current);
        return;
      }

      onLocationResolvedRef.current?.(resolved, {
        lat: pin.lat,
        lng: pin.lng,
      });

      const config = await resolvePinnedMapConfig();
      if (config.mode === "none") {
        setStatus("needs-config");
        return;
      }
      await initMap({ lat: pin.lat, lng: pin.lng }, config, pin);
    },
    [initMap, resolvePinnedMapConfig, refreshMapLayers, resolvedFromProfile, fetchRequests],
  );

  const startWithLocation = useCallback(
    async (resolved: ResolvedLocation) => {
      setLocation(resolved);
      setStatus("loading");

      let pin: UserDisplayPin;
      try {
        const token = await getIdToken();
        const userSub = getUserSubFromIdToken(token);
        pin = await resolveUserDisplayPin(resolved.lat, resolved.lng, userSub);
      } catch {
        pin = {
          lat: resolved.lat,
          lng: resolved.lng,
          bufferRadiusMeters: 0,
        };
      }

      displayPinRef.current = pin;
      setDisplayPin(pin);
      onLocationResolvedRef.current?.(resolved, {
        lat: pin.lat,
        lng: pin.lng,
      });

      const config = await resolvePinnedMapConfig();
      if (config.mode === "none") {
        setStatus("needs-config");
        return;
      }

      await initMap({ lat: pin.lat, lng: pin.lng }, config, pin);
    },
    [initMap, resolvePinnedMapConfig],
  );

  const bootstrap = useCallback(async () => {
    setStatus("locating");
    setError(null);

    const saved = profileRef.current;
    if (saved?.lat != null && saved?.lng != null) {
      await syncProfileToMap(saved);
      return;
    }

    const config = await resolvePinnedMapConfig();
    if (config.mode === "none") {
      setStatus("needs-config");
      return;
    }

    try {
      const resolved = await resolveUserLocation();
      await startWithLocation(resolved);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load map";
      setError(message);
      setStatus(message.includes("map tiles") ? "error" : "needs-location");
    }
  }, [startWithLocation, syncProfileToMap, resolvePinnedMapConfig]);

  useEffect(() => {
    void bootstrap();
    return () => {
      mapReadyRef.current = false;
      setMapReady(false);
      initInFlightRef.current = false;
      pinnedConfigRef.current = null;
      if (mapRef.current) {
        clearUserLocationLayer(mapRef.current);
        mapRef.current.remove();
      }
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    if (!mapReady || profile?.lat == null || profile?.lng == null) return;
    void syncProfileToMap(profile);
  }, [
    mapReady,
    profile,
    syncProfileToMap,
  ]);

  const handleZipSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!zipInput.trim()) return;

    setStatus("loading");
    setError(null);
    try {
      const resolved = await resolveLocationFromZip(zipInput);
      await startWithLocation(resolved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Geocode failed");
      setStatus("needs-location");
    }
  };

  return (
    <div className="relative flex h-full min-h-[280px] w-full flex-col">
      <div
        ref={containerRef}
        className="min-h-[280px] flex-1 overflow-hidden rounded-xl bg-slate-200"
        aria-label="Neighborhood map"
      />

      {(status === "loading" || status === "locating") && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-slate-100/80">
          <p className="text-sm font-medium text-slate-600">
            {status === "locating"
              ? "Getting your location…"
              : "Loading Amazon Location map…"}
          </p>
        </div>
      )}

      {status === "needs-config" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-slate-50/95 p-6 text-center">
          <p className="text-sm font-semibold text-slate-900">
            Connect Amazon Location Service
          </p>
          <p className="max-w-sm text-xs text-slate-600">
            Set{" "}
            <code className="rounded bg-slate-200 px-1">
              NEXT_PUBLIC_AMAZON_LOCATION_API_KEY
            </code>{" "}
            in <code className="rounded bg-slate-200 px-1">.env.local</code>, or
            run <code className="rounded bg-slate-200 px-1">npm run sandbox</code>{" "}
            and sign in.
          </p>
        </div>
      )}

      {status === "error" && error && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-slate-50/95 p-6 text-center">
          <p className="text-sm font-semibold text-slate-900">Map unavailable</p>
          <p className="max-w-sm text-xs text-slate-600">{error}</p>
          <button
            type="button"
            onClick={() => void bootstrap()}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            Retry
          </button>
        </div>
      )}

      {(status === "needs-location" || (error && status !== "error")) &&
        mapConfig.mode !== "none" && (
          <div className="absolute bottom-3 left-3 right-3 z-10 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-md backdrop-blur">
            <p className="text-xs text-slate-600">
              {error ??
                "Allow location access, or enter a ZIP code to center the map."}
            </p>
            <form onSubmit={handleZipSubmit} className="mt-2 flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{5}"
                maxLength={5}
                placeholder="ZIP code"
                value={zipInput}
                onChange={(e) => setZipInput(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
              >
                Go
              </button>
            </form>
            <button
              type="button"
              onClick={() => void bootstrap()}
              className="mt-2 text-xs font-medium text-teal-700 hover:underline"
            >
              Try GPS again
            </button>
          </div>
        )}

      {pinPickEnabled && status === "ready" && (
        <p className="pointer-events-none absolute left-3 right-3 top-3 z-10 rounded-lg bg-amber-50/95 px-3 py-2 text-center text-xs font-medium text-amber-900 shadow-sm">
          Click the map to place your request pin (orange dot)
        </p>
      )}

      {location && status === "ready" && (
        <p className="mt-2 text-xs text-slate-500">
          Amazon Location · {requests.length} request
          {requests.length === 1 ? "" : "s"} in area
          {displayPin ? " · blue = your approximate area" : ""}
          {pickedPin ? " · orange = new request location" : ""}
        </p>
      )}
    </div>
  );
}
