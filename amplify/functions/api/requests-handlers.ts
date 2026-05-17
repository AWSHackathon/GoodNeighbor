/**
 * Help requests, responses, private threads, fulfill, leaderboard.
 */

import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import { derivePublicPin } from "./obfuscate.js";
import {
  geofenceKeyForRequestPin,
  neighborhoodLabel,
} from "./geofence.js";
import type { ProfileRecord, UserProfile } from "./handler-types.js";
import { currentIsoWeekId } from "./iso-week.js";
import { incrementUserStats } from "./profile-stats.js";
import type { ApiGatewayEvent } from "./event.js";
import { getSub, parseJsonBody } from "./event.js";
import { json, type ApiJsonResponse } from "./response.js";

export type HelpRequestStatus = "open" | "claimed" | "fulfilled" | "expired";
export type ResponseStatus = "pending" | "accepted" | "declined";

export interface PublicHelpRequest {
  id: string;
  title: string;
  description: string;
  authorDisplayName: string;
  publicLat: number;
  publicLng: number;
  bufferRadiusMeters: number;
  meetingPlaceLabel?: string;
  neighborhood: string;
  geofence?: string;
  status: HelpRequestStatus;
  createdAt: string;
}

interface RequestMetadata {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  id: string;
  title: string;
  description: string;
  requesterSub: string;
  authorDisplayName: string;
  trueLat: number;
  trueLng: number;
  publicLat: number;
  publicLng: number;
  bufferRadiusMeters: number;
  meetingPlaceLabel?: string;
  neighborhood: string;
  geofence: string;
  status: HelpRequestStatus;
  acceptedHelperSub?: string;
  createdAt: string;
  updatedAt?: string;
  fulfilledAt?: string;
}

interface ResponseRecord {
  PK: string;
  SK: string;
  id: string;
  requestId: string;
  responderSub: string;
  responderDisplayName: string;
  status: ResponseStatus;
  message?: string;
  createdAt: string;
}

interface ThreadRecord {
  PK: string;
  SK: string;
  requestId: string;
  requesterSub: string;
  helperSub: string;
  createdAt: string;
}

interface MessageRecord {
  PK: string;
  SK: string;
  id: string;
  requestId: string;
  senderSub: string;
  body: string;
  createdAt: string;
}

interface LeaderRecord {
  PK: string;
  SK: string;
  userSub: string;
  displayName: string;
  requestsCompleted: number;
  hoursContributed: number;
  updatedAt: string;
}

function toPublicRequest(record: RequestMetadata): PublicHelpRequest {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    authorDisplayName: record.authorDisplayName,
    publicLat: record.publicLat,
    publicLng: record.publicLng,
    bufferRadiusMeters: record.bufferRadiusMeters,
    meetingPlaceLabel: record.meetingPlaceLabel,
    neighborhood: record.neighborhood,
    geofence: record.geofence,
    status: record.status,
    createdAt: record.createdAt,
  };
}

function gsiSk(status: HelpRequestStatus, createdAt: string, id: string): string {
  return `STATUS#${status}#${createdAt}#${id}`;
}

async function listRequestsByGeofence(
  doc: DynamoDBDocumentClient,
  tableName: string,
  geofence: string,
): Promise<RequestMetadata[]> {
  try {
    const result = await doc.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: { ":pk": `GEOFENCE#${geofence}` },
        ScanIndexForward: false,
      }),
    );
    return (result.Items ?? []) as RequestMetadata[];
  } catch (err) {
    console.warn("GSI1 query failed, using table scan fallback", err);
    const result = await doc.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression:
          "begins_with(PK, :pfx) AND SK = :sk AND geofence = :gf",
        ExpressionAttributeValues: {
          ":pfx": "REQUEST#",
          ":sk": "METADATA",
          ":gf": geofence,
        },
      }),
    );
    return (result.Items ?? []) as RequestMetadata[];
  }
}

async function getRequestMetadata(
  doc: DynamoDBDocumentClient,
  tableName: string,
  requestId: string,
): Promise<RequestMetadata | null> {
  const result = await doc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: `REQUEST#${requestId}`, SK: "METADATA" },
    }),
  );
  return (result.Item as RequestMetadata | undefined) ?? null;
}

