"use server";

import { createClient } from "@/lib/supabase/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExecutionQueueItem = {
  id: string;
  item_id: string | null;
  action_type: string;
  action_payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "executing" | "completed" | "failed" | "expired";
  source: "manual" | "automation" | "sync";
  expires_at: string | null;
  created_at: string;
  item_title?: string | null;
};

// ─── Fetch Execution Queue ────────────────────────────────────────────────────

export async function fetchExecutionQueue(
  status?: ExecutionQueueItem["status"]
): Promise<{ items: ExecutionQueueItem[]; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { items: [], error: "Not authenticated" };

    let query = supabase
      .from("execution_queue")
      .select("*, inventory_items(title)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) return { items: [], error: error.message };

    const items: ExecutionQueueItem[] = (data ?? []).map((row) => ({
      id: row.id as string,
      item_id: (row.item_id as string | null) ?? null,
      action_type: row.action_type as string,
      action_payload: (row.action_payload as Record<string, unknown>) ?? {},
      status: row.status as ExecutionQueueItem["status"],
      source: row.source as ExecutionQueueItem["source"],
      expires_at: (row.expires_at as string | null) ?? null,
      created_at: row.created_at as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      item_title: (row as any).inventory_items?.title ?? null,
    }));

    return { items };
  } catch (err) {
    return { items: [], error: String(err) };
  }
}

// ─── Approve Execution Item ───────────────────────────────────────────────────

export async function approveExecutionItem(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not authenticated" };

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("execution_queue")
      .update({ status: "approved", approved_at: now, updated_at: now })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ─── Reject Execution Item ────────────────────────────────────────────────────

export async function rejectExecutionItem(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not authenticated" };

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("execution_queue")
      .update({ status: "rejected", rejected_at: now, updated_at: now })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ─── Enqueue Action ───────────────────────────────────────────────────────────

export async function enqueueAction(params: {
  itemId?: string;
  actionType: string;
  actionPayload?: Record<string, unknown>;
  source?: "manual" | "automation" | "sync";
  expiresInHours?: number;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not authenticated" };

    const expiresInHours = params.expiresInHours ?? 72;
    const expiresAt = new Date(Date.now() + expiresInHours * 3_600_000).toISOString();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("execution_queue")
      .insert({
        user_id: user.id,
        item_id: params.itemId ?? null,
        action_type: params.actionType,
        action_payload: params.actionPayload ?? {},
        status: "pending",
        source: params.source ?? "manual",
        expires_at: expiresAt,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id as string };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
