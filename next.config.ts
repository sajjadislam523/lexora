import type { NextConfig } from "next";

/** Baseline security headers. A full Content-Security-Policy is planned for Phase 10. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Microphone stays available to Lexora itself for the future Speaking Lab.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
