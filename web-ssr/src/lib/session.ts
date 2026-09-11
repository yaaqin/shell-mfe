import "server-only";
import { cookies } from "next/headers";
import { apiMe, Admin } from "./api";
import { ACCESS_TOKEN_COOKIE } from "./cookies";

// Reads the current admin for Server Components. Token refresh itself
// happens proactively in proxy.ts (which CAN write cookies on every
// request) — Server Components render read-only, so by the time this runs
// the access token cookie should already be fresh.
export async function getCurrentAdmin(): Promise<Admin | null> {
  const store = await cookies();
  const accessToken = store.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return null;

  try {
    return await apiMe(accessToken);
  } catch {
    return null;
  }
}
