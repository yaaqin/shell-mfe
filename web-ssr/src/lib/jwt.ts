// Lightweight JWT payload decoder — NOT a signature verification. We only
// use this to read `exp` so middleware can decide whether to proactively
// refresh, before the actual token is verified for real by the backend.
export function decodeJwtPayload<T = any>(token: string): T | null {
  try {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) return null;

    const base64 = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("utf8");

    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function getJwtExpiryMs(token: string): number | null {
  const payload = decodeJwtPayload<{ exp?: number }>(token);
  return payload?.exp ? payload.exp * 1000 : null;
}

export function isJwtExpired(token: string, skewMs = 5000): boolean {
  const expMs = getJwtExpiryMs(token);
  if (expMs === null) return true;
  return Date.now() + skewMs >= expMs;
}
