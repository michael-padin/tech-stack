// Create the first admin — or promote an existing account to admin.
//
//   pnpm auth:create-admin you@example.com "Your Name"
//
// Public sign-up is disabled, so this is how a fresh deployment gets its first
// admin. Prints a temporary password for a new account; change it after the
// first sign-in. Reads DATABASE_URL / BETTER_AUTH_* from the root .env.local
// (or the shell), so point it at staging/production by exporting those first.

import { randomInt } from "node:crypto";

import { prisma } from "@repo/db";

import { auth } from "../src/server";

const [email, name] = process.argv.slice(2);
if (!email || !name) {
  console.error('Usage: pnpm auth:create-admin <email> "<name>"');
  process.exit(1);
}

const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

if (existing) {
  await prisma.user.update({ where: { id: existing.id }, data: { role: "admin" } });
  console.log(`Promoted ${email} to admin.`);
} else {
  const password = generateTempPassword();
  // Called server-side without request headers, so the admin plugin skips its
  // session check — the only place that is allowed.
  await auth.api.createUser({ body: { email, name, password, role: "admin" } });
  console.log(`Created admin ${email}\nTemporary password: ${password}`);
}

await prisma.$disconnect();

function generateTempPassword(): string {
  // Same alphabet as the /users invite flow (no 0/O/1/l confusion).
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 16; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}
