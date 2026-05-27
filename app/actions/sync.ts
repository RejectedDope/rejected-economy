"use server";

import { createClient } from "@/lib/supabase/server";

export type SyncJobType = "import" | "export" | "price_sync" | "inventory_sync";
export type SyncJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export type SyncJob = {
  id: string;
  job_type: SyncJobType;
  status: SyncJobStatus;
  source_platform: string | null;
  items_processed: number;
  items_failed: number;
  error_message: string | null;
  retry_count: number;
  started_at: string | null;
  completed_at: string | null;
  next_scheduled_at: string | null;
  created_at: string;
};

export type SyncHealth = {
  hasActiveJobs: boolean;
  lastCompletedAt: string | null;
  lastFailedAt: string | null;
  pendingCount: number;
  failedCount: number;
  recentJobs: SyncJob[];
};

export async function createSyncJob(params: {
  jobType: SyncJobType;
  sourcePlatform?: string;
  nextScheduledAt?: string;
}): Promise<{ ok: boolean; jobId?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not authenticated" };

    const { data, error } = await supabase
      .from("sync_jobs")
      .insert({
        user_id: user.id,
        job_type: params.jobType,
        source_platform: params.sourcePlatform ?? null,
        next_scheduled_at: params.nextScheduledAt ?? null,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, jobId: data.id };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function fetchSyncJobs(limit = 10): Promise<{ jobs: SyncJob[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { jobs: [], error: "Not authenticated" };

    const { data, error } = await supabase
      .from("sync_jobs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { jobs: [], error: error.message };
    return { jobs: (data ?? []) as SyncJob[] };
  } catch {
    return { jobs: [], error: "Failed to fetch sync jobs" };
  }
}

export async function getSyncHealth(): Promise<SyncHealth> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return emptyHealth();

    const { data } = await supabase
      .from("sync_jobs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const jobs = (data ?? []) as SyncJob[];

    const pending   = jobs.filter((j) => j.status === "pending" || j.status === "running");
    const failed    = jobs.filter((j) => j.status === "failed");
    const completed = jobs.filter((j) => j.status === "completed");

    return {
      hasActiveJobs:   pending.length > 0,
      lastCompletedAt: completed[0]?.completed_at ?? null,
      lastFailedAt:    failed[0]?.created_at ?? null,
      pendingCount:    pending.length,
      failedCount:     failed.length,
      recentJobs:      jobs.slice(0, 5),
    };
  } catch {
    return emptyHealth();
  }
}

function emptyHealth(): SyncHealth {
  return {
    hasActiveJobs: false,
    lastCompletedAt: null,
    lastFailedAt: null,
    pendingCount: 0,
    failedCount: 0,
    recentJobs: [],
  };
}
