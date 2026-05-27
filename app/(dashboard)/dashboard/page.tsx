"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Skull,
  TrendingDown,
  Zap,
  Clock,
  Upload,
  Package,
  DollarSign,
} from "lucide-react";
import { useInventory } from "@/lib/hooks/useInventory";
import { calcDashboardStats, buildRecoveryPlan } from "@/lib/scoring";
import { calcPortfolioHealth } from "@/lib/inventory/portfolio";
import { AgingChart } from "@/components/dashboard/AgingChart";
import { PlatformChart } from "@/components/dashboard/PlatformChart";
import { InsightCards } from "@/components/dashboard/InsightCards";
import { DeathPileTable } from "@/components/dashboard/DeathPileTable";
import { PortfolioHealthBar } from "@/components/dashboard/PortfolioHealthBar";
import { LifecycleDistributionBar } from "@/components/dashboard/LifecycleDistributionBar";
import { TrappedCashTrend } from "@/components/dashboard/TrappedCashTrend";
import { ImportStatusPanel } from "@/components/dashboard/ImportStatusPanel";
import { InventoryHealthDigest } from "@/components/dashboard/InventoryHealthDigest";
import { DailyFocusPanel } from "@/components/dashboard/DailyFocusPanel";
import { RecoveryStatsPanel } from "@/components/dashboard/RecoveryStatsPanel";
import { OperationalBriefPanel } from "@/components/dashboard/OperationalBriefPanel";
import { formatCurrency } from "@/lib/utils";

const ACTION_LABELS: Record<string, string> = {
  relist_now:          "Relist Now",
  strategic_markdown:  "Strategic Markdown",
  bundle:              "Bundle It",
  move_platform:       "Move Platform",
  optimize_specifics:  "Fix Item Specifics",
  add_photos:          "Add More Photos",
  liquidate:           "Liquidate",
  hold:                "Hold",
};

function SkeletonStat() {
  return (
    <div className="flex flex-col gap-3 p-5 animate-pulse">
      <div className="h-2.5 w-24 rounded bg-zinc-800" />
      <div className="h-8 w-20 rounded bg-zinc-800" />
      <div className="h-2 w-32 rounded bg-zinc-800" />
    </div>
  );
}

