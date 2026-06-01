// ============================================================
// RESALEIQ — Audit Form Submission Test Fixtures
// Covers valid, boundary, and invalid inputs for the audit form.
// ============================================================

import type { AuditSubmissionInput } from "@/lib/validation/audit-schema";

// ─── Valid submissions ────────────────────────────────────────────────────────

export const validSubmissions: { label: string; input: AuditSubmissionInput }[] = [
  {
    label: "high-severity: stale eBay inventory at scale",
    input: {
      name: "Marcus Webb",
      email: "marcus@example.com",
      primary_platform: "eBay",
      inventory_count: "Over 1,000 items",
      biggest_problem: "Items sitting too long",
      listing_url: "https://www.ebay.com/sch/i.html?_ssn=marcuswebb_shop",
      notes: "Most stuff has been sitting 6+ months",
    },
    // Expected: severity_score = round(70 × 1.00) = 70
    // recovery_est: $18,000–$50,000, action: relist_now
  },
  {
    label: "medium-severity: Poshmark pricing confusion",
    input: {
      name: "Dani Rivers",
      email: "Dani.Rivers@Gmail.Com", // mixed case — should be normalized
      primary_platform: "Poshmark",
      inventory_count: "100–500 items",
      biggest_problem: "Not sure how to price",
      listing_url: undefined,
      notes: undefined,
    },
    // Expected: severity_score = round(55 × 0.85) = 47
    // recovery_est: $2,000–$8,000, action: strategic_markdown
  },
  {
    label: "low-severity: small seller platform confusion",
    input: {
      name: "Teri Banks",
      email: "teri@resellers.co",
      primary_platform: "Multiple platforms",
      inventory_count: "Under 25 items",
      biggest_problem: "Not sure which platform is best",
      listing_url: undefined,
      notes: "  ", // whitespace only — should normalize to null
    },
    // Expected: severity_score = round(30 × 0.55) = 17 (low urgency)
    // recovery_est: $150–$500, action: move_platform
  },
  {
    label: "high-severity: views no sales at scale",
    input: {
      name: "Jerome L.",
      email: "jerome@example.com",
      primary_platform: "eBay",
      inventory_count: "500–1,000 items",
      biggest_problem: "Listings getting views but no sales",
      listing_url: "https://www.ebay.com/str/jeromeresale",
      notes: "Getting 50-100 views per item but nobody buys",
    },
    // Expected: severity_score = round(68 × 0.95) = 65
    // recovery_est: $8,000–$18,000, action: strategic_markdown
  },
];

// ─── Invalid / malicious submissions (should be rejected by schema) ───────────

export const invalidSubmissions: { label: string; input: unknown; expectErrors: string[] }[] = [
  {
    label: "empty form",
    input: { name: "", email: "", primary_platform: "", inventory_count: "", biggest_problem: "" },
    expectErrors: ["name", "email", "primary_platform", "inventory_count", "biggest_problem"],
  },
  {
    label: "invalid email format",
    input: {
      name: "Test User",
      email: "not-an-email",
      primary_platform: "eBay",
      inventory_count: "Under 25 items",
      biggest_problem: "Other",
    },
    expectErrors: ["email"],
  },
  {
    label: "invalid platform (not in enum)",
    input: {
      name: "Test User",
      email: "test@example.com",
      primary_platform: "Amazon",  // not in VALID_PLATFORMS
      inventory_count: "Under 25 items",
      biggest_problem: "Other",
    },
    expectErrors: ["primary_platform"],
  },
  {
    label: "invalid inventory_count (not in enum)",
    input: {
      name: "Test User",
      email: "test@example.com",
      primary_platform: "eBay",
      inventory_count: "A million items",  // not in VALID_INVENTORY_COUNTS
      biggest_problem: "Other",
    },
    expectErrors: ["inventory_count"],
  },
  {
    label: "invalid listing URL (not http/https)",
    input: {
      name: "Test User",
      email: "test@example.com",
      primary_platform: "eBay",
      inventory_count: "Under 25 items",
      biggest_problem: "Other",
      listing_url: "javascript:alert(1)",  // XSS attempt
    },
    expectErrors: ["listing_url"],
  },
  {
    label: "name too long (>120 chars)",
    input: {
      name: "A".repeat(121),
      email: "test@example.com",
      primary_platform: "eBay",
      inventory_count: "Under 25 items",
      biggest_problem: "Other",
    },
    expectErrors: ["name"],
  },
  {
    label: "notes too long (>2000 chars)",
    input: {
      name: "Test User",
      email: "test@example.com",
      primary_platform: "eBay",
      inventory_count: "Under 25 items",
      biggest_problem: "Other",
      notes: "X".repeat(2001),
    },
    expectErrors: ["notes"],
  },
  {
    label: "SQL injection attempt in name",
    input: {
      name: "Robert'); DROP TABLE audit_leads;--",
      email: "test@example.com",
      primary_platform: "eBay",
      inventory_count: "Under 25 items",
      biggest_problem: "Other",
    },
    // The name is technically valid (strings are valid up to 120 chars).
    // SQL injection is handled by Supabase's parameterized queries, not the schema.
    // This should PASS schema validation — the injection won't execute.
    expectErrors: [],
  },
];

// ─── Scoring engine test cases ────────────────────────────────────────────────
// Verify scoreAuditLead outputs for all problem × count combinations.

export const scoringTestCases = [
  // Max severity: highest problem × largest inventory
  {
    input: { biggest_problem: "Items sitting too long", inventory_count: "Over 1,000 items", primary_platform: "eBay" },
    expected: { severity_score: 70, action: "relist_now", recoveryRange: [18000, 50000] },
  },
  // Min severity: lowest problem × smallest inventory
  {
    input: { biggest_problem: "Other", inventory_count: "Under 25 items", primary_platform: "Poshmark" },
    expected: { severity_score: 14, action: "optimize_specifics", recoveryRange: [150, 500] },
  },
  // Views-no-sales at mid scale
  {
    input: { biggest_problem: "Listings getting views but no sales", inventory_count: "25–100 items", primary_platform: "Mercari" },
    expected: { severity_score: 48, action: "strategic_markdown", recoveryRange: [500, 2000] },
  },
  // Unknown problem + unknown count → fallback to defaults
  {
    input: { biggest_problem: "Completely unknown problem", inventory_count: "Unknown count", primary_platform: "eBay" },
    expected: { severity_score: 18, action: "optimize_specifics", recoveryRange: [500, 2000] },
    // base=25 (default) × mult=0.70 (default) = 17.5 → round to 18
  },
] as const;
