// Database env, owned by @repo/db. Used by the prisma client and composed
// into each app's env.ts.
//
// Node scripts (prisma migrate / seed) must run via `pnpm with-env <cmd>`
// (see packages/db/package.json) so dotenv-cli populates process.env before
// modules evaluate. Next.js apps don't need that — Next loads .env.local
// automatically.

import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// A function (not a constant) so each app's env.ts can compose it via
// createEnv({ extends: [keys()] }) — the next-forge convention.
export const keys = () =>
  createEnv({
    server: {
      NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
      // Optional so the public web app boots + builds with zero setup (it falls
      // back to @repo/db/seed-data when unset). Admin and any DB query require it
      // at runtime — set it in those deployments.
      DATABASE_URL: z.url().optional(),
    },
    runtimeEnv: process.env,
    skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
    emptyStringAsUndefined: true,
  });

export type DbEnv = ReturnType<typeof keys>;
