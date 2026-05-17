import { fetchAuthSession } from "aws-amplify/auth";

/** True when Cognito session tokens are present. */
export async function isSignedIn(): Promise<boolean> {
  try {
    const session = await fetchAuthSession();
    return Boolean(session.tokens?.idToken);
  } catch {
    return false;
  }
}

/** Cognito ID token for API Gateway JWT authorizer. */
export async function getIdToken(): Promise<string> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) {
    throw new Error("Not signed in");
  }
  return token;
}
