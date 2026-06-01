"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ActionEffectivenessRow, CategoryRecoveryPattern } from "@/app/actions/analytics";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const ACTION_LABELS: Record<string, string> = {
  relist_now: "Relist",
  strategic_markdown: "Price Reduction",
  bundle: "Bundle",
  move_platform: "Move Platform",
  optimize_specifics: "Fix Item Specifics",
  add_photos: "Add Photos",
  liquidate: "Liquidate",
  hold: "Hold",
  sell_similar: "Sell Similar",
  adjust_shipping: "Adjust Shipping",
};

export function RecoveredCashReport() {
  const [rows, setRows] = useState<ActionEffectivenessRow[]>([]);
  const [patterns, setPatterns] = useState<CategoryRecoveryPattern[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("@/app/actions/analytics")
      .then(({ fetchActionEffectiveness, fetchCategoryRecoveryPatterns }) =>
        Promise.all([fetchActionEffectiveness(), fetchCategoryRecoveryPatterns()])
      )
      .then(([{ rows: r }, { patterns: p }]) => {
        setRows((r ?? []).filter((row) => row.avg_recovery > 0).sort((a, b) => b.avg_recovery - a.avg_recovery));
        setPatterns((p ?? []).slice(0, 3));
      })
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

  if (rows.length === 0 && patterns.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-sm font-bold text-zinc-200">Cash Recovery Breakdown</p>
        <p className="mt-2 text-sm text-zinc-600">
          Log recovery actions and mark items as sold to see your breakdown
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rows.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-4 text-sm font-bold text-zinc-200">Which Actions Make You the Most Money</p>
          <div className="overflow-hidden rounded-lg border border-zinc-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950">
                  <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-zinc-600">Action</th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wide text-zinc-600">Times Used</th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wide text-zinc-600">Recovery Rate</th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wide text-zinc-600">Avg $ / Sale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {rows.map((row) => (
                  <tr key={row.action_type}>
                    <td className="px-3 py-2.5 font-medium text-zinc-300">
                      {ACTION_LABELS[row.action_type] ?? row.action_type}
                    </td>
                    <td className="px-3 py-2.5 text-right text-zinc-500">{row.total}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`font-semibold ${
                        row.success_rate >= 40 ? "text-emerald-400" :
                        row.success_rate >= 20 ? "text-yellow-400" : "text-zinc-500"
                      }`}>
                        {row.success_rate}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-zinc-200">{fmt(row.avg_recovery)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {patterns.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-3 text-sm font-bold text-zinc-200">Top Categories by Recovery</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {patterns.map((p) => (
              <div key={p.category} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <p className="truncate text-xs font-semibold text-zinc-300">{p.category}</p>
                <p className="mt-1.5 text-lg font-black text-emerald-400">{fmt(p.avg_recovery)}</p>
                <p className="text-[10px] text-zinc-600">avg per sale · {p.sold_count} sold</p>
                <p className="mt-1 text-[10px] text-zinc-500">
                  Best: <span className="text-zinc-400">{ACTION_LABELS[p.top_action] ?? p.top_action}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
