"use server";

import { createClient } from "@/lib/supabase/server";
import type { UserSettings } from "@/lib/types";

export type UserSettingsUpdate = Partial<Pick<UserSettings,
  | "primary_platform"
  | "active_platforms"
  | "stale_warning_days"
  | "stale_critical_days"
  | "dead_threshold_days"
  | "notify_critical_items"
  | "notify_weekly_report"
  | "notify_new_death_pile"
  | "ebay_fee_pct"
  | "poshmark_fee_pct"
  | "mercari_fee_pct"
  | "depop_fee_pct"
  | "avg_shipping_cost"
  | "free_shipping_threshold"
>>;

export async function fetchUserSettings(): Promise<{ settings: UserSettings | null; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { settings: null, error: "Not authenticated" };

  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error && error.code !== "PGRST116") return { settings: null, error: error.message };
  return { settings: data as unknown as UserSettings | null };
}

export async function saveUserSettings(
  updates: UserSettingsUpdate
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const now = new Date().toISOString();

  // Upsert — creates row if none exists
  const { error } = await supabase.from("user_settings").upsert({
    user_id: user.id,
    // Defaults for required fields on first insert
    primary_platform: "eBay",
    active_platforms: ["eBay"],
    ebay_fee_pct: 12.9,
    poshmark_fee_pct: 20,
    mercari_fee_pct: 10,
    depop_fee_pct: 10,
    avg_shipping_cost: 5,
    free_shipping_threshold: 0,
    stale_warning_days: 60,
    stale_critical_days: 90,
    dead_threshold_days: 180,
    notify_critical_items: true,
    notify_weekly_report: false,
    notify_new_death_pile: true,
    ...updates,
    updated_at: now,
  }, { onConflict: "user_id" });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
