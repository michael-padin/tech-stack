// The web app's environment: the schemas of every package it uses, composed
// (next-forge convention). Packages own their keys; this file decides which
// apply here. Imported by next.config.ts so a bad value fails the build.

import { createEnv } from "@t3-oss/env-nextjs";

import { keys as database } from "@repo/db/keys";
import { env as client } from "@repo/env/client";
import { env as revalidate } from "@repo/env/revalidate";

export const env = createEnv({
  extends: [client, database(), revalidate],
  server: {},
  client: {},
  runtimeEnv: {},
  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
});
