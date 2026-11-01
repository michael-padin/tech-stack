// Cloudflare R2 storage helpers. R2 is S3-compatible; we use the AWS SDK v3
// modular packages because Cloudflare's docs recommend them and there is no
// dedicated R2 client. Public reads go through a custom domain (R2_PUBLIC_URL),
// uploads happen via short-lived presigned PUT URLs so credentials never
// reach the browser.
//
// R2 does NOT support presigned POST (multipart form policies), so we can't
// embed a `content-length-range` condition in the signed URL the way pure-S3
// presigned POST allows. Size cap is enforced client-side at presign time
// (the route's Zod check) and the residual abuse window is small because
// the URL expires in five minutes.

import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

import { keys } from "./keys";

const env = keys();

let cachedClient: S3Client | null = null;

interface R2Credentials {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

function requireR2Credentials(): R2Credentials {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = env;
  const missing = [
    !R2_ACCOUNT_ID && "R2_ACCOUNT_ID",
    !R2_ACCESS_KEY_ID && "R2_ACCESS_KEY_ID",
    !R2_SECRET_ACCESS_KEY && "R2_SECRET_ACCESS_KEY",
    !R2_BUCKET && "R2_BUCKET",
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(`R2 storage is not configured — missing env: ${missing.join(", ")}`);
  }
  return {
    accountId: R2_ACCOUNT_ID!,
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
    bucket: R2_BUCKET!,
  };
}

function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  const { accountId, accessKeyId, secretAccessKey } = requireR2Credentials();
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return cachedClient;
}

export function isStorageConfigured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_BUCKET &&
    env.R2_PUBLIC_URL,
  );
}

// MIME → extension lookup. Whitelist: anything not here is rejected. The
// presign route also validates MIME against an image-only regex; this map
// is the source of truth for what the resulting object key looks like.
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
};

function extensionForMime(contentType: string): string {
  const key = contentType.toLowerCase();
  const ext = MIME_EXTENSIONS[key];
  if (!ext) throw new Error(`Unsupported content type: ${contentType}`);
  return ext;
}

export interface PresignArgs {
  /** Logical folder under the bucket (e.g. "photos/<pointId>/vicinity"). */
  prefix: string;
  /** MIME type — pinned by the signature; client must echo it on PUT. */
  contentType: string;
  /** TTL in seconds. Defaults to 5 minutes. */
  expiresIn?: number;
}

export interface PresignResult {
  /** Presigned PUT URL — valid for `expiresIn` seconds. */
  uploadUrl: string;
  /** Object key inside the bucket. Persist this in the DB record. */
  key: string;
  /** Public read URL. Only valid after the upload completes. */
  publicUrl: string;
  /** MIME type the client must echo in the PUT Content-Type header. */
  contentType: string;
}

/**
 * Generate a presigned PUT URL the browser uses to upload directly to R2.
 *
 * The signature pins the bucket, key, and Content-Type — any mismatch on the
 * PUT request fails with SignatureDoesNotMatch. Size is NOT enforced at the
 * storage layer (see file header comment).
 */
export async function presignUpload({
  prefix,
  contentType,
  expiresIn = 300,
}: PresignArgs): Promise<PresignResult> {
  if (!env.R2_PUBLIC_URL) {
    throw new Error("R2_PUBLIC_URL is required to construct public photo URLs");
  }
  const { bucket } = requireR2Credentials();
  const ext = extensionForMime(contentType);
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, "");
  const key = `${cleanPrefix}/${randomUUID()}.${ext}`;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn });
  return {
    uploadUrl,
    key,
    publicUrl: `${env.R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`,
    contentType,
  };
}

export async function deleteObject(key: string): Promise<void> {
  const { bucket } = requireR2Credentials();
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * Returns true if the object exists in R2. Used by finalize endpoints to
 * confirm the client really uploaded before we commit a DB record — defends
 * against a client lying about a successful upload to create a phantom row.
 */
export async function objectExists(key: string): Promise<boolean> {
  const { bucket } = requireR2Credentials();
  try {
    await getClient().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err) {
    if (err instanceof Error && err.name === "NotFound") return false;
    throw err;
  }
}
