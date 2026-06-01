"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { InventoryChangeReport as IReport } from "@/app/actions/reports";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

type Row = {
  label: string;
  currentVal: string;
  priorVal: string;
  delta: number;
  lowerIsBetter: boolean;
  unit: string;
};

function DeltaBadge({ delta, lowerIsBetter }: { delta: number; lowerIsBetter: boolean }) {
  if (delta === 0) return <span className="text-[10px] text-zinc-600">—</span>;
  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  const sign = delta > 0 ? "+" : "";
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${
      improved
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
        : "border-red-500/30 bg-red-500/10 text-red-400"
    }`}>
      {sign}{delta}
    </span>
  );
}

export function InventoryChangeReport() {
  const [report, setReport] = useState<IReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("@/app/actions/reports")
      .then(({ fetchInventoryChangeReport }) => fetchInventoryChangeReport())
      .then(({ report: r }) => setReport(r))
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

  if (!report?.current) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-sm font-bold text-zinc-200">30-Day Inventory Change</p>
        <p className="mt-2 text-sm text-zinc-600">No inventory data yet</p>
      </div>
    );
  }

  const rows: Row[] = [
    {
      label: "Dead Inventory",
      currentVal: `${report.current.dead_pct}%`,
      priorVal: report.prior ? `${report.prior.dead_pct}%` : "—",
      delta: report.deltas?.dead_pct ?? 0,
      lowerIsBetter: true,
      unit: "%",
    },
    {
      label: "Avg Days Listed",
      currentVal: `${report.current.avg_days}d`,
      priorVal: report.prior ? `${report.prior.avg_days}d` : "—",
      delta: report.deltas?.avg_days ?? 0,
      lowerIsBetter: true,
      unit: "d",
    },
    {
      label: "Health Score",
      currentVal: `${report.current.health_score}`,
      priorVal: report.prior ? `${report.prior.health_score}` : "—",
      delta: report.deltas?.health_score ?? 0,
      lowerIsBetter: false,
      unit: "",
    },
    {
      label: "Trapped Cash",
      currentVal: fmt(report.current.trapped_cash),
      priorVal: report.prior ? fmt(report.prior.trapped_cash) : "—",
      delta: report.deltas ? Math.round(report.deltas.trapped_cash) : 0,
      lowerIsBetter: true,
      unit: "$",
    },
  ];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-bold text-zinc-200">30-Day Inventory Change</p>
        {!report.prior && (
          <span className="text-[10px] text-zinc-600">Building trend history…</span>
        )}
      </div>
      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-950">
              <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-zinc-600">Metric</th>
              {report.prior && <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wide text-zinc-600">30d Ago</th>}
              <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wide text-zinc-600">Today</th>
              {report.prior && <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wide text-zinc-600">Change</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="px-3 py-2.5 font-medium text-zinc-400">{row.label}</td>
                {report.prior && <td className="px-3 py-2.5 text-right text-zinc-600">{row.priorVal}</td>}
                <td className="px-3 py-2.5 text-right font-semibold text-zinc-200">{row.currentVal}</td>
                {report.prior && (
                  <td className="px-3 py-2.5 text-right">
                    <DeltaBadge delta={row.delta} lowerIsBetter={row.lowerIsBetter} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
