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
