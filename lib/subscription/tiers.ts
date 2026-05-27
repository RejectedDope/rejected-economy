// Subscription tier definitions and feature gate helpers.
// No external dependencies — pure config.
// Wire to Stripe billing data when payment is integrated.

export type PlanId = "free" | "starter" | "pro" | "business";

export type FeatureKey =
  | "csv_import"
  | "xlsx_import"
  | "screenshot_ocr"
  | "column_mapper"
  | "recovery_engine"
  | "scoring_snapshots"
  | "platform_breakdown"
  | "export_data"
  | "api_sync"
  | "scheduled_imports"
  | "multi_platform"
  | "bulk_actions"
  | "automation_rules"
  | "automation_scheduling";

export type PlanTier = {
  id: PlanId;
  name: string;
  maxItems: number;           // -1 = unlimited
  maxImportsPerMonth: number; // -1 = unlimited
  maxBatchSize: number;       // max rows per single import
  features: FeatureKey[];
};

export const PLANS: Record<PlanId, PlanTier> = {
  free: {
    id: "free",
    name: "Free",
    maxItems: 100,
    maxImportsPerMonth: 3,
    maxBatchSize: 200,
    features: ["csv_import", "column_mapper", "recovery_engine"],
  },
  starter: {
    id: "starter",
    name: "Starter",
    maxItems: 500,
    maxImportsPerMonth: 10,
    maxBatchSize: 1_000,
    features: [
      "csv_import",
      "xlsx_import",
      "screenshot_ocr",
      "column_mapper",
      "recovery_engine",
      "scoring_snapshots",
      "platform_breakdown",
      "multi_platform",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    maxItems: 5_000,
    maxImportsPerMonth: -1,
    maxBatchSize: 10_000,
    features: [
      "csv_import",
      "xlsx_import",
      "screenshot_ocr",
      "column_mapper",
      "recovery_engine",
      "scoring_snapshots",
      "platform_breakdown",
      "export_data",
      "multi_platform",
      "bulk_actions",
      "automation_rules",
      "automation_scheduling",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    maxItems: -1,
    maxImportsPerMonth: -1,
    maxBatchSize: 10_000,
    features: [
      "csv_import",
      "xlsx_import",
      "screenshot_ocr",
      "column_mapper",
      "recovery_engine",
      "scoring_snapshots",
      "platform_breakdown",
      "export_data",
      "api_sync",
      "scheduled_imports",
      "multi_platform",
      "bulk_actions",
      "automation_rules",
      "automation_scheduling",
    ],
  },
};

export const DEFAULT_PLAN: PlanId = "free";

export function getPlan(id: PlanId | undefined | null): PlanTier {
  return PLANS[id ?? DEFAULT_PLAN] ?? PLANS.free;
}

export function hasFeature(
  planId: PlanId | undefined | null,
  feature: FeatureKey
): boolean {
  return getPlan(planId).features.includes(feature);
}

export type QuotaCheckResult =
  | { ok: true }
  | { ok: false; reason: string; limit: number };

export function checkItemQuota(
  planId: PlanId | undefined | null,
  currentItemCount: number,
  pendingRows: number
): QuotaCheckResult {
  const plan = getPlan(planId);

  if (plan.maxItems !== -1 && currentItemCount + pendingRows > plan.maxItems) {
    const remaining = Math.max(0, plan.maxItems - currentItemCount);
    return {
      ok: remaining > 0,
      reason: `${plan.name} plan allows ${plan.maxItems} items (${remaining} slots remaining, ${pendingRows} pending)`,
      limit: plan.maxItems,
    };
  }

  return { ok: true };
}

export function checkBatchSizeQuota(
  planId: PlanId | undefined | null,
  rowCount: number
): QuotaCheckResult {
  const plan = getPlan(planId);

  if (rowCount > plan.maxBatchSize) {
    return {
      ok: false,
      reason: `${rowCount} rows exceeds the ${plan.maxBatchSize}-row batch limit for the ${plan.name} plan`,
      limit: plan.maxBatchSize,
    };
  }

  return { ok: true };
}
