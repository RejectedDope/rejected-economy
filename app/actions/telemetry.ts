"use server";

import { createClient } from "@/lib/supabase/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRetentionSignals = {
  lastImportAt: string | null;
  lastRecoveryAt: string | null;
  lastAutomationAt: string | null;
  importCount30d: number;
  recoveryCount30d: number;
  automationCount30d: number;
  totalEvents30d: number;
};

// ─── Fetch User Retention Signals ─────────────────────────────────────────────

export async function fetchUserRetentionSignals(): Promise<UserRetentionSignals | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();

    const { data } = await supabase
      .from("operational_events")
      .select("category, occurred_at")
      .eq("user_id", user.id)
      .gte("occurred_at", cutoff)
      .in("category", ["import", "recovery", "automation"])
      .order("occurred_at", { ascending: false });

    const events: { category: string; occurred_at: string }[] = data ?? [];

    const imports = events.filter((e) => e.category === "import");
    const recoveries = events.filter((e) => e.category === "recovery");
    const automations = events.filter((e) => e.category === "automation");

    return {
      lastImportAt: imports[0]?.occurred_at ?? null,
      lastRecoveryAt: recoveries[0]?.occurred_at ?? null,
      lastAutomationAt: automations[0]?.occurred_at ?? null,
      importCount30d: imports.length,
      recoveryCount30d: recoveries.length,
      automationCount30d: automations.length,
      totalEvents30d: events.length,
    };
  } catch {
    return null;
  }
}
