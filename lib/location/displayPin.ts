import type { ResolvedLocation } from "@/lib/location/resolve";

/** Map pin for the signed-in user only (never exposed to other users). */
export type UserDisplayPin = {
  lat: number;
  lng: number;
  bufferRadiusMeters: number;
};

/**
 * Precise map center for the current user. No offset — neighbors never see this pin;
 * only request pins are obfuscated when shared via GET /requests.
 */
export function userMapPinFromResolved(
  resolved: Pick<ResolvedLocation, "lat" | "lng">,
): UserDisplayPin {
  return {
    lat: resolved.lat,
    lng: resolved.lng,
    bufferRadiusMeters: 0,
  };
}
