import { NextRequest, NextResponse } from "next/server";
import { getPhotoIntakeConfig } from "@/lib/photo-intake/config";
import { listRunningResaleIqRuns } from "@/lib/photo-intake/graph";
import { finalizeResaleIqRun } from "@/lib/resaleiq-intake/finalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const config = getPhotoIntakeConfig();
    const runs = await listRunningResaleIqRuns(config, 5);
    const results = [];
    for (const run of runs) {
      try {
        const result = await finalizeResaleIqRun(config, run);
        results.push({ sku: run.sku, responseId: run.responseId, status: result.status });
      } catch (error) {
        results.push({ sku: run.sku, responseId: run.responseId, status: "error", error: error instanceof Error ? error.message : String(error) });
      }
    }
    return NextResponse.json({ ok: true, inspected: runs.length, results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
