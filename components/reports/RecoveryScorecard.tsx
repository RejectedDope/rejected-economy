"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { RecoveryScorecard } from "@/app/actions/reports";

const GRADE_COLORS: Record<string, string> = {
  A: "text-emerald-400",
  B: "text-teal-400",
  C: "text-yellow-400",
  D: "text-orange-400",
  F: "text-zinc-600",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function RecoveryScorecard() {
  const [scorecard, setScorecard] = useState<RecoveryScorecard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("@/app/actions/reports")
      .then(({ fetchRecoveryScorecard }) => fetchRecoveryScorecard())
      .then(({ scorecard: s }) => setScorecard(s))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 p-8">
        <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
      </div>
    );
  }

  const empty = !scorecard || scorecard.actions_taken === 0;
  const grade = scorecard?.grade ?? "–";
  const gradeColor = scorecard ? (GRADE_COLORS[scorecard.grade] ?? "text-zinc-600") : "text-zinc-700";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center">
      <div className={`text-8xl font-black leading-none ${gradeColor}`}>{grade}</div>
      {empty ? (
        <p className="mt-4 text-sm text-zinc-600">
          Take your first recovery action to generate your scorecard
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-lg font-black text-emerald-400">{fmt(scorecard!.total_recovered)}</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Recovered</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-lg font-black text-zinc-200">{scorecard!.items_sold}</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Items Sold</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-lg font-black text-zinc-200">{scorecard!.success_rate}%</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Recovery Rate</p>
            </div>
          </div>
          {scorecard!.dead_pct_change !== null && (
            <div className="mt-3 flex justify-center">
              <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                scorecard!.dead_pct_change <= 0
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-red-500/30 bg-red-500/10 text-red-400"
              }`}>
                Dead inventory {scorecard!.dead_pct_change > 0 ? "↑" : "↓"}{Math.abs(scorecard!.dead_pct_change)}%
              </span>
            </div>
          )}
          <p className="mt-4 text-[11px] text-zinc-600">Based on your last {scorecard!.period_days} days of recovery activity</p>
        </>
      )}
    </div>
  );
}
