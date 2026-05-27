"use server";

import { createClient } from "@/lib/supabase/server";
import type { RecoveryActionLog } from "@/lib/types";

export type FetchRecoveryLogsResult = {
  logs: RecoveryActionLog[];
  error?: string;
};

export async function fetchRecoveryLogs(
  itemId?: string,
  limit = 50
): Promise<FetchRecoveryLogsResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { logs: [], error: "Not authenticated" };

  let query = supabase
    .from("recovery_actions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (itemId) query = query.eq("item_id", itemId);

  const { data, error } = await query;
  if (error) return { logs: [], error: error.message };

  return { logs: (data ?? []) as unknown as RecoveryActionLog[] };
}

export async function fetchRecoverySummary(): Promise<{
  total: number;
  sold: number;
  total_recovered: number;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { total: 0, sold: 0, total_recovered: 0, error: "Not authenticated" };

  const { data, error } = await supabase
    .from("recovery_actions")
    .select("action_status, outcome, recovery_amount")
    .eq("user_id", user.id)
    .eq("action_status", "completed");

  if (error) return { total: 0, sold: 0, total_recovered: 0, error: error.message };

  const rows = data ?? [];
  const sold = rows.filter((r) => r.outcome === "sold").length;
  const total_recovered = rows
    .filter((r) => r.outcome === "sold" && r.recovery_amount)
    .reduce((sum, r) => sum + (r.recovery_amount as number), 0);

  return { total: rows.length, sold, total_recovered };
}

// ─── Monthly / Weekly Stats ───────────────────────────────────────────────────

export type RecoveryStatsResult = {
  recoveredThisMonth: number;
  recoveredThisWeek: number;
  actionsThisMonth: number;
  soldThisMonth: number;
  actionBreakdown: {
    action: string;
    count: number;
    soldCount: number;
    totalRecovered: number;
  }[];
};

export async function fetchRecoveryStats(): Promise<RecoveryStatsResult | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const { data: logs } = await supabase
      .from("recovery_actions")
      .select("action_type, outcome, recovery_amount, completed_at, created_at")
      .eq("user_id", user.id)
      .gte("created_at", monthStart.toISOString());

    if (!logs) return null;

    const recoveredThisMonth = logs
      .filter((l) => l.outcome === "sold" && l.recovery_amount != null)
      .reduce((sum, l) => sum + (l.recovery_amount ?? 0), 0);

    const weekCutoff = weekStart.toISOString();
    const recoveredThisWeek = logs
      .filter(
        (l) =>
          l.outcome === "sold" &&
          l.recovery_amount != null &&
          (l.completed_at ?? l.created_at) >= weekCutoff
      )
      .reduce((sum, l) => sum + (l.recovery_amount ?? 0), 0);

    const soldThisMonth = logs.filter((l) => l.outcome === "sold").length;

    const actionMap = new Map<
      string,
      { count: number; soldCount: number; totalRecovered: number }
    >();
    for (const log of logs) {
      if (!actionMap.has(log.action_type)) {
        actionMap.set(log.action_type, { count: 0, soldCount: 0, totalRecovered: 0 });
      }
      const entry = actionMap.get(log.action_type)!;
      entry.count++;
      if (log.outcome === "sold") {
        entry.soldCount++;
        entry.totalRecovered += log.recovery_amount ?? 0;
      }
    }

    const actionBreakdown = Array.from(actionMap.entries())
      .map(([action, stats]) => ({ action, ...stats }))
      .sort((a, b) => b.count - a.count);

    return {
      recoveredThisMonth,
      recoveredThisWeek,
      actionsThisMonth: logs.length,
      soldThisMonth,
      actionBreakdown,
    };
  } catch {
    return null;
  }
}
