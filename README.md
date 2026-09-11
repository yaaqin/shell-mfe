# multiapp — Auth demo: reverse-proxy composite frontend

Four processes, composed behind **one gateway origin**, sharing one **existing, read-only** Postgres database:

| App | Tech | Port | Role |
|---|---|---|---|
| `gateway` | Node + Express + http-proxy-middleware | **9760** | The only port a browser ever talks to — path-based reverse proxy |
| `backend` | NestJS + Prisma (read-only) | 9761 | Auth API — internal, called by the frontends |
| `web-csr` | Next.js (client components) | 9762 | Client-rendered, `localStorage` — internal, reached only via the gateway |
| `web-ssr` | Next.js (Server Actions/Handlers) | 9763 | Server-rendered, httpOnly cookies — internal, reached only via the gateway |

**You only ever open `http://localhost:9760`.** The gateway makes web-csr and web-ssr look like a single app ("Composite Frontend" / "Micro-Frontend via Reverse Proxy"):

- `/login`, `/profile`, `/csr-static/*` → `web-csr`
- everything else (`/`, `/api/auth/callback`, ...) → `web-ssr`

**Login only happens on `web-csr`** (the only page with a login form). On success it stores the tokens in `localStorage` **and** immediately navigates to `/api/auth/callback?accessToken=...&refreshToken=...` — a relative URL the gateway routes to `web-ssr` — which sets them as httpOnly cookies and redirects straight to `/` (the home page). Visiting `web-ssr`'s home page without a session redirects (relatively, so it stays on the gateway) back to `/login`. Same admin credentials, checked against the existing `admins` table in your real Postgres DB, drive both storage strategies — this is purely to prove out CSR/localStorage vs SSR/cookie auth *behavior*; nothing here touches your schema.

## Architecture

```
                              ┌───────────────────────────┐
        browser  ───────────▶│   gateway :9760            │◀─── the ONE public port
                              │   /login,/profile,         │
                              │   /csr-static/*  → web-csr │
                              │   everything else → web-ssr│
                              └───────┬──────────┬─────────┘
                                      ▼          ▼
                        ┌─────────────────┐  ┌─────────────────────┐
                        │ web-csr :9762    │  │ web-ssr :9763         │
                        │ localStorage     │  │ httpOnly cookies      │
                        │ /login /profile  │  │ / (home) — no /login  │
                        │ (only login form)│  │ /api/auth/callback    │
                        └────────┬────────┘  └──────────┬───────────┘
                                 │  direct fetch          │  direct fetch
                                 ▼                        ▼
                              ┌───────────────────────────┐
                              │   backend :9761            │
                              │   Prisma — READ ONLY       │
                              │   against your real        │
                              │   Postgres `admins`        │
                              │   /auth/login /refresh     │
                              │   /auth/logout /me         │
                              └───────────────────────────┘
```

`web-csr`/`web-ssr` still call the backend **directly** (not through the gateway) — CORS on the backend allows the gateway origin plus both internal ports.

## Read-only, on purpose

This backend **never writes** to your database — no register endpoint, no session table, no write of any kind. `PrismaService` wraps the Prisma client in an extension that throws on any `create`/`update`/`upsert`/`delete` call, on any model, so this is enforced at runtime, not just by convention (see `backend/src/prisma/prisma.service.ts`).

- **No registration** — admins already exist in your `admins` table; this demo only logs them in.
- **Refresh tokens are stateless JWTs**, not DB-backed sessions. Refreshing re-reads the admin (so a deactivated account loses access on its next refresh) but there's no server-side revocation list — a leaked refresh token stays valid until it naturally expires.
- **Logout** doesn't revoke anything server-side (nothing to revoke) — it just requires a valid access token and tells the client to drop its tokens.
- **SSO is out of scope here.** Your schema's SSO fields (`googleId`, etc.) live on the `User` model, not `Admin` — this demo only exercises admin login.

## Why a reverse proxy, and why two token-storage strategies?

