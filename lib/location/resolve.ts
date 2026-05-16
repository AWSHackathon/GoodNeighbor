/**
 * Map center resolution: GPS → IP → manual ZIP (docs/PLAN.md#location-resolution).
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

const NOT_IMPLEMENTED =
  "Location resolution requires Phase 1 (Amplify API + Amazon Location).";

/**
 * Resolve where to center the map and which geofence bucket to query.
 */
export async function resolveUserLocation(
  _options: ResolveLocationOptions = {},
): Promise<ResolvedLocation> {
  if (typeof navigator !== "undefined" && navigator.geolocation) {
    try {
      const position = await getBrowserPosition(_options.gpsTimeoutMs ?? 10_000);
      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        source: "gps",
      };
    } catch {
      // fall through to IP / ZIP in Phase 1
    }
  }

  throw new Error(NOT_IMPLEMENTED);
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

/** Phase 1: Amazon Location IP geolocation via API. */
export async function resolveLocationFromIp(): Promise<ResolvedLocation> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Phase 1: geocode ZIP via Places, return center + neighborhood label. */
export async function resolveLocationFromZip(
  zipCode: string,
): Promise<ResolvedLocation> {
  void zipCode;
  throw new Error(NOT_IMPLEMENTED);
}
