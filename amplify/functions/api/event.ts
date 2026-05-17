/** Subset of API Gateway HTTP API v2 event used by route handlers. */
export type ApiGatewayEvent = {
  body?: string | null;
  isBase64Encoded?: boolean;
  rawPath: string;
  queryStringParameters?: Record<string, string | undefined> | null;
  requestContext: {
    http: { method: string };
    authorizer?: {
      jwt?: {
        claims?: Record<string, string | number | boolean>;
      };
    };
  };
};

export function getSub(event: ApiGatewayEvent): string | undefined {
  const sub = event.requestContext.authorizer?.jwt?.claims?.sub;
  return typeof sub === "string" ? sub : undefined;
}

export function getClaim(event: ApiGatewayEvent, key: string): string | undefined {
  const claims = event.requestContext.authorizer?.jwt?.claims;
  if (!claims) return undefined;
  const value = claims[key];
  return typeof value === "string" ? value : undefined;
}

export function parseJsonBody<T extends Record<string, unknown>>(
  event: ApiGatewayEvent,
): T {
  if (!event.body) return {} as T;
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  return JSON.parse(raw) as T;
}
