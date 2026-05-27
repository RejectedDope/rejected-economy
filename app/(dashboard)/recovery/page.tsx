"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Zap, Upload, Filter, ChevronDown } from "lucide-react";
import { useInventory } from "@/lib/hooks/useInventory";
import { buildRecoveryPlan } from "@/lib/scoring";
import { prioritizeRecovery } from "@/lib/inventory/prioritization";
import {
  filterRecoveryPlan,
  filterPriorityQueue,
  getAvailablePlatforms,
  type RecoveryFilterState,
  DEFAULT_FILTERS,
} from "@/lib/recovery/filters";
import { ActionCards } from "@/components/recovery/ActionCards";
import { PriorityQueue } from "@/components/recovery/PriorityQueue";
import { RecoveryEffectivenessSummary } from "@/components/recovery/RecoveryEffectivenessSummary";
import { ActionEffectivenessTable } from "@/components/recovery/ActionEffectivenessTable";
import { formatCurrency } from "@/lib/utils";

const URGENCY_OPTS = [
  { value: "all",        label: "All Urgency" },
  { value: "immediate",  label: "Immediate" },
  { value: "this_week",  label: "This Week" },
  { value: "this_month", label: "This Month" },
] as const;

const SORT_OPTS = [
  { value: "cash",  label: "Recoverable Cash" },
  { value: "age",   label: "Oldest First" },
  { value: "score", label: "Highest Score" },
] as const;

function FilterBar({
  filters,
  platforms,
  onChange,
}: {
  filters: RecoveryFilterState;
  platforms: string[];
  onChange: (f: RecoveryFilterState) => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
        <Filter className="h-3 w-3" />
        Filter
      </div>

      {/* Urgency */}
      <div className="relative">
        <select
          value={filters.urgency}
          onChange={(e) =>
            onChange({ ...filters, urgency: e.target.value as RecoveryFilterState["urgency"] })
          }
          className="appearance-none rounded border border-zinc-700 bg-zinc-900 py-1.5 pl-3 pr-7 text-xs font-semibold text-zinc-300 focus:border-zinc-500 focus:outline-none"
        >
          {URGENCY_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-600" />
      </div>

      {/* Platform */}
      {platforms.length > 1 && (
        <div className="relative">
          <select
            value={filters.platform}
            onChange={(e) => onChange({ ...filters, platform: e.target.value })}
            className="appearance-none rounded border border-zinc-700 bg-zinc-900 py-1.5 pl-3 pr-7 text-xs font-semibold text-zinc-300 focus:border-zinc-500 focus:outline-none"
          >
            <option value="">All Platforms</option>
            {platforms.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-600" />
        </div>
      )}

      {/* Sort */}
      <div className="relative ml-auto">
        <select
          value={filters.sort}
          onChange={(e) =>
            onChange({ ...filters, sort: e.target.value as RecoveryFilterState["sort"] })
          }
          className="appearance-none rounded border border-zinc-700 bg-zinc-900 py-1.5 pl-3 pr-7 text-xs font-semibold text-zinc-300 focus:border-zinc-500 focus:outline-none"
        >
          {SORT_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              Sort: {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-600" />
      </div>

      {/* Reset */}
      {(filters.urgency !== "all" || filters.platform || filters.sort !== "cash") && (
        <button
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="text-xs text-zinc-600 hover:text-zinc-400"
        >
          Reset
        </button>
      )}
    </div>
  );
}

export default function RecoveryPage() {
  const { items: scored, loading, isAuthenticated, isRealData } = useInventory();
  const plan     = useMemo(() => buildRecoveryPlan(scored), [scored]);
  const priority = useMemo(() => prioritizeRecovery(scored), [scored]);

  const [filters, setFilters] = useState<RecoveryFilterState>(DEFAULT_FILTERS);

  const availablePlatforms = useMemo(() => getAvailablePlatforms(priority), [priority]);
  const filteredPlan       = useMemo(() => filterRecoveryPlan(plan, filters), [plan, filters]);
  const filteredPriority   = useMemo(() => filterPriorityQueue(priority, filters), [priority, filters]);

  const totalRecoverable = filteredPlan.reduce((sum, p) => sum + p.estimated_cash_recovery, 0);
  const immediateActions = filteredPlan.filter((p) => p.urgency === "immediate");
  const immediateItems   = immediateActions.reduce((s, p) => s + p.items.length, 0);

  const isEmpty = !loading && isAuthenticated && scored.length === 0;

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-1 flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-[#E935C1]" />
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">
            Recovery Center
          </span>
          {!isRealData && !loading && (
            <span className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
              Demo
            </span>
          )}
        </div>
        <h1 className="text-2xl font-black text-zinc-100">Recovery Action Center</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {isEmpty
            ? "Import your inventory to generate a recovery plan."
            : "Prioritized actions to unlock your trapped cash. Work from top to bottom."}
        </p>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#E935C1]/30 bg-[#E935C1]/10">
            <Upload className="h-5 w-5 text-[#E935C1]" />
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-300">No inventory to analyze</p>
            <p className="mt-1 text-xs text-zinc-600">
              Import your listings to generate a recovery action plan.
            </p>
          </div>
          <Link
            href="/inventory/import"
            className="rounded-lg bg-[#E935C1] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90"
          >
            Import Inventory →
          </Link>
        </div>
      )}

      {/* Main content */}
      {!isEmpty && (
        <div>
          {/* Summary strip */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-[#E935C1]/30 bg-[#E935C1]/5 p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Total Recoverable
              </p>
              <p className="mt-2 text-2xl font-black text-[#FF2D95]">
                {formatCurrency(totalRecoverable)}
              </p>
              <p className="mt-0.5 text-xs text-zinc-600">
                {filters.urgency !== "all" || filters.platform
                  ? "filtered view"
                  : "across all actions"}
              </p>
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
              <p className="mt-2 text-2xl font-black text-zinc-100">{filteredPlan.length}</p>
              <p className="mt-0.5 text-xs text-zinc-600">recovery strategies active</p>
            </div>
          </div>

          {/* Filters */}
          <FilterBar
            filters={filters}
            platforms={availablePlatforms}
            onChange={setFilters}
          />

          {/* Recovery Effectiveness */}
          <RecoveryEffectivenessSummary />

          {/* Action Effectiveness */}
          <ActionEffectivenessTable />

          {/* Priority Queue — all items, no cap */}
          <PriorityQueue items={filteredPriority} limit={filteredPriority.length || 50} />

          {/* How to use */}
          <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">
              How to Use This
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              Actions are sorted by urgency. Work through{" "}
              <span className="font-semibold text-[#FF2D95]">Immediate</span> first, then{" "}
              <span className="font-semibold text-orange-400">This Week</span>, then{" "}
              <span className="font-semibold text-zinc-400">This Month</span>. Each card shows the
              reasoning so you understand the why — not just the what.
            </p>
          </div>

          {/* Action cards */}
          <ActionCards plan={filteredPlan} />
        </div>
      )}
    </div>
  );
}
