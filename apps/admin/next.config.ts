import type { NextConfig } from "next";

import { env as clientEnv } from "@repo/env/client";
import { env as storageEnv } from "@repo/env/storage";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react", "@repo/ui"],
    // Extend the client-side router cache so back/forward and same-page
    // re-navigations don't re-render the loading.tsx fallback every time.
    // Defaults are 0 (dynamic) / 5 min (static); 30 s dynamic is a sweet
    // spot for an admin tool — fresh enough for moderation work, snappy
    // enough that tab-hopping feels instant.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https" as const, hostname: "**.r2.dev" },
      { protocol: "https" as const, hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https" as const, hostname: "mf.michaelpadin.com" },
      { protocol: "https" as const, hostname: "**.michaelpadin.com" },
      ...(() => {
        const candidates = [
          storageEnv.R2_PUBLIC_URL,
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
