import { createHmac, timingSafeEqual } from "node:crypto";

export const PHOTO_ROLES = [
  "front",
  "back",
  "label",
  "detail",
  "flaw",
  "measurement",
  "other",
] as const;

export type PhotoRole = (typeof PHOTO_ROLES)[number];

export type BatchClaims = {
  batchId: string;
  sku: string;
  inventoryItemId: string;
  expectedCount: number;
  issuedAt: number;
};

const SKU_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

export function normalizeSku(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

export function assertValidSku(value: string): string {
  const sku = normalizeSku(value);
  if (sku.length < 3 || sku.length > 64 || !SKU_PATTERN.test(sku)) {
    throw new Error("Enter a valid existing SKU using letters, numbers, and hyphens.");
  }
  return sku;
}

export function normalizeExtension(value: string): string {
  const extension = value.toLowerCase().replace(/^\./, "");
  if (["heic", "heif", "jpg", "jpeg", "png", "webp"].includes(extension)) {
    return extension === "jpeg" ? "jpg" : extension;
  }
  return "jpg";
}

export function photoBaseName(sku: string, role: PhotoRole, sequence: number): string {
  if (!PHOTO_ROLES.includes(role)) throw new Error("Unsupported photo role.");
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 99) {
    throw new Error("Photo sequence must be between 1 and 99.");
  }
  return `${assertValidSku(sku)}_${role}-${String(sequence).padStart(2, "0")}`;
}

export function originalFileName(
  sku: string,
  role: PhotoRole,
  sequence: number,
  extension: string
): string {
  return `${photoBaseName(sku, role, sequence)}_original.${normalizeExtension(extension)}`;
}

export function listingFileName(sku: string, role: PhotoRole, sequence: number): string {
  return `${photoBaseName(sku, role, sequence)}_listing.jpg`;
}

export function transparentFileName(sku: string, role: PhotoRole, sequence: number): string {
  return `${photoBaseName(sku, role, sequence)}_transparent.png`;
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

export function signBatchClaims(claims: BatchClaims, secret: string): string {
  const payload = base64url(JSON.stringify(claims));
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyBatchClaims(token: string, secret: string): BatchClaims {
  const [payload, suppliedSignature] = token.split(".");
  if (!payload || !suppliedSignature) throw new Error("Invalid batch token.");

  const expectedSignature = createHmac("sha256", secret).update(payload).digest("base64url");
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new Error("Invalid batch token.");
  }

  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as BatchClaims;
  if (Date.now() - claims.issuedAt > 24 * 60 * 60 * 1000) throw new Error("Batch token expired.");
  assertValidSku(claims.sku);
  if (!claims.inventoryItemId || !claims.batchId) throw new Error("Invalid batch token.");
  return claims;
}
