/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  // Lets Server Action / CSRF-style origin checks in dev mode trust
  // requests forwarded by the gateway (whose Host header, "localhost:9760",
  // differs from this app's own port). NOTE: this does NOT fix Turbopack's
  // dev HMR websocket, which still fails silently when proxied through an
  // arbitrary reverse proxy — a known Next.js dev-server limitation, not
  // specific to this project. In dev mode, pages served through the
  // gateway can fail to hydrate because of it. Workarounds: develop
  // against this app's own port (9763) directly where HMR works normally,
  // and use a production build (`npm run build && npm run start`) to
  // verify the fully composed gateway experience — see root README.
  allowedDevOrigins: ["localhost:9760", "127.0.0.1:9760"],
};

module.exports = nextConfig;
