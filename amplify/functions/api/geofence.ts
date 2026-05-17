import type { UserProfile } from "./handler-types.js";

/** Geofence key for DynamoDB queries (matches client lib/geofence.ts). */
export function geofenceKey(
  profile: Pick<UserProfile, "neighborhood" | "zipCode" | "lat" | "lng">,
  trueLat?: number,
  trueLng?: number,
): string {
  if (profile.neighborhood) {
    return profile.neighborhood
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }
  if (profile.zipCode) return profile.zipCode;
  const lat = trueLat ?? profile.lat;
  const lng = trueLng ?? profile.lng;
  if (lat != null && lng != null) {
    return `loc-${Math.round(lat * 100)}-${Math.round(lng * 100)}`;
  }
  return "unknown";
}

export function neighborhoodLabel(
  profile: Pick<UserProfile, "neighborhood" | "zipCode">,
  geofence: string,
): string {
  return profile.neighborhood ?? profile.zipCode ?? geofence;
}
