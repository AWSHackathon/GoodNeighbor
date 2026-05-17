import {
  BUFFER_RADIUS_METERS_MAX,
  BUFFER_RADIUS_METERS_MIN,
  enumerateUserDisplayCandidates,
  USER_DISPLAY_FALLBACK_MAX,
  USER_DISPLAY_FALLBACK_MIN,
  USER_DISPLAY_MAX_ATTEMPTS,
  type PublicPinResult,
} from "@/lib/location/obfuscate";

export type UserDisplayPin = PublicPinResult;

async function checkOnLand(lat: number, lng: number): Promise<boolean> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
  });
  const res = await fetch(`/api/location/reverse-geocode?${params}`);
  if (!res.ok) {
    console.warn("reverse-geocode failed", res.status);
    return true;
  }
  const data = (await res.json()) as { onLand?: boolean };
  return data.onLand === true;
}

const LAND_CHECK_MAX = 4;

async function pickFirstOnLand(
  candidates: PublicPinResult[],
): Promise<PublicPinResult | null> {
  const toCheck = candidates.slice(0, LAND_CHECK_MAX);
  for (const candidate of toCheck) {
    if (await checkOnLand(candidate.lat, candidate.lng)) {
      return candidate;
    }
  }
  return toCheck[0] ?? null;
}

/**
 * Resolve a stable, privacy-preserving map pin for the signed-in user.
 */
export async function resolveUserDisplayPin(
  trueLat: number,
  trueLng: number,
  userSub: string,
): Promise<UserDisplayPin> {
  const primary = enumerateUserDisplayCandidates(
    trueLat,
    trueLng,
    userSub,
    USER_DISPLAY_MAX_ATTEMPTS,
    BUFFER_RADIUS_METERS_MIN,
    BUFFER_RADIUS_METERS_MAX,
  );

  const onLand = await pickFirstOnLand(primary);
  if (onLand) return onLand;

  const fallback = enumerateUserDisplayCandidates(
    trueLat,
    trueLng,
    userSub,
    LAND_CHECK_MAX,
    USER_DISPLAY_FALLBACK_MIN,
    USER_DISPLAY_FALLBACK_MAX,
  );

  const fallbackLand = await pickFirstOnLand(fallback);
  if (fallbackLand) return fallbackLand;

  return (
    primary[0] ?? {
      lat: trueLat,
      lng: trueLng,
      bufferRadiusMeters: BUFFER_RADIUS_METERS_MIN,
    }
  );
}
