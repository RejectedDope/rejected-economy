"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ActionAttributionRow } from "@/app/actions/attribution";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const RANK_STYLES: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: "bg-yellow-500/10 border-yellow-500/30", text: "text-yellow-400", label: "#1" },
  2: { bg: "bg-zinc-400/10 border-zinc-400/20", text: "text-zinc-300", label: "#2" },
  3: { bg: "bg-orange-700/10 border-orange-700/30", text: "text-orange-500", label: "#3" },
};

export function RecommendationRanking() {
  const [rows, setRows] = useState<ActionAttributionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("@/app/actions/attribution")
      .then(({ fetchRecommendationEffectiveness }) => fetchRecommendationEffectiveness())
      .then(({ rows: r }) => setRows(r ?? []))
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

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-sm font-bold text-zinc-200">Recommendation Effectiveness Ranking</p>
        <p className="mt-2 text-sm text-zinc-600">
          Follow ResaleIQ recommendations and log outcomes to see your ranking
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="mb-4 text-sm font-bold text-zinc-200">Recommendation Effectiveness Ranking</p>
      <div className="space-y-2">
        {rows.map((row) => {
          const rankStyle = RANK_STYLES[row.rank];
          const isLowROI = row.total_completed >= 3 && row.sale_rate < 15;
          return (
            <div
              key={row.action_type}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                rankStyle
                  ? `${rankStyle.bg}`
                  : "border-zinc-800 bg-zinc-950"
              }`}
            >
              <span className={`w-6 shrink-0 text-center text-xs font-black ${rankStyle ? rankStyle.text : "text-zinc-600"}`}>
                {rankStyle ? rankStyle.label : `#${row.rank}`}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-200">{row.label}</span>
                  {isLowROI && (
                    <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-400">
                      Low ROI
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[10px] text-zinc-600">
                  {row.total_followed} followed · {row.total_completed} completed · {row.total_sold} sold
                  {row.avg_days_to_sale !== null && ` · avg ${row.avg_days_to_sale}d to sale`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-sm font-black ${
                  row.sale_rate >= 40 ? "text-emerald-400" :
                  row.sale_rate >= 20 ? "text-yellow-400" : "text-zinc-500"
                }`}>
                  {row.sale_rate}%
                </p>
                <p className="text-[10px] text-zinc-600">sale rate</p>
              </div>
              {row.total_recovered > 0 && (
                <div className="shrink-0 text-right">
                  <p className="text-sm font-black text-zinc-200">{fmt(row.total_recovered)}</p>
                  <p className="text-[10px] text-zinc-600">recovered</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
