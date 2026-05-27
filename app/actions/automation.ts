"use server";

import { createClient } from "@/lib/supabase/server";
import { evaluateAutomationRules } from "@/lib/automation/engine";
import type { ScoredItem, VisibilityRisk, RecoveryAction } from "@/lib/types";

export type AutomationRule = {
  id: string;
  rule_type: "auto_markdown" | "auto_relist" | "auto_crosslist" | "stale_alert";
  enabled: boolean;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  run_count: number;
  last_run_at: string | null;
  created_at: string;
};

export type AutomationRulesResult = {
  rules: AutomationRule[];
  error?: string;
};

export async function fetchAutomationRules(): Promise<AutomationRulesResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { rules: [], error: "Not authenticated" };

    const { data, error } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("user_id", user.id)
      .order("rule_type");

    if (error) return { rules: [], error: error.message };
    return { rules: (data ?? []) as AutomationRule[] };
  } catch {
    return { rules: [], error: "Failed to fetch automation rules" };
  }
}

export async function upsertAutomationRule(params: {
  ruleType: AutomationRule["rule_type"];
  enabled: boolean;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not authenticated" };

    const { error } = await supabase.from("automation_rules").upsert(
      {
        user_id: user.id,
        rule_type: params.ruleType,
        enabled: params.enabled,
        conditions: params.conditions,
        actions: params.actions,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,rule_type" }
    );

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save rule" };
  }
}

export async function toggleAutomationRule(
  ruleId: string,
  enabled: boolean
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not authenticated" };

    const { error } = await supabase
      .from("automation_rules")
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq("id", ruleId)
      .eq("user_id", user.id);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to toggle rule" };
  }
}

// ─── Automation Task Types ────────────────────────────────────────────────────

export type AutomationTaskStatus =
  | "queued" | "pending_review" | "approved"
  | "completed" | "skipped" | "failed" | "expired";

export type AutomationTask = {
  id: string;
  item_id: string | null;
  rule_type: AutomationRule["rule_type"];
  suggested_action: string;
  alert_message: string | null;
  status: AutomationTaskStatus;
  queued_at: string;
  expires_at: string | null;
  dead_score_snapshot: number | null;
  days_listed_snapshot: number | null;
  price_snapshot: number | null;
  item_title?: string;
  item_price?: number;
  item_platform?: string;
};

export type AutomationRun = {
  id: string;
  triggered_by: string;
  rules_evaluated: number;
  tasks_created: number;
  items_scanned: number;
  ran_at: string;
};

// ─── Evaluate Rules For User ──────────────────────────────────────────────────
// Fetches active inventory from DB, runs the evaluation engine, persists tasks.

