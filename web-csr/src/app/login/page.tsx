"use client";

import { useState } from "react";
import { login, ssrHandoffUrl, ApiError } from "@/lib/api";
import { setTokens } from "@/lib/auth";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await login(identifier, password);
      setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });

      // Hand the freshly issued tokens off to web-ssr's callback route (via
      // the gateway) so it can set them as httpOnly cookies, then land on
      // the home page it renders — a full navigation, not a client-side
      // route change, since a real server route needs to set the cookies.
      const handoff = ssrHandoffUrl();
      window.location.href = handoff ?? "/profile";
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h1>Admin sign in</h1>
      <p className="sub">Email/username &amp; password, checked against the admins table.</p>

      {error && <div className="error">{error}</div>}

      <form onSubmit={onSubmit}>
        <label htmlFor="identifier">Email or username</label>
        <input
          id="identifier"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="admin username or email"
          autoComplete="username"
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />

        <button className="primary" type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
