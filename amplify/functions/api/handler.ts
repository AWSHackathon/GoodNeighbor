/**
 * Good Neighbor HTTP API (Phase 1+: profiles; later routes return 501).
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";

const TABLE_NAME = process.env.TABLE_NAME;
const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export type UserRole = "resident" | "moderator" | "admin";

export interface UserProfile {
  sub: string;
  email: string;
  displayName: string;
  role: UserRole;
  neighborhood?: string;
  zipCode?: string;
  lat?: number;
  lng?: number;
  createdAt: string;
  updatedAt?: string;
}

interface ProfileRecord extends UserProfile {
  PK: string;
  SK: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
};

function json(statusCode: number, data: unknown) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(data),
  };
}

type ApiGatewayEvent = Parameters<APIGatewayProxyHandlerV2>[0];

/** HTTP API + Cognito JWT authorizer (not in default APIGatewayEventRequestContextV2 types). */
type RequestContextWithJwt = ApiGatewayEvent["requestContext"] & {
  authorizer?: {
    jwt?: {
      claims?: Record<string, string | number | boolean>;
    };
  };
};

function getRouteKey(event: ApiGatewayEvent): string {
  const method = event.requestContext.http.method;
  const path = event.rawPath;
  return `${method} ${path}`;
}

function getJwtClaims(
  event: ApiGatewayEvent,
): Record<string, string | number | boolean> | undefined {
  const ctx = event.requestContext as RequestContextWithJwt;
  return ctx.authorizer?.jwt?.claims;
}

function getSub(event: ApiGatewayEvent): string | undefined {
  const claims = getJwtClaims(event);
  if (!claims) return undefined;
  const sub = claims.sub;
  return typeof sub === "string" ? sub : undefined;
}

function getClaim(event: ApiGatewayEvent, key: string): string | undefined {
  const claims = getJwtClaims(event);
  if (!claims) return undefined;
  const value = claims[key];
  return typeof value === "string" ? value : undefined;
}

function profileKeys(sub: string) {
  return { PK: `USER#${sub}`, SK: "PROFILE" };
}

function toProfile(record: ProfileRecord): UserProfile {
  const {
    PK: _pk,
    SK: _sk,
    updatedAt,
    ...profile
  } = record;
  return { ...profile, updatedAt };
}

function displayNameFromClaims(event: ApiGatewayEvent, email: string): string {
  const name = getClaim(event, "name");
  if (name) return name;
  const given = getClaim(event, "given_name");
  const family = getClaim(event, "family_name");
  if (given || family) {
    return [given, family].filter(Boolean).join(" ").trim();
  }
  return email.split("@")[0] ?? "Neighbor";
}

async function getProfileRecord(sub: string): Promise<ProfileRecord | null> {
  if (!TABLE_NAME) throw new Error("TABLE_NAME not configured");
  const result = await doc.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: profileKeys(sub),
    }),
  );
  return (result.Item as ProfileRecord | undefined) ?? null;
}

async function handleGetProfileMe(event: ApiGatewayEvent) {
  const sub = getSub(event);
  if (!sub) return json(401, { error: "Unauthorized" });

  const email = getClaim(event, "email");
  if (!email) return json(400, { error: "Email claim missing from token" });

  const existing = await getProfileRecord(sub);
  if (existing) {
    return json(200, toProfile(existing));
  }

  const now = new Date().toISOString();
  const record: ProfileRecord = {
    ...profileKeys(sub),
    sub,
    email,
    displayName: displayNameFromClaims(event, email),
    role: "resident",
    createdAt: now,
    updatedAt: now,
  };

  await doc.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: record,
      ConditionExpression: "attribute_not_exists(PK)",
    }),
  );

  return json(201, toProfile(record));
}

async function handlePutProfileMe(event: ApiGatewayEvent) {
  const sub = getSub(event);
  if (!sub) return json(401, { error: "Unauthorized" });

  let body: Partial<UserProfile>;
  try {
    body = event.body ? (JSON.parse(event.body) as Partial<UserProfile>) : {};
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const email = getClaim(event, "email");
  if (!email) return json(400, { error: "Email claim missing from token" });

  let record = await getProfileRecord(sub);
  const now = new Date().toISOString();

  if (!record) {
    record = {
      ...profileKeys(sub),
      sub,
      email,
      displayName: displayNameFromClaims(event, email),
      role: "resident",
      createdAt: now,
    };
  }

  if (body.displayName !== undefined) {
    record.displayName = String(body.displayName).trim() || record.displayName;
  }
  if (body.neighborhood !== undefined) {
    record.neighborhood = body.neighborhood
      ? String(body.neighborhood).trim()
      : undefined;
  }
  if (body.zipCode !== undefined) {
    record.zipCode = body.zipCode ? String(body.zipCode).trim() : undefined;
  }
  if (body.lat !== undefined) {
    record.lat = typeof body.lat === "number" ? body.lat : undefined;
  }
  if (body.lng !== undefined) {
    record.lng = typeof body.lng === "number" ? body.lng : undefined;
  }

  if (
    body.role !== undefined &&
    (body.role === "resident" ||
      body.role === "moderator" ||
      body.role === "admin")
  ) {
    record.role = body.role;
  }

  record.email = email;
  record.updatedAt = now;

  await doc.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: record,
    }),
  );

  return json(200, toProfile(record));
}

function notImplemented(routeKey: string) {
  return json(501, { error: "Not implemented", routeKey });
}

const routes: Record<
  string,
  (event: ApiGatewayEvent) => Promise<ReturnType<typeof json>>
> = {
  "GET /profiles/me": handleGetProfileMe,
  "PUT /profiles/me": handlePutProfileMe,
  "GET /requests": async (e) => notImplemented(getRouteKey(e)),
  "POST /requests": async (e) => notImplemented(getRouteKey(e)),
  "GET /leaderboard": async (e) => notImplemented(getRouteKey(e)),
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (event.requestContext.http.method === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  const routeKey = getRouteKey(event);
  const routeHandler = routes[routeKey];
  if (!routeHandler) {
    return json(404, { error: "Route not found", routeKey });
  }

  try {
    return await routeHandler(event);
  } catch (err) {
    console.error(routeKey, err);
    return json(500, {
      error: "Internal server error",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
};
