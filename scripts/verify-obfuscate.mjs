/**
 * Quick determinism check for user display pin math (mirrors lib/location/obfuscate.ts).
 * Run: node scripts/verify-obfuscate.mjs
 */

const BUFFER_RADIUS_METERS_MIN = 400;
const BUFFER_RADIUS_METERS_MAX = 800;
const METERS_PER_DEGREE_LAT = 111_320;

function hashString(input) {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return hash >>> 0;
}

function quantizeCoordinate(value, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function seededUnit(hash, salt) {
  const x = Math.sin((hash + salt) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function deriveOffsetCandidate(trueLat, trueLng, baseHash, attempt, minMeters, maxMeters) {
  const hash = (baseHash + attempt * 7919) >>> 0;
  const angle = seededUnit(hash, 1) * 2 * Math.PI;
  const t = seededUnit(hash, 2);
  const distanceMeters = minMeters + t * (maxMeters - minMeters);
  const latOffset = (distanceMeters * Math.cos(angle)) / METERS_PER_DEGREE_LAT;
  const lngScale = METERS_PER_DEGREE_LAT * Math.cos((trueLat * Math.PI) / 180);
  const lngOffset = (distanceMeters * Math.sin(angle)) / lngScale;
  return {
    lat: trueLat + latOffset,
    lng: trueLng + lngOffset,
    bufferRadiusMeters: distanceMeters,
  };
}

function getUserDisplaySeed(userSub, trueLat, trueLng) {
  const qLat = quantizeCoordinate(trueLat);
  const qLng = quantizeCoordinate(trueLng);
  return hashString(`${userSub}:${qLat}:${qLng}`);
}

function enumerateUserDisplayCandidates(trueLat, trueLng, userSub, maxAttempts) {
  const baseHash = getUserDisplaySeed(userSub, trueLat, trueLng);
  const candidates = [];
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    candidates.push(
      deriveOffsetCandidate(
        trueLat,
        trueLng,
        baseHash,
        attempt,
        BUFFER_RADIUS_METERS_MIN,
        BUFFER_RADIUS_METERS_MAX,
      ),
    );
  }
  return candidates;
}

const sub = "user-abc";
const lat = 47.6062;
const lng = -122.3321;

const seed1 = getUserDisplaySeed(sub, lat, lng);
const seed2 = getUserDisplaySeed(sub, lat + 0.0001, lng - 0.0001);
if (seed1 !== seed2) {
  throw new Error("quantize bucket should stabilize minor GPS jitter");
}

const a = enumerateUserDisplayCandidates(lat, lng, sub, 3);
const b = enumerateUserDisplayCandidates(lat, lng, sub, 3);
if (JSON.stringify(a) !== JSON.stringify(b)) {
  throw new Error("candidates should be deterministic");
}

const moved = enumerateUserDisplayCandidates(lat + 0.05, lng, sub, 3);
if (JSON.stringify(a) === JSON.stringify(moved)) {
  throw new Error("candidates should change when location bucket changes");
}

console.log("verify-obfuscate: ok");
