import type { NextConfig } from "next";

import { env as clientEnv } from "@repo/env/client";

// Baseline security headers. `frame-ancestors 'none'` blocks clickjacking; a
// full script CSP needs per-request nonces, so add it per project if needed.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  cacheComponents: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "@repo/ui"],
  },
  images: {
    // Cloudflare R2 patterns (for @repo/storage) plus any host derived from
    // your public env URLs. Add project-specific image hosts as needed.
    remotePatterns: [
      { protocol: "https" as const, hostname: "**.r2.dev" },
      { protocol: "https" as const, hostname: "**.r2.cloudflarestorage.com" },
      ...(() => {
        const candidates = [
          clientEnv.NEXT_PUBLIC_R2_PUBLIC_URL,
          clientEnv.NEXT_PUBLIC_SITE_URL,
        ].filter((value): value is string => Boolean(value));
        return candidates.flatMap((value) => {
          try {
            return [
              {
                protocol: "https" as const,
                hostname: new URL(value).hostname,
              },
            ];
          } catch {
            return [];
          }
        });
      })(),
    ],
  },
};

export default nextConfig;
