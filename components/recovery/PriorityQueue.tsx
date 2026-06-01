"use client";

import { useState } from "react";
import Link from "next/link";
import { Zap, ArrowRight, CheckSquare, Square, CheckCircle2, RefreshCw, Clock, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import type { PrioritizedItem } from "@/lib/inventory/prioritization";
import { RecoveryQuickActions } from "./RecoveryQuickActions";

const ACTION_LABELS: Record<string, string> = {
  relist_now:          "Relist Now",
  sell_similar:        "Sell Similar",
  strategic_markdown:  "Markdown",
  title_rewrite:       "Rewrite Title",
  bundle:              "Bundle",
  move_platform:       "Move Platform",
  optimize_specifics:  "Fix Specifics",
  add_photos:          "Add Photos",
  liquidate:           "Liquidate",
  hold:                "Hold",
};

function urgencyClass(score: number): string {
  if (score >= 60) return "text-[#FF2D95] border-[#FF2D95]/30 bg-[#FF2D95]/10";
  if (score >= 40) return "text-orange-400 border-orange-400/30 bg-orange-400/10";
  if (score >= 20) return "text-yellow-400 border-yellow-400/30 bg-yellow-400/10";
  return "text-zinc-500 border-zinc-700 bg-zinc-800";
}


interface PriorityQueueProps {
  items: PrioritizedItem[];
  limit?: number;
}

type BulkAction = "sold" | "relisted" | "snoozed";

export function PriorityQueue({ items, limit = 10 }: PriorityQueueProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState<BulkAction | null>(null);
  const [bulkDoneCount, setBulkDoneCount] = useState(0);

  const activeItems = items.filter((i) => !dismissed.has(i.item.id));
  if (activeItems.length === 0) return null;

  const displayed = activeItems.slice(0, limit);
  const quickWins = activeItems.filter((i) => i.is_quick_win);
  const selectedCount = selected.size;
  const allDisplayedSelected = displayed.length > 0 && displayed.every((i) => selected.has(i.item.id));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allDisplayedSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayed.map((i) => i.item.id)));
    }
  }

  async function runBulkAction(action: BulkAction) {
    if (bulkPending || selected.size === 0) return;
    setBulkPending(action);
    setBulkDoneCount(0);

    const ids = Array.from(selected);
    const status = action === "sold" ? "sold" : action === "relisted" ? "relisted" : "active";

    try {
      const { updateItemStatus } = await import("@/app/actions/inventory");
      let done = 0;
      for (const id of ids) {
        const result = await updateItemStatus(id, status as "sold" | "relisted" | "active");
        if (result.ok) {
          done++;
          setBulkDoneCount(done);
          setDismissed((prev) => new Set([...prev, id]));
        }
      }
      setSelected(new Set());
    } finally {
      setBulkPending(null);
    }
  }

  return (
    <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-[#E935C1]" />
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
            Recovery Priority Queue
          </span>
          <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
            {activeItems.length} items
          </span>
        </div>
        {quickWins.length > 0 && (
          <span className="rounded-full border border-[#E935C1]/30 bg-[#E935C1]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#E935C1]">
            {quickWins.length} quick win{quickWins.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Bulk action toolbar — appears when items are selected */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between border-b border-zinc-700/60 bg-zinc-800/60 px-5 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-300">
              {selectedCount} selected
            </span>
            <button
              onClick={() => setSelected(new Set())}
              className="text-zinc-600 hover:text-zinc-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {bulkPending && (
              <span className="text-[10px] text-zinc-500">
                {bulkDoneCount}/{selectedCount}…
              </span>
            )}
            <button
              onClick={() => runBulkAction("sold")}
              disabled={!!bulkPending}
              className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {bulkPending === "sold" ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
              Mark Sold
            </button>
            <button
              onClick={() => runBulkAction("relisted")}
              disabled={!!bulkPending}
              className="flex items-center gap-1 rounded border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold text-blue-400 transition-colors hover:bg-blue-500/20 disabled:opacity-50"
            >
              {bulkPending === "relisted" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Relist
            </button>
            <button
              onClick={() => runBulkAction("snoozed")}
              disabled={!!bulkPending}
              className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[10px] font-bold text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300 disabled:opacity-50"
            >
              {bulkPending === "snoozed" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock className="h-3 w-3" />}
              Snooze
            </button>
          </div>
        </div>
      )}

      {/* Column header with select-all */}
      <div className="flex items-center gap-4 border-b border-zinc-800/40 bg-zinc-900/60 px-5 py-2">
        <button
          onClick={toggleSelectAll}
          className="shrink-0 text-zinc-600 hover:text-zinc-400 transition-colors"
          title={allDisplayedSelected ? "Deselect all" : "Select all"}
        >
          {allDisplayedSelected
            ? <CheckSquare className="h-4 w-4 text-[#E935C1]" />
            : <Square className="h-4 w-4" />}
        </button>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-700 flex-1">Item</span>
        <span className="hidden text-[10px] font-bold uppercase tracking-widest text-zinc-700 sm:block">Score</span>
        <span className="hidden text-[10px] font-bold uppercase tracking-widest text-zinc-700 sm:block w-24">Action</span>
        <span className="hidden text-[10px] font-bold uppercase tracking-widest text-zinc-700 sm:block w-20 text-right">Recovery</span>
        <span className="w-28 hidden sm:block" />
      </div>

      {/* Queue rows */}
      <div className="divide-y divide-zinc-800/60">
        {displayed.map((prioritized, idx) => {
          const item = prioritized.item;
          const actionLabel = ACTION_LABELS[prioritized.action] ?? prioritized.action;
          const isSelected = selected.has(item.id);

          return (
            <div
              key={item.id}
              className={cn(
                "group flex items-center gap-4 px-5 py-3.5 transition-colors",
                isSelected ? "bg-[#E935C1]/5" : "hover:bg-zinc-800/50"
              )}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleSelect(item.id)}
                className="shrink-0 text-zinc-600 hover:text-[#E935C1] transition-colors"
              >
                {isSelected
                  ? <CheckSquare className="h-4 w-4 text-[#E935C1]" />
                  : <Square className="h-4 w-4" />}
              </button>

              {/* Rank */}
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-500 group-hover:bg-zinc-700">
                {idx + 1}
              </span>

              {/* Title + reasoning — links to item detail */}
              <Link href={`/inventory/${item.id}`} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-zinc-200 max-w-[280px]">
                    {item.title}
                  </p>
                  {prioritized.is_quick_win && (
                    <span className="shrink-0 rounded bg-[#E935C1]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#E935C1]">
                      Quick Win
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                  {prioritized.reasoning}
                </p>
              </Link>

              {/* Metrics */}
              <div className="hidden items-center gap-3 sm:flex">
                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", urgencyClass(prioritized.urgency_score))}>
                  {prioritized.urgency_score}
                </span>
                <span className="w-24 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-center text-[10px] font-semibold text-zinc-400">
                  {actionLabel}
                </span>
                <span className="w-20 text-right text-xs font-bold text-emerald-400">
                  {formatCurrency(prioritized.estimated_recovery)}
                </span>
              </div>

              {/* Per-item quick actions */}
              <div className="hidden sm:block shrink-0">
                <RecoveryQuickActions
                  item={item}
                  onDone={(itemId) => {
                    setDismissed((prev) => new Set([...prev, itemId]));
                    setSelected((prev) => { const n = new Set(prev); n.delete(itemId); return n; });
                  }}
                />
              </div>

              <Link href={`/inventory/${item.id}`}>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-700 transition-colors group-hover:text-zinc-500" />
              </Link>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {activeItems.length > limit && (
        <div className="border-t border-zinc-800 px-5 py-3 text-center">
          <p className="text-xs text-zinc-600">
            Showing {limit} of {activeItems.length} items.{" "}
            <Link href="/inventory" className="text-[#E935C1] hover:underline">
              View all in inventory →
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
