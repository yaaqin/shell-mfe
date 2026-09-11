# multiapp — Auth demo: NestJS API + Next.js CSR + Next.js SSR

Three apps sharing one **existing, read-only** Postgres database:

| App | Tech | Renders | Tokens stored in | Pages |
|---|---|---|---|---|
| `backend` | NestJS + Prisma (read-only) | API only | — | `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me` |
| `web-csr` | Next.js (client components) | Client-side | `localStorage` | `/login`, `/profile` |
| `web-ssr` | Next.js (Server Components/Actions) | Server-side | httpOnly cookies | `/` (home) — **no login page** |

**Login only happens on `web-csr`.** `web-ssr` has no login form at all — after a successful login on `web-csr`, its profile page offers a "single sign-on" link that hands the freshly issued tokens to `web-ssr`'s `/api/auth/callback`, which sets them as httpOnly cookies and redirects to `/`. Visiting `web-ssr` while logged out redirects straight to `web-csr`'s `/login` (a real cross-origin redirect, not a local page). This is purely to prove out the auth **behavior** of the two frontend patterns (CSR/localStorage vs SSR/cookies) using the same admin credentials, checked against the existing `admins` table in your real Postgres DB; it does not add any new tables or touch your schema.

## Read-only, on purpose

This backend **never writes** to your database — no register endpoint, no session table, no write of any kind. `PrismaService` wraps the Prisma client in an extension that throws on any `create`/`update`/`upsert`/`delete` call, on any model, so this is enforced at runtime, not just by convention (see `backend/src/prisma/prisma.service.ts`). A consequence of this:

- **No registration** — admins already exist in your `admins` table; this demo only logs them in.
- **Refresh tokens are stateless JWTs**, not DB-backed sessions. Refreshing re-reads the admin (so a deactivated account loses access on its next refresh) but there's no server-side revocation list — a leaked refresh token stays valid until it naturally expires. Fine for testing auth *behavior*; you'd want a real session store before shipping this.
- **Logout** doesn't revoke anything server-side (nothing to revoke) — it just requires a valid access token and tells the client to drop its tokens.
- **SSO is out of scope here.** Your schema's SSO fields (`googleId`, etc.) live on the `User` model, not `Admin` — this demo only exercises admin login, so no Google/OAuth code is included.

## Why two different token-storage strategies?

- **web-csr** is a pure client-rendered app. The browser calls the API directly, so tokens live in `localStorage` and get attached as `Authorization: Bearer <token>` on every request. Simple, but readable by any JS on the page (XSS exposure) — the classic CSR trade-off.
- **web-ssr** never lets the browser touch a token. Since the two apps are different origins, a token issued to `web-csr`'s `localStorage` can't be read by `web-ssr` directly — so `web-csr`'s profile page hands the tokens to `web-ssr`'s `/api/auth/callback` as query params (the same shape as a classic SSO handoff), which sets them as `httpOnly` cookies scoped to `web-ssr`'s own origin and redirects to `/`. From then on, a `proxy.ts` (Next's middleware convention) transparently rotates the access token cookie before each page render when it's expired, so the Server Component home page always sees a valid session — no client JS, no flash of "loading..." while checking auth.

Because the two frontends are different origins, a token issued for one **cannot** be reused by the other on its own — that's why the handoff step exists, and why `web-ssr` bounces logged-out visitors to `web-csr`'s `/login` rather than having a login form of its own.

## Architecture

```
                    ┌──────────────────────┐
                    │   backend (NestJS)   │   :9761
                    │  Prisma — READ ONLY  │
                    │  against your real   │
                    │  Postgres `admins`   │
                    │  /auth/login         │
                    │  /auth/refresh       │
                    │  /auth/logout        │
                    │  /auth/me            │
                    └──────┬────────┬──────┘
                           │        │
          Bearer token (body)   Bearer token (body)
                           │        │
      ┌────────────────────┘        └────────────────────┐
      ▼                                                   ▼
┌─────────────────────┐                     ┌─────────────────────────┐
│  web-csr :9762       │   tokens via URL   │  web-ssr :9763           │
│  Client Components    │ ────query params──▶│  Server Actions/Handlers │
│  fetch() from browser │  (SSO-style        │  fetch() from Next server│
│  → localStorage       │   handoff)         │  → httpOnly cookies      │
│  /login /profile      │                     │  /  (home) — no /login  │
│  "Open web-ssr" link  │                     │  /api/auth/callback     │
│                       │                     │  proxy.ts auto-refresh   │
└─────────────────────┘                     └─────────────────────────┘
```

Logged out and you land on `web-ssr`? It immediately redirects (server-side) to `web-csr`'s `/login` — there's nowhere else to sign in.

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
# 1. Install everything
npm run install:all

# 2. Generate the Prisma client for your existing schema (no migration, no writes)
npm run db:setup

# 3. Run all three apps together
npm run dev
```

- Backend: http://localhost:9761
- web-csr: http://localhost:9762
- web-ssr: http://localhost:9763

Or run each individually with `npm run start:dev` (backend) / `npm run dev` (either frontend) inside its own folder.

### Try it

Log in with an **existing admin's** username/email + password (one already exists in your `admins` table — no registration flow here):

1. Open http://localhost:9762/login and sign in. On success you land on `/profile` (web-csr) — check DevTools → Application → Local Storage for the tokens.
2. On the profile page, click **"Open web-ssr home (single sign-on) →"**. It opens `web-ssr` in a new tab, already logged in as the same admin — check DevTools → Application → Cookies there for `ssr_access_token` / `ssr_refresh_token`, both `httpOnly`.
3. Try visiting http://localhost:9763/ directly in a fresh/incognito browser (no session) — it redirects straight to `web-csr`'s `/login`, confirming `web-ssr` has no login of its own.
4. Log out from either app.

## Project layout

```
backend/     NestJS auth API — read-only Prisma against your existing Postgres DB
web-csr/     Next.js — client components, localStorage, /login /profile (the only login form)
web-ssr/     Next.js — Server Actions + proxy.ts, httpOnly cookies, / (home) + /api/auth/callback
             (receives its session via handoff from web-csr; redirects to web-csr's /login otherwise)
```

## Notes / things to change before this becomes more than a behavior test

- Cookies are `secure: false` in dev (no HTTPS on localhost); the code already flips `secure: true` when `NODE_ENV=production`.
- No server-side refresh-token revocation (see "Read-only, on purpose" above) — add a session table + rotation if this needs to be production auth rather than a behavior demo.
- CORS is locked to the two frontend origins via `CORS_ORIGINS` in `backend/.env`.
- `backend/.env`'s `DATABASE_URL` points at a real database — don't commit it; `.env` is gitignored, only `.env.example` (with a placeholder URL) is tracked.