export async function evaluateRulesForUser(): Promise<{
  ok: boolean;
  tasksCreated: number;
  itemsScanned: number;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, tasksCreated: 0, itemsScanned: 0, error: "Not authenticated" };

    // 1. Fetch enabled rules
    const { data: rulesData } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("user_id", user.id)
      .eq("enabled", true);
    const rules = (rulesData ?? []) as AutomationRule[];
    if (rules.length === 0) return { ok: true, tasksCreated: 0, itemsScanned: 0 };

    // 2. Fetch active inventory with cached scores
    const { data: itemsData } = await supabase
      .from("inventory_items")
      .select("id,user_id,title,platform,category,price,original_price,cost_basis,days_listed,date_listed,status,item_specifics_complete,image_count,title_keyword_strength,has_promoted_listing,shipping_type,shipping_cost,views,watchers,impressions,dead_inventory_score,listing_health_score,visibility_risk,primary_recovery_action,estimated_recovery,notes,tags,image_url,created_at,updated_at")
      .eq("user_id", user.id)
      .eq("status", "active");

    const rawItems = itemsData ?? [];
    const scoredItems: ScoredItem[] = rawItems.map((item) => ({
      ...item,
      dead_inventory_score: item.dead_inventory_score ?? 0,
      listing_health_score: item.listing_health_score ?? 50,
      visibility_risk: (item.visibility_risk ?? "Low") as VisibilityRisk,
      primary_recovery_action: (item.primary_recovery_action ?? "hold") as RecoveryAction,
      estimated_recovery: item.estimated_recovery ?? item.price ?? 0,
    }));

    // 3. Run evaluation engine
    const results = evaluateAutomationRules(rules, scoredItems);
    const itemsScanned = scoredItems.length;

    // 4. Fetch existing queued tasks to avoid duplicates
    const { data: existingTasks } = await supabase
      .from("automation_tasks")
      .select("item_id,rule_type")
      .eq("user_id", user.id)
      .in("status", ["queued", "pending_review"]);
    const existingSet = new Set(
      (existingTasks ?? []).map((t: { item_id: string; rule_type: string }) => `${t.item_id}:${t.rule_type}`)
    );

    // 5. Build new tasks (skip already-queued combos)
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();

    const newTasks = results.flatMap((result) =>
      result.triggeredItems
        .filter((item) => !existingSet.has(`${item.id}:${result.ruleType}`))
        .map((item) => ({
          user_id: user.id,
          rule_id: result.ruleId ?? null,
          rule_type: result.ruleType,
          item_id: item.id,
          suggested_action: result.suggestedAction,
          alert_message: result.alertMessage,
          status: "queued" as AutomationTaskStatus,
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

    // 6. Log the run
    await supabase.from("automation_runs").insert({
      user_id: user.id,
      triggered_by: "manual",
      rules_evaluated: rules.length,
      tasks_created: newTasks.length,
      items_scanned: itemsScanned,
    });

    // 7. Update last_run_at + run_count on matched rules
    for (const result of results) {
      if (result.ruleId) {
        await supabase
          .from("automation_rules")
          .update({
            last_run_at: now,
            updated_at: now,
          })
          .eq("id", result.ruleId)
          .eq("user_id", user.id);
      }
    }

    return { ok: true, tasksCreated: newTasks.length, itemsScanned };
  } catch (err) {
    return { ok: false, tasksCreated: 0, itemsScanned: 0, error: String(err) };
  }
}

// ─── Fetch Automation Tasks ───────────────────────────────────────────────────

export async function fetchAutomationTasks(): Promise<{
  tasks: AutomationTask[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { tasks: [] };

    const { data, error } = await supabase
      .from("automation_tasks")
      .select("*, inventory_items(title, price, platform)")
      .eq("user_id", user.id)
      .in("status", ["queued", "pending_review"])
      .gt("expires_at", new Date().toISOString())
      .order("queued_at", { ascending: false })
      .limit(50);

    if (error) return { tasks: [], error: error.message };

    const tasks: AutomationTask[] = (data ?? []).map((t) => ({
      id: t.id,
      item_id: t.item_id,
      rule_type: t.rule_type as AutomationRule["rule_type"],
      suggested_action: t.suggested_action,
      alert_message: t.alert_message,
      status: t.status as AutomationTaskStatus,
      queued_at: t.queued_at,
      expires_at: t.expires_at,
      dead_score_snapshot: t.dead_score_snapshot,
      days_listed_snapshot: t.days_listed_snapshot,
      price_snapshot: t.price_snapshot,
      item_title: (t.inventory_items as { title?: string } | null)?.title,
      item_price: (t.inventory_items as { price?: number } | null)?.price,
      item_platform: (t.inventory_items as { platform?: string } | null)?.platform,
    }));

    return { tasks };
  } catch {
    return { tasks: [], error: "Failed to fetch tasks" };
  }
}

// ─── Dismiss Automation Task ──────────────────────────────────────────────────

export async function dismissAutomationTask(taskId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not authenticated" };

    const { error } = await supabase
      .from("automation_tasks")
      .update({ status: "skipped", reviewed_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("user_id", user.id);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to dismiss task" };
  }
}

// ─── Fetch Automation History ─────────────────────────────────────────────────

export async function fetchAutomationHistory(limit = 20): Promise<{
  runs: AutomationRun[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { runs: [] };

    const { data, error } = await supabase
      .from("automation_runs")
      .select("id,triggered_by,rules_evaluated,tasks_created,items_scanned,ran_at")
      .eq("user_id", user.id)
      .order("ran_at", { ascending: false })
      .limit(limit);

    if (error) return { runs: [], error: error.message };
    return { runs: (data ?? []) as AutomationRun[] };
  } catch {
    return { runs: [], error: "Failed to fetch history" };
  }
}
