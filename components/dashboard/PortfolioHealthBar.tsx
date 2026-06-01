"use client";

import Link from "next/link";
import { TrendingUp, Layers, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PortfolioHealth } from "@/lib/inventory/portfolio";

// ─── Grade display helpers ────────────────────────────────────────────────────

function gradeColor(grade: PortfolioHealth["grade"]): string {
  if (grade === "A") return "text-emerald-400";
  if (grade === "B") return "text-blue-400";
  if (grade === "C") return "text-yellow-400";
  if (grade === "D") return "text-orange-400";
  return "text-[#FF2D95]";
}

function scoreFill(score: number): string {
  if (score >= 85) return "bg-emerald-400";
  if (score >= 70) return "bg-blue-400";
  if (score >= 50) return "bg-yellow-400";
  if (score >= 30) return "bg-orange-400";
  return "bg-[#FF2D95]";
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PortfolioHealthBarProps {
  health: PortfolioHealth;
}

export function PortfolioHealthBar({ health }: PortfolioHealthBarProps) {
  const topCategory = health.category_risks[0];
  const quickWins = health.top_opportunities.filter((o) => o.is_quick_win);

  return (
    <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900">
      {/* Header row */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Portfolio Health
          </span>
        </div>
        <Link
          href="/inventory"
          className="text-[10px] font-semibold text-zinc-600 hover:text-zinc-400"
        >
          View all inventory →
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-0 sm:grid-cols-4">

        {/* Score + Grade */}
        <div className="border-b border-r border-zinc-800 px-5 py-4 sm:border-b-0">
          <div className="flex items-end gap-2">
            <span className={cn("text-3xl font-black leading-none", gradeColor(health.grade))}>
              {health.grade}
            </span>
            <span className="mb-0.5 text-sm font-bold text-zinc-500">
              {Math.round(health.score)}/100
            </span>
          </div>
          {/* Score bar */}
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className={cn("h-full rounded-full transition-all", scoreFill(health.score))}
              style={{ width: `${health.score}%` }}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-zinc-600">
            {health.critical_count > 0
              ? `${health.critical_count} listing${health.critical_count !== 1 ? "s" : ""} in critical decay`
              : "No critical decay detected"}
          </p>
        </div>

        {/* Recovery opportunity */}
        <div className="border-b border-r border-zinc-800 px-5 py-4 sm:border-b-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
            Recovery Potential
          </p>
          <p className="mt-1.5 text-xl font-black text-emerald-400">
            ${Math.round(health.recovery_opportunity).toLocaleString()}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-600">
            across {health.stale_count} aging listing{health.stale_count !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Top category risk */}
        <div className="border-b border-r border-zinc-800 px-5 py-4 sm:border-b-0 sm:border-r">
          <div className="flex items-center gap-1.5">
            <Layers className="h-3 w-3 text-zinc-600" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
              Category Risk
            </p>
          </div>
          {topCategory ? (
            <>
              <p className="mt-1.5 text-sm font-bold text-zinc-200 truncate">
                {topCategory.category}
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-600">
                <span className={cn(
                  "font-bold",
                  topCategory.risk_level === "high" ? "text-[#FF2D95]"
                    : topCategory.risk_level === "medium" ? "text-yellow-400"
                    : "text-emerald-400"
                )}>
                  {topCategory.risk_level.toUpperCase()}
                </span>
                {" "}· {topCategory.dead_pct.toFixed(0)}% dead · {topCategory.count} items
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-sm text-zinc-600">No categories</p>
          )}
        </div>

        {/* Quick wins */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-[#E935C1]" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
              Quick Wins
            </p>
          </div>
          <p className="mt-1.5 text-xl font-black text-[#E935C1]">
            {quickWins.length}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-600">
            {quickWins.length > 0
              ? `high-ROI, low-effort — act now`
              : "no quick wins identified"}
          </p>
          {quickWins.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {quickWins.slice(0, 2).map((opp) => (
                <span
                  key={opp.item_id}
                  className="max-w-[120px] truncate rounded bg-[#E935C1]/10 px-1.5 py-0.5 text-[10px] text-[#E935C1]"
                >
                  {opp.title.split(" ").slice(0, 3).join(" ")}…
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Aging distribution strip */}
      {health.total_active > 0 && (
        <div className="border-t border-zinc-800 px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-700">
              Age Mix
            </span>
            <div className="flex h-2 flex-1 overflow-hidden rounded-full">
              {health.aging_distribution.pct_fresh > 0 && (
                <div
                  className="h-full bg-emerald-400"
                  style={{ width: `${health.aging_distribution.pct_fresh}%` }}
                  title={`0–30d: ${health.aging_distribution.pct_fresh.toFixed(0)}%`}
                />
              )}
              {health.aging_distribution.pct_normal > 0 && (
                <div
                  className="h-full bg-blue-400"
                  style={{ width: `${health.aging_distribution.pct_normal}%` }}
                  title={`31–90d: ${health.aging_distribution.pct_normal.toFixed(0)}%`}
                />
              )}
              {health.aging_distribution.pct_aging > 0 && (
                <div
                  className="h-full bg-yellow-400"
                  style={{ width: `${health.aging_distribution.pct_aging}%` }}
                  title={`91–180d: ${health.aging_distribution.pct_aging.toFixed(0)}%`}
                />
              )}
              {health.aging_distribution.pct_stale > 0 && (
                <div
                  className="h-full bg-[#FF2D95]"
                  style={{ width: `${health.aging_distribution.pct_stale}%` }}
                  title={`180d+: ${health.aging_distribution.pct_stale.toFixed(0)}%`}
                />
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-zinc-700 shrink-0">
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />Fresh {health.aging_distribution.pct_fresh.toFixed(0)}%</span>
              <span className="hidden sm:inline"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-400" />Normal {health.aging_distribution.pct_normal.toFixed(0)}%</span>
              <span className="hidden sm:inline"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-yellow-400" />Aging {health.aging_distribution.pct_aging.toFixed(0)}%</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#FF2D95]" />Stale {health.aging_distribution.pct_stale.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
