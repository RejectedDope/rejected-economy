import type { PhotoRole } from "./naming";

export const PHOTO_INTAKE_ROOT = "Photo Intake & Processing";

export function batchPaths(sku: string, batchId: string) {
  return {
    originals: `${PHOTO_INTAKE_ROOT}/01 Originals - Preserve/${sku}/${batchId}`,
    listingReady: `${PHOTO_INTAKE_ROOT}/02 Listing Ready/${sku}/${batchId}`,
    needsReview: `${PHOTO_INTAKE_ROOT}/03 Needs Review/${sku}/${batchId}`,
    errors: `${PHOTO_INTAKE_ROOT}/04 Processing Errors/${sku}/${batchId}`,
    manifests: `${PHOTO_INTAKE_ROOT}/05 Manifests and Logs/${sku}`,
  };
}

export function defaultRole(sequence: number): PhotoRole {
  if (sequence === 1) return "front";
  if (sequence === 2) return "back";
  if (sequence === 3) return "label";
  return "detail";
}
