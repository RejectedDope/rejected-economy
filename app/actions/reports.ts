"use server";

import { createClient } from "@/lib/supabase/server";

export type RecoveryScorecard = {
  grade: "A" | "B" | "C" | "D" | "F";
  total_recovered: number;
  items_sold: number;
  success_rate: number;
  dead_pct_change: number | null;
  actions_taken: number;
  period_days: number;
};

export type InventoryChangeReport = {
  period_days: number;
  current: { dead_pct: number; avg_days: number; health_score: number; trapped_cash: number } | null;
  prior:   { dead_pct: number; avg_days: number; health_score: number; trapped_cash: number } | null;
  deltas:  { dead_pct: number; avg_days: number; health_score: number; trapped_cash: number } | null;
};

export type SellerOutcomeSummary = {
  recovered_total: number;
  items_sold: number;
  actions_taken: number;
  recovery_rate: number;
  top_action_type: string | null;
  period_days: number;
};

function assignGrade(successRate: number, actionsTaken: number): "A" | "B" | "C" | "D" | "F" {
  if (actionsTaken === 0) return "F";
  if (successRate >= 50) return "A";
  if (successRate >= 35) return "B";
  if (successRate >= 20) return "C";
  if (successRate >= 10) return "D";
  return "F";
}

export async function fetchRecoveryScorecard(
  periodDays = 30
): Promise<{ scorecard: RecoveryScorecard | null; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { scorecard: null, error: "Not authenticated" };

  const since = new Date();
  since.setDate(since.getDate() - periodDays);

  const { data, error } = await supabase
    .from("recovery_actions")
    .select("action_type, outcome, recovery_amount, action_status")
    .eq("user_id", user.id)
    .gte("created_at", since.toISOString());

  if (error) return { scorecard: null, error: error.message };

  const rows = (data ?? []) as { action_type: string; outcome: string | null; recovery_amount: number | null; action_status: string }[];
  const completed = rows.filter((r) => r.action_status === "completed");
  const sold = completed.filter((r) => r.outcome === "sold");
  const total_recovered = sold.reduce((s, r) => s + (r.recovery_amount ?? 0), 0);
  const success_rate = completed.length > 0 ? Math.round((sold.length / completed.length) * 100) : 0;

  const since2 = new Date();
  since2.setDate(since2.getDate() - periodDays * 2);

  const { data: metricsData } = await supabase
    .from("portfolio_metrics")
    .select("dead_inventory_pct, metric_date")
    .eq("user_id", user.id)
    .gte("metric_date", since2.toISOString().split("T")[0])
    .order("metric_date", { ascending: false })
    .limit(2);

  const metrics = (metricsData ?? []) as { dead_inventory_pct: number; metric_date: string }[];
  let dead_pct_change: number | null = null;
  if (metrics.length >= 2) {
    dead_pct_change = Math.round((metrics[0].dead_inventory_pct - metrics[1].dead_inventory_pct) * 10) / 10;
  }

  const scorecard: RecoveryScorecard = {
    grade: assignGrade(success_rate, completed.length),
    total_recovered,
    items_sold: sold.length,
    success_rate,
    dead_pct_change,
    actions_taken: completed.length,
    period_days: periodDays,
  };

  return { scorecard };
}

export async function fetchInventoryChangeReport(
  periodDays = 30
): Promise<{ report: InventoryChangeReport; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      report: { period_days: periodDays, current: null, prior: null, deltas: null },
      error: "Not authenticated",
    };
  }

  const { data: metricsData } = await supabase
    .from("portfolio_metrics")
    .select("dead_inventory_pct, avg_days_listed, portfolio_health_score, metric_date")
    .eq("user_id", user.id)
    .order("metric_date", { ascending: false })
    .limit(2);

  const metrics = (metricsData ?? []) as {
    dead_inventory_pct: number;
    avg_days_listed: number;
    portfolio_health_score: number;
    metric_date: string;
  }[];

  const { data: snapshotsData } = await supabase
    .from("inventory_snapshots")
    .select("trapped_cash, snapshotted_at")
    .eq("user_id", user.id)
    .order("snapshotted_at", { ascending: false })
    .limit(2);

  const snapshots = (snapshotsData ?? []) as { trapped_cash: number; snapshotted_at: string }[];

  if (metrics.length === 0) {
    return { report: { period_days: periodDays, current: null, prior: null, deltas: null } };
  }

  const current = {
    dead_pct: metrics[0].dead_inventory_pct,
    avg_days: metrics[0].avg_days_listed,
    health_score: metrics[0].portfolio_health_score,
    trapped_cash: snapshots[0]?.trapped_cash ?? 0,
  };

  if (metrics.length < 2) {
    return { report: { period_days: periodDays, current, prior: null, deltas: null } };
  }

  const prior = {
    dead_pct: metrics[1].dead_inventory_pct,
    avg_days: metrics[1].avg_days_listed,
    health_score: metrics[1].portfolio_health_score,
    trapped_cash: snapshots[1]?.trapped_cash ?? 0,
  };

  const deltas = {
    dead_pct: Math.round((current.dead_pct - prior.dead_pct) * 10) / 10,
    avg_days: Math.round((current.avg_days - prior.avg_days) * 10) / 10,
    health_score: Math.round((current.health_score - prior.health_score) * 10) / 10,
    trapped_cash: Math.round((current.trapped_cash - prior.trapped_cash) * 100) / 100,
  };

  return { report: { period_days: periodDays, current, prior, deltas } };
}

export async function fetchSellerOutcomeSummary(
  periodDays: 30 | 60 | 90 = 30
): Promise<{ summary: SellerOutcomeSummary | null; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { summary: null, error: "Not authenticated" };

  const since = new Date();
  since.setDate(since.getDate() - periodDays);

  const { data, error } = await supabase
    .from("recovery_actions")
    .select("action_type, outcome, recovery_amount, action_status")
    .eq("user_id", user.id)
    .eq("action_status", "completed")
    .gte("created_at", since.toISOString());

  if (error) return { summary: null, error: error.message };

  const rows = (data ?? []) as { action_type: string; outcome: string | null; recovery_amount: number | null }[];
  const sold = rows.filter((r) => r.outcome === "sold");
  const recovered_total = sold.reduce((s, r) => s + (r.recovery_amount ?? 0), 0);
  const recovery_rate = rows.length > 0 ? Math.round((sold.length / rows.length) * 100) : 0;

  const actionCounts: Record<string, number> = {};
  for (const r of rows) {
    actionCounts[r.action_type] = (actionCounts[r.action_type] ?? 0) + 1;
  }
  const top_action_type = Object.keys(actionCounts).length > 0
    ? Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  return {
    summary: {
      recovered_total,
      items_sold: sold.length,
      actions_taken: rows.length,
      recovery_rate,
      top_action_type,
      period_days: periodDays,
    },
  };
}
