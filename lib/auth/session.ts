import { fetchAuthSession } from "aws-amplify/auth";

/** Cognito ID token for API Gateway JWT authorizer. */
export async function getIdToken(): Promise<string> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) {
    throw new Error("Not signed in");
  }
  return token;
}
