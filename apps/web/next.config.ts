import type { NextConfig } from "next";

import { env as clientEnv } from "@repo/env/client";

const nextConfig: NextConfig = {
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
