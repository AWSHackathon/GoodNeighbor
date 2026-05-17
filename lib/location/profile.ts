import type { UserProfile } from "@/lib/types/domain";
import {
  resolveLocationFromZip,
  type ResolvedLocation,
} from "@/lib/location/resolve";

/**
 * Only GPS-sourced profile coordinates are trusted for the private blue pin.
 * Legacy rows with zipCode but no locationSource used to save ZIP centroids as lat/lng.
 */
export function canUseProfileCoordsForMapPin(
  profile: Pick<UserProfile, "lat" | "lng" | "locationSource" | "zipCode">,
): boolean {
  if (profile.lat == null || profile.lng == null) return false;
  if (profile.locationSource === "gps") return true;
  if (profile.locationSource === "zip" || profile.locationSource === "ip") {
    return false;
  }
  // Legacy: do not trust stored coords when a ZIP is on file (often a geocode centroid).
  if (profile.zipCode) return false;
  return true;
}

/** Fallback when browser GPS is unavailable — never reuse stale ZIP lat/lng from DynamoDB. */
export async function resolveLocationFromProfile(
  profile: Pick<
    UserProfile,
    "lat" | "lng" | "locationSource" | "zipCode" | "neighborhood"
  >,
): Promise<ResolvedLocation | null> {
  if (canUseProfileCoordsForMapPin(profile)) {
    return {
      lat: profile.lat!,
      lng: profile.lng!,
      source: "gps",
      zipCode: profile.zipCode,
      neighborhood: profile.neighborhood,
    };
  }

  if (profile.zipCode?.trim()) {
    const fromZip = await resolveLocationFromZip(profile.zipCode);
    return {
      ...fromZip,
      neighborhood: profile.neighborhood ?? fromZip.neighborhood,
    };
  }

  return null;
}
