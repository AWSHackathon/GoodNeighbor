import type {
  GeoJSONSource,
  Map as MapLibreMap,
  StyleSpecification,
} from "maplibre-gl";
import { getStyleDescriptorUrl } from "@/lib/map/config";
import type { ApiKeyMapConfig } from "@/lib/map/config";
import type { Coordinates } from "@/lib/types/domain";
import type { MapPin } from "@/lib/map/samplePins";

/** Fallback when Amazon Location tiles fail in the browser (CORS, key scope, etc.). */
export const OSM_FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

export function createApiKeyTransformRequest(apiKey: string) {
  return (url: string): { url: string } | undefined => {
    if (!url.includes("amazonaws.com") && !url.includes("geo.")) {
      return undefined;
    }
    if (url.includes("key=")) {
      return { url };
    }
    const separator = url.includes("?") ? "&" : "?";
    return { url: `${url}${separator}key=${encodeURIComponent(apiKey)}` };
  };
}

export async function fetchAmazonStandardStyle(
  config: ApiKeyMapConfig,
): Promise<StyleSpecification> {
  const res = await fetch(
    getStyleDescriptorUrl(config.region, config.styleName, config.apiKey),
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(
      `Amazon Location style failed (HTTP ${res.status}): ${detail.slice(0, 120)}`,
    );
  }
  return (await res.json()) as StyleSpecification;
}

export function addPinLayers(
  map: MapLibreMap,
  sourceId: string,
  pins: MapPin[],
): void {
  const features = pins.map((pin, index) => ({
    type: "Feature" as const,
    id: index,
    geometry: {
      type: "Point" as const,
      coordinates: pin.coordinates,
    },
    properties: {
      title: pin.title,
      address: pin.address ?? "",
    },
  }));

  if (map.getSource(sourceId)) {
    (map.getSource(sourceId) as GeoJSONSource).setData({
      type: "FeatureCollection",
      features,
    });
    return;
  }

  map.addSource(sourceId, {
    type: "geojson",
    data: { type: "FeatureCollection", features },
  });

  map.addLayer({
    id: `${sourceId}-circles`,
    type: "circle",
    source: sourceId,
    paint: {
      "circle-radius": 10,
      "circle-color": "#0d9488",
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  });
}

export async function createAmazonApiKeyMap(
  container: HTMLElement,
  center: Coordinates,
  config: ApiKeyMapConfig,
): Promise<MapLibreMap> {
  const maplibregl = (await import("maplibre-gl")).default;
  const transformRequest = createApiKeyTransformRequest(config.apiKey);

  let style: StyleSpecification;
  try {
    style = await fetchAmazonStandardStyle(config);
  } catch {
    style = OSM_FALLBACK_STYLE;
  }

  const map = new maplibregl.Map({
    container,
    center: [center.lng, center.lat],
    zoom: 13,
    style,
    transformRequest,
  });

  return map;
}

export async function waitForMapLoad(
  map: MapLibreMap,
  timeoutMs = 12_000,
): Promise<boolean> {
  if (map.loaded()) return true;

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(false), timeoutMs);
    map.once("load", () => {
      window.clearTimeout(timer);
      resolve(true);
    });
  });
}

/** If Amazon style never loads, swap to OSM so the user still sees a centered map. */
/** Wait for tiles, or switch to OSM if Amazon Location fails. Returns true if OSM was used. */
export async function ensureMapLoaded(
  map: MapLibreMap,
  center: Coordinates,
): Promise<boolean> {
  let usedFallback = false;

  const switchToOsm = () => {
    if (usedFallback) return;
    usedFallback = true;
    map.setStyle(OSM_FALLBACK_STYLE);
    map.setCenter([center.lng, center.lat]);
    map.setZoom(13);
  };

  map.on("error", () => {
    switchToOsm();
  });

  const loaded = await waitForMapLoad(map, 8_000);
  if (!loaded) {
    switchToOsm();
    const ok = await waitForMapLoad(map, 8_000);
    if (!ok) {
      throw new Error("Map tiles could not load. Check your network connection.");
    }
  }

  return usedFallback;
}