export async function handleListRequests(
  event: ApiGatewayEvent,
  doc: DynamoDBDocumentClient,
  tableName: string,
): Promise<ApiJsonResponse> {
  const sub = getSub(event);
  if (!sub) return json(401, { error: "Unauthorized" });

  const geofence = event.queryStringParameters?.geofence?.trim();
  if (!geofence) {
    return json(400, { error: "geofence query parameter is required" });
  }

  const items = await listRequestsByGeofence(doc, tableName, geofence);
  const publicItems = items
    .filter((item) => item.SK === "METADATA")
    .map((item) => ({
      ...toPublicRequest(item),
      isOwn: item.requesterSub === sub,
    }))
    .filter((r) => r.status !== "expired");

  return json(200, publicItems);
}

export async function handleCreateRequest(
  event: ApiGatewayEvent,
  doc: DynamoDBDocumentClient,
  tableName: string,
  getProfile: (sub: string) => Promise<ProfileRecord | null>,
  ensureProfile?: (
    sub: string,
    event: ApiGatewayEvent,
  ) => Promise<ProfileRecord | null>,
): Promise<ApiJsonResponse> {
  const sub = getSub(event);
  if (!sub) return json(401, { error: "Unauthorized" });

  let body: {
    title?: string;
    description?: string;
    trueLat?: number;
    trueLng?: number;
    meetingPlaceLabel?: string;
  };
  try {
    body = parseJsonBody(event);
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  if (!title || !description) {
    return json(400, { error: "title and description are required" });
  }
  if (typeof body.trueLat !== "number" || typeof body.trueLng !== "number") {
    return json(400, { error: "trueLat and trueLng are required" });
  }

  let profileRecord = await getProfile(sub);
  if (!profileRecord && ensureProfile) {
    profileRecord = await ensureProfile(sub, event);
  }
  if (!profileRecord) {
    return json(400, {
      error: "Profile required before creating a request. Refresh and try again.",
    });
  }

  const profile = profileRecord as unknown as UserProfile;
  const geofence = geofenceKeyForRequestPin(body.trueLat, body.trueLng);
  const nhLabel = neighborhoodLabel(profile, geofence);
  const id = randomUUID();
  const now = new Date().toISOString();
  const pin = derivePublicPin(body.trueLat, body.trueLng, id);

  const record: RequestMetadata = {
    PK: `REQUEST#${id}`,
    SK: "METADATA",
    GSI1PK: `GEOFENCE#${geofence}`,
    GSI1SK: gsiSk("open", now, id),
    id,
    title,
    description,
    requesterSub: sub,
    authorDisplayName: profile.displayName,
    trueLat: body.trueLat,
    trueLng: body.trueLng,
    publicLat: pin.lat,
    publicLng: pin.lng,
    bufferRadiusMeters: pin.bufferRadiusMeters,
    meetingPlaceLabel: body.meetingPlaceLabel
      ? String(body.meetingPlaceLabel).trim()
      : undefined,
    neighborhood: nhLabel,
    geofence,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };

  await doc.send(
    new PutCommand({
      TableName: tableName,
      Item: record,
      ConditionExpression: "attribute_not_exists(PK)",
    }),
  );

  await incrementUserStats(doc, tableName, sub, { requestsPosted: 1 });

  return json(201, toPublicRequest(record));
}

export async function handleRespond(
  event: ApiGatewayEvent,
  doc: DynamoDBDocumentClient,
  tableName: string,
  requestId: string,
  getProfile: (sub: string) => Promise<ProfileRecord | null>,
): Promise<ApiJsonResponse> {
  const sub = getSub(event);
  if (!sub) return json(401, { error: "Unauthorized" });

  const request = await getRequestMetadata(doc, tableName, requestId);
  if (!request) return json(404, { error: "Request not found" });
  if (request.status !== "open") {
    return json(400, { error: "Request is not open for responses" });
  }
  if (request.requesterSub === sub) {
    return json(400, { error: "Cannot respond to your own request" });
  }

  const existing = await doc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: `REQUEST#${requestId}`, SK: `RESPONSE#${sub}` },
    }),
  );
  if (existing.Item) {
    return json(409, { error: "You already responded to this request" });
  }

  let body: { message?: string } = {};
  try {
    body = parseJsonBody(event);
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const profileRecord = await getProfile(sub);
  const displayName =
    (profileRecord as UserProfile | null)?.displayName ?? "Neighbor";
  const now = new Date().toISOString();

  const response: ResponseRecord = {
    PK: `REQUEST#${requestId}`,
    SK: `RESPONSE#${sub}`,
    id: sub,
    requestId,
    responderSub: sub,
    responderDisplayName: displayName,
    status: "pending",
    message: body.message ? String(body.message).trim() : undefined,
    createdAt: now,
  };

  await doc.send(
    new PutCommand({
      TableName: tableName,
      Item: response,
      ConditionExpression: "attribute_not_exists(PK)",
    }),
  );

  await incrementUserStats(doc, tableName, sub, { responsesSubmitted: 1 });

  return json(201, {
    id: response.id,
    requestId: response.requestId,
    responderSub: response.responderSub,
    responderDisplayName: response.responderDisplayName,
    status: response.status,
    message: response.message,
    createdAt: response.createdAt,
  });
}

