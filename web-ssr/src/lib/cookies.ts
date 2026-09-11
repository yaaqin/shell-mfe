import { getJwtExpiryMs } from "./jwt";

export const ACCESS_TOKEN_COOKIE = "ssr_access_token";
export const REFRESH_TOKEN_COOKIE = "ssr_refresh_token";

// Shared options for both cookies except maxAge, which is derived from
// each JWT's own `exp` claim so the cookie never outlives the token.
export function cookieOptions(token: string) {
  const expMs = getJwtExpiryMs(token);
  const maxAge = expMs ? Math.max(1, Math.floor((expMs - Date.now()) / 1000)) : undefined;

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
