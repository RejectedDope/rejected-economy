"use server";

import { logger } from "@/lib/logger";

export type TelemetryCategory =
  | "import"
  | "automation"
  | "recovery"
  | "integration"
  | "inventory"
  | "session";

export type TelemetryEvent =
  | "import_completed"
  | "import_failed"
  | "import_undo"
  | "automation_rule_enabled"
  | "automation_rule_disabled"
  | "automation_task_dismissed"
  | "automation_task_completed"
  | "recovery_action_taken"
  | "marketplace_connected"
  | "marketplace_disconnected"
  | "inventory_item_deleted"
  | "session_started";

export type RetentionSignals = {
  lastImportAt: string | null;
  lastRecoveryAt: string | null;
  lastAutomationAt: string | null;
  importCount30d: number;
  recoveryCount30d: number;
  automationCount30d: number;
};

export async function trackEvent(
  userId: string,
  eventType: TelemetryEvent,
  category: TelemetryCategory,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties?: Record<string, any>
): Promise<void> {
  try {
    const { createServiceClient, isServiceClientConfigured } = await import("@/lib/supabase/service");
    if (!isServiceClientConfigured()) return;

    const supabase = createServiceClient();
    await supabase.from("operational_events").insert({
      user_id: userId,
      event_type: eventType,
      category,
      properties: properties ?? {},
    });
  } catch (err) {
    logger.warn("runtime", "Failed to track event", { eventType, error: String(err) });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchRetentionSignals(supabase: any, userId: string): Promise<RetentionSignals> {
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const { data } = await supabase
    .from("operational_events")
    .select("event_type, category, occurred_at")
    .eq("user_id", userId)
    .gte("occurred_at", cutoff)
    .in("category", ["import", "recovery", "automation"])
    .order("occurred_at", { ascending: false });

  const events: { event_type: string; category: string; occurred_at: string }[] = data ?? [];

  const imports    = events.filter((e) => e.category === "import");
  const recoveries = events.filter((e) => e.category === "recovery");
  const automations = events.filter((e) => e.category === "automation");

  return {
    lastImportAt:     imports[0]?.occurred_at ?? null,
    lastRecoveryAt:   recoveries[0]?.occurred_at ?? null,
    lastAutomationAt: automations[0]?.occurred_at ?? null,
    importCount30d:     imports.length,
    recoveryCount30d:   recoveries.length,
    automationCount30d: automations.length,
  };
}
