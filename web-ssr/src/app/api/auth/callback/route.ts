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

  // Built from the incoming Host header rather than `request.url` — behind
  // the gateway, `request.url` reflects this server's OWN port (9763), not
  // the gateway's public one, because the gateway forwards the browser's
  // original Host header (see server.js: changeOrigin defaults to false)
  // but Next.js still resolves `request.url`'s origin from where it's
  // actually bound. Using `new URL("/", request.url)` here would leak the
  // internal port into the redirect and bounce the browser off the gateway.
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const home = new URL("/", `${proto}://${host}`);

  if (!accessToken || !refreshToken) {
    return NextResponse.redirect(home);
  }

  const response = NextResponse.redirect(home);
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, cookieOptions(accessToken));
  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, cookieOptions(refreshToken));
  return response;
}
