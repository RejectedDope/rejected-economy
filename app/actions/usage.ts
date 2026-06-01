"use server";

import { createClient } from "@/lib/supabase/server";
import { getPlan } from "@/lib/subscription/tiers";
import type { PlanId, PlanTier } from "@/lib/subscription/tiers";

export type UsageSummary = {
  planId: PlanId;
  plan: PlanTier;
  itemsUsed: number;
  importsUsedThisMonth: number;
  lastImportAt: string | null;
  daysSinceLastImport: number | null;
};

export async function fetchUsageSummary(): Promise<UsageSummary | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    // Parallel fetch: plan, item count, import count this month, last session
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [subResult, itemCountResult, importCountResult, lastSessionResult] =
      await Promise.all([
        supabase
          .from("user_subscriptions")
          .select("plan_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle(),
        supabase
          .from("inventory_items")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "active"),
        supabase
          .from("upload_sessions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .in("status", ["complete", "partial"])
          .gte("started_at", monthStart.toISOString()),
        supabase
          .from("upload_sessions")
          .select("completed_at, started_at")
          .eq("user_id", user.id)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    const planId = (subResult.data?.plan_id ?? "free") as PlanId;
    const plan = getPlan(planId);
    const itemsUsed = itemCountResult.count ?? 0;
    const importsUsedThisMonth = importCountResult.count ?? 0;
    const lastSession = lastSessionResult.data;
    const lastImportAt = lastSession?.completed_at ?? lastSession?.started_at ?? null;
    const daysSinceLastImport = lastImportAt
      ? Math.floor((Date.now() - new Date(lastImportAt).getTime()) / 86_400_000)
      : null;

    return { planId, plan, itemsUsed, importsUsedThisMonth, lastImportAt, daysSinceLastImport };
  } catch {
    return null;
  }
}
