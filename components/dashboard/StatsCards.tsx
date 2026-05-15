"use client";

import { TrendingDown, AlertTriangle, DollarSign, Clock, Skull } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { DashboardStats } from "@/lib/types";

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {/* Trapped Cash — hero metric */}
      <div className="col-span-2 rounded-lg border border-[#E935C1]/30 bg-gradient-to-br from-[#E935C1]/10 via-zinc-900 to-zinc-900 p-5 lg:col-span-1">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Trapped Cash
            </p>
            <p className="mt-2 text-3xl font-black text-[#FF2D95]">
              {formatCurrency(stats.trapped_cash)}
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              locked in {stats.total_items} active listings
            </p>
          </div>
          <DollarSign className="h-5 w-5 text-[#E935C1]" />
        </div>
      </div>

      {/* Dead Inventory % */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Dead Inventory
            </p>
            <p className="mt-2 text-3xl font-black text-zinc-100">
              {stats.dead_inventory_pct}
              <span className="text-lg text-zinc-500">%</span>
            </p>
            <p className="mt-1 text-xs text-zinc-600">of active listings</p>
          </div>
          <Skull className="h-5 w-5 text-zinc-600" />
        </div>
      </div>

      {/* Critical Listings */}
      <div className="rounded-lg border border-[#FF2D95]/20 bg-zinc-900 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Critical Risk
            </p>
            <p className="mt-2 text-3xl font-black text-[#FF2D95]">
              {stats.critical_count}
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              {stats.high_risk_count} more high-risk
            </p>
          </div>
          <AlertTriangle className="h-5 w-5 text-[#FF2D95]" />
        </div>
      </div>

      {/* Average Days Listed */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Avg Days Listed
            </p>
            <p className="mt-2 text-3xl font-black text-zinc-100">
              {stats.avg_days_listed}
              <span className="text-lg text-zinc-500">d</span>
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              {stats.avg_days_listed > 60 ? "above healthy threshold" : "within range"}
            </p>
          </div>
          <Clock className="h-5 w-5 text-zinc-600" />
        </div>
      </div>
    </div>
  );
}