- **web-csr** is a pure client-rendered app. The browser calls the API directly, so tokens live in `localStorage`. Simple, but readable by any JS on the page (XSS exposure) — the classic CSR trade-off.
- **web-ssr** never lets the browser touch a token — a Route Handler (`/api/auth/callback`) sets them as `httpOnly` cookies instead. `proxy.ts` (Next's middleware convention) transparently rotates the access token cookie before each page render when it's expired.
- Since these are genuinely two separate processes/origins, a token from one can't be read by the other directly — hence the handoff via `/api/auth/callback` (same shape as a classic SSO callback).
- The **gateway** is what makes this feel like one app instead of two: it composes both under a single origin via path-based routing, so relative links/redirects (`/login`, `/`, `/api/auth/callback`) always resolve correctly no matter which internal service actually renders them.

### `web-csr`'s asset prefix

Both `web-csr` and `web-ssr` are Next.js apps, and both default to serving their build assets at `/_next/*`. Merged under one origin, those would collide. `web-csr/next.config.js` sets `assetPrefix: "/csr-static"` so its assets live at `/csr-static/_next/*` instead; the gateway strips that prefix again before forwarding to `web-csr`. **This means opening `web-csr` directly on its own port (9762) shows an unstyled/broken page** — always go through the gateway.

### ⚠️ Dev mode + the gateway: HMR doesn't survive the proxy

Next.js's dev server (Turbopack) runs a hot-reload WebSocket that silently fails to complete its handshake when proxied through an arbitrary reverse proxy (a known Next.js dev-server limitation, not specific to this project) — when that happens, the page loads but **never finishes hydrating**, so clicks/form-submits silently fall back to native browser behavior instead of running React code.

- **Developing `web-csr` or `web-ssr` directly?** Hit their own port (9762 / 9763) — HMR works normally there.
- **Verifying the composed app through the gateway (:9760)?** Use a production build:
  ```bash
  npm run build
  npm run start
  ```
  `npm run dev` still starts everything (including the gateway) for convenience, but only trust interactive behavior through :9760 when running the production build.

## Auth flow

1. **Login** — `POST /auth/login` with `{ identifier, password }` (identifier = admin email or username). Backend does a **read-only** `findFirst` on `admins` (joined with `roles`), `bcrypt.compare`s the password, and — if `isActive` — returns `{ admin, accessToken, refreshToken }`.
2. **Access protected data** — `GET /auth/me` with `Authorization: Bearer <accessToken>` → re-reads the admin (read-only) and returns their public profile.
3. **Refresh** — `POST /auth/refresh` with `{ refreshToken }`. Stateless: verifies the JWT, re-reads the admin (read-only) to confirm they still exist/are active, and issues a new pair.
4. **Logout** — `POST /auth/logout` with `Authorization: Bearer <accessToken>` → no DB write; just confirms the access token is valid and tells the client to discard its tokens.

## Database

This project does **not** own or migrate the schema — `backend/prisma/schema.prisma` mirrors your existing project's schema as-is, pointed at your real `DATABASE_URL` (already set in `backend/.env`). The only models the backend actually queries are `Admin` and `Role`, and only ever with `findFirst`/`findUnique`.

`admins` fields used: `id`, `username`, `email`, `password` (bcrypt hash), `roleId` → `Role.name`/`level`, `isActive`, `sitecode`, `createdAt`.

## Getting started

```bash
# 1. Install everything (backend, web-csr, web-ssr, gateway)
npm run install:all

# 2. Generate the Prisma client for your existing schema (no migration, no writes)
npm run db:setup

# 3. Run all four processes together
npm run dev
```

Open **http://localhost:9760** — that's the only address you should visit as a user.

(Individually: `npm run start:dev` in `backend/`, `npm run dev` in `web-csr/`/`web-ssr/`/`gateway/`.)

### Try it

Log in with an **existing admin's** username/email + password (already in your `admins` table — no registration flow here):

1. Open http://localhost:9760 → redirects to `/login` (served by web-csr).
2. Sign in. On success you're taken straight to `/` — web-ssr's home page — via the `/api/auth/callback` handoff. Check DevTools → Application: `csr_access_token`/`csr_refresh_token` in **Local Storage**, and `ssr_access_token`/`ssr_refresh_token` in **Cookies** (both `httpOnly`).
3. Visit `/profile` (web-csr) any time — it still works off the same `localStorage` tokens, with a "Go to home page →" link back to `/`.
4. Log out from either page.
5. For the fully interactive experience (forms actually submitting, not falling back to native behavior) run `npm run build && npm run start` first — see the HMR caveat above.

## Project layout

```
gateway/     Reverse proxy (Express + http-proxy-middleware) — the single public entry point
backend/     NestJS auth API — read-only Prisma against your existing Postgres DB
web-csr/     Next.js — client components, localStorage, /login /profile (the only login form)
web-ssr/     Next.js — Server Actions + proxy.ts, httpOnly cookies, / (home) + /api/auth/callback
```

## Notes / things to change before this becomes more than a behavior test

- Cookies are `secure: false` in dev (no HTTPS on localhost); the code already flips `secure: true` when `NODE_ENV=production`.
- No server-side refresh-token revocation (see "Read-only, on purpose" above) — add a session table + rotation if this needs to be production auth rather than a behavior demo.
- CORS on the backend allows the gateway origin (9760) plus both internal frontend ports (9762/9763), via `CORS_ORIGINS` in `backend/.env`.
- `backend/.env`'s `DATABASE_URL` points at a real database — don't commit it; `.env`/`.env.local` are gitignored, only the `.env*.example` files (placeholders) are tracked.
- The gateway is a minimal demo proxy (no TLS, no rate limiting, no header hardening) — swap in Nginx/Caddy/a managed load balancer for anything beyond local behavior testing.
