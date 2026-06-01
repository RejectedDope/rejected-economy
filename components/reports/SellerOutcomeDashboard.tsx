"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { SellerOutcomeSummary } from "@/app/actions/reports";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const ACTION_LABELS: Record<string, string> = {
  relist_now: "Relist", strategic_markdown: "Price Reduction", bundle: "Bundle",
  move_platform: "Move Platform", optimize_specifics: "Fix Item Specifics",
  add_photos: "Add Photos", liquidate: "Liquidate", hold: "Hold",
  sell_similar: "Sell Similar", adjust_shipping: "Adjust Shipping",
};

const PERIODS: (30 | 60 | 90)[] = [30, 60, 90];

export function SellerOutcomeDashboard() {
  const [period, setPeriod] = useState<30 | 60 | 90>(30);
  const [summary, setSummary] = useState<SellerOutcomeSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("@/app/actions/reports")
      .then(({ fetchSellerOutcomeSummary }) => fetchSellerOutcomeSummary(period))
      .then(({ summary: s }) => setSummary(s))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  const rateColor =
    (summary?.recovery_rate ?? 0) >= 30
      ? "text-emerald-400"
      : (summary?.recovery_rate ?? 0) >= 15
        ? "text-yellow-400"
        : "text-orange-400";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-zinc-200">Your Results</p>
          <span className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
            Last {period} days
          </span>
        </div>
        <div className="flex items-center gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded px-2 py-0.5 text-[10px] font-bold transition-colors ${
                period === p
                  ? "bg-[#E935C1]/20 text-[#E935C1]"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-zinc-600" /></div>
      ) : !summary || summary.actions_taken === 0 ? (
        <p className="py-4 text-center text-sm text-zinc-600">
          Start logging recovery actions to see your outcomes
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="text-xl font-black text-emerald-400">{fmt(summary.recovered_total)}</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-600">$ Recovered</p>
            </div>
            <div className="rounded-lg border border-teal-500/20 bg-teal-500/5 p-3">
              <p className="text-xl font-black text-teal-400">{summary.items_sold}</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Items Sold</p>
            </div>
            <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-3">
              <p className="text-xl font-black text-zinc-200">{summary.actions_taken}</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Actions Taken</p>
            </div>
            <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-3">
              <p className={`text-xl font-black ${rateColor}`}>{summary.recovery_rate}%</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Recovery Rate</p>
            </div>
          </div>
          {summary.top_action_type && (
            <p className="mt-3 text-[11px] text-zinc-500">
              Most-used action:{" "}
              <span className="font-semibold text-zinc-300">
                {ACTION_LABELS[summary.top_action_type] ?? summary.top_action_type}
              </span>
            </p>
          )}
        </>
      )}
    </div>
  );
}
