import { prisma } from "../client";
import { exampleItems } from "./example-data";

// Safety rail: the demo seed must never run against a remote database by
// accident. Only localhost/Docker is allowed unless SEED_ALLOW_REMOTE=true.
function isLocalDatabase(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  // Host follows either `@` (credentialed URL) or `//` (userless URL).
  return /(?:@|\/\/)(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal)([:/])/.test(url);
}

// Idempotent, re-runnable seed. There's no natural unique key on Item, so we
// find-or-update by title — re-running never duplicates rows. Soft-deleted rows
// count as existing (and stay deleted), so deleting a seed item and re-seeding
// doesn't bring back a copy.
async function main() {
  if (!isLocalDatabase() && process.env.SEED_ALLOW_REMOTE !== "true") {
    throw new Error(
      "Refusing to seed a non-local database. Set SEED_ALLOW_REMOTE=true to override " +
        "(this is what `pnpm db:seed:staging` does).",
    );
  }

  console.log(`Seeding ${exampleItems.length} example items…`);

  for (const item of exampleItems) {
    const existing = await prisma.item.findFirst({
      where: { title: item.title },
      select: { id: true },
    });

    if (existing) {
      await prisma.item.update({
        where: { id: existing.id },
        data: { description: item.description, status: item.status },
      });
    } else {
      await prisma.item.create({ data: item });
    }
  }

  console.log(`✓ Seeded ${exampleItems.length} items.`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
