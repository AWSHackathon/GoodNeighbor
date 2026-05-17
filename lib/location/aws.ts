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
  const res = await fetch(`https://places.geo.${region}.amazonaws.com/v2/geocode`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      QueryText: zipCode.trim(),
      Filter: { IncludeCountries: ["USA"] },
      MaxResults: 1,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
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
