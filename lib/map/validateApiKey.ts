/**
 * Probes tile access for an Amazon Location API key before MapLibre loads tiles.
 * Style descriptors can succeed while GetTile is denied on a mis-scoped key.
 */
export async function assertMapTileAccess(
  region: string,
  apiKey: string,
): Promise<void> {
  const url = `https://maps.geo.${region}.amazonaws.com/v2/tiles/vector.basemap/0/0/0?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (res.ok) return;

  const detail = await res.text().catch(() => res.statusText);
  const resourceArn = `arn:aws:geo-maps:${region}::provider/default`;

  throw new Error(
    `Amazon Location API key cannot load map tiles (HTTP ${res.status}). ` +
      `In the Location Service console → API keys, allow Maps actions such as geo-maps:* ` +
      `on resource ${resourceArn} (not only Places / Geocode). ` +
      `Or remove NEXT_PUBLIC_AMAZON_LOCATION_API_KEY and run npm run sandbox. ` +
      (detail ? `AWS: ${detail.slice(0, 200)}` : ""),
  );
}
