import type {
  GeoJSONSource,
  Map as MapLibreMap,
  StyleSpecification,
} from "maplibre-gl";
import { getStyleDescriptorUrl } from "@/lib/map/config";
import type { ApiKeyMapConfig } from "@/lib/map/config";
import type { Coordinates } from "@/lib/types/domain";
import type { MapPin } from "@/lib/map/samplePins";

export function createApiKeyTransformRequest(apiKey: string) {
  return (url: string): { url: string } => {
    if (!url.includes("amazonaws.com") && !url.includes("geo.")) {
      return { url };
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

const DRAFT_PIN_SOURCE = "good-neighbor-draft-pin";

function whenStyleReady(map: MapLibreMap, fn: () => void): void {
  const run = () => {
    try {
      fn();
    } catch (err) {
      console.error("Map layer update failed", err);
    }
  };
  if (map.loaded()) {
    run();
    return;
  }
  map.once("load", run);
}

export function setDraftPinLayer(
  map: MapLibreMap,
  coordinates: [number, number] | null,
): void {
  whenStyleReady(map, () => {
    setDraftPinLayerNow(map, coordinates);
  });
}

function setDraftPinLayerNow(
  map: MapLibreMap,
  coordinates: [number, number] | null,
): void {
  if (!coordinates) {
    if (map.getLayer(`${DRAFT_PIN_SOURCE}-circle`)) {
      map.removeLayer(`${DRAFT_PIN_SOURCE}-circle`);
    }
    if (map.getSource(DRAFT_PIN_SOURCE)) {
      map.removeSource(DRAFT_PIN_SOURCE);
    }
    return;
  }

  const data = {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates,
        },
        properties: {},
      },
    ],
  };

  if (map.getSource(DRAFT_PIN_SOURCE)) {
    (map.getSource(DRAFT_PIN_SOURCE) as GeoJSONSource).setData(data);
    return;
  }

  map.addSource(DRAFT_PIN_SOURCE, { type: "geojson", data });
  map.addLayer({
    id: `${DRAFT_PIN_SOURCE}-circle`,
    type: "circle",
    source: DRAFT_PIN_SOURCE,
    paint: {
      "circle-radius": 14,
      "circle-color": "#f59e0b",
      "circle-stroke-width": 3,
      "circle-stroke-color": "#ffffff",
    },
  });
}

export function addPinLayers(
  map: MapLibreMap,
  sourceId: string,
  pins: MapPin[],
): void {
  whenStyleReady(map, () => {
    addPinLayersNow(map, sourceId, pins);
  });
}

function addPinLayersNow(
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
      "circle-radius": 12,
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
  const style = await fetchAmazonStandardStyle(config);

  return new maplibregl.Map({
    container,
    center: [center.lng, center.lat],
    zoom: 13,
    style,
    transformRequest,
  });
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

/** Wait for Amazon Location tiles to finish loading. */
export async function ensureMapLoaded(
  map: MapLibreMap,
  _center: Coordinates,
): Promise<void> {
  const loaded = await waitForMapLoad(map, 15_000);
  if (!loaded) {
    throw new Error(
      "Amazon Location map tiles could not load. Check your API key scopes or sign in after sandbox deploy.",
    );
  }
}
