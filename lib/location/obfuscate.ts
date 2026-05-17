/**
 * Marketplace-style public pin: deterministic offset within a buffer around true location.
 * Server must recompute on create; client may preview before submit.
 */

import type { Coordinates } from "@/lib/types/domain";

/** ~40–80 m public pin offset — see docs/PLAN.md#location-privacy */
export const BUFFER_RADIUS_METERS_MIN = 40;
export const BUFFER_RADIUS_METERS_MAX = 80;

/** Smaller buffer when primary offset candidates fall on water */
export const USER_DISPLAY_FALLBACK_MIN = 100;
export const USER_DISPLAY_FALLBACK_MAX = 300;

export const USER_DISPLAY_MAX_ATTEMPTS = 12;

const METERS_PER_DEGREE_LAT = 111_320;

export function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return hash >>> 0;
}

function seededUnit(hash: number, salt: number): number {
  const x = Math.sin((hash + salt) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** ~100 m buckets so minor GPS jitter does not move the user display pin */
export function quantizeCoordinate(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export interface PublicPinResult extends Coordinates {
  bufferRadiusMeters: number;
}

export function offsetPointMeters(
  trueLat: number,
  trueLng: number,
  angleRad: number,
  distanceMeters: number,
): Coordinates {
  const latOffset = (distanceMeters * Math.cos(angleRad)) / METERS_PER_DEGREE_LAT;
  const lngScale =
    METERS_PER_DEGREE_LAT * Math.cos((trueLat * Math.PI) / 180);
  const lngOffset = (distanceMeters * Math.sin(angleRad)) / lngScale;

  return {
    lat: trueLat + latOffset,
    lng: trueLng + lngOffset,
  };
}

export function deriveOffsetCandidate(
  trueLat: number,
  trueLng: number,
  baseHash: number,
  attempt: number,
  minMeters: number,
  maxMeters: number,
): PublicPinResult {
  const hash = (baseHash + attempt * 7919) >>> 0;
  const angle = seededUnit(hash, 1) * 2 * Math.PI;
  const t = seededUnit(hash, 2);
  const distanceMeters = minMeters + t * (maxMeters - minMeters);
  const point = offsetPointMeters(trueLat, trueLng, angle, distanceMeters);

  return {
    ...point,
    bufferRadiusMeters: distanceMeters,
  };
}

export function getUserDisplaySeed(
  userSub: string,
  trueLat: number,
  trueLng: number,
): number {
  const qLat = quantizeCoordinate(trueLat);
  const qLng = quantizeCoordinate(trueLng);
  return hashString(`${userSub}:${qLat}:${qLng}`);
}

/**
 * Stable ordered candidates for user map pin (land check applied separately).
 */
export function enumerateUserDisplayCandidates(
  trueLat: number,
  trueLng: number,
  userSub: string,
  maxAttempts: number = USER_DISPLAY_MAX_ATTEMPTS,
  minMeters: number = BUFFER_RADIUS_METERS_MIN,
  maxMeters: number = BUFFER_RADIUS_METERS_MAX,
): PublicPinResult[] {
  const baseHash = getUserDisplaySeed(userSub, trueLat, trueLng);
  const candidates: PublicPinResult[] = [];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    candidates.push(
      deriveOffsetCandidate(trueLat, trueLng, baseHash, attempt, minMeters, maxMeters),
    );
  }

  return candidates;
}

/**
 * Derive a stable public point from true coordinates and request id.
 */
export function derivePublicPin(
  trueLat: number,
  trueLng: number,
  requestId: string,
): PublicPinResult {
  return deriveOffsetCandidate(
    trueLat,
    trueLng,
    hashString(requestId),
    0,
    BUFFER_RADIUS_METERS_MIN,
    BUFFER_RADIUS_METERS_MAX,
  );
}

export function toPublicCoordinates(pin: PublicPinResult): Coordinates {
  return { lat: pin.lat, lng: pin.lng };
}
