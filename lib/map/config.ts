/**
 * Amazon Location map configuration: Amplify Geo (sandbox) or API key (local dev).
 */

export type MapAuthMode = "amplify" | "api-key" | "none";

export interface ApiKeyMapConfig {
  mode: "api-key";
  apiKey: string;
  region: string;
  styleName: string;
}

export interface AmplifyMapConfig {
  mode: "amplify";
  hasGeo: boolean;
}

export interface NoMapConfig {
  mode: "none";
}

export type MapConfig = ApiKeyMapConfig | AmplifyMapConfig | NoMapConfig;

export function getPublicMapConfig(): MapConfig {
  const apiKey = process.env.NEXT_PUBLIC_AMAZON_LOCATION_API_KEY?.trim();
  const region =
    process.env.NEXT_PUBLIC_AWS_REGION?.trim() ?? "us-west-2";
  const styleName =
    process.env.NEXT_PUBLIC_LOCATION_MAP_STYLE?.trim() ?? "Standard";

  if (apiKey) {
    return { mode: "api-key", apiKey, region, styleName };
  }

  return { mode: "amplify", hasGeo: false };
}

export function hasAmplifyGeo(outputs: unknown): boolean {
  if (!outputs || typeof outputs !== "object") return false;
  const geo = (outputs as { geo?: { maps?: { default?: string } } }).geo;
  return Boolean(geo?.maps?.default);
}

export function getStyleDescriptorUrl(
  region: string,
  styleName: string,
  apiKey: string,
): string {
  return `https://maps.geo.${region}.amazonaws.com/v2/styles/${styleName}/descriptor?key=${encodeURIComponent(apiKey)}`;
}
