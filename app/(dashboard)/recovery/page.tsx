"use client";

import { useMemo } from "react";
import { Zap, DollarSign } from "lucide-react";
import { MOCK_ITEMS } from "@/lib/mock-data";
import { scoreAll, buildRecoveryPlan } from "@/lib/scoring";
import { ActionCards } from "@/components/recovery/ActionCards";
import { formatCurrency } from "@/lib/utils";

export default function RecoveryPage() {
  const scored = useMemo(() => scoreAll(MOCK_ITEMS), []);
  const plan = useMemo(() => buildRecoveryPlan(scored), [scored]);

  const totalRecoverable = plan.reduce(
    (sum, p) => sum + p.estimated_cash_recovery,
    0
  );
  const immediateActions = plan.filter((p) => p.urgency === "immediate");
  const immediateItems = immediateActions.reduce((s, p) => s + p.items.length, 0);

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="h-3.5 w-3.5 text-[#E935C1]" />
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">
            Recovery Center
          </span>
        </div>
        <h1 className="text-2xl font-black text-zinc-100">Recovery Action Center</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Prioritized actions to unlock your trapped cash. Work from top to bottom.
        </p>
      </div>

      {/* Summary strip */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-[#E935C1]/30 bg-[#E935C1]/5 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Total Recoverable
          </p>
          <p className="mt-2 text-2xl font-black text-[#FF2D95]">
            {formatCurrency(totalRecoverable)}
          </p>
          <p className="mt-0.5 text-xs text-zinc-600">across all actions</p>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Immediate Actions
          </p>
          <p className="mt-2 text-2xl font-black text-zinc-100">
            {immediateActions.length}
          </p>
          <p className="mt-0.5 text-xs text-zinc-600">
            {immediateItems} listings need attention now
          </p>
        </div>

        <div className="col-span-2 rounded-lg border border-zinc-800 bg-zinc-900 p-5 sm:col-span-1">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Action Categories
          </p>
          <p className="mt-2 text-2xl font-black text-zinc-100">{plan.length}</p>
          <p className="mt-0.5 text-xs text-zinc-600">recovery strategies active</p>
        </div>
      </div>

      {/* Priority guide */}
      <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">
          How to Use This
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Actions are sorted by urgency. Work through{" "}
          <span className="text-[#FF2D95] font-semibold">Immediate</span> first, then{" "}
          <span className="text-orange-400 font-semibold">This Week</span>, then{" "}
          <span className="text-zinc-400 font-semibold">This Month</span>. Each card shows the
          reasoning so you understand the why — not just the what.
        </p>
      </div>

      {/* Action cards */}
      <ActionCards plan={plan} />
    </div>
  );
}
