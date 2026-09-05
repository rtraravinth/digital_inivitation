import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Opening the dev server from another device on the LAN — a phone, to see
  // the published page on a real screen — is a cross-origin request, and
  // Next refuses to serve /_next/* to one by default. The page then arrives
  // unstyled and never hydrates.
  allowedDevOrigins: ["192.168.0.7"],
};

export default nextConfig;
