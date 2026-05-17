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
const USER_PIN_SOURCE = "good-neighbor-user-pin";

type MapLibreMarker = {
  setLngLat(lngLat: [number, number]): void;
  remove(): void;
};

const userLocationMarkers = new WeakMap<MapLibreMap, MapLibreMarker>();

function createUserPinElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.style.width = "22px";
  el.style.height = "22px";
  el.style.borderRadius = "50%";
  el.style.backgroundColor = "#2563eb";
  el.style.border = "3px solid #ffffff";
  el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.35)";
  el.style.pointerEvents = "none";
  return el;
}

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

/** DOM marker for the signed-in user (always above map tiles). */
export async function setUserLocationLayer(
  map: MapLibreMap,
  coordinates: [number, number] | null,
): Promise<void> {
  const maplibregl = (await import("maplibre-gl")).default;
  const existing = userLocationMarkers.get(map);

  if (!coordinates) {
    existing?.remove();
    userLocationMarkers.delete(map);
    removeUserLocationCircleLayer(map);
    return;
  }

  if (existing) {
    existing.setLngLat(coordinates);
    return;
  }

  const marker = new maplibregl.Marker({
    element: createUserPinElement(),
    anchor: "center",
  })
    .setLngLat(coordinates)
    .addTo(map);

  userLocationMarkers.set(map, marker);
}

export function clearUserLocationLayer(map: MapLibreMap): void {
  userLocationMarkers.get(map)?.remove();
  userLocationMarkers.delete(map);
  removeUserLocationCircleLayer(map);
}

function removeUserLocationCircleLayer(map: MapLibreMap): void {
  const layerId = `${USER_PIN_SOURCE}-circle`;
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(USER_PIN_SOURCE)) map.removeSource(USER_PIN_SOURCE);
}

/** Optional faint radius ring under the user marker. */
function setUserLocationCircleLayerNow(
  map: MapLibreMap,
  coordinates: [number, number] | null,
): void {
  const layerId = `${USER_PIN_SOURCE}-circle`;

  if (!coordinates) {
    removeUserLocationCircleLayer(map);
    return;
  }

  const data = {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates },
        properties: {},
      },
    ],
  };

  if (map.getSource(USER_PIN_SOURCE)) {
    (map.getSource(USER_PIN_SOURCE) as GeoJSONSource).setData(data);
    if (map.getLayer(layerId)) {
      map.moveLayer(layerId);
    }
    return;
  }

  map.addSource(USER_PIN_SOURCE, { type: "geojson", data });
  map.addLayer({
    id: layerId,
    type: "circle",
    source: USER_PIN_SOURCE,
    paint: {
      "circle-radius": 40,
      "circle-color": "#3b82f6",
      "circle-opacity": 0.15,
      "circle-stroke-width": 0,
    },
  });
}

export function applyMapPinLayers(
  map: MapLibreMap,
  options: {
    requestPins: MapPin[];
    requestSourceId: string;
    userCoordinates: [number, number] | null;
    draftCoordinates: [number, number] | null;
  },
): void {
  whenStyleReady(map, () => {
    addPinLayersNow(map, options.requestSourceId, options.requestPins);
    setUserLocationCircleLayerNow(map, options.userCoordinates);
    setDraftPinLayerNow(map, options.draftCoordinates);

    const userLayerId = `${USER_PIN_SOURCE}-circle`;
    if (options.userCoordinates && map.getLayer(userLayerId)) {
      map.moveLayer(userLayerId);
    }
    const draftLayerId = `${DRAFT_PIN_SOURCE}-circle`;
    if (options.draftCoordinates && map.getLayer(draftLayerId)) {
      map.moveLayer(draftLayerId);
    }
    const requestLayerId = `${options.requestSourceId}-circles`;
    if (options.requestPins.length > 0 && map.getLayer(requestLayerId)) {
      map.moveLayer(requestLayerId);
    }

    void setUserLocationLayer(map, options.userCoordinates);
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

export type EnsureMapLoadedOptions = {
  /**
   * API-key maps must receive the load event before pins render.
   * Amplify/Cognito maps often render usable tiles before `load` fires (especially
   * after pan/zoom); treating a slow load as failure caused a switch to the basic
   * Standard API-key style mid-session.
   */
  strict?: boolean;
};

/** Wait for Amazon Location tiles to finish loading. */
export async function ensureMapLoaded(
  map: MapLibreMap,
  _center: Coordinates,
  options: EnsureMapLoadedOptions = {},
): Promise<void> {
  const strict = options.strict ?? true;
  const timeoutMs = strict ? 15_000 : 30_000;

  if (map.loaded()) return;

  const loaded = await waitForMapLoad(map, timeoutMs);
  if (loaded) return;

  if (!strict) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    if (map.loaded() || map.isStyleLoaded()) return;
  }

  throw new Error(
    "Amazon Location map tiles could not load. Sign in after `npm run sandbox`, or remove " +
      "NEXT_PUBLIC_AMAZON_LOCATION_API_KEY from .env.local to use the sandbox map. " +
      "If you keep an API key, allow geo-maps:GetTile on the default map provider in the Location console.",
  );
}
