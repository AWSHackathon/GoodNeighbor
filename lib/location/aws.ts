export function getLocationApiKey(): string | undefined {
  return (
    process.env.AMAZON_LOCATION_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_AMAZON_LOCATION_API_KEY?.trim()
  );
}

export function getAwsRegion(): string {
  return (
    process.env.AWS_REGION?.trim() ??
    process.env.NEXT_PUBLIC_AWS_REGION?.trim() ??
    "us-west-2"
  );
}

type GeocodeResultItem = {
  Title?: string;
  Position?: [number, number];
  Address?: { Label?: string };
};

type ReverseGeocodeResultItem = {
  Title?: string;
  PlaceType?: string;
  Categories?: { Id?: string; Name?: string }[];
};

const WATER_CATEGORY_IDS = new Set([
  "body_of_water",
  "ocean",
  "sea",
  "lake",
  "river",
  "bay",
  "strait",
  "canal",
  "reservoir",
]);

function resultLooksLikeWater(item: ReverseGeocodeResultItem): boolean {
  const placeType = item.PlaceType?.toLowerCase() ?? "";
  if (placeType.includes("water") || placeType === "body_of_water") {
    return true;
  }

  for (const category of item.Categories ?? []) {
    const id = category.Id?.toLowerCase() ?? "";
    const name = category.Name?.toLowerCase() ?? "";
    if (WATER_CATEGORY_IDS.has(id)) return true;
    if (name.includes("body of water") || name === "ocean" || name === "sea") {
      return true;
    }
  }

  return false;
}

export function classifyReverseGeocodeResults(
  items: ReverseGeocodeResultItem[] | undefined,
): boolean {
  if (!items?.length) return false;
  return items.some((item) => !resultLooksLikeWater(item));
}

/**
 * Geocode a US ZIP via Amazon Location Places API v2.
 * @see https://docs.aws.amazon.com/location/latest/APIReference/API_geoplaces_Geocode.html
 */
export async function geocodePostalCode(
  zipCode: string,
): Promise<{ lat: number; lng: number; label?: string } | null> {
  const apiKey = getLocationApiKey();
  if (!apiKey) return null;

  const region = getAwsRegion();
  // Places v2 expects the key as a query param, not x-api-key (see AWS Geocode API).
  const url = new URL(`https://places.geo.${region}.amazonaws.com/v2/geocode`);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      QueryText: zipCode.trim(),
      Filter: { IncludeCountries: ["USA"] },
      MaxResults: 1,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    if (res.status === 403 || res.status === 401) {
      const fallback = await geocodePostalCodeFallback(zipCode);
      if (fallback) return fallback;
    }
    throw new Error(`Places geocode ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { ResultItems?: GeocodeResultItem[] };
  const place = data.ResultItems?.[0];
  if (!place?.Position) return null;

  const [lng, lat] = place.Position;
  return {
    lat,
    lng,
    label: place.Title ?? place.Address?.Label,
  };
}

/**
 * Dev fallback when the API key is map-only (no Places Geocode on the key).
 * Production should use Amazon Location Places on the API key or sandbox.
 */
/**
 * Reverse geocode coordinates via Amazon Location Places API v2.
 * @see https://docs.aws.amazon.com/location/latest/APIReference/API_geoplaces_ReverseGeocode.html
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResultItem[] | null> {
  const apiKey = getLocationApiKey();
  if (!apiKey) return null;

  const region = getAwsRegion();
  const url = new URL(
    `https://places.geo.${region}.amazonaws.com/v2/reverse-geocode`,
  );
  url.searchParams.set("key", apiKey);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      QueryPosition: [lng, lat],
      MaxResults: 3,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    if (res.status === 403 || res.status === 401) {
      const fallback = await reverseGeocodeFallback(lat, lng);
      if (fallback) return fallback;
    }
    throw new Error(`Places reverse-geocode ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { ResultItems?: ReverseGeocodeResultItem[] };
  return data.ResultItems ?? [];
}

export async function isOnLand(lat: number, lng: number): Promise<boolean> {
  const items = await reverseGeocode(lat, lng);
  if (!items) {
    const fallback = await reverseGeocodeFallback(lat, lng);
    return fallback ? classifyReverseGeocodeResults(fallback) : false;
  }
  return classifyReverseGeocodeResults(items);
}

async function reverseGeocodeFallback(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResultItem[] | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}&format=json`,
    {
      headers: {
        "User-Agent": "GoodNeighbor-Hackathon/1.0 (local dev reverse fallback)",
      },
    },
  );
  if (!res.ok) return null;

  const hit = (await res.json()) as {
    type?: string;
    class?: string;
    display_name?: string;
  };

  const type = `${hit.type ?? ""} ${hit.class ?? ""}`.toLowerCase();
  const isWater =
    type.includes("water") ||
    type.includes("bay") ||
    type.includes("sea") ||
    type.includes("ocean") ||
    type.includes("lake") ||
    type.includes("river");

  if (isWater) {
    return [{ PlaceType: "body_of_water", Title: hit.display_name }];
  }

  return [{ PlaceType: "locality", Title: hit.display_name }];
}

async function geocodePostalCodeFallback(
  zipCode: string,
): Promise<{ lat: number; lng: number; label?: string } | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(zipCode.trim())}&countrycodes=us&format=json&limit=1`,
    {
      headers: {
        "User-Agent": "GoodNeighbor-Hackathon/1.0 (local dev zip fallback)",
      },
    },
  );
  if (!res.ok) return null;
  const results = (await res.json()) as { lat: string; lon: string; display_name?: string }[];
  const hit = results[0];
  if (!hit) return null;
  return {
    lat: Number.parseFloat(hit.lat),
    lng: Number.parseFloat(hit.lon),
    label: hit.display_name,
  };
}
