import type { ResolvedLocation } from "@/lib/location/resolve";
import type { Coordinates, UserProfile } from "@/lib/types/domain";

/** Geofence key for DynamoDB queries (matches Lambda). */
export function resolveGeofenceKey(
  profile: Pick<UserProfile, "neighborhood" | "zipCode" | "lat" | "lng"> | null,
  location?: ResolvedLocation | null,
  mapPoint?: Pick<Coordinates, "lat" | "lng"> | null,
): string {
  if (profile?.neighborhood) {
    return profile.neighborhood
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }
  if (profile?.zipCode) return profile.zipCode;
  if (location?.zipCode) return location.zipCode;
  const lat = mapPoint?.lat ?? profile?.lat ?? location?.lat;
  const lng = mapPoint?.lng ?? profile?.lng ?? location?.lng;
  if (lat != null && lng != null) {
    return `loc-${Math.round(lat * 100)}-${Math.round(lng * 100)}`;
  }
  if (location?.neighborhood) {
    return location.neighborhood
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }
  return "unknown";
}

export function geofenceLabel(
  profile: Pick<UserProfile, "neighborhood" | "zipCode"> | null,
  geofence: string,
): string {
  return profile?.neighborhood ?? profile?.zipCode ?? geofence.replace(/-/g, " ");
}
