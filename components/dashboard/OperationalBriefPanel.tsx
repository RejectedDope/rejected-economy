"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, TrendingDown } from "lucide-react";
import type { ScoredItem } from "@/lib/types";
import {
  calcOperationalHealthScore,
} from "@/lib/inventory/health-score";
import { fetchUsageSummary } from "@/app/actions/usage";
import { fetchRecoveryStats } from "@/app/actions/recovery";

const GRADE_RING: Record<string, string> = {
  A: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10",
  B: "text-blue-400 border-blue-400/40 bg-blue-400/10",
  C: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
  D: "text-orange-400 border-orange-400/40 bg-orange-400/10",
  F: "text-red-400 border-red-400/40 bg-red-400/10",
};

export function OperationalBriefPanel({ items }: { items: ScoredItem[] }) {
  const [daysSince, setDaysSince] = useState<number | null>(null);
  const [actionsThisMonth, setActionsThisMonth] = useState(0);
  const [recoveredThisMonth, setRecoveredThisMonth] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([fetchUsageSummary(), fetchRecoveryStats()])
      .then(([usage, stats]) => {
        setDaysSince(usage?.daysSinceLastImport ?? null);
        setActionsThisMonth(stats?.actionsThisMonth ?? 0);
        setRecoveredThisMonth(stats?.recoveredThisMonth ?? 0);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  if (!ready) return null;

  const result = calcOperationalHealthScore({
    items,
    daysSinceLastImport: daysSince,
    actionsThisMonth,
    recoveredThisMonth,
  });

  const criticalCount = items.filter(
    (i) => i.status === "active" && i.dead_inventory_score >= 75
  ).length;

  const overdueCount = items.filter(
    (i) => i.status === "active" && i.days_listed >= 180
  ).length;

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Operational Health
          </span>
        </div>
        <Link
          href="/recovery"
          className="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
        >
          Recovery Plan →
        </Link>
      </div>

      <div className="flex items-start gap-6 p-5">
        {/* Score ring */}
        <div
          className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border-2 ${GRADE_RING[result.grade]}`}
        >
          <span className="text-xl font-black leading-none">{result.grade}</span>
          <span className="text-[9px] font-bold uppercase">{result.score}</span>
        </div>

        {/* Right section */}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-zinc-100">{result.label}</p>

          {/* Pressure signals */}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {criticalCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-red-400">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {criticalCount} critical item{criticalCount !== 1 ? "s" : ""}
              </div>
            )}
            {overdueCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-orange-400">
                <TrendingDown className="h-3 w-3 shrink-0" />
                {overdueCount} listing{overdueCount !== 1 ? "s" : ""} 180d+
              </div>
            )}
            {daysSince !== null && daysSince >= 7 && (
              <div className="flex items-center gap-1.5 text-xs text-yellow-400">
                <Activity className="h-3 w-3 shrink-0" />
                No import in {daysSince}d
              </div>
            )}
            {daysSince === null && (
              <div className="flex items-center gap-1.5 text-xs text-yellow-400">
                <Activity className="h-3 w-3 shrink-0" />
                No import on record
              </div>
            )}
          </div>

          {/* Score breakdown — top 2 deductions + bonuses */}
          {result.deductions.length > 0 && (
            <div className="mt-3 space-y-1">
              {result.deductions.slice(0, 2).map((d) => (
                <div key={d.reason} className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">{d.reason}</span>
                  <span className="font-bold text-red-400/80">-{d.points} pts</span>
                </div>
              ))}
              {result.bonuses.map((b) => (
                <div key={b.reason} className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">{b.reason}</span>
                  <span className="font-bold text-emerald-400/80">+{b.points} pts</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
