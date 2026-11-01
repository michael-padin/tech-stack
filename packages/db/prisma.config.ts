import { defineConfig } from "prisma/config";

// Env vars are loaded by `pnpm with-env` (dotenv-cli) before this file is
// evaluated, so process.env is already populated. App-side validation lives
// in ./src/keys.ts.
//
// Read DATABASE_URL directly rather than through Prisma's `env()` helper:
// `env()` throws when the var is unset, which breaks `prisma generate` (and so
// typecheck/build/dev) on a fresh clone. Generate never connects; migrate,
// seed and studio still fail loudly without a URL.
export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: { path: "./prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
