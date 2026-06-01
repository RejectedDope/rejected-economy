"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type MetricRow = Record<string, unknown>;

export function DeadInventoryReductionReport() {
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("@/app/actions/snapshots")
      .then(({ fetchPortfolioTrend }) => fetchPortfolioTrend(30))
      .then(({ metrics: m }) => setMetrics(m ?? []))
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

  if (metrics.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-sm font-bold text-zinc-200">Dead Inventory Trend</p>
        <p className="mt-2 text-sm text-zinc-600">
          Portfolio snapshots build over time — check back after your next import
        </p>
      </div>
    );
  }

  const latest = metrics[metrics.length - 1];
  const current = Number(latest?.dead_inventory_pct ?? 0);
  const recent = metrics.slice(-14);
  const first = Number(metrics[0]?.dead_inventory_pct ?? current);
  const trend = current - first;
  const improving = trend <= 0;

  const pctColor =
    current <= 20 ? "text-emerald-400" : current <= 40 ? "text-yellow-400" : "text-red-400";
  const maxVal = Math.max(...recent.map((r) => Number(r.dead_inventory_pct ?? 0)), 1);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className={`text-4xl font-black ${pctColor}`}>{current.toFixed(1)}%</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            of your active inventory shows declining sell signals
          </p>
        </div>
        {metrics.length > 1 && (
          <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            improving
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}>
            {improving ? `↓ Improving` : `↑ Increasing`}
          </span>
        )}
      </div>

      {recent.length > 1 && (
        <div className="space-y-1">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Last {recent.length} Days</p>
          {recent.map((row, i) => {
            const val = Number(row.dead_inventory_pct ?? 0);
            const widthPct = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;
            const barColor = val <= 20 ? "bg-emerald-500/40" : val <= 40 ? "bg-yellow-500/40" : "bg-red-500/40";
            const date = String(row.metric_date ?? "").slice(5);
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-right text-[9px] text-zinc-700">{date}</span>
                <div className="flex-1 rounded-full bg-zinc-800" style={{ height: "6px" }}>
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${widthPct}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right text-[9px] text-zinc-600">{val.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
