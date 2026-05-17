"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  addPinLayers,
  createAmazonApiKeyMap,
  ensureMapLoaded,
} from "@/lib/map/amazonMap";
import { buildSamplePins } from "@/lib/map/samplePins";
import {
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
import type { Coordinates } from "@/lib/types/domain";

type MapStatus =
  | "loading"
  | "locating"
  | "ready"
  | "needs-location"
  | "needs-config"
  | "error";

const PIN_SOURCE_ID = "good-neighbor-requests";

export function NeighborhoodMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<ResolvedLocation | null>(null);
  const [zipInput, setZipInput] = useState("");
  const [mapConfig, setMapConfig] = useState<MapConfig>({ mode: "none" });
  const [usingFallbackTiles, setUsingFallbackTiles] = useState(false);

  const initMap = useCallback(
    async (center: Coordinates, config: MapConfig) => {
      if (!containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      setUsingFallbackTiles(false);

      if (config.mode === "api-key") {
        await assertMapTileAccess(config.region, config.apiKey);
        await assertMapStyleAccess(config.region, config.styleName, config.apiKey);

        const map = await createAmazonApiKeyMap(
          containerRef.current,
          center,
          config,
        );
        mapRef.current = map;

        const usedOsm = await ensureMapLoaded(map, center);
        setUsingFallbackTiles(usedOsm);

        addPinLayers(map, PIN_SOURCE_ID, buildSamplePins(center));
        setStatus("ready");
        return;
      }

      if (config.mode === "amplify") {
        try {
          await import("@/lib/amplify/configure-client");
          const { fetchAuthSession } = await import("aws-amplify/auth");
          await fetchAuthSession();

          const { createMap, drawPoints } = await import(
            "maplibre-gl-js-amplify"
          );
          const map = await createMap({
            container: containerRef.current,
            center: [center.lng, center.lat],
            zoom: 13,
          });
          mapRef.current = map;

          await new Promise<void>((resolve, reject) => {
            const timer = window.setTimeout(
              () => reject(new Error("Amplify map load timeout")),
              12_000,
            );
            map.once("load", () => {
              window.clearTimeout(timer);
              resolve();
            });
          });

          drawPoints(PIN_SOURCE_ID, buildSamplePins(center), map, {
            showCluster: true,
            unclusteredOptions: { showMarkerPopup: true },
          });
          setStatus("ready");
          return;
        } catch (amplifyErr) {
          console.warn("Amplify Geo map failed, using API key", amplifyErr);
          const mod = await import("@/amplify_outputs.json");
          const outputs = mod.default ?? mod;
          const fallback = resolveApiKeyMapConfig(outputs);
          if (!fallback) throw amplifyErr;
          return initMap(center, fallback);
        }
      }

      setStatus("needs-config");
    },
    [],
  );

  const bootstrap = useCallback(async () => {
    setStatus("locating");
    setError(null);

    const config = await resolveMapConfig();
    setMapConfig(config);

    if (config.mode === "none") {
      setStatus("needs-config");
      return;
    }

    try {
      const resolved = await resolveUserLocation();
      setLocation(resolved);
      setStatus("loading");
      await initMap(resolved, config);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load map";
      setError(message);
      setStatus(message.includes("map tiles") ? "error" : "needs-location");
    }
  }, [initMap]);

  useEffect(() => {
    void bootstrap();
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [bootstrap]);

  const handleZipSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!zipInput.trim()) return;

    setStatus("loading");
    setError(null);
    try {
      const resolved = await resolveLocationFromZip(zipInput);
      const config = await resolveMapConfig();
      setMapConfig(config);
      setLocation(resolved);
      await initMap(resolved, config);
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
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-slate-100/80">
          <p className="text-sm font-medium text-slate-600">
            {status === "locating"
              ? "Getting your location…"
              : "Loading map…"}
          </p>
        </div>
      )}

      {status === "needs-config" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-slate-50/95 p-6 text-center">
          <p className="text-sm font-semibold text-slate-900">
            Connect Amazon Location Service
          </p>
          <p className="max-w-sm text-xs text-slate-600">
            Set{" "}
            <code className="rounded bg-slate-200 px-1">NEXT_PUBLIC_AMAZON_LOCATION_API_KEY</code>{" "}
            in <code className="rounded bg-slate-200 px-1">.env.local</code>, or run{" "}
            <code className="rounded bg-slate-200 px-1">npm run sandbox</code> and sign in.
          </p>
        </div>
      )}

      {status === "error" && error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-slate-50/95 p-6 text-center">
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
          <div className="absolute bottom-3 left-3 right-3 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-md backdrop-blur">
            <p className="text-xs text-slate-600">
              {error ??
                "Allow location access in your browser to center the map on you, or enter a ZIP code."}
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

      {location && status === "ready" && (
        <p className="mt-2 text-xs text-slate-500">
          Centered via {location.source}
          {location.zipCode ? ` · ${location.zipCode}` : ""}
          {location.neighborhood ? ` · ${location.neighborhood}` : ""}
          {usingFallbackTiles ? " · OpenStreetMap fallback tiles" : ""}
          {" · "}
          Sample pins are obfuscated (~400–800m buffer)
        </p>
      )}
    </div>
  );
}
