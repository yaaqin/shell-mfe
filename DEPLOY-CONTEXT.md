# Context: shell-mfe — reverse-proxy composite frontend (needs deployment steps)

I already have a working local project. I need help figuring out **deployment steps** (infra/ops), not code — the coding is done. Please give me a step-by-step deployment plan for the setup described below.

## What this project is

A demo proving out an auth pattern across a **reverse-proxy composite frontend** (aka "Micro-Frontend via Reverse Proxy"): one NestJS API + two Next.js frontends (one CSR, one SSR), composed behind a single gateway so they look like one app to the browser.

- **Repo**: `git@github.com:yaaqin/shell-mfe.git` (branch `main`)
- **Target domain**: `shell.yaaqin.xyz` → currently resolves to `194.233.94.234` (same host as the Postgres DB below)
- **Local dev**: works fully; not deployed anywhere yet.

## Architecture (4 Node processes)

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
                              │   against existing         │
                              │   Postgres `admins` table  │
                              │   /auth/login /refresh     │
                              │   /auth/logout /me         │
                              └───────────────────────────┘
```

**Only `gateway` (port 9760) should ever be reachable from the internet.** The other three (9761/9762/9763) are internal-only — the gateway and the two frontends talk to them over localhost/private network.

## The 4 services

| Folder | Tech | Port | Start command (prod) | Notes |
|---|---|---|---|---|
| `gateway/` | Node (plain, no framework build step) + Express + http-proxy-middleware | 9760 | `npm run start` → `node server.js` | Path-based reverse proxy. No TLS/rate-limiting built in — needs a real TLS terminator (Nginx/Caddy/managed LB) in front for production, OR it needs to sit behind one. |
| `backend/` | NestJS + Prisma | 9761 | `npm run build` then `node dist/main.js` | **Read-only** against an existing production Postgres DB (not owned by this app — no migrations to run). Auth: bcrypt + JWT (access+refresh), against an existing `admins` table. |
| `web-csr/` | Next.js 16 (App Router, client components) | 9762 | `npm run build` then `npm run start` (`next start -p 9762`) | Client-rendered. Its own assets are served under `/csr-static/*` (via `assetPrefix` in `next.config.js`) so they don't collide with web-ssr's `/_next/*` once merged behind the gateway. **Must be accessed through the gateway** — opening it directly on 9762 shows broken/unstyled pages. |
| `web-ssr/` | Next.js 16 (App Router, Server Actions/Handlers) | 9763 | `npm run build` then `npm run start` (`next start -p 9763`) | Server-rendered. No login page of its own — receives its session via `/api/auth/callback` (a handoff from web-csr's login). |

Root `package.json` has `install:all`, `db:setup`, `dev`, `build`, `start` scripts that orchestrate all four via `concurrently` — see the repo's own README for exact commands.

## Docker is already set up

Each service has its own multi-stage `Dockerfile` (production builds; `web-csr`/`web-ssr` use Next's `output: "standalone"`), plus a root `docker-compose.yml` wiring all four on one internal bridge network. **Already built, run, and tested end-to-end** — `docker compose up --build`, hit the gateway, full login-flow plumbing confirmed working through it (including a real query against the Postgres DB from inside the `backend` container). So deployment topology question #1 below is really "how do I run this docker-compose.yml on a VPS reliably" (which orchestrator/supervisor for the Docker Compose process itself), not "should I containerize this."

Compose networking notes, since they change what "the deployment steps" actually need to cover:
- `gateway` and `backend` are `ports:`-published to the host (9760 and 9761); `web-csr`/`web-ssr` are internal-only, reached by `gateway` via Docker's service-name DNS (`http://web-csr:9762`, `http://web-ssr:9763`).
- `backend` is published because `web-csr` is client-rendered — its `NEXT_PUBLIC_API_URL` gets baked into the **browser** bundle at Docker build time (a `build.args` value in the compose file), so it must be a URL the browser can actually reach, not a Docker-internal hostname.
- Real per-service env values go in gitignored `*.env.docker`/`.env.local.docker` files (templates: `*.env.docker.example`, tracked in the repo) plus a root `.env` for the one build-time `NEXT_PUBLIC_API_URL` value — see the repo's README "Running with Docker" section for the exact copy commands.

## ⚠️ Known limitation: dev mode does NOT work correctly behind the gateway

Next.js's dev server (Turbopack) runs an HMR websocket that silently fails when proxied through an arbitrary reverse proxy (documented Next.js dev-server limitation, confirmed via testing) — pages load but never finish hydrating (clicks/forms fall back to native browser behavior). **This only affects `npm run dev`.** Production builds (`next build && next start`) work correctly end-to-end through the gateway — already verified locally with Playwright. **Whatever deployment approach you suggest, it must run all three Next-adjacent services (`gateway`, `web-csr`, `web-ssr`) in production mode**, not dev mode.

## Environment variables needed (per service)

None of the `.env`/`.env.local` files are committed (see `.gitignore`) — only `*.env.example` files are in the repo. Real values must be supplied at deploy time.

**`backend/.env`**
```
PORT=9761
DATABASE_URL="postgresql://<user>:<password>@<host>:<port>/<db>?schema=public"   # existing DB, read-only usage only
JWT_ACCESS_SECRET="<random>"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="<random>"
JWT_REFRESH_EXPIRES_IN="7d"
CORS_ORIGINS="https://shell.yaaqin.xyz"     # update from localhost origins to the real public domain
```

**`web-csr/.env.local`**
```
NEXT_PUBLIC_API_URL="https://<wherever backend is publicly/internally reachable>"
```

**`web-ssr/.env.local`**
```
API_URL="http://<backend host>:9761"   # server-to-server call, doesn't need to be public
```

**`gateway/.env`**
```
PORT=9760
CSR_TARGET="http://<web-csr host>:9762"
SSR_TARGET="http://<web-ssr host>:9763"
```

## Database

- Existing Postgres instance, **not owned by this project** — `backend/prisma/schema.prisma` mirrors an existing schema as-is (many tables: admins, roles, bookings, restaurants, chat, etc.) — this app only ever runs read-only `findFirst`/`findUnique` queries against `admins`/`roles`, enforced at runtime via a Prisma Client extension that throws on any write call.
- No migrations to run against this DB. Just `npx prisma generate` (schema → client codegen, no DB connection needed) after `DATABASE_URL` is set.
- DB host is currently `194.233.94.234:9039` (same IP the target domain `shell.yaaqin.xyz` resolves to) — so the app may be intended to run on/near the same host as the DB.

## What I need help with (ask the other session for this)

1. How to get `docker compose up` running reliably on a VPS long-term — process supervision/restart-on-boot for the Compose stack itself (systemd unit calling `docker compose up -d`? Docker's own `restart: unless-stopped` already in the compose file — is that enough, or do I still want systemd on top?).
2. Nginx/Caddy config to terminate TLS for `shell.yaaqin.xyz` and reverse-proxy to the published `gateway` port (9760) — Let's Encrypt cert setup included. Also whether `backend`'s published port (9761) needs its own TLS-terminated subdomain, or whether there's a cleaner way to avoid publishing it separately (see the `NEXT_PUBLIC_API_URL` note above).
3. How to safely get the real secrets into the gitignored `*.env.docker` files on the server (not committed to git) — e.g. scp once vs. a secrets manager, given this is a small single-VPS deployment.
4. Any hardening needed on the `gateway`'s own minimal Express proxy before exposing it publicly (it currently has no TLS, no rate limiting, no request size limits — noted as a "swap for something production-grade" caveat in the project's README) — should this run behind Nginx/Caddy for that instead of trying to harden the Express proxy itself?
5. Whether it's worth changing `NEXT_PUBLIC_API_URL`/backend exposure so the browser calls the API through the gateway's own domain (avoiding a second public port/subdomain entirely) — the gateway doesn't currently route anything to `backend`, only to `web-csr`/`web-ssr`.

Full source: `git@github.com:yaaqin/shell-mfe.git` — see its `README.md` for the fuller local-dev writeup this summary is based on.
