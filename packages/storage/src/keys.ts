// Storage env, owned by @repo/storage (Cloudflare R2, S3-compatible).
// All fields are optional at schema level so `next build`'s page-data step
// (which loads route modules eagerly) doesn't fail when build-time env
// injection is missing. Runtime call sites must check presence — see
// requireR2Credentials() in @repo/storage.

import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// A function (not a constant) so each app's env.ts can compose it via
// createEnv({ extends: [keys()] }) — the next-forge convention.
export const keys = () =>
  createEnv({
    server: {
      R2_ACCOUNT_ID: z.string().min(1).optional(),
      R2_ACCESS_KEY_ID: z.string().min(1).optional(),
      R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
      R2_BUCKET: z.string().min(1).optional(),
      R2_PUBLIC_URL: z.url().optional(),
    },
    runtimeEnv: process.env,
    skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
    emptyStringAsUndefined: true,
  });

export type StorageEnv = ReturnType<typeof keys>;
