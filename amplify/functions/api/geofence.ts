import type { UserProfile } from "./handler-types.js";

/** ~1.1 km grid cell for pin-based request index (matches client lib/geofence.ts). */
export function geofenceLocBucket(lat: number, lng: number): string {
  return `loc-${Math.round(lat * 100)}-${Math.round(lng * 100)}`;
}

/** Geofence when storing a request — bucket by the pin, not profile neighborhood. */
export function geofenceKeyForRequestPin(lat: number, lng: number): string {
  return geofenceLocBucket(lat, lng);
}

/** Geofence key for DynamoDB queries (profile browse / legacy). */
export function geofenceKey(
  profile: Pick<UserProfile, "neighborhood" | "zipCode" | "lat" | "lng">,
  trueLat?: number,
  trueLng?: number,
): string {
  if (trueLat != null && trueLng != null) {
    return geofenceKeyForRequestPin(trueLat, trueLng);
  }
  if (profile.neighborhood) {
    return profile.neighborhood
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }
  if (profile.zipCode) return profile.zipCode;
  const lat = profile.lat;
  const lng = profile.lng;
  if (lat != null && lng != null) {
    return geofenceLocBucket(lat, lng);
  }
  return "unknown";
}

export function neighborhoodLabel(
  profile: Pick<UserProfile, "neighborhood" | "zipCode">,
  geofence: string,
): string {
  return profile.neighborhood ?? profile.zipCode ?? geofence;
}
