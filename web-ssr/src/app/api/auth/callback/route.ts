import { NextRequest, NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, cookieOptions } from "@/lib/cookies";

// web-ssr has no login form of its own — the CSR app is the only place an
// admin actually signs in. After a successful login there, CSR hands the
// freshly issued tokens off to this endpoint (as query params, same shape
// as a classic SSO callback) so we can move them into httpOnly cookies on
// web-ssr's own origin. See web-csr's profile page for the link that sends
// admins here.
export async function GET(request: NextRequest) {
  const accessToken = request.nextUrl.searchParams.get("accessToken");
  const refreshToken = request.nextUrl.searchParams.get("refreshToken");

  if (!accessToken || !refreshToken) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, cookieOptions(accessToken));
  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, cookieOptions(refreshToken));
  return response;
}
