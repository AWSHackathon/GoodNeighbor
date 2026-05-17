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
  if (apiKey) {
    return {
      mode: "api-key",
      apiKey,
      region,
      // API keys on the v2 styles endpoint support "Standard"; sandbox map styles use Cognito.
      styleName: "Standard",
    };
  }

  return { mode: "amplify", hasGeo: false };
}

export function hasAmplifyGeo(outputs: unknown): boolean {
  if (!outputs || typeof outputs !== "object") return false;
  const geo = (outputs as { geo?: { maps?: { default?: string } } }).geo;
  return Boolean(geo?.maps?.default);
}

/** True when `amplify_outputs.json` is still the setup template, not a sandbox deploy. */
export function isPlaceholderAmplifyOutputs(outputs: unknown): boolean {
  if (!outputs || typeof outputs !== "object") return true;
  const poolId = (outputs as { auth?: { user_pool_id?: string } }).auth
    ?.user_pool_id;
  return !poolId || poolId === "REPLACE_AFTER_SANDBOX";
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

/** API key map config when NEXT_PUBLIC_AMAZON_LOCATION_API_KEY is set. */
export function resolveApiKeyMapConfig(outputs?: unknown): ApiKeyMapConfig | null {
  const apiKey = process.env.NEXT_PUBLIC_AMAZON_LOCATION_API_KEY?.trim();
  if (!apiKey) return null;

  const envRegion = process.env.NEXT_PUBLIC_AWS_REGION?.trim();
  const geo =
    outputs && !isPlaceholderAmplifyOutputs(outputs)
      ? getAmplifyGeoMapSettings(outputs)
      : null;

  return {
    mode: "api-key",
    apiKey,
    // API keys are regional; env wins over template amplify_outputs geo (often us-west-2).
    region: envRegion ?? geo?.region ?? "us-east-1",
    styleName: "Standard",
  };
}

/**
 * Prefer a working API key when present; otherwise Cognito-backed Amplify Geo.
 */
export async function resolveMapConfig(): Promise<MapConfig> {
  try {
    const mod = await import("@/amplify_outputs.json");
    const outputs = mod.default ?? mod;

    const apiKeyConfig = resolveApiKeyMapConfig(outputs);
    if (apiKeyConfig) return apiKeyConfig;

    if (hasAmplifyGeo(outputs) && !isPlaceholderAmplifyOutputs(outputs)) {
      return { mode: "amplify", hasGeo: true };
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
