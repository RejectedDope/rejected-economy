"use client";

import { useEffect, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import { fetchUserRetentionSignals, type UserRetentionSignals } from "@/app/actions/telemetry";

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function StatBar({ count, max = 10 }: { count: number; max?: number }) {
  const pct = Math.min((count / max) * 100, 100);
  return (
    <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-800">
      <div
        className="h-1.5 rounded-full bg-emerald-500/70 transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function StatCard({
  label,
  count,
  lastAt,
}: {
  label: string;
  count: number;
  lastAt: string | null;
}) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">
          {label}
        </span>
        <span className="text-sm font-bold text-emerald-400">{count}</span>
      </div>
      <StatBar count={count} />
      <p className="mt-1.5 text-[10px] text-zinc-600">
        Last: {formatDate(lastAt)}
      </p>
    </div>
  );
}

export function RetentionPanel() {
  const [signals, setSignals] = useState<UserRetentionSignals | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchUserRetentionSignals()
      .then((data) => {
        if (!cancelled) {
          setSignals(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
      </div>
    );
  }

  // Hide entirely if no activity
  if (!signals || signals.totalEvents30d === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-4 w-4 text-zinc-500" />
        <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">
          Operational Activity
        </h2>
        <span className="ml-auto text-[10px] text-zinc-600 font-medium">Last 30 days</span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <StatCard
          label="Imports"
          count={signals.importCount30d}
          lastAt={signals.lastImportAt}
        />
        <StatCard
          label="Recovery Actions"
          count={signals.recoveryCount30d}
          lastAt={signals.lastRecoveryAt}
        />
        <StatCard
          label="Automation Interactions"
          count={signals.automationCount30d}
          lastAt={signals.lastAutomationAt}
        />
      </div>
    </div>
  );
}
