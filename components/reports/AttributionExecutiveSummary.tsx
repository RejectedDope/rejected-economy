"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { AttributionSummary } from "@/app/actions/attribution";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function AttributionExecutiveSummary() {
  const [summary, setSummary] = useState<AttributionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("@/app/actions/attribution")
      .then(({ fetchAttributionSummary }) => fetchAttributionSummary())
      .then(({ summary: s }) => setSummary(s))
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

  const empty =
    !summary ||
    (!summary.best_action_by_sales && !summary.best_action_by_dollars && !summary.most_used_action);

  if (empty) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-sm font-bold text-zinc-200">Attribution Summary</p>
        <p className="mt-2 text-sm text-zinc-600">
          Follow ResaleIQ recommendations and complete recovery actions to see attribution data
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <p className="text-sm font-bold text-zinc-200">Which ResaleIQ Recommendations Actually Work?</p>
        {summary!.platform_attribution_rate > 0 && (
          <span className="shrink-0 rounded border border-[#E935C1]/30 bg-[#E935C1]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#E935C1]">
            {summary!.platform_attribution_rate}% of your sales followed a recommendation
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {summary!.best_action_by_sales && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Best by Sales</p>
            <p className="mt-1.5 text-base font-black text-emerald-400">{summary!.best_action_by_sales}</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">highest sale rate</p>
          </div>
        )}
        {summary!.best_action_by_dollars && (
          <div className="rounded-lg border border-teal-500/20 bg-teal-500/5 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Best by Dollars</p>
            <p className="mt-1.5 text-base font-black text-teal-400">{summary!.best_action_by_dollars}</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">most cash recovered</p>
          </div>
        )}
        {summary!.most_ignored_action && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Low ROI Action</p>
            <p className="mt-1.5 text-base font-black text-red-400">{summary!.most_ignored_action}</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">low sale rate when completed</p>
          </div>
        )}
      </div>

      {summary!.total_attributed_recovery > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
          <p className="text-[11px] text-zinc-500">Total recovered following recommendations</p>
          <p className="text-lg font-black text-zinc-200">{fmt(summary!.total_attributed_recovery)}</p>
        </div>
      )}
    </div>
  );
}
