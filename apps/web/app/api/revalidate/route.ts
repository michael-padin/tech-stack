import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@repo/env/revalidate";

import { PUBLIC_ITEMS_TAG } from "@/lib/db";

const KNOWN_TAGS = [PUBLIC_ITEMS_TAG] as const;

// `item:<id>` is a per-detail tag (see publicItemTag in lib/db.ts).
const ITEM_TAG_PATTERN = /^item:[\w-]+$/;

const bodySchema = z.object({
  tags: z
    .array(z.union([z.enum(KNOWN_TAGS), z.string().regex(ITEM_TAG_PATTERN, "Expected item:<id>")]))
    .min(1),
});

// Constant-time comparison so response timing doesn't leak the secret.
function isAuthorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: Request) {
  const secret = env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Revalidation is not configured" }, { status: 500 });
  }

  if (!isAuthorized(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body. Expected { tags: string[] }", knownTags: KNOWN_TAGS },
      { status: 400 },
    );
  }

  const tags = parsed.data.tags;
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
  return NextResponse.json({ revalidated: true, tags });
}
