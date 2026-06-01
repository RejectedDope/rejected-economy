"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bot,
  AlertTriangle,
  TrendingDown,
  RefreshCw,
  Settings2,
  Loader2,
  X,
  Clock,
} from "lucide-react";
import {
  fetchAutomationTasks,
  dismissAutomationTask,
  evaluateRulesForUser,
  type AutomationTask,
} from "@/app/actions/automation";
import { formatCurrency } from "@/lib/utils";

const RULE_ICONS: Record<string, React.ElementType> = {
  stale_alert:    AlertTriangle,
  auto_markdown:  TrendingDown,
  auto_relist:    RefreshCw,
  auto_crosslist: Settings2,
};

const RULE_LABELS: Record<string, string> = {
  stale_alert:    "Stale Alert",
  auto_markdown:  "Markdown",
  auto_relist:    "Relist",
  auto_crosslist: "Cross-list",
};

const RULE_COLORS: Record<string, string> = {
  stale_alert:    "text-yellow-400",
  auto_markdown:  "text-orange-400",
  auto_relist:    "text-blue-400",
  auto_crosslist: "text-purple-400",
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "< 1h ago";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function AutomationQueue() {
  const [tasks, setTasks] = useState<AutomationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ tasksCreated: number; itemsScanned: number } | null>(null);
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());

  async function load() {
    fetchAutomationTasks()
      .then(({ tasks: t }) => { setTasks(t); setLoading(false); })
      .catch(() => { setLoading(false); });
  }

  useEffect(() => { load(); }, []); // load has no reactive deps — intentional empty array

  async function runNow() {
    setRunning(true);
    setRunResult(null);
    try {
      const result = await evaluateRulesForUser();
      if (result.ok) {
        setRunResult({ tasksCreated: result.tasksCreated, itemsScanned: result.itemsScanned });
        await load();
      }
    } finally {
      setRunning(false);
    }
  }

  async function dismiss(taskId: string) {
    setDismissing((prev) => new Set(prev).add(taskId));
    await dismissAutomationTask(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setDismissing((prev) => { const n = new Set(prev); n.delete(taskId); return n; });
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-3.5 w-3.5 text-[#E935C1]" />
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Task Queue
          </span>
          {tasks.length > 0 && (
            <span className="rounded bg-[#E935C1]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#E935C1]">
              {tasks.length}
            </span>
          )}
        </div>
        <button
          onClick={runNow}
          disabled={running}
          className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-50"
        >
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Run Now
        </button>
      </div>

      {runResult && (
        <div className="border-b border-zinc-800 bg-emerald-500/5 px-5 py-2.5 text-xs text-emerald-400">
          Scan complete — {runResult.itemsScanned} items checked,{" "}
          {runResult.tasksCreated} new task{runResult.tasksCreated !== 1 ? "s" : ""} created
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 px-5 py-6 text-xs text-zinc-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading tasks…
        </div>
      ) : tasks.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-zinc-600">No pending automation tasks</p>
          <p className="mt-1 text-xs text-zinc-700">
            Enable rules above and click Run Now to evaluate your inventory.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/50">
          {tasks.map((task) => {
            const Icon = RULE_ICONS[task.rule_type] ?? Bot;
            const color = RULE_COLORS[task.rule_type] ?? "text-zinc-400";
            const label = RULE_LABELS[task.rule_type] ?? task.rule_type;

            return (
              <div key={task.id} className="flex items-start gap-3 px-5 py-3.5">
                <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${color}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-500">
                      {label}
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px] text-zinc-600">
                      <Clock className="h-2.5 w-2.5" />
                      {relTime(task.queued_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-semibold text-zinc-200">
                    {task.item_title ?? "(unknown item)"}
                  </p>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
                    {task.item_platform && <span>{task.item_platform}</span>}
                    {task.price_snapshot != null && (
                      <span>{formatCurrency(task.price_snapshot)}</span>
                    )}
                    {task.days_listed_snapshot != null && (
                      <span>{task.days_listed_snapshot}d listed</span>
                    )}
                    {task.dead_score_snapshot != null && (
                      <span>dead score {task.dead_score_snapshot}</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Suggested:{" "}
                    <span className="text-zinc-300">
                      {task.suggested_action.replace(/_/g, " ")}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {task.item_id && (
                    <Link
                      href="/recovery"
                      className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] font-semibold text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
                    >
                      Review →
                    </Link>
                  )}
                  <button
                    onClick={() => dismiss(task.id)}
                    disabled={dismissing.has(task.id)}
                    className="flex items-center gap-1 text-[10px] text-zinc-700 transition-colors hover:text-zinc-500 disabled:opacity-40"
                  >
                    <X className="h-2.5 w-2.5" />
                    Skip
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
