import type { Coordinates, PublicHelpRequest } from "@/lib/types/domain";

const EARTH_RADIUS_M = 6_371_000;

/** Default radius for “neighbors nearby” on map + list (see docs/AWS-US-3.md). */
export const NEARBY_REQUEST_RADIUS_METERS = 8_000;

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

export function filterRequestsNearby(
  requests: PublicHelpRequest[],
  center: Coordinates | null,
  radiusMeters: number = NEARBY_REQUEST_RADIUS_METERS,
): PublicHelpRequest[] {
  if (!center) return requests;
  return requests.filter((r) => {
    if (r.isOwn) return true;
    return (
      distanceMeters(center, { lat: r.publicLat, lng: r.publicLng }) <=
      radiusMeters
    );
  });
}
