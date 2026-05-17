/**
 * Map center resolution: GPS → manual ZIP (docs/PLAN.md#location-resolution).
 * Resolved coordinates are private; only neighborhood/ZIP are published on profile.
 */

import type { Coordinates } from "@/lib/types/domain";

export type LocationSource = "gps" | "ip" | "zip";

export interface ResolvedLocation extends Coordinates {
  source: LocationSource;
  neighborhood?: string;
  zipCode?: string;
}

export interface ResolveLocationOptions {
  /** Timeout for browser geolocation (ms). */
  gpsTimeoutMs?: number;
}

function getBrowserPosition(timeoutMs: number): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 60_000,
    });
  });
}

/**
 * Resolve where to center the map and which geofence bucket to query.
 */
export async function resolveUserLocation(
  options: ResolveLocationOptions = {},
): Promise<ResolvedLocation> {
  if (typeof navigator !== "undefined" && navigator.geolocation) {
    try {
      const position = await getBrowserPosition(options.gpsTimeoutMs ?? 10_000);
      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        source: "gps",
      };
    } catch {
      // fall through to ZIP / manual
    }
  }

  throw new Error(
    "Location unavailable. Allow GPS or enter your ZIP code below.",
  );
}

/** Geocode ZIP via Amazon Location Places (server route). */
export async function resolveLocationFromZip(
  zipCode: string,
): Promise<ResolvedLocation> {
  const params = new URLSearchParams({ zip: zipCode.trim() });
  const res = await fetch(`/api/location/geocode?${params}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Geocode failed (${res.status})`);
  }
  const data = (await res.json()) as ResolvedLocation;
  return data;
}
