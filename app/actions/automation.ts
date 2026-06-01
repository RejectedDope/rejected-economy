"use server";

import { createClient } from "@/lib/supabase/server";
import { runAutomationForUser } from "@/lib/automation/runner";

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

    import("@/lib/telemetry/events").then(({ trackEvent }) => {
      const eventType = params.enabled ? "automation_rule_enabled" : "automation_rule_disabled";
      trackEvent(user.id, eventType, "automation", { ruleType: params.ruleType }).catch(() => {});
    }).catch(() => {});

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
// Delegates to lib/automation/runner so the same logic can be used from the
// cron route (with a service-role client) without duplicating code.

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

    const result = await runAutomationForUser(user.id, supabase);
    if (result.error) return { ok: false, tasksCreated: 0, itemsScanned: 0, error: result.error };
    return { ok: true, tasksCreated: result.tasksCreated, itemsScanned: result.itemsScanned };
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

// ─── Fetch Automation Effectiveness ──────────────────────────────────────────

export type AutomationEffectiveness = {
  total: number;
  completed: number;
  skipped: number;
  queued: number;
  completionRate: number;
  skipRate: number;
  lastTaskAt: string | null;
  avgDurationMs: number | null;
};

export async function fetchAutomationEffectiveness(): Promise<AutomationEffectiveness | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const [tasksRes, runsRes] = await Promise.all([
      supabase
        .from("automation_tasks")
        .select("status, queued_at")
        .eq("user_id", user.id),
      supabase
        .from("automation_runs")
        .select("duration_ms, ran_at")
        .eq("user_id", user.id)
        .not("duration_ms", "is", null)
        .order("ran_at", { ascending: false })
        .limit(20),
    ]);

    const tasks = tasksRes.data ?? [];
    const runs  = runsRes.data ?? [];

    const total     = tasks.length;
    const completed = tasks.filter((t: { status: string }) => t.status === "completed").length;
    const skipped   = tasks.filter((t: { status: string }) => t.status === "skipped").length;
    const queued    = tasks.filter((t: { status: string }) =>
      t.status === "queued" || t.status === "pending_review"
    ).length;

    const lastTaskAt = tasks.length > 0
      ? tasks.sort((a: { queued_at: string }, b: { queued_at: string }) =>
          new Date(b.queued_at).getTime() - new Date(a.queued_at).getTime()
        )[0].queued_at
      : null;

    const avgDurationMs = runs.length > 0
      ? Math.round(runs.reduce((s: number, r: { duration_ms: number }) => s + r.duration_ms, 0) / runs.length)
      : null;

    return {
      total,
      completed,
      skipped,
      queued,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      skipRate: total > 0 ? Math.round((skipped / total) * 100) : 0,
      lastTaskAt,
      avgDurationMs,
    };
  } catch {
    return null;
  }
}
