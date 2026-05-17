/**
 * Resolve API base URLs: deployed Amplify HTTP API vs local Next.js mock routes.
 */

export interface ApiOutputConfig {
  endpoint: string;
  region?: string;
  apiName?: string;
}

const LOCAL_MOCK_API =
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/api\/?$/i;

export function getApiBaseUrlFromOutputs(outputs: unknown): string | null {
  if (!outputs || typeof outputs !== "object") return null;
  const custom = (outputs as { custom?: { API?: Record<string, ApiOutputConfig> } })
    .custom;
  const api = custom?.API;
  if (!api) return null;
  const first = Object.values(api)[0];
  const endpoint = first?.endpoint?.replace(/\/$/, "");
  if (!endpoint || endpoint.includes("REPLACE")) return null;
  return endpoint;
}

export function isLocalMockApiUrl(url: string): boolean {
  return LOCAL_MOCK_API.test(url.replace(/\/$/, ""));
}

/** Cognito-backed Lambda API (profiles, requests, …). */
export function resolveDeployedApiBaseUrl(outputs?: unknown): string {
  if (outputs) {
    const fromOutputs = getApiBaseUrlFromOutputs(outputs);
    if (fromOutputs) return fromOutputs;
  }

  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv && !isLocalMockApiUrl(fromEnv)) {
    return fromEnv.replace(/\/$/, "");
  }

  throw new Error(
    "Deployed API URL not configured. Run npm run sandbox and restart dev.",
  );
}

/** Next.js route handlers under /api (leaderboard mock, geocode, …). */
export function resolveLocalMockApiBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_LOCAL_API_URL?.trim() ??
    process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv && isLocalMockApiUrl(fromEnv)) {
    return fromEnv.replace(/\/$/, "");
  }
  return "http://127.0.0.1:3000/api";
}

/** @deprecated Use resolveDeployedApiBaseUrl or resolveLocalMockApiBaseUrl. */
export function resolveApiBaseUrl(outputs?: unknown): string {
  return resolveDeployedApiBaseUrl(outputs);
}
