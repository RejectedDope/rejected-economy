"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { AttributionFunnelData } from "@/app/actions/attribution";

type Step = {
  label: string;
  value: number;
  rate: number | null;
  rateLabel: string | null;
};

export function AttributionFunnel() {
  const [funnel, setFunnel] = useState<AttributionFunnelData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("@/app/actions/attribution")
      .then(({ fetchAttributionFunnel }) => fetchAttributionFunnel())
      .then(({ funnel: f }) => setFunnel(f))
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

  const empty = !funnel || funnel.items_with_recommendations === 0;

  if (empty) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-sm font-bold text-zinc-200">Recommendation Funnel</p>
        <p className="mt-2 text-sm text-zinc-600">
          Import your inventory to generate recovery recommendations to track
        </p>
      </div>
    );
  }

  const maxVal = funnel.items_with_recommendations;

  const steps: Step[] = [
    {
      label: "Items with Recommendations",
      value: funnel.items_with_recommendations,
      rate: null,
      rateLabel: null,
    },
    {
      label: "Recommendations Followed",
      value: funnel.recommendations_followed,
      rate: funnel.acceptance_rate,
      rateLabel: "acceptance rate",
    },
    {
      label: "Actions Completed",
      value: funnel.actions_completed,
      rate: funnel.completion_rate,
      rateLabel: "completion rate",
    },
    {
      label: "Items Sold",
      value: funnel.items_sold,
      rate: funnel.sale_rate,
      rateLabel: "sale rate",
    },
  ];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="mb-4 text-sm font-bold text-zinc-200">Recommendation Funnel</p>
      <div className="space-y-3">
        {steps.map((step, i) => {
          const widthPct = maxVal > 0 ? Math.round((step.value / maxVal) * 100) : 0;
          const isLast = i === steps.length - 1;
          return (
            <div key={step.label}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-medium text-zinc-400">{step.label}</span>
                <div className="flex items-center gap-2">
                  {step.rate !== null && (
                    <span className={`text-[10px] font-bold ${
                      step.rate >= 50 ? "text-emerald-400" :
                      step.rate >= 25 ? "text-yellow-400" : "text-zinc-500"
                    }`}>
                      {step.rate}% {step.rateLabel}
                    </span>
                  )}
                  <span className={`text-sm font-black ${isLast ? "text-[#E935C1]" : "text-zinc-200"}`}>
                    {step.value.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all ${isLast ? "bg-[#E935C1]/60" : "bg-zinc-600"}`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
