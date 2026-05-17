import { fetchAuthSession } from "aws-amplify/auth/server";
import { NextRequest, NextResponse } from "next/server";
import outputs from "@/amplify_outputs.json";
import { runWithAmplifyServerContext } from "@/utils/amplifyServerUtils";

function isAuthDeployed(): boolean {
  const poolId = (outputs as { auth?: { user_pool_id?: string } }).auth
    ?.user_pool_id;
  return Boolean(poolId && !poolId.includes("REPLACE"));
}

export async function middleware(request: NextRequest) {
  if (!isAuthDeployed()) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  const authenticated = await runWithAmplifyServerContext({
    nextServerContext: { request, response },
    operation: async (contextSpec) => {
      try {
        const session = await fetchAuthSession(contextSpec);
        return (
          session.tokens?.idToken !== undefined &&
          session.tokens?.idToken !== null
        );
      } catch {
        return false;
      }
    },
  });

  if (!authenticated) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: ["/map/:path*", "/requests/:path*"],
};