function UploadFirstCTA() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#E935C1]/30 bg-[#E935C1]/10">
        <Upload className="h-7 w-7 text-[#E935C1]" />
      </div>
      <h2 className="text-2xl font-black text-zinc-100">Upload your inventory</h2>
      <p className="mt-3 max-w-md text-sm text-zinc-500">
        Import your eBay, Poshmark, or other platform exports to discover trapped cash,
        stale listings, and recovery opportunities.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <Link
          href="/inventory/import"
          className="flex items-center gap-2 rounded-lg bg-[#E935C1] px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          <Upload className="h-4 w-4" />
          Import Inventory
        </Link>
        <Link
          href="/inventory"
          className="flex items-center gap-2 rounded-lg border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
        >
          <Package className="h-4 w-4" />
          View Inventory
        </Link>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3 max-w-xl w-full">
        {[
          { label: "eBay CSV Export", tip: "Seller Hub → Active Listings → Download" },
          { label: "Poshmark CSV", tip: "Account → My Inventory → Export" },
          { label: "Screenshots", tip: "Screenshot any listing page — OCR extracts data" },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-left">
            <p className="text-xs font-bold text-zinc-300">{item.label}</p>
            <p className="mt-1 text-xs text-zinc-600">{item.tip}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { items: scored, loading, isRealData, isAuthenticated } = useInventory();
  const stats         = useMemo(() => calcDashboardStats(scored), [scored]);
  const recoveryPlan  = useMemo(() => buildRecoveryPlan(scored), [scored]);
  const portfolioHealth = useMemo(() => calcPortfolioHealth(scored), [scored]);

  const topAction = recoveryPlan.find((p) => p.urgency === "immediate");

  const isEmpty = isAuthenticated && isRealData && scored.length === 0;

  return (
    <div className="min-h-screen bg-zinc-950">

      {/* ── Critical Alert Banner ────────────────────────────────────────────── */}
      {!loading && !isEmpty && stats.critical_count > 0 && (
        <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-[#FF2D95]/30 bg-[#FF2D95]/10 px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#FF2D95]" />
            <p className="text-xs font-bold text-[#FF2D95]">
              {stats.critical_count} listing{stats.critical_count !== 1 ? "s" : ""} in critical decay —
              functionally invisible on platform search.
            </p>
          </div>
          <Link
            href="/recovery"
            className="shrink-0 text-xs font-bold uppercase tracking-wide text-[#FF2D95] hover:text-white"
          >
            Fix Now →
          </Link>
        </div>
      )}

      <div className="px-4 py-8 sm:px-6 lg:px-8">

        {/* ── Page Header ───────────────────────────────────────────────────── */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#E935C1]" />
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">
                Inventory Command
              </span>
              {!isRealData && !loading && (
                <span className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                  Demo
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black text-zinc-100">Dashboard</h1>
            {!loading && !isEmpty && (
              <p className="mt-0.5 text-sm text-zinc-500">
                {stats.total_items} active listings · avg age {stats.avg_days_listed} days ·{" "}
                <span className="text-[#E935C1]">no sugarcoating</span>
              </p>
            )}
          </div>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <Link
              href="/inventory/import"
              className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
            >
              <Upload className="h-3.5 w-3.5" />
              Import
            </Link>
            <Link
              href="/recovery"
              className="flex items-center gap-1.5 rounded-md border border-[#E935C1]/30 bg-[#E935C1]/10 px-3 py-2 text-xs font-bold text-[#E935C1] transition-colors hover:bg-[#E935C1]/20"
            >
              <Zap className="h-3.5 w-3.5" />
              Recovery Center
            </Link>
          </div>
        </div>

        {/* ── Ingestion Status (authenticated only) ────────────────────────── */}
        {isAuthenticated && (
          <ImportStatusPanel
            totalInventoryCount={stats.total_items}
            isAuthenticated={isAuthenticated}
          />
        )}

        {/* ── Recovery Stats (authenticated + real data only) ──────────────── */}
        {isAuthenticated && isRealData && <RecoveryStatsPanel />}

        {/* ── Loading Skeleton ─────────────────────────────────────────────── */}
        {loading && (
          <div className="mb-6 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={i < 3 ? "border-b border-r border-zinc-800" : ""}>
                  <SkeletonStat />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Empty State (authenticated, no inventory) ────────────────────── */}
        {!loading && isEmpty && <UploadFirstCTA />}

        {/* ── Demo Banner ──────────────────────────────────────────────────── */}
        {!loading && !isAuthenticated && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2.5">
            <p className="text-xs text-zinc-500">
              Showing demo inventory.{" "}
              <Link href="/login" className="text-[#E935C1] hover:underline">
                Sign in
              </Link>{" "}
              or{" "}
              <Link href="/signup" className="text-[#E935C1] hover:underline">
                create an account
              </Link>{" "}
              to import your own.
            </p>
            <Link href="/inventory/import" className="ml-4 shrink-0 text-xs font-bold text-[#E935C1] hover:underline">
              Import →
            </Link>
          </div>
        )}

        {/* ── Operational Dashboard (real or demo data, not empty) ─────────── */}
        {!loading && !isEmpty && (
          <>
            {/* ── Hero: Trapped Cash ──────────────────────────────────────── */}
            <div className="mb-6 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
              <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4">

                {/* Trapped cash — dominant metric */}
                <div className="relative overflow-hidden border-b border-zinc-800 p-6 sm:col-span-2 sm:border-b-0 sm:border-r lg:col-span-1 lg:border-r">
                  <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#E935C1]/10 blur-2xl" />
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                    Trapped Cash
                  </p>
                  <p className="mt-2 text-4xl font-black leading-none text-[#FF2D95] sm:text-5xl">
                    {formatCurrency(stats.trapped_cash)}
                  </p>
                  <p className="mt-2 text-xs text-zinc-600">
                    locked in {stats.total_items} active listings
                  </p>
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-[10px] text-zinc-600">
                      <span>dead inventory</span>
                      <span className="font-bold text-zinc-400">{stats.dead_inventory_pct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-[#E935C1] transition-all"
                        style={{ width: `${stats.dead_inventory_pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Dead Inventory % */}
                <div className="flex flex-col justify-between border-b border-r border-zinc-800 p-5 sm:border-b-0 lg:border-r">
                  <div className="flex items-start justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                      Dead Inventory
                    </p>
                    <Skull className="h-4 w-4 text-zinc-700" />
                  </div>
                  <div>
                    <p className="text-3xl font-black text-zinc-100">
                      {stats.dead_inventory_pct}
                      <span className="text-xl text-zinc-500">%</span>
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                      {stats.dead_inventory_pct > 40
                        ? "above danger threshold"
                        : "within range — watch it"}
                    </p>
                  </div>
                </div>

                {/* Critical */}
                <div className="flex flex-col justify-between border-b border-r border-zinc-800 p-5 sm:border-r-0 lg:border-b-0 lg:border-r">
                  <div className="flex items-start justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                      Critical Risk
                    </p>
                    <AlertTriangle className="h-4 w-4 text-[#FF2D95]" />
                  </div>
                  <div>
                    <p className="text-3xl font-black text-[#FF2D95]">
                      {stats.critical_count}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                      {stats.high_risk_count} more high-risk
                    </p>
                  </div>
                </div>

                {/* Stale Inventory */}
                <div className="flex flex-col justify-between p-5">
                  <div className="flex items-start justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                      Stale Inventory
                    </p>
                    <Clock className="h-4 w-4 text-zinc-700" />
                  </div>
                  <div>
                    <p className="text-3xl font-black text-zinc-100">
                      {stats.stale_count}
                      <span className="ml-1 text-xl text-zinc-500">items</span>
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                      {stats.stale_cash > 0
                        ? `${formatCurrency(stats.stale_cash)} sitting 60d+`
                        : "60+ days listed"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── 30-Day Trend (real data only) ─────────────────────────── */}
            {isRealData && (
              <div className="mb-6">
                <TrappedCashTrend />
              </div>
            )}

            {/* ── Priority Action Strip ──────────────────────────────────── */}
            {topAction && (
              <div className="mb-6">
                <Link
                  href="/recovery"
                  className="group flex items-center justify-between gap-4 rounded-lg border border-[#E935C1]/25 bg-gradient-to-r from-[#E935C1]/8 to-transparent px-5 py-4 transition-colors hover:border-[#E935C1]/40 hover:from-[#E935C1]/12"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#E935C1]/30 bg-[#E935C1]/10">
                      <TrendingDown className="h-4 w-4 text-[#E935C1]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#E935C1]">
                        Your #1 priority right now
                      </p>
                      <p className="text-sm font-semibold text-zinc-200">
                        {ACTION_LABELS[topAction.action]} ·{" "}
                        <span className="text-zinc-400">
                          {topAction.items.length} listing{topAction.items.length !== 1 ? "s" : ""},{" "}
                          {formatCurrency(topAction.estimated_cash_recovery)} recoverable
                        </span>
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-[#E935C1]" />
                </Link>
              </div>
            )}

            {/* ── Operational Health (real data only) ──────────────────── */}
            {isRealData && <OperationalBriefPanel items={scored} />}

            {/* ── Daily Focus Panel (real data only) ───────────────────── */}
            {isRealData && <DailyFocusPanel items={scored} />}

            {/* ── Stale Inventory Alert ─────────────────────────────────── */}
            {stats.stale_count > 0 && stats.stale_cash > 0 && (
              <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-zinc-700/60 bg-zinc-900 px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 shrink-0 text-zinc-500" />
                  <div>
                    <p className="text-xs font-bold text-zinc-300">
                      {stats.stale_count} listings have been sitting 60+ days
                    </p>
                    <p className="text-xs text-zinc-600">
                      {formatCurrency(stats.stale_cash)} trapped in stale inventory — algorithm visibility is declining
                    </p>
                  </div>
                </div>
                <Link
                  href="/recovery"
                  className="shrink-0 text-xs font-bold text-[#E935C1] hover:underline"
                >
                  Recovery Plan →
                </Link>
              </div>
            )}

            {/* ── Recovery Opportunity Strip ────────────────────────────── */}
            {recoveryPlan.length > 0 && (
              <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {recoveryPlan.slice(0, 3).map((plan) => (
                  <Link
                    key={plan.action}
                    href="/recovery"
                    className="group rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-600"
                  >
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                      {ACTION_LABELS[plan.action] ?? plan.action}
                    </p>
                    <p className="mt-1 text-xl font-black text-zinc-100">
                      {plan.items.length}
                      <span className="ml-1 text-sm font-normal text-zinc-500">items</span>
                    </p>
                    <p className="mt-1 text-xs text-[#E935C1]">
                      {formatCurrency(plan.estimated_cash_recovery)} recoverable
                    </p>
                  </Link>
                ))}
              </div>
            )}

            {/* ── Portfolio Health Bar ──────────────────────────────────── */}
            <PortfolioHealthBar health={portfolioHealth} />

            {/* ── Lifecycle Distribution ───────────────────────────────── */}
            <LifecycleDistributionBar items={scored} />

            {/* ── Aging Chart + Platform Breakdown ─────────────────────── */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <AgingChart buckets={stats.aging_breakdown} />
              <PlatformChart buckets={stats.platform_breakdown} />
            </div>

            {/* ── Insight Cards ─────────────────────────────────────────── */}
            <div className="mt-6">
              <InsightCards stats={stats} items={scored} />
            </div>

            {/* ── Inventory Health Digest ───────────────────────────────── */}
            <div className="mt-6">
              <InventoryHealthDigest items={scored} />
            </div>

            {/* ── Death Pile Table ──────────────────────────────────────── */}
            <div className="mt-6">
              <DeathPileTable items={scored} />
            </div>

            {/* ── Import CTA ────────────────────────────────────────────── */}
            {!isRealData && (
              <div className="mt-8 flex flex-col items-center gap-4 rounded-lg border border-[#E935C1]/20 bg-gradient-to-br from-[#E935C1]/5 to-transparent p-6 text-center sm:flex-row sm:text-left">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#E935C1]/30 bg-[#E935C1]/10">
                  <DollarSign className="h-5 w-5 text-[#E935C1]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-zinc-300">
                    This is demo inventory — your numbers will be different
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-600">
                    Import your real listings to see your actual trapped cash, stale inventory, and recovery opportunities.
                  </p>
                </div>
                <Link
                  href="/inventory/import"
                  className="shrink-0 rounded-md bg-[#E935C1] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#B5279A]"
                >
                  Import Your Inventory →
                </Link>
              </div>
            )}

            {/* ── Recovery footer (only when real data) ─────────────────── */}
            {isRealData && (
              <div className="mt-8 flex flex-col items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 text-center sm:flex-row sm:text-left">
                <div className="flex-1">
                  <p className="text-sm font-bold text-zinc-300">
                    Ready to work the list?
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-600">
                    The Recovery Center has a prioritized action plan — immediate, this week, this month.
                    Every action comes with reasoning and estimated cash recovery.
                  </p>
                </div>
                <Link
                  href="/recovery"
                  className="shrink-0 rounded-md bg-[#E935C1] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#B5279A]"
                >
                  Run Recovery Audit →
                </Link>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