export async function handleAcceptResponse(
  event: ApiGatewayEvent,
  doc: DynamoDBDocumentClient,
  tableName: string,
  requestId: string,
  responseId: string,
): Promise<ApiJsonResponse> {
  const sub = getSub(event);
  if (!sub) return json(401, { error: "Unauthorized" });

  const request = await getRequestMetadata(doc, tableName, requestId);
  if (!request) return json(404, { error: "Request not found" });
  if (request.requesterSub !== sub) {
    return json(403, { error: "Only the requester can accept an offer" });
  }
  if (request.status !== "open") {
    return json(400, { error: "Request already has an accepted helper" });
  }

  const accepted = await doc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: `REQUEST#${requestId}`, SK: `RESPONSE#${responseId}` },
    }),
  );
  const acceptedRecord = accepted.Item as ResponseRecord | undefined;
  if (!acceptedRecord || acceptedRecord.status !== "pending") {
    return json(404, { error: "Response not found or not pending" });
  }

  const allResponses = await doc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `REQUEST#${requestId}`,
        ":prefix": "RESPONSE#",
      },
    }),
  );

  const now = new Date().toISOString();
  for (const item of allResponses.Items ?? []) {
    const resp = item as ResponseRecord;
    const newStatus: ResponseStatus =
      resp.responderSub === responseId ? "accepted" : "declined";
    await doc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: resp.PK, SK: resp.SK },
        UpdateExpression: "SET #status = :status",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":status": newStatus },
      }),
    );
  }

  const thread: ThreadRecord = {
    PK: `REQUEST#${requestId}`,
    SK: `THREAD#${responseId}`,
    requestId,
    requesterSub: sub,
    helperSub: responseId,
    createdAt: now,
  };
  await doc.send(new PutCommand({ TableName: tableName, Item: thread }));

  const welcome: MessageRecord = {
    PK: `REQUEST#${requestId}`,
    SK: `MSG#${now}#${randomUUID()}`,
    id: randomUUID(),
    requestId,
    senderSub: "system",
    body: "You're connected. Share exact meet-up details here — not on the public map.",
    createdAt: now,
  };
  await doc.send(new PutCommand({ TableName: tableName, Item: welcome }));

  const updatedAt = now;
  await doc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK: request.PK, SK: request.SK },
      UpdateExpression:
        "SET #status = :status, acceptedHelperSub = :helper, updatedAt = :updatedAt, GSI1SK = :gsiSk",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": "claimed",
        ":helper": responseId,
        ":updatedAt": updatedAt,
        ":gsiSk": gsiSk("claimed", request.createdAt, requestId),
      },
    }),
  );

  return json(200, {
    requestId,
    requesterSub: sub,
    helperSub: responseId,
    messages: [
      {
        id: welcome.id,
        requestId,
        senderSub: welcome.senderSub,
        body: welcome.body,
        createdAt: welcome.createdAt,
      },
    ],
  });
}

async function loadThreadMessages(
  doc: DynamoDBDocumentClient,
  tableName: string,
  requestId: string,
): Promise<MessageRecord[]> {
  const result = await doc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `REQUEST#${requestId}`,
        ":prefix": "MSG#",
      },
    }),
  );
  const messages = (result.Items ?? []) as MessageRecord[];
  messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return messages;
}

