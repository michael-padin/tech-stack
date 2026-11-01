// Auth env, owned by @repo/auth. Used by the better-auth server config and
// composed into the admin app's env.ts.

import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// A function (not a constant) so each app's env.ts can compose it via
// createEnv({ extends: [keys()] }) — the next-forge convention.
export const keys = () =>
  createEnv({
    server: {
      BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be ≥ 32 chars"),
      BETTER_AUTH_URL: z.url(),
      GOOGLE_CLIENT_ID: z.string().optional(),
      GOOGLE_CLIENT_SECRET: z.string().optional(),
    },
    runtimeEnv: process.env,
    skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
    emptyStringAsUndefined: true,
  });

export type AuthEnv = ReturnType<typeof keys>;
