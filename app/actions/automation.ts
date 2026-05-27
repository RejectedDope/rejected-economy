"use server";

import { createClient } from "@/lib/supabase/server";

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
