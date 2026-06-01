// Screenshot ingestion foundation.
// Architecture: upload → stage as pending_ocr → manual review (+ future OCR pipeline).
//
// OCR is explicitly NOT automated in this phase.
// Screenshots are staged with status "pending_review" so operators can
// manually transcribe or verify extracted data before it enters inventory.

import { logger } from "@/lib/logger";

export const SCREENSHOT_MAX_BYTES = 15 * 1024 * 1024; // 15 MB
export const SCREENSHOT_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export type ScreenshotStagingResult =
  | {
      ok: true;
      uploadId: string;
      fileName: string;
      fileSizeBytes: number;
      mimeType: string;
      status: "pending_review";
      message: string;
    }
  | {
      ok: false;
      reason: string;
    };

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateScreenshotFile(file: {
  name: string;
  size: number;
  type: string;
}): { valid: true } | { valid: false; reason: string } {
  if (file.size > SCREENSHOT_MAX_BYTES) {
    return {
      valid: false,
      reason: `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB (max 15 MB)`,
    };
  }

  const allowed: readonly string[] = SCREENSHOT_ALLOWED_TYPES;
  if (!allowed.includes(file.type)) {
    return {
      valid: false,
      reason: `Unsupported file type: ${file.type}. Use PNG, JPG, or WebP.`,
    };
  }

  return { valid: true };
}

// ─── Staging Record Builder ───────────────────────────────────────────────────
// Creates the metadata record for a pending screenshot upload.
// Actual file storage is handled by the Server Action (Supabase Storage).

export function buildScreenshotStagingRecord(file: {
  name: string;
  size: number;
  type: string;
  uploadId: string;
}): ScreenshotStagingResult {
  const validation = validateScreenshotFile(file);
  if (!validation.valid) {
    logger.warn("ingestion", "Screenshot validation failed", {
      file: file.name,
      reason: validation.reason,
    });
    return { ok: false, reason: validation.reason };
  }

  logger.info("ingestion", "Screenshot staged for review", {
    uploadId: file.uploadId,
    file: file.name,
    size: file.size,
  });

  return {
    ok: true,
    uploadId: file.uploadId,
    fileName: file.name,
    fileSizeBytes: file.size,
    mimeType: file.type,
    status: "pending_review",
    message:
      "Screenshot uploaded. Review the extracted details below and correct any errors before importing.",
  };
}

// ─── Text Extraction Stub ─────────────────────────────────────────────────────
// Placeholder for future OCR integration.
// Returns structured fields that an operator can review and correct.

export type ExtractedListingFields = {
  title?: string;
  price?: string;
  platform?: string;
  category?: string;
  days_listed?: string;
  views?: string;
  watchers?: string;
  confidence: "high" | "medium" | "low" | "none";
  extractionMethod: "ocr" | "manual" | "none";
};

export function extractFieldsFromScreenshot(
  _uploadId: string
): ExtractedListingFields {
  // OCR pipeline not implemented in Phase 4.
  // Returns empty scaffold so the review form can be pre-populated once OCR is wired.
  return {
    title: undefined,
    price: undefined,
    platform: undefined,
    days_listed: undefined,
    views: undefined,
    watchers: undefined,
    confidence: "none",
    extractionMethod: "none",
  };
}
