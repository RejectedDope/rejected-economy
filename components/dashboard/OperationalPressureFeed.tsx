"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, Skull, TrendingDown, ChevronRight } from "lucide-react";
import { useInventory } from "@/lib/hooks/useInventory";
import { fetchAutomationTasks, type AutomationTask } from "@/app/actions/automation";

type PressureSignal = {
  id: string;
  icon: React.ElementType;
  color: string;
  message: string;
  detail: string;
  href: string;
  severity: "critical" | "warning" | "info";
};

export function OperationalPressureFeed() {
  const { items, loading } = useInventory();
  const [tasks, setTasks] = useState<AutomationTask[]>([]);

  useEffect(() => {
    fetchAutomationTasks()
      .then(({ tasks: t }) => setTasks(t))
      .catch(() => {});
  }, []);

  const signals = useMemo<PressureSignal[]>(() => {
    if (loading || items.length === 0) return [];

    const active = items.filter((i) => i.status === "active");
    const critical = active.filter((i) => i.dead_inventory_score >= 75);
    const overdue  = active.filter((i) => i.days_listed >= 180);
    const stale    = active.filter((i) => i.days_listed >= 60);
    const deadPct  = active.length > 0
      ? Math.round((active.filter((i) => i.dead_inventory_score >= 60).length / active.length) * 100)
      : 0;

    const out: PressureSignal[] = [];

    if (critical.length > 0) {
      out.push({
        id: "critical",
        icon: AlertTriangle,
        color: "text-red-400",
        message: `${critical.length} listing${critical.length !== 1 ? "s" : ""} in critical decay`,
        detail: "Functionally invisible in platform search. Action required now.",
        href: "/recovery",
        severity: "critical",
      });
    }

    if (tasks.length > 0) {
      out.push({
        id: "tasks",
        icon: TrendingDown,
        color: "text-[#E935C1]",
        message: `${tasks.length} automation task${tasks.length !== 1 ? "s" : ""} awaiting review`,
        detail: "Rules fired and queued recovery tasks — review and approve.",
        href: "/settings/automation",
        severity: "warning",
      });
    }

    if (overdue.length > 0) {
      out.push({
        id: "overdue",
        icon: Skull,
        color: "text-orange-400",
        message: `${overdue.length} listing${overdue.length !== 1 ? "s" : ""} at 180+ days`,
        detail: "Market has likely moved on. Consider liquidation or relist with new photos.",
        href: "/recovery",
        severity: "warning",
      });
    }

    if (deadPct >= 40 && critical.length === 0) {
      out.push({
        id: "deadpct",
        icon: TrendingDown,
        color: "text-orange-400",
        message: `Dead inventory at ${deadPct}% — above safe threshold`,
        detail: "More than 40% of active listings show low sell-through signals.",
        href: "/recovery",
        severity: "warning",
      });
    }

    if (stale.length > 0 && overdue.length === 0) {
      out.push({
        id: "stale",
        icon: Clock,
        color: "text-yellow-400",
        message: `${stale.length} listing${stale.length !== 1 ? "s" : ""} sitting 60+ days`,
        detail: "Visibility score declining. Time to review pricing or relist.",
        href: "/recovery",
        severity: "info",
      });
    }

    return out.slice(0, 4);
  }, [items, loading, tasks]);

  if (loading || signals.length === 0) return null;

  const hasCritical = signals.some((s) => s.severity === "critical");

  return (
    <div className={`mb-6 overflow-hidden rounded-xl border ${
      hasCritical ? "border-red-500/20" : "border-zinc-800"
    } bg-zinc-900`}>
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
          Operational Pressure
        </span>
        <Link href="/recovery" className="text-xs text-zinc-600 transition-colors hover:text-zinc-400">
          Recovery Center →
        </Link>
      </div>

      <div className="divide-y divide-zinc-800/50">
        {signals.map((signal) => {
          const Icon = signal.icon;
          return (
            <Link
              key={signal.id}
              href={signal.href}
              className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-zinc-800/40"
            >
              <Icon className={`h-3.5 w-3.5 shrink-0 ${signal.color}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-200">{signal.message}</p>
                <p className="text-xs text-zinc-500">{signal.detail}</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-700 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-500" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
