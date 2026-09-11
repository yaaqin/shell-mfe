import { Admin, clearTokens, getAccessToken, getRefreshToken, setTokens } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9761";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (Array.isArray(body?.message)) return body.message.join(", ");
    if (typeof body?.message === "string") return body.message;
  } catch {
    // ignore
  }
  return `Request failed (${res.status})`;
}

// Tries the request with the current access token; if it comes back 401,
// silently refreshes once using the refresh token and retries.
async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = (token: string | null) =>
    fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  let res = await doFetch(getAccessToken());

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doFetch(getAccessToken());
    }
  }

  return res;
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearTokens();
    return false;
  }

  const data = await res.json();
  setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return true;
}

export async function login(
  identifier: string,
  password: string,
): Promise<{ admin: Admin; accessToken: string; refreshToken: string }> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res), res.status);
  return res.json();
}

export async function fetchMe(): Promise<Admin> {
  const res = await authorizedFetch("/auth/me");
  if (!res.ok) throw new ApiError(await parseErrorMessage(res), res.status);
  return res.json();
}

export async function logout(): Promise<void> {
  await authorizedFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
  clearTokens();
}

// web-ssr has no login form of its own — this hands the current tokens off
// to its callback route (as query params, same shape as a classic SSO
// callback) so it can set them as httpOnly cookies on its own origin.
export function ssrHandoffUrl(): string | null {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();
  if (!accessToken || !refreshToken) return null;

  const ssrUrl = process.env.NEXT_PUBLIC_SSR_APP_URL || "http://localhost:9763";
  const url = new URL(`${ssrUrl}/api/auth/callback`);
  url.searchParams.set("accessToken", accessToken);
  url.searchParams.set("refreshToken", refreshToken);
  return url.toString();
}
