// Lightweight scoring engine for audit intake form submissions.
// Derives severity, recovery range, and suggested action from
// text fields only — no additional marketplace data required.

export type AuditScoreInput = {
  biggest_problem: string;
  inventory_count: string;
  primary_platform: string;
};

export type AuditScoreResult = {
  severity_score: number;
  recovery_est_low: number;
  recovery_est_high: number;
  suggested_action: string;
};

// Base severity 0–100 from problem type
const PROBLEM_SEVERITY: Record<string, number> = {
  "Items sitting too long":                   70,
  "Listings getting views but no sales":      68,
  "Not sure how to price":                    55,
  "Need to know what to relist or liquidate": 50,
  "Too much inventory":                       42,
  "Not sure which platform is best":          30,
  "Other":                                    25,
};

// Multiplier based on inventory scale — larger piles = higher systemic risk
const COUNT_MULTIPLIER: Record<string, number> = {
  "Under 25 items":   0.55,
  "25–100 items":     0.70,
  "100–500 items":    0.85,
  "500–1,000 items":  0.95,
  "Over 1,000 items": 1.00,
};

// Recovery estimate [low, high] USD based on:
// inventory count midpoint × ~$28 avg resale value × 15–35% recovery rate
const RECOVERY_RANGES: Record<string, [number, number]> = {
  "Under 25 items":   [150,    500],
  "25–100 items":     [500,  2_000],
  "100–500 items":  [2_000,  8_000],
  "500–1,000 items":[8_000, 18_000],
  "Over 1,000 items":[18_000, 50_000],
};

const PROBLEM_ACTION: Record<string, string> = {
  "Items sitting too long":                   "relist_now",
  "Listings getting views but no sales":      "strategic_markdown",
  "Not sure how to price":                    "strategic_markdown",
  "Need to know what to relist or liquidate": "relist_now",
  "Too much inventory":                       "bundle",
  "Not sure which platform is best":          "move_platform",
  "Other":                                    "optimize_specifics",
};

export function scoreAuditLead(input: AuditScoreInput): AuditScoreResult {
  const base = PROBLEM_SEVERITY[input.biggest_problem] ?? 25;
  const mult = COUNT_MULTIPLIER[input.inventory_count] ?? 0.70;
  const severity_score = Math.round(Math.min(100, base * mult));

  const [recovery_est_low, recovery_est_high] =
    RECOVERY_RANGES[input.inventory_count] ?? [500, 2_000];

  const suggested_action =
    PROBLEM_ACTION[input.biggest_problem] ?? "optimize_specifics";

  return { severity_score, recovery_est_low, recovery_est_high, suggested_action };
}
