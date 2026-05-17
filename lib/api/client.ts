/**
 * HTTP API client (docs/PLAN.md — Lambda API).
 */

import { resolveDeployedApiBaseUrl } from "@/lib/api/config";
import type {
  CreateHelpRequestInput,
  HelpRequestResponse,
  PrivateThread,
  PublicHelpRequest,
  ThreadMessage,
  UserProfile,
} from "@/lib/types/domain";

let cachedApiBaseUrl: string | null = null;

async function getApiBaseUrl(): Promise<string> {
  if (cachedApiBaseUrl) return cachedApiBaseUrl;
  try {
    const mod = await import("@/amplify_outputs.json");
    const outputs = mod.default ?? mod;
    cachedApiBaseUrl = resolveDeployedApiBaseUrl(outputs);
  } catch {
    cachedApiBaseUrl = resolveDeployedApiBaseUrl();
  }
  return cachedApiBaseUrl;
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
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// --- Profiles ---

export async function getProfileMe(authToken: string): Promise<UserProfile> {
  return apiFetch<UserProfile>("/profiles/me", { authToken });
}

export async function putProfileMe(
  authToken: string,
  body: Partial<UserProfile>,
): Promise<UserProfile> {
  return apiFetch<UserProfile>("/profiles/me", {
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
