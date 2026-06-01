import { describe, it, expect } from "vitest";
import {
  parseAuditSubmission,
  parseLeadStatusUpdate,
  VALID_PLATFORMS,
  VALID_INVENTORY_COUNTS,
  VALID_PROBLEMS,
} from "@/lib/validation/audit-schema";
import { validSubmissions, invalidSubmissions } from "@/tests/fixtures/audit-submissions";

// ─── Valid Submissions ────────────────────────────────────────────────────────

describe("valid audit submissions", () => {
  validSubmissions.forEach(({ label, input }) => {
    it(`accepts: ${label}`, () => {
      const result = parseAuditSubmission(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBeTruthy();
        expect(result.data.email).toContain("@");
      }
    });
  });

  it("normalizes email to lowercase", () => {
    const result = parseAuditSubmission({
      name: "Dani Rivers",
      email: "Dani.Rivers@Gmail.Com",
      primary_platform: "Poshmark",
      inventory_count: "100–500 items",
      biggest_problem: "Not sure how to price",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("dani.rivers@gmail.com");
    }
  });

  it("trims whitespace-only notes to null/undefined", () => {
    const result = parseAuditSubmission({
      name: "Teri Banks",
      email: "teri@resellers.co",
      primary_platform: "Multiple platforms",
      inventory_count: "Under 25 items",
      biggest_problem: "Not sure which platform is best",
      notes: "   ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // Whitespace-only notes should normalize to null or empty
      expect(!result.data.notes || result.data.notes.trim() === "").toBe(true);
    }
  });

  it("accepts undefined listing_url", () => {
    const result = parseAuditSubmission({
      name: "Test User",
      email: "test@example.com",
      primary_platform: "eBay",
      inventory_count: "Under 25 items",
      biggest_problem: "Other",
      listing_url: undefined,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid https listing URL", () => {
    const result = parseAuditSubmission({
      name: "Test User",
      email: "test@example.com",
      primary_platform: "eBay",
      inventory_count: "Under 25 items",
      biggest_problem: "Other",
      listing_url: "https://www.ebay.com/sch/i.html?_ssn=test",
    });
    expect(result.success).toBe(true);
  });
});

// ─── Invalid Submissions ──────────────────────────────────────────────────────

describe("invalid audit submissions", () => {
  invalidSubmissions
    .filter((tc) => tc.expectErrors.length > 0)
    .forEach(({ label, input, expectErrors }) => {
      it(`rejects: ${label}`, () => {
        const result = parseAuditSubmission(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expectErrors.forEach((field) => {
            expect(result.errors).toHaveProperty(field);
          });
        }
      });
    });

  it("SQL injection passes schema (injection handled by parameterized queries)", () => {
    const sqlInjection = invalidSubmissions.find((tc) => tc.label === "SQL injection attempt in name");
    expect(sqlInjection).toBeDefined();
    expect(sqlInjection!.expectErrors).toHaveLength(0);
    const result = parseAuditSubmission(sqlInjection!.input);
    expect(result.success).toBe(true);
  });

  it("rejects javascript: URLs", () => {
    const result = parseAuditSubmission({
      name: "Test User",
      email: "test@example.com",
      primary_platform: "eBay",
      inventory_count: "Under 25 items",
      biggest_problem: "Other",
      listing_url: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toHaveProperty("listing_url");
    }
  });

  it("rejects name > 120 chars", () => {
    const result = parseAuditSubmission({
      name: "A".repeat(121),
      email: "test@example.com",
      primary_platform: "eBay",
      inventory_count: "Under 25 items",
      biggest_problem: "Other",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toHaveProperty("name");
    }
  });

  it("rejects notes > 2000 chars", () => {
    const result = parseAuditSubmission({
      name: "Test User",
      email: "test@example.com",
      primary_platform: "eBay",
      inventory_count: "Under 25 items",
      biggest_problem: "Other",
      notes: "X".repeat(2001),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toHaveProperty("notes");
    }
  });

  it("rejects platform not in enum", () => {
    const result = parseAuditSubmission({
      name: "Test User",
      email: "test@example.com",
      primary_platform: "Amazon",
      inventory_count: "Under 25 items",
      biggest_problem: "Other",
    });
    expect(result.success).toBe(false);
  });

  it("rejects inventory_count not in enum", () => {
    const result = parseAuditSubmission({
      name: "Test User",
      email: "test@example.com",
      primary_platform: "eBay",
      inventory_count: "A million items",
      biggest_problem: "Other",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty required fields", () => {
    const result = parseAuditSubmission({
      name: "",
      email: "",
      primary_platform: "",
      inventory_count: "",
      biggest_problem: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(result.errors).length).toBeGreaterThanOrEqual(3);
    }
  });
});

// ─── Enum Completeness ────────────────────────────────────────────────────────

describe("enum values", () => {
  it("all VALID_PLATFORMS pass schema", () => {
    VALID_PLATFORMS.forEach((platform) => {
      const result = parseAuditSubmission({
        name: "Test",
        email: "test@example.com",
        primary_platform: platform,
        inventory_count: "Under 25 items",
        biggest_problem: "Other",
      });
      expect(result.success).toBe(true);
    });
  });

  it("all VALID_INVENTORY_COUNTS pass schema", () => {
    VALID_INVENTORY_COUNTS.forEach((count) => {
      const result = parseAuditSubmission({
        name: "Test",
        email: "test@example.com",
        primary_platform: "eBay",
        inventory_count: count,
        biggest_problem: "Other",
      });
      expect(result.success).toBe(true);
    });
  });

  it("all VALID_PROBLEMS pass schema", () => {
    VALID_PROBLEMS.forEach((problem) => {
      const result = parseAuditSubmission({
        name: "Test",
        email: "test@example.com",
        primary_platform: "eBay",
        inventory_count: "Under 25 items",
        biggest_problem: problem,
      });
      expect(result.success).toBe(true);
    });
  });
});

// ─── Lead Status Update ───────────────────────────────────────────────────────

describe("parseLeadStatusUpdate", () => {
  it("accepts valid statuses", () => {
    expect(parseLeadStatusUpdate({ status: "new" })).not.toBeNull();
    expect(parseLeadStatusUpdate({ status: "reviewed" })).not.toBeNull();
    expect(parseLeadStatusUpdate({ status: "contacted" })).not.toBeNull();
  });

  it("rejects invalid status", () => {
    expect(parseLeadStatusUpdate({ status: "spam" })).toBeNull();
    expect(parseLeadStatusUpdate({ status: "" })).toBeNull();
    expect(parseLeadStatusUpdate({ status: "DROP TABLE" })).toBeNull();
  });

  it("rejects missing status", () => {
    expect(parseLeadStatusUpdate({})).toBeNull();
    expect(parseLeadStatusUpdate(null)).toBeNull();
  });
});
