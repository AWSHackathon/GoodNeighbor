/**
 * Good Neighbor HTTP API — profiles, requests, threads, leaderboard.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import type {
  ProfileRecord,
  UserProfile,
  UserProfileWithMetrics,
} from "./handler-types.js";
import {
  getNeighborhoodContribution,
  getOrCreateStats,
  toUsageMetrics,
  touchStatsActivity,
} from "./profile-stats.js";
import {
  handleAcceptResponse,
  handleCreateRequest,
  handleFulfillRequest,
  handleGetLeaderboard,
  handleGetThread,
  handleListRequests,
  handleListResponses,
  handlePostThreadMessage,
  handleRespond,
} from "./requests-handlers.js";
import type { ApiGatewayEvent } from "./event.js";
import { getClaim, getSub, parseJsonBody } from "./event.js";
import { CORS_HEADERS, json, type ApiJsonResponse } from "./response.js";

const TABLE_NAME = process.env.TABLE_NAME;
const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function profileKeys(sub: string) {
  return { PK: `USER#${sub}`, SK: "PROFILE" };
}

function toProfile(record: ProfileRecord): UserProfile {
  const { PK: _pk, SK: _sk, updatedAt, ...profile } = record;
  return { ...profile, updatedAt };
}

async function toProfileWithMetrics(
  record: ProfileRecord,
): Promise<UserProfileWithMetrics> {
  if (!TABLE_NAME) throw new Error("TABLE_NAME not configured");

  const stats = await getOrCreateStats(doc, TABLE_NAME, record.sub);
  const neighborhoodContribution = await getNeighborhoodContribution(
    doc,
    TABLE_NAME,
    record.sub,
    record,
  );

  return {
    ...toProfile(record),
    usageMetrics: toUsageMetrics(stats),
    neighborhoodContribution,
  };
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

async function ensureProfileRecord(
  event: ApiGatewayEvent,
  sub: string,
): Promise<ProfileRecord | null> {
  const existing = await getProfileRecord(sub);
  if (existing) return existing;

  const email = getClaim(event, "email");
  if (!email || !TABLE_NAME) return null;

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

  try {
    await doc.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: record,
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );
  } catch (err) {
    const name = err && typeof err === "object" && "name" in err ? err.name : "";
    if (name === "ConditionalCheckFailedException") {
      return getProfileRecord(sub);
    }
    throw err;
  }

  return record;
}

async function handleGetProfileMe(event: ApiGatewayEvent) {
  const sub = getSub(event);
  if (!sub) return json(401, { error: "Unauthorized" });

  const email = getClaim(event, "email");
  if (!email) return json(400, { error: "Email claim missing from token" });

  const existing = await getProfileRecord(sub);
  if (existing) {
    return json(200, await toProfileWithMetrics(existing));
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

  return json(201, await toProfileWithMetrics(record));
}

async function handlePutProfileMe(event: ApiGatewayEvent) {
  const sub = getSub(event);
  if (!sub) return json(401, { error: "Unauthorized" });

  let body: Partial<UserProfile>;
  try {
    body = parseJsonBody<Partial<UserProfile>>(event);
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

  record.email = email;
  record.updatedAt = now;

  await doc.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: record,
    }),
  );

  await touchStatsActivity(doc, TABLE_NAME!, sub);

  return json(200, await toProfileWithMetrics(record));
}

function parseSegments(rawPath: string): string[] {
  return rawPath.split("/").filter(Boolean);
}

type RoutedHandler = (
  event: ApiGatewayEvent,
) => Promise<ApiJsonResponse>;

async function routeRequest(event: ApiGatewayEvent): Promise<ApiJsonResponse> {
  if (!TABLE_NAME) {
    return json(500, { error: "TABLE_NAME not configured" });
  }

  const method = event.requestContext.http.method;
  const segments = parseSegments(event.rawPath);

  if (method === "GET" && segments.length === 1 && segments[0] === "requests") {
    return handleListRequests(event, doc, TABLE_NAME);
  }
  if (method === "POST" && segments.length === 1 && segments[0] === "requests") {
    return handleCreateRequest(
      event,
      doc,
      TABLE_NAME,
      getProfileRecord,
      (sub, ev) => ensureProfileRecord(ev, sub),
    );
  }
  if (method === "GET" && segments.length === 1 && segments[0] === "leaderboard") {
    return handleGetLeaderboard(event, doc, TABLE_NAME);
  }

  if (segments[0] === "requests" && segments.length >= 2) {
    const requestId = segments[1];

    if (method === "POST" && segments.length === 3 && segments[2] === "respond") {
      return handleRespond(event, doc, TABLE_NAME, requestId, getProfileRecord);
    }
    if (method === "POST" && segments.length === 3 && segments[2] === "fulfill") {
      return handleFulfillRequest(event, doc, TABLE_NAME, requestId, getProfileRecord);
    }
    if (method === "GET" && segments.length === 3 && segments[2] === "responses") {
      return handleListResponses(event, doc, TABLE_NAME, requestId);
    }
    if (method === "GET" && segments.length === 3 && segments[2] === "thread") {
      return handleGetThread(event, doc, TABLE_NAME, requestId);
    }
    if (method === "POST" && segments.length === 4 && segments[2] === "thread" && segments[3] === "messages") {
      return handlePostThreadMessage(event, doc, TABLE_NAME, requestId);
    }
    if (
      method === "POST" &&
      segments.length === 5 &&
      segments[2] === "responses" &&
      segments[4] === "accept"
    ) {
      const responseId = segments[3];
      return handleAcceptResponse(event, doc, TABLE_NAME, requestId, responseId);
    }
  }

  return json(404, {
    error: "Route not found",
    routeKey: `${method} ${event.rawPath}`,
  });
}

const staticRoutes: Record<string, RoutedHandler> = {
  "GET /profiles/me": handleGetProfileMe,
  "PUT /profiles/me": handlePutProfileMe,
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const req = event as ApiGatewayEvent;

  if (event.requestContext.http.method === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  const routeKey = `${event.requestContext.http.method} ${event.rawPath}`;

  try {
    const staticHandler = staticRoutes[routeKey];
    if (staticHandler) {
      return await staticHandler(req);
    }
    return await routeRequest(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const name =
      err && typeof err === "object" && "name" in err
        ? String((err as { name: string }).name)
        : "Error";
    console.error(routeKey, name, message, err);
    return json(500, {
      error: "Internal server error",
      message: `${name}: ${message}`,
    });
  }
};
