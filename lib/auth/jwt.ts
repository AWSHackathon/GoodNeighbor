/** Decode Cognito ID token payload (client-side; token is already in memory). */
export function getUserSubFromIdToken(token: string): string {
  const parts = token.split(".");
  if (parts.length < 2) {
    throw new Error("Invalid ID token");
  }

  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const payload = JSON.parse(atob(padded)) as { sub?: string };

  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("ID token missing sub");
  }

  return payload.sub;
}
