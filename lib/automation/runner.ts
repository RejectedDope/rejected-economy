// Core automation evaluation runner.
// Accepts a pre-built Supabase client so it can be used from both server
// actions (cookie-based client) and cron routes (service-role client).

import { evaluateAutomationRules } from "./engine";
import type { ScoredItem, VisibilityRisk, RecoveryAction } from "@/lib/types";

export type RunnerResult = {
  tasksCreated: number;
  itemsScanned: number;
  rulesEvaluated: number;
  durationMs: number;
  error?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runAutomationForUser(userId: string, supabase: any): Promise<RunnerResult> {
  const startMs = Date.now();

  try {
    // 1. Fetch enabled rules
    const { data: rulesData } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("user_id", userId)
      .eq("enabled", true);

    const rules = rulesData ?? [];
    if (rules.length === 0) {
      return { tasksCreated: 0, itemsScanned: 0, rulesEvaluated: 0, durationMs: Date.now() - startMs };
    }

    // 2. Fetch active inventory items with cached scores
    const { data: rawItems } = await supabase
      .from("inventory_items")
      .select(
        "id,user_id,title,platform,category,price,original_price,cost_basis," +
        "days_listed,date_listed,status,item_specifics_complete,image_count," +
        "title_keyword_strength,has_promoted_listing,shipping_type,shipping_cost," +
        "views,watchers,impressions,dead_inventory_score,listing_health_score," +
        "visibility_risk,primary_recovery_action,estimated_recovery," +
        "notes,tags,image_url,created_at,updated_at"
      )
      .eq("user_id", userId)
      .eq("status", "active");

    const items = rawItems ?? [];
    const scoredItems: ScoredItem[] = items.map((item: Record<string, unknown>) => ({
      ...item,
      dead_inventory_score: (item.dead_inventory_score as number) ?? 0,
      listing_health_score: (item.listing_health_score as number) ?? 50,
      visibility_risk: ((item.visibility_risk as string) ?? "Low") as VisibilityRisk,
      primary_recovery_action: ((item.primary_recovery_action as string) ?? "hold") as RecoveryAction,
      estimated_recovery: (item.estimated_recovery as number) ?? (item.price as number) ?? 0,
    }));

    // 3. Evaluate rules
    const results = evaluateAutomationRules(rules, scoredItems);

    // 4. Deduplicate against existing queued tasks
    const { data: existingTasks } = await supabase
      .from("automation_tasks")
      .select("item_id,rule_type")
      .eq("user_id", userId)
      .in("status", ["queued", "pending_review"]);

    const existingSet = new Set(
      (existingTasks ?? []).map((t: { item_id: string; rule_type: string }) => `${t.item_id}:${t.rule_type}`)
    );

    // 5. Build and insert new tasks
    const now        = new Date().toISOString();
    const expiresAt  = new Date(Date.now() + 7 * 86_400_000).toISOString();

    const newTasks = results.flatMap((result) =>
      result.triggeredItems
        .filter((item) => !existingSet.has(`${item.id}:${result.ruleType}`))
        .map((item) => ({
          user_id: userId,
          rule_id: result.ruleId ?? null,
          rule_type: result.ruleType,
          item_id: item.id,
          suggested_action: result.suggestedAction,
          alert_message: result.alertMessage,
          status: "queued",
          queued_at: now,
          expires_at: expiresAt,
          dead_score_snapshot: item.dead_inventory_score ?? null,
          days_listed_snapshot: item.days_listed ?? null,
          price_snapshot: item.price ?? null,
        }))
    );

    if (newTasks.length > 0) {
      await supabase.from("automation_tasks").insert(newTasks);
    }

    const durationMs = Date.now() - startMs;

    // 6. Log run
    await supabase.from("automation_runs").insert({
      user_id: userId,
      triggered_by: "scheduled",
      rules_evaluated: rules.length,
      tasks_created: newTasks.length,
      items_scanned: scoredItems.length,
      status: "completed",
      duration_ms: durationMs,
      ran_at: now,
    });

    // 7. Update last_run_at on matched rules
    if (results.length > 0) {
      const matchedRuleIds = results.map((r) => r.ruleId).filter(Boolean);
      if (matchedRuleIds.length > 0) {
        await supabase
          .from("automation_rules")
          .update({ last_run_at: now, updated_at: now })
          .in("id", matchedRuleIds)
          .eq("user_id", userId);
      }
    }

    return {
      tasksCreated: newTasks.length,
      itemsScanned: scoredItems.length,
      rulesEvaluated: rules.length,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - startMs;
    return { tasksCreated: 0, itemsScanned: 0, rulesEvaluated: 0, durationMs, error: String(err) };
  }
}
