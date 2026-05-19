"use client";

import { useState, useEffect } from "react";
import { TrendingUp, DollarSign, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Summary {
  total: number;
  sold: number;
  total_recovered: number;
}

export function RecoveryEffectivenessSummary() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    import("@/app/actions/recovery").then(({ fetchRecoverySummary }) => {
      fetchRecoverySummary().then((result) => {
        if (!result.error) setSummary(result);
      }).catch(() => {/* unauthenticated or no data — silent */});
    });
  }, []);

  if (!summary || summary.total === 0) return null;

  const rate = summary.total > 0
    ? Math.round((summary.sold / summary.total) * 100)
    : 0;

  return (
    <div className="mb-6 grid grid-cols-3 gap-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="flex items-center gap-1.5 mb-1">
          <CheckCircle2 className="h-3 w-3 text-zinc-600" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Actions Taken</p>
        </div>
        <p className="text-xl font-black text-zinc-100">{summary.total}</p>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="flex items-center gap-1.5 mb-1">
          <TrendingUp className="h-3 w-3 text-zinc-600" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Sell Rate</p>
        </div>
        <p className="text-xl font-black text-emerald-400">{rate}%</p>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="flex items-center gap-1.5 mb-1">
          <DollarSign className="h-3 w-3 text-zinc-600" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Recovered</p>
        </div>
        <p className="text-xl font-black text-emerald-400">{formatCurrency(summary.total_recovered)}</p>
      </div>
    </div>
  );
}
