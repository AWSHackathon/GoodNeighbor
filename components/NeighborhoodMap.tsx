"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  getStyleDescriptorUrl,
  resolveMapConfig,
  type MapConfig,
} from "@/lib/map/config";
import { assertMapTileAccess } from "@/lib/map/validateApiKey";
import { buildSamplePins } from "@/lib/map/samplePins";
import {
  resolveLocationFromZip,
  resolveUserLocation,
  type ResolvedLocation,
} from "@/lib/location/resolve";
import type { Coordinates } from "@/lib/types/domain";

type MapStatus = "loading" | "ready" | "needs-location" | "needs-config" | "error";

export function NeighborhoodMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<ResolvedLocation | null>(null);
  const [zipInput, setZipInput] = useState("");
  const [mapConfig, setMapConfig] = useState<MapConfig>({ mode: "none" });

  const initMap = useCallback(
    async (center: Coordinates, config: MapConfig) => {
      if (!containerRef.current) return;

      const maplibregl = (await import("maplibre-gl")).default;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const centerLngLat: [number, number] = [center.lng, center.lat];

      if (config.mode === "api-key") {
        await assertMapTileAccess(config.region, config.apiKey);

        const map = new maplibregl.Map({
          container: containerRef.current,
          center: centerLngLat,
          zoom: 13,
          style: getStyleDescriptorUrl(
            config.region,
            config.styleName,
            config.apiKey,
          ),
        });
        map.on("error", (event) => {
          const status =
            event.error && "status" in event.error
              ? (event.error as { status?: number }).status
              : undefined;
          const message =
            event.error instanceof Error
              ? event.error.message
              : typeof event.error === "string"
                ? event.error
                : "";
          if (status === 403 || /load failed/i.test(message)) {
            setError(
              status === 403
                ? "Map tiles were denied (403). Update your API key to allow geo-maps:* on the default map resource, or run npm run sandbox."
                : "Map tiles could not load. Run npm run sandbox and sign in, or fix NEXT_PUBLIC_AMAZON_LOCATION_API_KEY / map style in .env.local.",
            );
            setStatus("error");
          }
        });
        mapRef.current = map;
        wireSamplePins(map, center);
        setStatus("ready");
        return;
      }

      if (config.mode === "amplify") {
        await import("@/lib/amplify/configure-client");
        const { createMap, drawPoints } = await import("maplibre-gl-js-amplify");

        const map = await createMap({
          container: containerRef.current,
          center: centerLngLat,
          zoom: 13,
        });
        mapRef.current = map;
        map.on("error", (event) => {
          const message =
            event.error instanceof Error
              ? event.error.message
              : typeof event.error === "string"
                ? event.error
                : "";
          if (/load failed|403|401/i.test(message)) {
            setError(
              "Map could not load tiles. Sign in and ensure npm run sandbox deployed GoodNeighborMap, or set a valid Amazon Location API key.",
            );
            setStatus("error");
          }
        });
        map.on("load", () => {
          drawPoints("good-neighbor-requests", buildSamplePins(center), map, {
            showCluster: true,
            unclusteredOptions: { showMarkerPopup: true },
          });
        });
        setStatus("ready");
        return;
      }

      setStatus("needs-config");
    },
    [],
  );

  const wireSamplePins = (map: MapLibreMap, center: Coordinates) => {
    map.on("load", async () => {
      const { drawPoints } = await import("maplibre-gl-js-amplify");
      drawPoints("good-neighbor-requests", buildSamplePins(center), map, {
        showCluster: true,
        unclusteredOptions: { showMarkerPopup: true },
      });
    });
  };

  const bootstrap = useCallback(async () => {
    setStatus("loading");
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

  const handleRetryGps = () => {
    void bootstrap();
  };

  return (
    <div className="relative flex h-full min-h-[280px] w-full flex-col">
      <div
        ref={containerRef}
        className="min-h-[280px] flex-1 overflow-hidden rounded-xl bg-slate-200"
        aria-label="Neighborhood map"
      />

      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-slate-100/80">
          <p className="text-sm font-medium text-slate-600">Loading map…</p>
        </div>
      )}

      {status === "needs-config" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-slate-50/95 p-6 text-center">
          <p className="text-sm font-semibold text-slate-900">
            Connect Amazon Location Service
          </p>
          <p className="max-w-sm text-xs text-slate-600">
            Option A: set{" "}
            <code className="rounded bg-slate-200 px-1">NEXT_PUBLIC_AMAZON_LOCATION_API_KEY</code>{" "}
            in <code className="rounded bg-slate-200 px-1">.env.local</code> (map resource + API key
            in AWS Console). Option B: run{" "}
            <code className="rounded bg-slate-200 px-1">npx ampx sandbox</code> to deploy the Amplify
            backend and generate <code className="rounded bg-slate-200 px-1">amplify_outputs.json</code>.
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
            {error ?? "Allow location access or enter your ZIP to center the map."}
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
            onClick={handleRetryGps}
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
          {" · "}
          Sample pins are obfuscated (~400–800m buffer)
        </p>
      )}
    </div>
  );
}