async function getThreadForUser(
  doc: DynamoDBDocumentClient,
  tableName: string,
  requestId: string,
  sub: string,
): Promise<ThreadRecord | null> {
  const request = await getRequestMetadata(doc, tableName, requestId);
  if (!request?.acceptedHelperSub) return null;

  const threadResult = await doc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: `REQUEST#${requestId}`,
        SK: `THREAD#${request.acceptedHelperSub}`,
      },
    }),
  );
  const thread = threadResult.Item as ThreadRecord | undefined;
  if (!thread) return null;
  if (thread.requesterSub !== sub && thread.helperSub !== sub) return null;
  return thread;
}

export async function handleGetThread(
  event: ApiGatewayEvent,
  doc: DynamoDBDocumentClient,
  tableName: string,
  requestId: string,
): Promise<ApiJsonResponse> {
  const sub = getSub(event);
  if (!sub) return json(401, { error: "Unauthorized" });

  const thread = await getThreadForUser(doc, tableName, requestId, sub);
  if (!thread) {
    return json(403, { error: "Thread not available for this user" });
  }

  const messages = await loadThreadMessages(doc, tableName, requestId);
  return json(200, {
    requestId,
    requesterSub: thread.requesterSub,
    helperSub: thread.helperSub,
    messages: messages.map((m) => ({
      id: m.id,
      requestId: m.requestId,
      senderSub: m.senderSub,
      body: m.body,
      createdAt: m.createdAt,
    })),
  });
}

export async function handlePostThreadMessage(
  event: ApiGatewayEvent,
  doc: DynamoDBDocumentClient,
  tableName: string,
  requestId: string,
): Promise<ApiJsonResponse> {
  const sub = getSub(event);
  if (!sub) return json(401, { error: "Unauthorized" });

  const thread = await getThreadForUser(doc, tableName, requestId, sub);
  if (!thread) {
    return json(403, { error: "Thread not available for this user" });
  }

  let body: { body?: string } = {};
  try {
    body = parseJsonBody(event);
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const text = String(body.body ?? "").trim();
  if (!text) return json(400, { error: "body is required" });

  const now = new Date().toISOString();
  const id = randomUUID();
  const message: MessageRecord = {
    PK: `REQUEST#${requestId}`,
    SK: `MSG#${now}#${id}`,
    id,
    requestId,
    senderSub: sub,
    body: text,
    createdAt: now,
  };

  await doc.send(new PutCommand({ TableName: tableName, Item: message }));

  return json(201, {
    id: message.id,
    requestId,
    senderSub: message.senderSub,
    body: message.body,
    createdAt: message.createdAt,
  });
}

async function incrementLeaderboard(
  doc: DynamoDBDocumentClient,
  tableName: string,
  geofence: string,
  userSub: string,
  displayName: string,
  hours: number,
): Promise<void> {
  const now = new Date().toISOString();
  const weekId = currentIsoWeekId();

  for (const sk of [`LEADER#ALL#${userSub}`, `LEADER#WEEK#${weekId}#${userSub}`]) {
    const existing = await doc.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: `GEOFENCE#${geofence}`, SK: sk },
      }),
    );

    if (existing.Item) {
      const row = existing.Item as LeaderRecord;
      await doc.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { PK: row.PK, SK: row.SK },
          UpdateExpression:
            "SET requestsCompleted = requestsCompleted + :one, hoursContributed = hoursContributed + :hours, updatedAt = :now",
          ExpressionAttributeValues: {
            ":one": 1,
            ":hours": hours,
            ":now": now,
          },
        }),
      );
    } else {
      const row: LeaderRecord = {
        PK: `GEOFENCE#${geofence}`,
        SK: sk,
        userSub,
        displayName,
        requestsCompleted: 1,
        hoursContributed: hours,
        updatedAt: now,
      };
      await doc.send(new PutCommand({ TableName: tableName, Item: row }));
    }
  }
}

