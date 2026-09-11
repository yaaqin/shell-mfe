// Reverse proxy / path-based router that composes web-csr and web-ssr into
// one origin — this is the "Composite Frontend" piece: from the browser's
// point of view there is only ever ONE app, at this gateway's port. Which
// internal Next.js server actually renders a given path is an
// implementation detail hidden behind here.
//
// Routing rules:
//   /login, /profile, /csr-static/*  -> web-csr  (client-rendered, localStorage)
//   everything else (/, /api/*, ...) -> web-ssr  (server-rendered, httpOnly cookies)
//
// /csr-static is where web-csr's own Next.js assets live (see its
// `assetPrefix` in next.config.js) — kept on a distinct prefix so they
// never collide with web-ssr's default /_next/* asset path once both are
// merged under this single origin.
const http = require("http");
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const PORT = process.env.PORT ? Number(process.env.PORT) : 9760;
const CSR_TARGET = process.env.CSR_TARGET || "http://localhost:9762";
const SSR_TARGET = process.env.SSR_TARGET || "http://localhost:9763";

const app = express();

// changeOrigin is deliberately left at its default (false): we want each
// upstream Next.js app to see the ORIGINAL Host header (this gateway's
// address), not its own internal port — otherwise redirects/absolute URLs
// built from `request.url` on the upstream would leak the internal port
// back to the browser instead of staying on the gateway.
//
// Every proxy below is mounted at "/" (not e.g. app.use("/login", ...)) —
// `app.use(path, mw)` strips that path prefix off req.url before the
// middleware ever sees it, which would forward "/login" to web-csr as a
// bare "/" (a route it doesn't even have). Using `pathFilter` instead lets
// http-proxy-middleware decide whether to handle a request while leaving
// the original path untouched, falling through to `next()` otherwise.
const isCsrPage = (pathname) =>
  pathname === "/login" ||
  pathname.startsWith("/login/") ||
  pathname === "/profile" ||
  pathname.startsWith("/profile/");

const csrAssets = createProxyMiddleware({
  target: CSR_TARGET,
  pathFilter: (pathname) => pathname.startsWith("/csr-static"),
  pathRewrite: { "^/csr-static": "" },
});

const csrPages = createProxyMiddleware({
  target: CSR_TARGET,
  pathFilter: isCsrPage,
});

const ssr = createProxyMiddleware({
  target: SSR_TARGET,
  // no pathFilter => matches everything that reaches this point (catch-all)
});

app.use(csrAssets);
app.use(csrPages);
app.use(ssr);

const server = http.createServer(app);

// Express doesn't forward WebSocket 'upgrade' events to middleware on its
// own (needed for each Next.js dev server's HMR socket) — wire it up
// manually, routed by the same path rules as above.
server.on("upgrade", (req, socket, head) => {
  const pathname = req.url.split("?")[0];
  if (pathname.startsWith("/csr-static")) {
    csrAssets.upgrade(req, socket, head);
  } else if (isCsrPage(pathname)) {
    csrPages.upgrade(req, socket, head);
  } else {
    ssr.upgrade(req, socket, head);
  }
});

server.listen(PORT, () => {
  console.log(`🔀 Gateway (reverse proxy) listening on http://localhost:${PORT}`);
  console.log(`   /login, /profile, /csr-static/* -> ${CSR_TARGET}`);
  console.log(`   everything else (/, ...)        -> ${SSR_TARGET}`);
});
