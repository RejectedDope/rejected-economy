"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import type { ScoredItem, VisibilityRisk } from "@/lib/types";

const ACTION_LABELS: Record<string, string> = {
  relist_now: "Relist Now",
  strategic_markdown: "Mark Down",
  bundle: "Bundle It",
  move_platform: "Move Platform",
  optimize_specifics: "Fix Specifics",
  add_photos: "Add Photos",
  liquidate: "Liquidate",
  hold: "Hold",
};

type SortKey = "dead_inventory_score" | "days_listed" | "price" | "listing_health_score";
type SortDir = "asc" | "desc";

interface InventoryTableProps {
  items: ScoredItem[];
}

export function InventoryTable({ items }: InventoryTableProps) {
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<VisibilityRisk | "All">("All");
  const [sortKey, setSortKey] = useState<SortKey>("dead_inventory_score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const filtered = items
    .filter((i) => {
      const matchQ = query
        ? i.title.toLowerCase().includes(query.toLowerCase()) ||
          i.category.toLowerCase().includes(query.toLowerCase())
        : true;
      const matchR = riskFilter === "All" ? true : i.visibility_risk === riskFilter;
      return matchQ && matchR;
    })
    .sort((a, b) => {
      const mult = sortDir === "asc" ? 1 : -1;
      return (a[sortKey] - b[sortKey]) * mult;
    });

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 text-zinc-600" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 text-[#E935C1]" />
    ) : (
      <ArrowDown className="h-3 w-3 text-[#E935C1]" />
    );
  };

  const riskOptions: Array<VisibilityRisk | "All"> = ["All", "Critical", "High", "Medium", "Low"];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search listings..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex items-center gap-2">
          {riskOptions.map((r) => (
            <button
              key={r}
              onClick={() => setRiskFilter(r)}
              className={`rounded px-3 py-1 text-xs font-bold uppercase tracking-wide transition-colors ${
                riskFilter === r
                  ? "bg-[#E935C1] text-white"
                  : "border border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-zinc-600">
          {filtered.length} listings
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-950">
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-zinc-600">
                Listing
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-right text-xs font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-400"
                onClick={() => handleSort("days_listed")}
              >
                <span className="flex items-center justify-end gap-1">
                  Age <SortIcon col="days_listed" />
                </span>
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-right text-xs font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-400"
                onClick={() => handleSort("price")}
              >
                <span className="flex items-center justify-end gap-1">
                  Price <SortIcon col="price" />
                </span>
              </th>
              <th
                className="hidden cursor-pointer px-4 py-3 text-right text-xs font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-400 md:table-cell"
                onClick={() => handleSort("dead_inventory_score")}
              >
                <span className="flex items-center justify-end gap-1">
                  Decay <SortIcon col="dead_inventory_score" />
                </span>
              </th>
              <th className="hidden px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-zinc-600 sm:table-cell">
                Risk
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-zinc-600">
                Action
              </th>
              <th className="w-8 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filtered.map((item) => (
              <tr
                key={item.id}
                className="group transition-colors hover:bg-zinc-800/40"
              >
                <td className="px-4 py-3">
                  <div className="max-w-[280px]">
                    <p className="truncate font-medium text-zinc-200">{item.title}</p>
                    <p className="text-xs text-zinc-600">
                      {item.platform} · {item.category}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-xs text-zinc-400">
                  {item.days_listed}d
                </td>
                <td className="px-4 py-3 text-right text-xs font-semibold text-zinc-300">
                  {formatCurrency(item.price)}
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-xs font-bold text-zinc-400">
                      {item.dead_inventory_score}
                    </span>
                    <Progress
                      value={item.dead_inventory_score}
                      className="h-1.5 w-16"
                      indicatorClassName={
                        item.dead_inventory_score >= 75
                          ? "bg-[#FF2D95]"
                          : item.dead_inventory_score >= 55
                          ? "bg-orange-400"
                          : item.dead_inventory_score >= 30
                          ? "bg-yellow-400"
                          : "bg-emerald-400"
                      }
                    />
                  </div>
                </td>
                <td className="hidden px-4 py-3 text-center sm:table-cell">
                  <Badge
                    variant={item.visibility_risk.toLowerCase() as "critical" | "high" | "medium" | "low"}
                  >
                    {item.visibility_risk}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-semibold text-[#E935C1]">
                    {ACTION_LABELS[item.primary_recovery_action]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/inventory/${item.id}`}>
                    <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:text-zinc-400" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-zinc-600">
            No listings match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
