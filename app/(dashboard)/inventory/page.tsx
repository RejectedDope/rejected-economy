"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Package, Search, Upload, RefreshCw, AlertTriangle } from "lucide-react";
import { useInventory } from "@/lib/hooks/useInventory";
import { InventoryTable } from "@/components/analyzer/InventoryTable";
import { detectEscalations } from "@/lib/inventory/prioritization";
import { formatCurrency } from "@/lib/utils";
import type { ScoredItem, VisibilityRisk, Platform } from "@/lib/types";

type SortOption =
  | "dead_inventory_score"
  | "days_listed"
  | "price"
  | "estimated_recovery";

const RISK_OPTIONS: Array<VisibilityRisk | "All"> = [
  "All",
  "Critical",
  "High",
  "Medium",
  "Low",
];

const RISK_ACTIVE_CLASSES: Record<VisibilityRisk | "All", string> = {
  All: "bg-[#E935C1] text-white border-[#E935C1]",
  Critical: "bg-[#FF2D95]/20 text-[#FF2D95] border-[#FF2D95]",
  High: "bg-orange-500/20 text-orange-400 border-orange-500",
  Medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500",
  Low: "bg-emerald-500/20 text-emerald-400 border-emerald-500",
};

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "dead_inventory_score", label: "Dead Score (highest)" },
  { value: "days_listed", label: "Days Listed (longest)" },
  { value: "price", label: "Price (highest)" },
  { value: "estimated_recovery", label: "Est. Recovery (highest)" },
];

export default function InventoryPage() {
  const { items: allItems, loading, isRealData, isAuthenticated, refresh } = useInventory();

  const platforms = useMemo<Array<Platform | "All">>(() => {
    const unique = Array.from(new Set(allItems.map((i) => i.platform))).sort();
    return ["All", ...unique] as Array<Platform | "All">;
  }, [allItems]);

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<VisibilityRisk | "All">("All");
  const [platformFilter, setPlatformFilter] = useState<Platform | "All">("All");
  const [sortKey, setSortKey] = useState<SortOption>("dead_inventory_score");

  const filtered = useMemo<ScoredItem[]>(() => {
    const base = allItems.filter((item) => {
      const matchSearch = search
        ? item.title.toLowerCase().includes(search.toLowerCase())
        : true;
      const matchRisk =
        riskFilter === "All" ? true : item.visibility_risk === riskFilter;
      const matchPlatform =
        platformFilter === "All" ? true : item.platform === platformFilter;
      return matchSearch && matchRisk && matchPlatform;
    });

    return [...base].sort((a, b) => b[sortKey] - a[sortKey]);
  }, [allItems, search, riskFilter, platformFilter, sortKey]);

  const criticalCount = filtered.filter(
    (i) => i.visibility_risk === "Critical"
  ).length;

  const trappedSum = filtered.reduce((sum, i) => sum + i.price, 0);

  const escalations = useMemo(() => detectEscalations(allItems).slice(0, 3), [allItems]);

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Package className="h-3.5 w-3.5 text-[#E935C1]" />
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">
            All Inventory
          </span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-zinc-100">Inventory</h1>
          <div className="flex items-center gap-2">
            {isRealData && (
              <button onClick={refresh} className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400">
                <RefreshCw className="h-3 w-3" /> Refresh
              </button>
            )}
            <Link
              href="/inventory/uploads"
              className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400"
            >
              History
            </Link>
            <Link
              href="/inventory/import"
              className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-xs font-bold text-zinc-300 transition-colors hover:border-[#E935C1] hover:text-[#E935C1]"
            >
              <Upload className="h-3.5 w-3.5" />
              Import
            </Link>
          </div>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          {loading
            ? "Loading inventory…"
            : isRealData
            ? `${allItems.length} items from your inventory`
            : isAuthenticated
            ? "No inventory yet — import your first file to get started"
            : "Demo inventory — sign in to see your real listings"}
        </p>
      </div>

      {/* Escalation Alerts */}
      {escalations.length > 0 && (
        <div className="mb-6 space-y-2">
          {escalations.map(({ item, reason, severity }) => (
            <Link
              key={item.id}
              href={`/inventory/${item.id}`}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors hover:opacity-90 ${
                severity === "critical"
                  ? "border-red-500/30 bg-red-500/5 text-red-300"
                  : "border-orange-500/30 bg-orange-500/5 text-orange-300"
              }`}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate font-semibold">{item.title}</span>
              <span className="shrink-0 text-xs opacity-70">{reason}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Filter Controls */}
      <div className="mb-5 space-y-3">
        {/* Row 1: search + sort */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative w-full sm:w-[300px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
            <input
              type="text"
              placeholder="Search listings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 py-2 pl-8 pr-3 text-sm text-zinc-300 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-0"
            />
          </div>

          {/* Platform dropdown */}
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value as Platform | "All")}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 focus:border-zinc-500 focus:outline-none"
          >
            {platforms.map((p) => (
              <option key={p} value={p}>
                {p === "All" ? "All Platforms" : p}
              </option>
            ))}
          </select>

          {/* Sort dropdown */}
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortOption)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 focus:border-zinc-500 focus:outline-none"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Sort: {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Row 2: risk filters */}
        <div className="flex flex-wrap items-center gap-2">
          {RISK_OPTIONS.map((risk) => (
            <button
              key={risk}
              onClick={() => setRiskFilter(risk)}
              className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide transition-colors ${
                riskFilter === risk
                  ? RISK_ACTIVE_CLASSES[risk]
                  : "border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              {risk}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
        <span className="text-sm font-bold text-zinc-300">
          {filtered.length}{" "}
          <span className="font-normal text-zinc-500">
            {filtered.length === 1 ? "item" : "items"}
          </span>
        </span>
        {criticalCount > 0 && (
          <>
            <span className="text-zinc-700">·</span>
            <span className="text-sm font-bold text-[#FF2D95]">
              {criticalCount} critical
            </span>
          </>
        )}
        <span className="text-zinc-700">·</span>
        <span className="text-sm">
          <span className="text-zinc-500">Trapped: </span>
          <span className="font-bold text-[#E935C1]">
            {formatCurrency(trappedSum)}
          </span>
        </span>
      </div>

      {/* Skeleton loader while fetching */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 animate-pulse">
              <div className="h-3 w-2/5 rounded bg-zinc-800" />
              <div className="h-3 w-16 rounded bg-zinc-800" />
              <div className="h-3 w-12 rounded bg-zinc-800" />
              <div className="h-3 w-16 ml-auto rounded bg-zinc-800" />
            </div>
          ))}
        </div>
      )}

      {/* Table or Empty State */}
      {!loading && filtered.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 py-16 text-center">
          <p className="text-sm font-semibold text-zinc-500">
            No items match your filters.
          </p>
          <button
            onClick={() => {
              setSearch("");
              setRiskFilter("All");
              setPlatformFilter("All");
            }}
            className="mt-3 text-xs text-[#E935C1] hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : !loading ? (
        <InventoryTable items={filtered} />
      ) : null}
    </div>
  );
}
