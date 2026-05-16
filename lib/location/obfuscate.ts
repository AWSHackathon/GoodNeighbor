/**
 * Marketplace-style public pin: deterministic offset within a buffer around true location.
 * Server must recompute on create; client may preview before submit.
 */

import type { Coordinates } from "@/lib/types/domain";

/** ~0.25–0.5 mi — see docs/PLAN.md#location-privacy */
export const BUFFER_RADIUS_METERS_MIN = 400;
export const BUFFER_RADIUS_METERS_MAX = 800;

const METERS_PER_DEGREE_LAT = 111_320;

function hashRequestId(requestId: string): number {
  let hash = 5381;
  for (let i = 0; i < requestId.length; i++) {
    hash = (hash * 33) ^ requestId.charCodeAt(i);
  }
  return hash >>> 0;
}

function seededUnit(hash: number, salt: number): number {
  const x = Math.sin((hash + salt) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export interface PublicPinResult extends Coordinates {
  bufferRadiusMeters: number;
}

/**
 * Derive a stable public point from true coordinates and request id.
 */
export function derivePublicPin(
  trueLat: number,
  trueLng: number,
  requestId: string,
): PublicPinResult {
  const hash = hashRequestId(requestId);
  const angle = seededUnit(hash, 1) * 2 * Math.PI;
  const t = seededUnit(hash, 2);
  const distanceMeters =
    BUFFER_RADIUS_METERS_MIN +
    t * (BUFFER_RADIUS_METERS_MAX - BUFFER_RADIUS_METERS_MIN);

  const latOffset = (distanceMeters * Math.cos(angle)) / METERS_PER_DEGREE_LAT;
  const lngScale =
    METERS_PER_DEGREE_LAT * Math.cos((trueLat * Math.PI) / 180);
  const lngOffset = (distanceMeters * Math.sin(angle)) / lngScale;

  return {
    lat: trueLat + latOffset,
    lng: trueLng + lngOffset,
    bufferRadiusMeters: distanceMeters,
  };
}

export function toPublicCoordinates(pin: PublicPinResult): Coordinates {
  return { lat: pin.lat, lng: pin.lng };
}
