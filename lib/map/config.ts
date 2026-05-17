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

type GeoOutputs = {
  geo?: {
    aws_region?: string;
    maps?: {
      default?: string;
      items?: Record<string, { style?: string }>;
    };
  };
};

/** Region + style from sandbox `amplify_outputs.json` geo section. */
export function getAmplifyGeoMapSettings(outputs: unknown): {
  region: string;
  styleName: string;
} | null {
  if (!hasAmplifyGeo(outputs)) return null;
  const geo = (outputs as GeoOutputs).geo;
  const mapName = geo?.maps?.default;
  const region = geo?.aws_region;
  if (!mapName || !region) return null;
  const styleName =
    geo?.maps?.items?.[mapName]?.style ?? "VectorEsriNavigation";
  return { region, styleName };
}

/**
 * Prefer Amplify Geo (Cognito-backed tiles) when sandbox deployed geo exists;
 * otherwise fall back to API key from env.
 */
export async function resolveMapConfig(): Promise<MapConfig> {
  try {
    const mod = await import("@/amplify_outputs.json");
    const outputs = mod.default ?? mod;

    if (hasAmplifyGeo(outputs)) {
      return { mode: "amplify", hasGeo: true };
    }

    const apiKey = process.env.NEXT_PUBLIC_AMAZON_LOCATION_API_KEY?.trim();
    if (apiKey) {
      const geo = getAmplifyGeoMapSettings(outputs);
      return {
        mode: "api-key",
        apiKey,
        region:
          geo?.region ??
          process.env.NEXT_PUBLIC_AWS_REGION?.trim() ??
          "us-east-1",
        styleName:
          geo?.styleName ??
          process.env.NEXT_PUBLIC_LOCATION_MAP_STYLE?.trim() ??
          "Standard",
      };
    }
  } catch {
    // outputs not generated yet
  }

  return getPublicMapConfig();
}

export function getStyleDescriptorUrl(
  region: string,
  styleName: string,
  apiKey: string,
): string {
  return `https://maps.geo.${region}.amazonaws.com/v2/styles/${styleName}/descriptor?key=${encodeURIComponent(apiKey)}`;
}
