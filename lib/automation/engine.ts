import type { ScoredItem, RecoveryAction } from "@/lib/types";

export type AutomationRuleType =
  | "stale_alert"
  | "auto_markdown"
  | "auto_relist"
  | "auto_crosslist";

export type AutomationRule = {
  id: string;
  rule_type: AutomationRuleType;
  enabled: boolean;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  run_count: number;
  last_run_at: string | null;
  created_at: string;
};

export type RuleEvalResult = {
  ruleType: AutomationRuleType;
  ruleId: string | undefined;
  triggeredItems: ScoredItem[];
  suggestedAction: RecoveryAction;
  alertMessage: string;
};

const SUGGESTED_ACTIONS: Record<AutomationRuleType, RecoveryAction> = {
  stale_alert:    "strategic_markdown",
  auto_markdown:  "strategic_markdown",
  auto_relist:    "relist_now",
  auto_crosslist: "move_platform",
};

function minDays(conditions: Record<string, unknown>): number {
  return typeof conditions.min_days_listed === "number" ? conditions.min_days_listed : 30;
}

function evalRule(rule: AutomationRule, items: ScoredItem[]): ScoredItem[] {
  const threshold = minDays(rule.conditions);

  return items.filter((item) => {
    if (item.status !== "active") return false;
    if (item.days_listed < threshold) return false;

    switch (rule.rule_type) {
      case "stale_alert":
        return true;

      case "auto_markdown":
        return !item.original_price || item.price >= item.original_price * 0.97;

      case "auto_relist":
        return (item.dead_inventory_score ?? 0) >= 60;

      case "auto_crosslist":
        return (item.dead_inventory_score ?? 0) >= 50;
    }
  });
}

export function evaluateAutomationRules(
  rules: AutomationRule[],
  items: ScoredItem[]
): RuleEvalResult[] {
  const results: RuleEvalResult[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const triggered = evalRule(rule, items);
    if (triggered.length === 0) continue;

    const suggestedAction = SUGGESTED_ACTIONS[rule.rule_type];
    const count = triggered.length;
    const label =
      rule.rule_type === "stale_alert"   ? "stale alert" :
      rule.rule_type === "auto_markdown"  ? "price drop" :
      rule.rule_type === "auto_relist"    ? "relist" :
                                            "crosslist";

    results.push({
      ruleType: rule.rule_type,
      ruleId: rule.id,
      triggeredItems: triggered,
      suggestedAction,
      alertMessage: `${count} item${count !== 1 ? "s" : ""} triggered ${label} rule`,
    });
  }

  return results;
}
