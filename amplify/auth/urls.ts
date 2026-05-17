/**
 * Cognito Hosted UI redirect URLs.
 *
 * Local URLs are always included. After the first Amplify Hosting deploy, set
 * branch env vars in the console (Hosting → Environment variables):
 *
 *   AMPLIFY_AUTH_CALLBACK_URLS=https://main.<appId>.amplifyapp.com/login
 *   AMPLIFY_AUTH_LOGOUT_URLS=https://main.<appId>.amplifyapp.com/
 *
 * Comma-separate multiple URLs. Redeploy the backend (push to main) after updating.
 */
const LOCAL_CALLBACK_URLS = [
  "http://localhost:3000/login",
  "http://127.0.0.1:3000/login",
];

const LOCAL_LOGOUT_URLS = [
  "http://localhost:3000/",
  "http://127.0.0.1:3000/",
];

function urlsFromEnv(name: string): string[] {
  const raw = process.env[name];
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function authCallbackUrls(): string[] {
  return [...LOCAL_CALLBACK_URLS, ...urlsFromEnv("AMPLIFY_AUTH_CALLBACK_URLS")];
}

export function authLogoutUrls(): string[] {
  return [...LOCAL_LOGOUT_URLS, ...urlsFromEnv("AMPLIFY_AUTH_LOGOUT_URLS")];
}
