import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// ─── Cron: Scheduled Automation Evaluation ────────────────────────────────────
// Runs automation rules for all users who have at least one enabled rule.
// Scheduled via vercel.json — called every 6 hours.
// Protected by CRON_SECRET per Vercel cron authentication pattern.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const start = Date.now();

  // Auth: verify CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    logger.warn("runtime", "Rejected — invalid secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Guard: service client required
  const { isServiceClientConfigured } = await import("@/lib/supabase/service");
  if (!isServiceClientConfigured()) {
    logger.warn("runtime", "Skipped — service role not configured");
    return NextResponse.json({ skipped: true, reason: "service_role_not_configured" }, { status: 200 });
  }

  try {
    const { createServiceClient } = await import("@/lib/supabase/service");
    const { runAutomationForUser } = await import("@/lib/automation/runner");

    const supabase = createServiceClient();

    // Find all users with at least one enabled automation rule
    const { data: eligibleUsers, error: usersErr } = await supabase
      .from("automation_rules")
      .select("user_id")
      .eq("enabled", true);

    if (usersErr) {
      logger.error("runtime", "Failed to fetch eligible users", { error: usersErr.message });
      return NextResponse.json({ error: usersErr.message }, { status: 500 });
    }

    const uniqueUserIds = [...new Set((eligibleUsers ?? []).map((r: { user_id: string }) => r.user_id))];

    const results = await Promise.allSettled(
      uniqueUserIds.map((userId: string) => runAutomationForUser(userId, supabase))
    );

    const summary = results.reduce(
      (acc, res) => {
        if (res.status === "fulfilled") {
          acc.tasksCreated += res.value.tasksCreated;
          acc.itemsScanned += res.value.itemsScanned;
          if (res.value.error) acc.failures++;
          else acc.usersProcessed++;
        } else {
          acc.failures++;
        }
        return acc;
      },
      { usersProcessed: 0, tasksCreated: 0, itemsScanned: 0, failures: 0 }
    );

    logger.info("runtime", "Automation run complete", {
      ...summary,
      durationMs: Date.now() - start,
    });

    return NextResponse.json({
      ok: true,
      usersEvaluated: uniqueUserIds.length,
      ...summary,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    logger.error("runtime", "Unexpected error", { error: String(err) });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
