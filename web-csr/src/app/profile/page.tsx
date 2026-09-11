"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMe, logout, ssrHandoffUrl, ApiError } from "@/lib/api";
import { Admin, isLoggedIn } from "@/lib/auth";

export default function ProfilePage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }

    fetchMe()
      .then(setAdmin)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load profile");
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onLogout() {
    await logout();
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="card">
        <p className="sub">Loading profile...</p>
      </div>
    );
  }

  if (error || !admin) {
    return (
      <div className="card">
        <div className="error">{error || "No profile data"}</div>
      </div>
    );
  }

  const initial = admin.username.charAt(0).toUpperCase();

  return (
    <div className="card">
      <h1>Admin profile</h1>
      <p className="sub">Fetched from /auth/me using the access token in localStorage.</p>

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
          <dd>
            {admin.role ? `${admin.role.name} (level ${admin.role.level})` : "—"}
          </dd>
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

      {ssrHandoffUrl() && (
        <a href={ssrHandoffUrl()!} style={{ textDecoration: "none" }}>
          <button className="secondary" type="button">
            Go to home page →
          </button>
        </a>
      )}

      <button className="secondary" onClick={onLogout}>
        Log out
      </button>
    </div>
  );
}
