/**
 * Resolve API base URL: env override, then Amplify sandbox HTTP API output.
 */

export interface ApiOutputConfig {
  endpoint: string;
  region?: string;
  apiName?: string;
}

export function getApiBaseUrlFromOutputs(outputs: unknown): string | null {
  if (!outputs || typeof outputs !== "object") return null;
  const custom = (outputs as { custom?: { API?: Record<string, ApiOutputConfig> } })
    .custom;
  const api = custom?.API;
  if (!api) return null;
  const first = Object.values(api)[0];
  const endpoint = first?.endpoint?.replace(/\/$/, "");
  return endpoint ?? null;
}

export function resolveApiBaseUrl(outputs?: unknown): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (outputs) {
    const fromOutputs = getApiBaseUrlFromOutputs(outputs);
    if (fromOutputs) return fromOutputs;
  }

  throw new Error(
    "API URL not configured. Run npm run sandbox and restart dev, or set NEXT_PUBLIC_API_URL.",
  );
}
