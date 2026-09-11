/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  // Served behind the gateway (reverse proxy) alongside web-ssr under one
  // origin — this pushes this app's own JS/CSS chunk URLs onto a distinct
  // /csr-static prefix so they never collide with web-ssr's default
  // /_next/* asset path once merged. The gateway strips this prefix again
  // before forwarding to this server. NOTE: this means assets 404 if you
  // open this app directly on its own port — always go through the
  // gateway (see root README).
  assetPrefix: "/csr-static",
  // Lets Server Action / CSRF-style origin checks in dev mode trust
  // requests forwarded by the gateway (whose Host header, "localhost:9760",
  // differs from this app's own port). NOTE: this does NOT fix Turbopack's
  // dev HMR websocket, which still fails silently when proxied through an
  // arbitrary reverse proxy — a known Next.js dev-server limitation, not
  // specific to this project. In dev mode, pages served through the
  // gateway can fail to hydrate (forms fall back to native submit with no
  // visible error) because of it. Workarounds: develop against this app's
  // own port (9762) directly where HMR works normally, and use a
  // production build (`npm run build && npm run start`) to verify the
  // fully composed gateway experience — see root README.
  allowedDevOrigins: ["localhost:9760", "127.0.0.1:9760"],
};

module.exports = nextConfig;
