import { describe, expect, it } from "vitest";
import {
  assertValidSku,
  listingFileName,
  originalFileName,
  signBatchClaims,
  verifyBatchClaims,
} from "@/lib/photo-intake/naming";

describe("photo intake naming", () => {
  it("normalizes SKU and creates permanent original/listing names", () => {
    expect(assertValidSku(" rt-2608-shoe-001 ")).toBe("RT-2608-SHOE-001");
    expect(originalFileName("RT-0241", "front", 1, ".HEIC")).toBe(
      "RT-0241_front-01_original.heic"
    );
    expect(listingFileName("RT-0241", "front", 1)).toBe("RT-0241_front-01_listing.jpg");
  });

  it("rejects unsafe SKU values", () => {
    expect(() => assertValidSku("../secret")).toThrow();
    expect(() => assertValidSku("a")).toThrow();
  });

  it("signs and verifies stateless batch claims", () => {
    const claims = {
      batchId: "2026-08-14-abc12345",
      sku: "RT-0241",
      inventoryItemId: "81",
      expectedCount: 4,
      issuedAt: Date.now(),
    };
    const token = signBatchClaims(claims, "test-secret");
    expect(verifyBatchClaims(token, "test-secret")).toEqual(claims);
    expect(() => verifyBatchClaims(`${token}x`, "test-secret")).toThrow();
  });
});
