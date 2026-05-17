import type { Coordinates, PublicHelpRequest } from "@/lib/types/domain";

const EARTH_RADIUS_M = 6_371_000;

/**
 * Default discovery radius for map pins and the requests list.
 * ~10 km / 6 mi — urban volunteering sweet spot: short drive or bike ride,
 * wider than walk-only (~3–5 km) but still “my area” (not metro-wide).
 */
export const NEARBY_REQUEST_RADIUS_METERS = 10_000;

/** Requests list UI page size (no cap on total nearby results). */
export const REQUEST_LIST_PAGE_SIZE = 5;

export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function requestDistanceMeters(
  center: Coordinates,
  request: Pick<PublicHelpRequest, "publicLat" | "publicLng">,
): number {
  return distanceMeters(center, {
    lat: request.publicLat,
    lng: request.publicLng,
  });
}

export function filterRequestsNearby(
  requests: PublicHelpRequest[],
  center: Coordinates | null,
  radiusMeters: number = NEARBY_REQUEST_RADIUS_METERS,
): PublicHelpRequest[] {
  if (!center) return requests;
  return requests.filter((r) => {
    if (r.isOwn) return true;
    return requestDistanceMeters(center, r) <= radiusMeters;
  });
}

/** Nearest first; own posts grouped at top when distances tie. */
export function sortRequestsByDistance(
  requests: PublicHelpRequest[],
  center: Coordinates | null,
): PublicHelpRequest[] {
  if (!center) return requests;
  return [...requests].sort((a, b) => {
    if (a.isOwn && !b.isOwn) return -1;
    if (!a.isOwn && b.isOwn) return 1;
    return (
      requestDistanceMeters(center, a) - requestDistanceMeters(center, b)
    );
  });
}

export function formatDistanceMeters(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}
