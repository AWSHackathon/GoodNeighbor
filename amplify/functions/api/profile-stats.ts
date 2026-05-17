import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { currentIsoWeekId } from "./iso-week.js";
import type { ProfileRecord, StatsRecord, UserUsageMetrics } from "./handler-types.js";
import { geofenceKey } from "./geofence.js";

export function statsKeys(sub: string) {
  return { PK: `USER#${sub}`, SK: "STATS" };
}

function emptyStatsRecord(sub: string, now: string): StatsRecord {
  return {
    ...statsKeys(sub),
    requestsPosted: 0,
    responsesSubmitted: 0,
    helpsCompleted: 0,
    hoursContributed: 0,
    updatedAt: now,
  };
}

export function toUsageMetrics(record: StatsRecord): UserUsageMetrics {
  return {
    requestsPosted: record.requestsPosted ?? 0,
    responsesSubmitted: record.responsesSubmitted ?? 0,
    helpsCompleted: record.helpsCompleted ?? 0,
    hoursContributed: record.hoursContributed ?? 0,
    lastActiveAt: record.lastActiveAt,
  };
}

export async function getOrCreateStats(
  doc: DynamoDBDocumentClient,
  tableName: string,
  sub: string,
): Promise<StatsRecord> {
  const result = await doc.send(
    new GetCommand({
      TableName: tableName,
      Key: statsKeys(sub),
    }),
  );
  if (result.Item) {
    return result.Item as StatsRecord;
  }

  const now = new Date().toISOString();
  const record = emptyStatsRecord(sub, now);

  try {
    await doc.send(
      new PutCommand({
        TableName: tableName,
        Item: record,
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );
  } catch (err) {
    const name = err && typeof err === "object" && "name" in err ? err.name : "";
    if (name === "ConditionalCheckFailedException") {
      const retry = await doc.send(
        new GetCommand({ TableName: tableName, Key: statsKeys(sub) }),
      );
      if (retry.Item) return retry.Item as StatsRecord;
    }
    throw err;
  }

  return record;
}

export type StatsIncrement = {
  requestsPosted?: number;
  responsesSubmitted?: number;
  helpsCompleted?: number;
  hoursContributed?: number;
};

export async function incrementUserStats(
  doc: DynamoDBDocumentClient,
  tableName: string,
  sub: string,
  delta: StatsIncrement,
): Promise<void> {
  await getOrCreateStats(doc, tableName, sub);

  const parts: string[] = [];
  const values: Record<string, number | string> = {
    ":now": new Date().toISOString(),
  };

  if (delta.requestsPosted) {
    parts.push("requestsPosted :rp");
    values[":rp"] = delta.requestsPosted;
  }
  if (delta.responsesSubmitted) {
    parts.push("responsesSubmitted :rs");
    values[":rs"] = delta.responsesSubmitted;
  }
  if (delta.helpsCompleted) {
    parts.push("helpsCompleted :hc");
    values[":hc"] = delta.helpsCompleted;
  }
  if (delta.hoursContributed) {
    parts.push("hoursContributed :hours");
    values[":hours"] = delta.hoursContributed;
  }

  if (parts.length === 0) return;

  await doc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: statsKeys(sub),
      UpdateExpression: `ADD ${parts.join(", ")} SET lastActiveAt = :now, updatedAt = :now`,
      ExpressionAttributeValues: values,
    }),
  );
}

interface LeaderSlice {
  requestsCompleted: number;
  hoursContributed: number;
}

async function getLeaderSlice(
  doc: DynamoDBDocumentClient,
  tableName: string,
  geofence: string,
  sk: string,
): Promise<LeaderSlice> {
  const result = await doc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: `GEOFENCE#${geofence}`, SK: sk },
    }),
  );
  if (!result.Item) {
    return { requestsCompleted: 0, hoursContributed: 0 };
  }
  const row = result.Item as {
    requestsCompleted?: number;
    hoursContributed?: number;
  };
  return {
    requestsCompleted: row.requestsCompleted ?? 0,
    hoursContributed: row.hoursContributed ?? 0,
  };
}

export async function getNeighborhoodContribution(
  doc: DynamoDBDocumentClient,
  tableName: string,
  sub: string,
  profile: ProfileRecord,
): Promise<
  | {
      neighborhood: string;
      allTime: LeaderSlice;
      thisWeek: LeaderSlice & { weekId: string };
    }
  | undefined
> {
  const geofence = geofenceKey(profile);
  if (geofence === "unknown") return undefined;

  const weekId = currentIsoWeekId();
  const [allTime, thisWeek] = await Promise.all([
    getLeaderSlice(doc, tableName, geofence, `LEADER#ALL#${sub}`),
    getLeaderSlice(doc, tableName, geofence, `LEADER#WEEK#${weekId}#${sub}`),
  ]);

  return {
    neighborhood: geofence,
    allTime,
    thisWeek: { ...thisWeek, weekId },
  };
}

export async function touchStatsActivity(
  doc: DynamoDBDocumentClient,
  tableName: string,
  sub: string,
): Promise<void> {
  await getOrCreateStats(doc, tableName, sub);
  const now = new Date().toISOString();
  await doc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: statsKeys(sub),
      UpdateExpression: "SET lastActiveAt = :now, updatedAt = :now",
      ExpressionAttributeValues: { ":now": now },
    }),
  );
}
