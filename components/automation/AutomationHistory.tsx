"use client";

import { useEffect, useState } from "react";
import { History, Loader2, Package, RefreshCw, Zap } from "lucide-react";
import { fetchAutomationHistory, type AutomationRun } from "@/app/actions/automation";

function formatRunTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "< 1 hour ago";
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const TRIGGER_LABELS: Record<string, string> = {
  manual:    "Manual",
  scheduled: "Scheduled",
  import:    "Post-import",
};

export function AutomationHistory() {
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAutomationHistory(15)
      .then(({ runs: r }) => setRuns(r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-zinc-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading run history…
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-5 py-6 text-center">
        <p className="text-sm text-zinc-600">No automation runs yet</p>
        <p className="mt-1 text-xs text-zinc-700">
          Click Run Now above to evaluate your inventory against active rules.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-5 py-3">
        <History className="h-3.5 w-3.5 text-zinc-500" />
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
          Run History
        </span>
      </div>

      <div className="divide-y divide-zinc-800/50">
        {runs.map((run) => (
          <div key={run.id} className="flex items-center gap-4 px-5 py-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800">
              {run.triggered_by === "import" ? (
                <Package className="h-3.5 w-3.5 text-zinc-500" />
              ) : run.triggered_by === "scheduled" ? (
                <RefreshCw className="h-3.5 w-3.5 text-zinc-500" />
              ) : (
                <Zap className="h-3.5 w-3.5 text-zinc-500" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-300">
                  {TRIGGER_LABELS[run.triggered_by] ?? run.triggered_by}
                </span>
                <span className="text-[10px] text-zinc-600">{formatRunTime(run.ran_at)}</span>
              </div>
              <p className="text-[11px] text-zinc-500">
                {run.items_scanned} item{run.items_scanned !== 1 ? "s" : ""} scanned
                {" · "}
                {run.rules_evaluated} rule{run.rules_evaluated !== 1 ? "s" : ""} evaluated
              </p>
            </div>

            <div className="shrink-0 text-right">
              {run.tasks_created > 0 ? (
                <span className="rounded bg-[#E935C1]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#E935C1]">
                  +{run.tasks_created} task{run.tasks_created !== 1 ? "s" : ""}
                </span>
              ) : (
                <span className="text-[10px] text-zinc-700">no new tasks</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
