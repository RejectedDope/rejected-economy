// ============================================================
// RESALEIQ — Audit Form Validation Schemas
// Shared between client validation and server-side sanitization.
// ============================================================

import { z } from "zod";

// ─── Canonical enum values (must match recovery-audit form constants) ─────────

export const VALID_PLATFORMS = [
  "eBay",
  "Poshmark",
  "Mercari",
  "Facebook Marketplace",
  "Depop",
  "Vinted",
  "Whatnot",
  "Antique booth / flea market",
  "Multiple platforms",
] as const;

export const VALID_INVENTORY_COUNTS = [
  "Under 25 items",
  "25–100 items",
  "100–500 items",
  "500–1,000 items",
  "Over 1,000 items",
] as const;

export const VALID_PROBLEMS = [
  "Items sitting too long",
  "Not sure how to price",
  "Listings getting views but no sales",
  "Too much inventory",
  "Need to know what to relist or liquidate",
  "Not sure which platform is best",
  "Other",
] as const;

export const VALID_LEAD_STATUSES = ["new", "reviewed", "contacted"] as const;

export type ValidPlatform = (typeof VALID_PLATFORMS)[number];
export type ValidInventoryCount = (typeof VALID_INVENTORY_COUNTS)[number];
export type ValidProblem = (typeof VALID_PROBLEMS)[number];
export type ValidLeadStatus = (typeof VALID_LEAD_STATUSES)[number];

// ─── Audit submission schema ──────────────────────────────────────────────────

export const auditSubmissionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Name must be under 120 characters"),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .max(254, "Email must be under 254 characters"),

  primary_platform: z
    .string()
    .trim()
    .min(1, "Select your primary platform")
    .refine(
      (val) => VALID_PLATFORMS.includes(val as ValidPlatform),
      "Invalid platform selection"
    ),

  inventory_count: z
    .string()
    .trim()
    .min(1, "Select your approximate inventory size")
    .refine(
      (val) => VALID_INVENTORY_COUNTS.includes(val as ValidInventoryCount),
      "Invalid inventory count selection"
    ),

  biggest_problem: z
    .string()
    .trim()
    .min(1, "Select your biggest current problem")
    .refine(
      (val) => VALID_PROBLEMS.includes(val as ValidProblem),
      "Invalid problem selection"
    ),

  listing_url: z
    .string()
    .trim()
    .max(2048, "URL must be under 2048 characters")
    .optional()
    .transform((val) => val || null)
    .refine(
      (val) => !val || val.startsWith("http://") || val.startsWith("https://"),
      "Listing URL must start with http:// or https://"
    ),

  notes: z
    .string()
    .trim()
    .max(2000, "Notes must be under 2000 characters")
    .optional()
    .transform((val) => val || null),
});

export type AuditSubmissionInput = z.input<typeof auditSubmissionSchema>;
export type AuditSubmissionData = z.output<typeof auditSubmissionSchema>;

// ─── Admin status update schema ───────────────────────────────────────────────

export const leadStatusUpdateSchema = z.object({
  status: z.enum(VALID_LEAD_STATUSES, {
    errorMap: () => ({ message: "Invalid status value" }),
  }),
  reviewed_at: z.string().datetime().optional(),
});

export type LeadStatusUpdate = z.infer<typeof leadStatusUpdateSchema>;

// ─── Sanitize utility ─────────────────────────────────────────────────────────

/**
 * Parses and sanitizes audit form input for DB insertion.
 * Returns { success, data } or { success: false, errors }.
 * Use this on the server before any Supabase write.
 */
export function parseAuditSubmission(raw: unknown):
  | { success: true; data: AuditSubmissionData }
  | { success: false; errors: Record<string, string> } {
  const result = auditSubmissionSchema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0]?.toString() ?? "form";
    errors[key] = issue.message;
  }
  return { success: false, errors };
}

/**
 * Validates a lead status update payload.
 * Returns the sanitized update or null if invalid.
 */
export function parseLeadStatusUpdate(raw: unknown): LeadStatusUpdate | null {
  const result = leadStatusUpdateSchema.safeParse(raw);
  return result.success ? result.data : null;
}
