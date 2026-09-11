// Server-only helpers that talk to the NestJS auth API. Nothing in this
// file ever runs in the browser — the SSR app acts as a backend-for-frontend
// (BFF): it holds the tokens in httpOnly cookies and forwards them itself.

const API_URL = process.env.API_URL || "http://localhost:9761";

export interface Admin {
  id: string;
  username: string;
  email: string;
  isActive: boolean;
  sitecode: string | null;
  createdAt: string;
  role: { id: string; name: string; level: number } | null;
}

export interface AuthResult {
  admin: Admin;
  accessToken: string;
  refreshToken: string;
}

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

// No apiLogin here — web-ssr has no login form of its own. Sessions arrive
// via /api/auth/callback, handed off from the CSR app's login instead.

export async function apiMe(accessToken: string): Promise<Admin> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res), res.status);
  return res.json();
}

export async function apiRefresh(refreshToken: string): Promise<AuthResult> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res), res.status);
  return res.json();
}

export async function apiLogout(accessToken: string): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  }).catch(() => undefined);
}
