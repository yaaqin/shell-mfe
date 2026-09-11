import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/session";
import { apiLogout } from "@/lib/api";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/cookies";

const CSR_APP_URL = process.env.CSR_APP_URL || "http://localhost:9762";

export default async function HomePage() {
  const admin = await getCurrentAdmin();

  // web-ssr has no login form of its own — signing in only happens on the
  // CSR app, which then hands the session off to /api/auth/callback here.
  // So "not authenticated" just means: go sign in over there.
  if (!admin) {
    redirect(`${CSR_APP_URL}/login`);
  }

  async function logoutAction() {
    "use server";
    const store = await cookies();
    const accessToken = store.get(ACCESS_TOKEN_COOKIE)?.value;
    if (accessToken) await apiLogout(accessToken);
    store.delete(ACCESS_TOKEN_COOKIE);
    store.delete(REFRESH_TOKEN_COOKIE);
    redirect(`${CSR_APP_URL}/login`);
  }

  const initial = admin.username.charAt(0).toUpperCase();

  return (
    <div className="card">
      <h1>Welcome back 👋</h1>
      <p className="sub">
        This page is rendered on the server. The admin was resolved from an httpOnly cookie before
        any HTML reached the browser — no auth flash, no client-side redirect. This session got
        here via a handoff from the CSR app's login, not a local login form.
      </p>

      <div className="profile-row">
        <div className="avatar">{initial}</div>
        <div>
          <strong>@{admin.username}</strong>
          <div className="muted" style={{ marginLeft: 0 }}>
            {admin.role?.name ?? "no role"}
          </div>
        </div>
      </div>

      <dl className="details">
        <div>
          <dt>Email</dt>
          <dd>{admin.email}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{admin.role ? `${admin.role.name} (level ${admin.role.level})` : "—"}</dd>
        </div>
        <div>
          <dt>Site code</dt>
          <dd>{admin.sitecode || "—"}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{admin.isActive ? "Active" : "Inactive"}</dd>
        </div>
        <div>
          <dt>Admin ID</dt>
          <dd style={{ fontFamily: "monospace", fontSize: 12 }}>{admin.id}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{new Date(admin.createdAt).toLocaleDateString()}</dd>
        </div>
      </dl>

      <form action={logoutAction}>
        <button className="secondary" type="submit">
          Log out
        </button>
      </form>
    </div>
  );
}
