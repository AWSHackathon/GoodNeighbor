/**
 * Lambda HTTP API route stubs (Phase 1+).
 * Enforce: public responses never include trueLat/trueLng;
 * thread routes require requester or accepted helper JWT sub.
 */

import type {
  CreateHelpRequestInput,
  PublicHelpRequest,
} from "../../../lib/types/domain";
import { derivePublicPin } from "../../../lib/location/obfuscate";

export type ApiRouteHandler = (
  event: ApiGatewayEvent,
) => Promise<ApiGatewayResponse>;

export interface ApiGatewayEvent {
  routeKey: string;
  pathParameters?: Record<string, string>;
  body?: string;
  requestContext?: { authorizer?: { jwt?: { claims?: { sub?: string } } } };
}

export interface ApiGatewayResponse {
  statusCode: number;
  body: string;
}

function json(statusCode: number, data: unknown): ApiGatewayResponse {
  return {
    statusCode,
    body: JSON.stringify(data),
  };
}

function notImplemented(routeKey: string): ApiGatewayResponse {
  return json(501, { error: "Not implemented", routeKey });
}

/** Build public request payload; strips private coordinates. */
export function toPublicHelpRequest(
  record: CreateHelpRequestInput & {
    id: string;
    authorDisplayName: string;
    neighborhood: string;
    status: PublicHelpRequest["status"];
    createdAt: string;
  },
): PublicHelpRequest {
  const pin = derivePublicPin(record.trueLat, record.trueLng, record.id);
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    authorDisplayName: record.authorDisplayName,
    publicLat: pin.lat,
    publicLng: pin.lng,
    bufferRadiusMeters: pin.bufferRadiusMeters,
    meetingPlaceLabel: record.meetingPlaceLabel,
    neighborhood: record.neighborhood,
    status: record.status,
    createdAt: record.createdAt,
  };
}

const routes: Record<string, ApiRouteHandler> = {
  "GET /profiles/me": async () => notImplemented("GET /profiles/me"),
  "PUT /profiles/me": async () => notImplemented("PUT /profiles/me"),
  "GET /requests": async () => notImplemented("GET /requests"),
  "POST /requests": async () => notImplemented("POST /requests"),
  "POST /requests/{id}/respond": async () =>
    notImplemented("POST /requests/{id}/respond"),
  "POST /requests/{id}/responses/{responseId}/accept": async () =>
    notImplemented("POST /requests/{id}/responses/{responseId}/accept"),
  "GET /requests/{id}/thread": async () =>
    notImplemented("GET /requests/{id}/thread"),
  "POST /requests/{id}/thread/messages": async () =>
    notImplemented("POST /requests/{id}/thread/messages"),
};

export const handler: ApiRouteHandler = async (event) => {
  const routeHandler = routes[event.routeKey];
  if (!routeHandler) {
    return json(404, { error: "Route not found", routeKey: event.routeKey });
  }
  return routeHandler(event);
};
