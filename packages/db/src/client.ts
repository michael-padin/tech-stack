import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client";

import { keys } from "./keys";

const env = keys();

// node-postgres adapter — works with any standard Postgres (local Docker,
// Neon, Supabase, RDS, Railway). For Neon's serverless WebSocket driver on
// edge runtimes, swap to `@prisma/adapter-neon` (see docs/03-database.md).

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

function createClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalThis.__prismaClient ?? createClient();

if (env.NODE_ENV !== "production") {
  globalThis.__prismaClient = prisma;
}

export type Db = typeof prisma;
export { Prisma } from "../generated/client";
