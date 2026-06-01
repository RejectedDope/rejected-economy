"use server";

import { createClient } from "@/lib/supabase/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionAttributionRow = {
  action_type: string;
  label: string;
  total_followed: number;
  total_completed: number;
  total_sold: number;
  total_recovered: number;
  sale_rate: number;
  avg_recovery: number;
  avg_days_to_sale: number | null;
  rank: number;
};

export type AttributionFunnelData = {
  items_with_recommendations: number;
  recommendations_followed: number;
  actions_completed: number;
  items_sold: number;
  acceptance_rate: number;
  completion_rate: number;
  sale_rate: number;
};

export type AttributionSummary = {
  best_action_by_sales: string | null;
  best_action_by_dollars: string | null;
  most_used_action: string | null;
  most_ignored_action: string | null;
  total_attributed_recovery: number;
  platform_attribution_rate: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  relist_now:          "Relist",
  strategic_markdown:  "Price Reduction",
  bundle:              "Bundle",
  move_platform:       "Move Platform",
  optimize_specifics:  "Fix Item Specifics",
  add_photos:          "Add Photos",
  liquidate:           "Liquidate",
  hold:                "Hold",
  sell_similar:        "Sell Similar",
  adjust_shipping:     "Adjust Shipping",
};

function toLabel(actionType: string): string {
  return ACTION_LABELS[actionType] ?? actionType;
}

function pct(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 100) : 0;
}

// ─── Attribution Funnel ───────────────────────────────────────────────────────

export async function fetchAttributionFunnel(): Promise<{
  funnel: AttributionFunnelData;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { funnel: emptyFunnel(), error: "Not authenticated" };

    // Items the system has generated recommendations for
    const { count: withRecs } = await supabase
      .from("inventory_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active")
      .not("primary_recovery_action", "is", null);

    // Attribution funnel from recovery_actions where was_recommended=true
    const { data: attrRows } = await supabase
      .from("recovery_actions")
      .select("action_status, outcome")
      .eq("user_id", user.id)
      .eq("was_recommended", true);

    const followed  = (attrRows ?? []).length;
    const completed = (attrRows ?? []).filter((r) => r.action_status === "completed").length;
    const sold      = (attrRows ?? []).filter((r) => r.outcome === "sold").length;

    const items_with_recommendations = withRecs ?? 0;

    return {
      funnel: {
        items_with_recommendations,
        recommendations_followed: followed,
        actions_completed: completed,
        items_sold: sold,
        acceptance_rate: pct(followed, items_with_recommendations),
        completion_rate: pct(completed, followed),
        sale_rate: pct(sold, completed),
      },
    };
  } catch (err) {
    return { funnel: emptyFunnel(), error: String(err) };
  }
}

function emptyFunnel(): AttributionFunnelData {
  return {
    items_with_recommendations: 0,
    recommendations_followed: 0,
    actions_completed: 0,
    items_sold: 0,
    acceptance_rate: 0,
    completion_rate: 0,
    sale_rate: 0,
  };
}

// ─── Recommendation Effectiveness ────────────────────────────────────────────

export async function fetchRecommendationEffectiveness(): Promise<{
  rows: ActionAttributionRow[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { rows: [], error: "Not authenticated" };

    const { data, error } = await supabase
      .from("recovery_actions")
      .select("action_type, action_status, outcome, recovery_amount, days_listed_snapshot")
      .eq("user_id", user.id)
      .eq("was_recommended", true);

    if (error) return { rows: [], error: error.message };

    const grouped = new Map<string, {
      followed: number;
      completed: number;
      sold: number;
      recovered: number;
      daysAccum: number;
      daysCount: number;
    }>();

    for (const r of (data ?? [])) {
      if (!grouped.has(r.action_type)) {
        grouped.set(r.action_type, { followed: 0, completed: 0, sold: 0, recovered: 0, daysAccum: 0, daysCount: 0 });
      }
      const g = grouped.get(r.action_type)!;
      g.followed++;
      if (r.action_status === "completed") {
        g.completed++;
        if (r.outcome === "sold") {
          g.sold++;
          g.recovered += r.recovery_amount ?? 0;
          if (r.days_listed_snapshot != null) {
            g.daysAccum += r.days_listed_snapshot;
            g.daysCount++;
          }
        }
      }
    }

    const rows: Omit<ActionAttributionRow, "rank">[] = Array.from(grouped.entries()).map(
      ([action_type, g]) => ({
        action_type,
        label: toLabel(action_type),
        total_followed: g.followed,
        total_completed: g.completed,
        total_sold: g.sold,
        total_recovered: Math.round(g.recovered * 100) / 100,
        sale_rate: pct(g.sold, g.completed),
        avg_recovery: g.sold > 0 ? Math.round((g.recovered / g.sold) * 100) / 100 : 0,
        avg_days_to_sale: g.daysCount > 0 ? Math.round(g.daysAccum / g.daysCount) : null,
      })
    );

    rows.sort((a, b) => b.sale_rate - a.sale_rate);
    const ranked: ActionAttributionRow[] = rows.map((r, i) => ({ ...r, rank: i + 1 }));

    return { rows: ranked };
  } catch (err) {
    return { rows: [], error: String(err) };
  }
}

// ─── Attribution Summary ──────────────────────────────────────────────────────

export async function fetchAttributionSummary(): Promise<{
  summary: AttributionSummary;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { summary: emptySummary(), error: "Not authenticated" };

    const { rows } = await fetchRecommendationEffectiveness();

    // Total attributed recovery
    const total_attributed_recovery = rows.reduce((s, r) => s + r.total_recovered, 0);

    // Best by sales rate (min 1 sale)
    const bySales = rows.filter((r) => r.total_sold > 0).sort((a, b) => b.sale_rate - a.sale_rate);
    const byDollars = rows.filter((r) => r.total_recovered > 0).sort((a, b) => b.total_recovered - a.total_recovered);
    const byUsage = [...rows].sort((a, b) => b.total_followed - a.total_followed);
    const mostIgnored = rows.filter((r) => r.total_completed >= 3 && r.sale_rate < 15)
      .sort((a, b) => a.sale_rate - b.sale_rate);

    // Platform attribution rate: recommended-sold / total sold
    const { data: totalSoldData } = await supabase
      .from("recovery_actions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("action_status", "completed")
      .eq("outcome", "sold");

    const total_sold = totalSoldData as unknown as number ?? 0;
    const attributed_sold = rows.reduce((s, r) => s + r.total_sold, 0);

    return {
      summary: {
        best_action_by_sales:   bySales[0]  ? toLabel(bySales[0].action_type)   : null,
        best_action_by_dollars: byDollars[0] ? toLabel(byDollars[0].action_type) : null,
        most_used_action:       byUsage[0]  ? toLabel(byUsage[0].action_type)   : null,
        most_ignored_action:    mostIgnored[0] ? toLabel(mostIgnored[0].action_type) : null,
        total_attributed_recovery: Math.round(total_attributed_recovery * 100) / 100,
        platform_attribution_rate: pct(attributed_sold, typeof total_sold === "number" ? total_sold : 0),
      },
    };
  } catch (err) {
    return { summary: emptySummary(), error: String(err) };
  }
}

function emptySummary(): AttributionSummary {
  return {
    best_action_by_sales: null,
    best_action_by_dollars: null,
    most_used_action: null,
    most_ignored_action: null,
    total_attributed_recovery: 0,
    platform_attribution_rate: 0,
  };
}
