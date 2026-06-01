import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// ─── Cron: Automation Queue Cleanup ───────────────────────────────────────────
// Expires automation tasks past their deadline and trims old run history.
// Scheduled daily via vercel.json.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const start = Date.now();

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { isServiceClientConfigured } = await import("@/lib/supabase/service");
  if (!isServiceClientConfigured()) {
    return NextResponse.json({ skipped: true, reason: "service_role_not_configured" }, { status: 200 });
  }

  try {
    const { createServiceClient } = await import("@/lib/supabase/service");
    const supabase = createServiceClient();
    const now = new Date().toISOString();

    // 1. Expire tasks past their deadline
    const { data: expired, error: expireErr } = await supabase
      .from("automation_tasks")
      .update({ status: "expired" })
      .in("status", ["queued", "pending_review"])
      .lt("expires_at", now)
      .select("id");

    if (expireErr) {
      logger.error("runtime", "Failed to expire tasks", { error: expireErr.message });
    }

    // 2. Delete automation run records older than 90 days
    const cutoff = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const { error: trimErr } = await supabase
      .from("automation_runs")
      .delete()
      .lt("ran_at", cutoff);

    if (trimErr) {
      logger.warn("runtime", "Failed to trim old runs", { error: trimErr.message });
    }

    const expiredCount = expired?.length ?? 0;

    logger.info("runtime", "Queue cleanup complete", {
      expiredTasks: expiredCount,
      durationMs: Date.now() - start,
    });

    return NextResponse.json({
      ok: true,
      expiredTasks: expiredCount,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    logger.error("runtime", "Unexpected error", { error: String(err) });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
