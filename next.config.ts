import type { NextConfig } from "next";

// Set when the frontend and the API are served from one address — the
// Dockerfile does. The browser then calls /api/* on this origin and Next
// forwards it, which is what lets the refresh cookie work: it is
// SameSite=Lax, and a browser will not send that to an API on another site
// (two *.onrender.com or *.vercel.app names are different sites). Read at
// build time; rewrites are baked into the build.
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    if (!apiProxyTarget) return [];
    return [
      { source: "/api/:path*", destination: `${apiProxyTarget}/api/:path*` },
      // The API's liveness check, so one health probe covers both halves.
      { source: "/health", destination: `${apiProxyTarget}/health` },
    ];
  },

  // Opening the dev server from another device on the LAN — a phone, to see
  // the published page on a real screen — is a cross-origin request, and
  // Next refuses to serve /_next/* to one by default. The page then arrives
  // unstyled and never hydrates.
  // One entry per address this machine has held: the router leases by DHCP,
  // so the current one changes and a dead entry costs nothing. There is no
  // octet wildcard — the documented pattern form is a subdomain glob, so the
  // addresses are listed out.
  allowedDevOrigins: [
    "192.168.0.5",
    "192.168.0.6",
    "192.168.0.7",
    "192.168.0.8",
  ],
};

export default nextConfig;
