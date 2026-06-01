"use client";

import { useEffect, useState } from "react";
import { TrendingUp, CheckCircle2, X, Clock, Loader2, Zap } from "lucide-react";
import {
  fetchAutomationEffectiveness,
  type AutomationEffectiveness,
} from "@/app/actions/automation";

function StatCard({
  label,
  value,
  sub,
  color = "text-zinc-100",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{label}</p>
      <p className={`mt-1.5 text-2xl font-black ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-zinc-600">{sub}</p>}
    </div>
  );
}

export function AutomationEffectiveness() {
  const [data, setData] = useState<AutomationEffectiveness | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAutomationEffectiveness()
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-zinc-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading effectiveness data…
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-5 py-6 text-center">
        <p className="text-sm text-zinc-600">No automation tasks generated yet</p>
        <p className="mt-1 text-xs text-zinc-700">
          Enable rules, click Run Now, and work through the task queue to see effectiveness metrics.
        </p>
      </div>
    );
  }

  const completionColor =
    data.completionRate >= 70 ? "text-emerald-400" :
    data.completionRate >= 40 ? "text-yellow-400" :
    "text-orange-400";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-5 py-3">
        <TrendingUp className="h-3.5 w-3.5 text-zinc-500" />
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
          Effectiveness
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        <StatCard
          label="Completion Rate"
          value={`${data.completionRate}%`}
          sub={`${data.completed} of ${data.total} tasks`}
          color={completionColor}
        />
        <StatCard
          label="Tasks Completed"
          value={data.completed}
          sub="approved + actioned"
          color="text-emerald-400"
        />
        <StatCard
          label="Tasks Skipped"
          value={data.skipped}
          sub={`${data.skipRate}% skip rate`}
          color="text-zinc-400"
        />
        <StatCard
          label="In Queue"
          value={data.queued}
          sub="awaiting review"
          color="text-[#E935C1]"
        />
      </div>

      {/* Completion bar */}
      <div className="border-t border-zinc-800 px-5 py-3">
        <div className="flex items-center justify-between text-[10px] text-zinc-600 mb-1.5">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
            Completed {data.completionRate}%
          </span>
          <span className="flex items-center gap-1">
            <X className="h-2.5 w-2.5 text-zinc-500" />
            Skipped {data.skipRate}%
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5 text-[#E935C1]" />
            Queued {data.total > 0 ? Math.round((data.queued / data.total) * 100) : 0}%
          </span>
        </div>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-emerald-400/80 transition-all"
            style={{ width: `${data.completionRate}%` }}
          />
          <div
            className="h-full bg-[#E935C1]/60 transition-all"
            style={{ width: `${data.total > 0 ? Math.round((data.queued / data.total) * 100) : 0}%` }}
          />
        </div>
      </div>

      {data.avgDurationMs != null && (
        <div className="border-t border-zinc-800 px-5 py-2.5 flex items-center gap-1.5 text-[11px] text-zinc-600">
          <Zap className="h-3 w-3 text-zinc-600" />
          Avg evaluation time: {data.avgDurationMs < 1000
            ? `${data.avgDurationMs}ms`
            : `${(data.avgDurationMs / 1000).toFixed(1)}s`}
        </div>
      )}
    </div>
  );
}
