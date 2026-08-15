import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

/** Force Turbopack root to this app (avoids picking C:\\Users\\...\\package-lock.json). */
const appRoot = path.dirname(fileURLToPath(import.meta.url));

export const productionSecurityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self'",
    ].join("; "),
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=()",
  },
];

const apiNoStoreHeaders = [
  { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
  { key: "Pragma", value: "no-cache" },
  { key: "Expires", value: "0" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: appRoot,
  },
  async headers() {
    const apiHeaders = {
      source: "/api/:path*",
      headers: apiNoStoreHeaders,
    };

    if (process.env.NODE_ENV !== "production") return [apiHeaders];

    return [
      {
        source: "/:path*",
        headers: productionSecurityHeaders,
      },
      apiHeaders,
    ];
  },
};

export default nextConfig;