export async function handleFulfillRequest(
  event: ApiGatewayEvent,
  doc: DynamoDBDocumentClient,
  tableName: string,
  requestId: string,
  getProfile: (sub: string) => Promise<ProfileRecord | null>,
): Promise<ApiJsonResponse> {
  const sub = getSub(event);
  if (!sub) return json(401, { error: "Unauthorized" });

  const request = await getRequestMetadata(doc, tableName, requestId);
  if (!request) return json(404, { error: "Request not found" });
  if (request.status !== "claimed") {
    return json(400, { error: "Only claimed requests can be fulfilled" });
  }

  const isRequester = request.requesterSub === sub;
  const isHelper = request.acceptedHelperSub === sub;
  if (!isRequester && !isHelper) {
    return json(403, { error: "Only participants can mark fulfilled" });
  }

  let body: { hoursContributed?: number } = {};
  try {
    body = parseJsonBody(event);
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const hours =
    typeof body.hoursContributed === "number" && body.hoursContributed > 0
      ? body.hoursContributed
      : 1;

  const now = new Date().toISOString();
  await doc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK: request.PK, SK: request.SK },
      UpdateExpression:
        "SET #status = :status, fulfilledAt = :fulfilledAt, updatedAt = :now, GSI1SK = :gsiSk",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": "fulfilled",
        ":fulfilledAt": now,
        ":now": now,
        ":gsiSk": gsiSk("fulfilled", request.createdAt, requestId),
      },
    }),
  );

  if (request.acceptedHelperSub) {
    const helperProfile = await getProfile(request.acceptedHelperSub);
    const helperName =
      (helperProfile as UserProfile | null)?.displayName ?? "Neighbor";
    await incrementLeaderboard(
      doc,
      tableName,
      request.geofence,
      request.acceptedHelperSub,
      helperName,
      hours,
    );
    await incrementUserStats(doc, tableName, request.acceptedHelperSub, {
      helpsCompleted: 1,
      hoursContributed: hours,
    });
  }

  return json(200, toPublicRequest({ ...request, status: "fulfilled", fulfilledAt: now }));
}

export async function handleGetLeaderboard(
  event: ApiGatewayEvent,
  doc: DynamoDBDocumentClient,
  tableName: string,
): Promise<ApiJsonResponse> {
  const sub = getSub(event);
  if (!sub) return json(401, { error: "Unauthorized" });

  const neighborhood = event.queryStringParameters?.neighborhood?.trim();
  if (!neighborhood) {
    return json(400, { error: "neighborhood query parameter is required" });
  }

  const period = event.queryStringParameters?.period === "week" ? "week" : "all";
  const weekId = currentIsoWeekId();
  const prefix = period === "week" ? `LEADER#WEEK#${weekId}#` : "LEADER#ALL#";

  const result = await doc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `GEOFENCE#${neighborhood}`,
        ":prefix": prefix,
      },
    }),
  );

  const rows = (result.Items ?? []) as LeaderRecord[];
  rows.sort((a, b) => {
    if (b.hoursContributed !== a.hoursContributed) {
      return b.hoursContributed - a.hoursContributed;
    }
    return b.requestsCompleted - a.requestsCompleted;
  });

  const entries = rows.map((row, index) => ({
    rank: index + 1,
    userSub: row.userSub,
    displayName: row.displayName,
    requestsCompleted: row.requestsCompleted,
    hoursContributed: row.hoursContributed,
  }));

  return json(200, {
    neighborhood,
    neighborhoodLabel: neighborhood.replace(/-/g, " "),
    period,
    weekId: period === "week" ? weekId : undefined,
    entries,
    updatedAt: new Date().toISOString(),
  });
}

export async function handleListResponses(
  event: ApiGatewayEvent,
  doc: DynamoDBDocumentClient,
  tableName: string,
  requestId: string,
): Promise<ApiJsonResponse> {
  const sub = getSub(event);
  if (!sub) return json(401, { error: "Unauthorized" });

  const request = await getRequestMetadata(doc, tableName, requestId);
  if (!request) return json(404, { error: "Request not found" });

  const result = await doc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `REQUEST#${requestId}`,
        ":prefix": "RESPONSE#",
      },
    }),
  );

  const responses = (result.Items ?? []) as ResponseRecord[];

  if (request.requesterSub === sub) {
    return json(
      200,
      responses.map((r) => ({
        id: r.id,
        requestId: r.requestId,
        responderSub: r.responderSub,
        responderDisplayName: r.responderDisplayName,
        status: r.status,
        message: r.message,
        createdAt: r.createdAt,
      })),
    );
  }

  const mine = responses.find((r) => r.responderSub === sub);
  return json(200, mine ? [mine] : []);
}
