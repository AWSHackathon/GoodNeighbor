import type { ResolvedLocation } from "@/lib/location/resolve";
import type { Coordinates, UserProfile } from "@/lib/types/domain";

/** ~1.1 km grid cell for pin-based request index (AWS-US-3). */
export function geofenceLocBucket(lat: number, lng: number): string {
  return `loc-${Math.round(lat * 100)}-${Math.round(lng * 100)}`;
}

function slugNeighborhood(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/** Geofence when storing a request — always bucket by the pin the user placed. */
export function geofenceKeyForRequestPin(lat: number, lng: number): string {
  return geofenceLocBucket(lat, lng);
}

/**
 * True map position for browse/nearby filters — prefer GPS and picked pin over
 * the fuzzed blue display pin so list queries match where posts are stored.
 */
export function resolveBrowseCenter(
  profile: Pick<UserProfile, "lat" | "lng"> | null,
  location?: ResolvedLocation | null,
  pickedPin?: Coordinates | null,
  mapCenter?: Coordinates | null,
): Coordinates | null {
  if (pickedPin) return pickedPin;
  if (location?.lat != null && location.lng != null) {
    return { lat: location.lat, lng: location.lng };
  }
  if (profile?.lat != null && profile.lng != null) {
    return { lat: profile.lat, lng: profile.lng };
  }
  return mapCenter ?? null;
}

/** All geofence keys to query so creates and legacy posts are discoverable. */
export function collectRequestGeofenceKeys(
  profile: Pick<UserProfile, "neighborhood" | "zipCode" | "lat" | "lng"> | null,
  location?: ResolvedLocation | null,
  pickedPin?: Coordinates | null,
  mapCenter?: Coordinates | null,
  extraKeys: string[] = [],
): string[] {
  const keys = new Set<string>(extraKeys.filter(Boolean));

  const addPoint = (p?: Coordinates | null) => {
    if (p?.lat != null && p.lng != null) {
      keys.add(geofenceLocBucket(p.lat, p.lng));
    }
  };

  addPoint(pickedPin);
  if (location?.lat != null && location.lng != null) {
    addPoint({ lat: location.lat, lng: location.lng });
  }
  if (profile?.lat != null && profile.lng != null) {
    addPoint({ lat: profile.lat, lng: profile.lng });
  }
  addPoint(mapCenter);

  if (profile?.zipCode) keys.add(profile.zipCode);
  if (location?.zipCode) keys.add(location.zipCode);
  if (profile?.neighborhood) keys.add(slugNeighborhood(profile.neighborhood));
  if (location?.neighborhood) keys.add(slugNeighborhood(location.neighborhood));

  return [...keys];
}

/**
 * Primary geofence for list queries (first key from {@link collectRequestGeofenceKeys}).
 */
export function resolveGeofenceKey(
  profile: Pick<UserProfile, "neighborhood" | "zipCode" | "lat" | "lng"> | null,
  location?: ResolvedLocation | null,
  mapPoint?: Pick<Coordinates, "lat" | "lng"> | null,
): string {
  const keys = collectRequestGeofenceKeys(profile, location, mapPoint, null);
  return keys[0] ?? "unknown";
}

/** Leaderboard stays on neighborhood / ZIP when the profile has one. */
export function resolveLeaderboardGeofenceKey(
  profile: Pick<UserProfile, "neighborhood" | "zipCode" | "lat" | "lng"> | null,
  location?: ResolvedLocation | null,
): string {
  if (profile?.neighborhood) return slugNeighborhood(profile.neighborhood);
  if (profile?.zipCode) return profile.zipCode;
  if (location?.zipCode) return location.zipCode;
  if (location?.neighborhood) return slugNeighborhood(location.neighborhood);
  const lat = location?.lat ?? profile?.lat;
  const lng = location?.lng ?? profile?.lng;
  if (lat != null && lng != null) {
    return geofenceLocBucket(lat, lng);
  }
  return "unknown";
}

/** Stable string for effect deps (avoids refetch loops from new array references). */
export function geofenceKeysSignature(keys: string[]): string {
  return [...keys].sort().join("|");
}

export function coordinatesSignature(
  point: Pick<Coordinates, "lat" | "lng"> | null | undefined,
): string {
  if (point?.lat == null || point.lng == null) return "";
  return `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
}

export function geofenceLabel(
  profile: Pick<UserProfile, "neighborhood" | "zipCode"> | null,
  geofence: string,
): string {
  return profile?.neighborhood ?? profile?.zipCode ?? geofence.replace(/-/g, " ");
}
