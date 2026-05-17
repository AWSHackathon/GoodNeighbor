export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
} as const;

export type ApiJsonResponse = {
  statusCode: number;
  headers: typeof CORS_HEADERS;
  body: string;
};

export function json(statusCode: number, data: unknown): ApiJsonResponse {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(data),
  };
}
