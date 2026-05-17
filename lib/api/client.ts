/**
 * HTTP API client (docs/PLAN.md — Lambda API).
 */

import { resolveDeployedApiBaseUrl } from "@/lib/api/config";
import type {
  CreateHelpRequestInput,
  FulfillHelpRequestInput,
  HelpRequestResponse,
  PrivateThread,
  PublicHelpRequest,
  ThreadMessage,
  UserProfile,
  UserProfileWithMetrics,
} from "@/lib/types/domain";
import type { LeaderboardResponse } from "@/lib/types/leaderboard";

/** Always read fresh from amplify_outputs.json (avoids stale URL after sandbox redeploy). */
async function getApiBaseUrl(): Promise<string> {
  try {
    const mod = await import("@/amplify_outputs.json");
    const outputs = mod.default ?? mod;
    return resolveDeployedApiBaseUrl(outputs);
  } catch {
    return resolveDeployedApiBaseUrl();
  }
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit & { authToken?: string },
): Promise<T> {
  const { authToken, ...fetchInit } = init ?? {};
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(fetchInit.headers ?? {}),
  };
  if (authToken) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${authToken}`;
  }

  const base = await getApiBaseUrl();
  const res = await fetch(`${base}${path}`, {
    ...fetchInit,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string };
      const detail = [parsed.error, parsed.message].filter(Boolean).join(": ");
      if (detail) {
        throw new Error(detail);
      }
    } catch (e) {
      if (e instanceof Error && !e.message.startsWith("API ")) {
        throw e;
      }
    }
    throw new Error(`Request failed (${res.status}). ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

// --- Profiles ---

export async function getProfileMe(
  authToken: string,
): Promise<UserProfileWithMetrics> {
  return apiFetch<UserProfileWithMetrics>("/profiles/me", { authToken });
}

export async function putProfileMe(
  authToken: string,
  body: Partial<UserProfile>,
): Promise<UserProfileWithMetrics> {
  return apiFetch<UserProfileWithMetrics>("/profiles/me", {
    method: "PUT",
    authToken,
    body: JSON.stringify(body),
  });
}

// --- Requests (public fields only on list) ---

export async function listRequests(
  authToken: string,
  params?: { geofence?: string },
): Promise<PublicHelpRequest[]> {
  const q = params?.geofence
    ? `?geofence=${encodeURIComponent(params.geofence)}`
    : "";
  return apiFetch<PublicHelpRequest[]>(`/requests${q}`, { authToken });
}

export async function createRequest(
  authToken: string,
  body: CreateHelpRequestInput,
): Promise<PublicHelpRequest> {
  return apiFetch<PublicHelpRequest>("/requests", {
    method: "POST",
    authToken,
    body: JSON.stringify(body),
  });
}

export async function respondToRequest(
  authToken: string,
  requestId: string,
  message?: string,
): Promise<HelpRequestResponse> {
  return apiFetch<HelpRequestResponse>(`/requests/${requestId}/respond`, {
    method: "POST",
    authToken,
    body: JSON.stringify({ message }),
  });
}

export async function acceptResponse(
  authToken: string,
  requestId: string,
  responseId: string,
): Promise<PrivateThread> {
  return apiFetch<PrivateThread>(
    `/requests/${requestId}/responses/${responseId}/accept`,
    { method: "POST", authToken },
  );
}

// --- Private thread (participants only; exact meet-up details) ---

export async function getRequestThread(
  authToken: string,
  requestId: string,
): Promise<PrivateThread> {
  return apiFetch<PrivateThread>(`/requests/${requestId}/thread`, {
    authToken,
  });
}

export async function postThreadMessage(
  authToken: string,
  requestId: string,
  body: string,
): Promise<ThreadMessage> {
  return apiFetch<ThreadMessage>(`/requests/${requestId}/thread/messages`, {
    method: "POST",
    authToken,
    body: JSON.stringify({ body }),
  });
}

export async function listRequestResponses(
  authToken: string,
  requestId: string,
): Promise<HelpRequestResponse[]> {
  return apiFetch<HelpRequestResponse[]>(`/requests/${requestId}/responses`, {
    authToken,
  });
}

export async function fulfillRequest(
  authToken: string,
  requestId: string,
  body?: FulfillHelpRequestInput,
): Promise<PublicHelpRequest> {
  return apiFetch<PublicHelpRequest>(`/requests/${requestId}/fulfill`, {
    method: "POST",
    authToken,
    body: JSON.stringify(body ?? {}),
  });
}

export async function getLeaderboard(
  authToken: string,
  params: { neighborhood: string; period?: "all" | "week" },
): Promise<LeaderboardResponse> {
  const q = new URLSearchParams({
    neighborhood: params.neighborhood,
    period: params.period ?? "all",
  });
  return apiFetch<LeaderboardResponse>(`/leaderboard?${q}`, { authToken });
}
