import { NextRequest, NextResponse } from "next/server";
import { apiRefresh } from "@/lib/api";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, cookieOptions } from "@/lib/cookies";
import { isJwtExpired } from "@/lib/jwt";

// Runs before every matched request. If the access token is missing/expired
// but a refresh token is still valid, transparently rotate both tokens and
// write the new cookies onto BOTH the incoming request (so the Server
// Component rendered right after this sees the fresh cookie) and the
// outgoing response (so the browser stores it for the next request).
export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  const needsRefresh = (!accessToken || isJwtExpired(accessToken)) && !!refreshToken;

  if (!needsRefresh) {
    return NextResponse.next();
  }

  try {
    const result = await apiRefresh(refreshToken!);

    // Make the new cookies visible to this same request's rendering pass.
    request.cookies.set(ACCESS_TOKEN_COOKIE, result.accessToken);
    request.cookies.set(REFRESH_TOKEN_COOKIE, result.refreshToken);

    const response = NextResponse.next({ request });
    response.cookies.set(ACCESS_TOKEN_COOKIE, result.accessToken, cookieOptions(result.accessToken));
    response.cookies.set(REFRESH_TOKEN_COOKIE, result.refreshToken, cookieOptions(result.refreshToken));
    return response;
  } catch {
    // Refresh token invalid/expired/revoked — clear both cookies so the
    // page renders as logged-out instead of looping on a dead token.
    const response = NextResponse.next();
    response.cookies.delete(ACCESS_TOKEN_COOKIE);
    response.cookies.delete(REFRESH_TOKEN_COOKIE);
    return response;
  }
}

export const config = {
  // Skip static assets and the API routes (login/logout/callback manage
  // their own cookies directly and shouldn't race with this).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
