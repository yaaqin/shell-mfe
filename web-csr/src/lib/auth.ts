// Token storage for the CSR app: plain localStorage, read/written only in
// the browser. Simpler than cookies for a pure client-rendered app, but
// note it's readable by any JS on the page (XSS risk) — that's the
// trade-off the SSR app avoids by using httpOnly cookies instead.

const ACCESS_TOKEN_KEY = "csr_access_token";
const REFRESH_TOKEN_KEY = "csr_refresh_token";

export interface Admin {
  id: string;
  username: string;
  email: string;
  isActive: boolean;
  sitecode: string | null;
  createdAt: string;
  role: { id: string; name: string; level: number } | null;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: { accessToken: string; refreshToken: string }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return !!getAccessToken();
}
