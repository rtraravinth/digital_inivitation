import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Opening the dev server from another device on the LAN — a phone, to see
  // the published page on a real screen — is a cross-origin request, and
  // Next refuses to serve /_next/* to one by default. The page then arrives
  // unstyled and never hydrates.
  // One entry per address this machine has held: the router leases by DHCP,
  // so the current one changes and a dead entry costs nothing. There is no
  // octet wildcard — the documented pattern form is a subdomain glob, so the
  // addresses are listed out.
  allowedDevOrigins: ["192.168.0.6", "192.168.0.7", "192.168.0.8"],
};

export default nextConfig;
