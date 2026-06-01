"use client";

import { TrendingUp } from "lucide-react";
import { RecoveryScorecard } from "@/components/reports/RecoveryScorecard";
import { SellerOutcomeDashboard } from "@/components/reports/SellerOutcomeDashboard";
import { InventoryChangeReport } from "@/components/reports/InventoryChangeReport";
import { DeadInventoryReductionReport } from "@/components/reports/DeadInventoryReductionReport";
import { RecoveredCashReport } from "@/components/reports/RecoveredCashReport";
import { AttributionExecutiveSummary } from "@/components/reports/AttributionExecutiveSummary";
import { AttributionFunnel } from "@/components/reports/AttributionFunnel";
import { RecommendationRanking } from "@/components/reports/RecommendationRanking";

function SectionHeading({ label, sub }: { label: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

export default function OutcomesPage() {
  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="mb-1 flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-[#E935C1]" />
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">
            Outcomes
          </span>
        </div>
        <h1 className="text-2xl font-black text-zinc-100">Seller Outcomes</h1>
        <p className="mt-1 text-sm text-zinc-500">
          See exactly what ResaleIQ recommendations have done for your inventory.
          Proof over assumptions.
        </p>
      </div>

      <div className="max-w-3xl space-y-8">
        {/* Section 1 — Results overview */}
        <div className="space-y-4">
          <RecoveryScorecard />
          <SellerOutcomeDashboard />
        </div>

        {/* Section 2 — Inventory health change */}
        <div className="space-y-4">
          <SectionHeading label="Inventory Health Change" />
          <InventoryChangeReport />
          <DeadInventoryReductionReport />
        </div>

        {/* Section 3 — Cash recovery */}
        <div className="space-y-4">
          <SectionHeading label="Cash Recovery" />
          <RecoveredCashReport />
        </div>

        {/* Section 4 — Attribution */}
        <div className="space-y-4">
          <SectionHeading
            label="Recommendation Attribution"
            sub="Which ResaleIQ recommendations actually drive sales?"
          />
          <AttributionExecutiveSummary />
          <AttributionFunnel />
          <RecommendationRanking />
        </div>
      </div>
    </div>
  );
}
