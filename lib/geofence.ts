import type { ResolvedLocation } from "@/lib/location/resolve";
import type { Coordinates, UserProfile } from "@/lib/types/domain";

/** Capitol Hill demo cluster (AWS-US-4 seed) — always queried so mock posts are listable. */
export const DEMO_SEED_CENTER = { lat: 47.6253, lng: -122.3222 } as const;

/** GSI keys used by npm run seed:mock; must match seed script index + profile ZIP/neighborhood. */
export const DEMO_SEED_GEOFENCE_KEYS = [
  "98102",
  "capitol-hill",
  geofenceLocBucket(DEMO_SEED_CENTER.lat, DEMO_SEED_CENTER.lng),
] as const;

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
 * Map position for browse/nearby filters — picked pin, then true GPS (same as blue pin).
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
  const keys = new Set<string>([
    ...DEMO_SEED_GEOFENCE_KEYS,
    ...extraKeys.filter(Boolean),
  ]);

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

/**
 * Demo seed (`npm run seed:mock`) writes leaderboard rows under `capitol-hill`.
 * Profiles often resolve to ZIP `98102` or a loc bucket — alias those to the seed key.
 */
const LEADERBOARD_GEOFENCE_ALIASES: Record<string, string> = {
  "98102": "capitol-hill",
  [geofenceLocBucket(DEMO_SEED_CENTER.lat, DEMO_SEED_CENTER.lng)]: "capitol-hill",
};

/** Map ZIP / loc bucket to neighborhood slug where demo leaderboard is seeded. */
export function canonicalLeaderboardGeofence(key: string): string {
  return LEADERBOARD_GEOFENCE_ALIASES[key] ?? key;
}

/** Leaderboard stays on neighborhood / ZIP when the profile has one. */
export function resolveLeaderboardGeofenceKey(
  profile: Pick<UserProfile, "neighborhood" | "zipCode" | "lat" | "lng"> | null,
  location?: ResolvedLocation | null,
): string {
  if (profile?.neighborhood) {
    return canonicalLeaderboardGeofence(slugNeighborhood(profile.neighborhood));
  }
  if (profile?.zipCode) return canonicalLeaderboardGeofence(profile.zipCode);
  if (location?.zipCode) return canonicalLeaderboardGeofence(location.zipCode);
  if (location?.neighborhood) {
    return canonicalLeaderboardGeofence(slugNeighborhood(location.neighborhood));
  }
  const lat = location?.lat ?? profile?.lat;
  const lng = location?.lng ?? profile?.lng;
  if (lat != null && lng != null) {
    return canonicalLeaderboardGeofence(geofenceLocBucket(lat, lng));
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
