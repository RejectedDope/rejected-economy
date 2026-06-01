"use client";

import { useState } from "react";
import { CheckCircle2, RefreshCw, DollarSign, Archive, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScoredItem } from "@/lib/types";

interface RecoveryActionPanelProps {
  item: ScoredItem;
  onActionComplete?: (action: string, status: string) => void;
}

type ActionKey = "sold" | "relisted" | "liquidated" | "ended" | "snoozed";

const ACTIONS: Array<{
  key: ActionKey;
  label: string;
  description: string;
  icon: React.ElementType;
  className: string;
}> = [
  { key: "sold", label: "Mark Sold", description: "Item sold — record the outcome", icon: CheckCircle2, className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20" },
  { key: "relisted", label: "Relisted", description: "Fresh listing created (sell similar / relist)", icon: RefreshCw, className: "border-blue-400/30 bg-blue-400/10 text-blue-400 hover:bg-blue-400/20" },
  { key: "liquidated", label: "Liquidated", description: "Priced to move at clearance", icon: DollarSign, className: "border-yellow-400/30 bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20" },
  { key: "ended", label: "Ended", description: "Listing removed from platform", icon: Archive, className: "border-zinc-600/30 bg-zinc-800 text-zinc-400 hover:bg-zinc-700" },
  { key: "snoozed", label: "Snooze 7d", description: "Skip for now — revisit in a week", icon: Clock, className: "border-zinc-700 bg-zinc-900 text-zinc-500 hover:bg-zinc-800" },
];

const ACTION_MAP: Record<ActionKey, string> = {
  sold: "hold",
  relisted: "relist_now",
  liquidated: "liquidate",
  ended: "hold",
  snoozed: "hold",
};

const STATUS_MAP: Record<ActionKey, "completed" | "snoozed" | "skipped"> = {
  sold: "completed",
  relisted: "completed",
  liquidated: "completed",
  ended: "skipped",
  snoozed: "snoozed",
};

export function RecoveryActionPanel({ item, onActionComplete }: RecoveryActionPanelProps) {
  const [executing, setExecuting] = useState<ActionKey | null>(null);
  const [done, setDone] = useState<ActionKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [salePrice, setSalePrice] = useState<string>("");
  const [showSalePriceInput, setShowSalePriceInput] = useState(false);

  async function execute(key: ActionKey, recoveryAmount?: number) {
    setExecuting(key);
    setError(null);
    try {
      const { logRecoveryAction, updateItemStatus } = await import("@/app/actions/inventory");

      const outcome: "sold" | "still_active" | "ended" | "no_change" =
        key === "sold" ? "sold" :
        key === "ended" ? "ended" :
        key === "relisted" || key === "liquidated" ? "still_active" : "no_change";

      const snoozedMs = 7 * 24 * 60 * 60 * 1000;
      const snoozedUntil = key === "snoozed"
        ? new Date(new Date().getTime() + snoozedMs).toISOString()
        : undefined;

      // For sales, attribute to the item's own recommendation so was_recommended fires correctly
      const actionType = key === "sold"
        ? (item.primary_recovery_action ?? "hold")
        : ACTION_MAP[key];

      await logRecoveryAction(item.id, actionType, STATUS_MAP[key], {
        outcome,
        recoveryAmount,
        snoozedUntil,
        daysListed: item.days_listed,
        deadScore: item.dead_inventory_score,
        price: item.price,
      });

      if (key === "sold" || key === "ended") {
        await updateItemStatus(item.id, key === "sold" ? "sold" : "ended", recoveryAmount);
      }

      setDone(key);
      onActionComplete?.(actionType, STATUS_MAP[key]);
    } catch (err) {
      setError(String(err));
    } finally {
      setExecuting(null);
    }
  }

  function handleClick(key: ActionKey) {
    if (key === "sold" && !showSalePriceInput) {
      setShowSalePriceInput(true);
      return;
    }
    if (key === "sold" && showSalePriceInput) {
      const amount = salePrice ? parseFloat(salePrice) : item.price;
      execute("sold", isFinite(amount) ? amount : item.price);
      setShowSalePriceInput(false);
      return;
    }
    execute(key);
  }

  if (done) {
    const action = ACTIONS.find((a) => a.key === done)!;
    return (
      <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-bold text-zinc-200">{action.label} recorded</p>
            <p className="text-xs text-zinc-500">Outcome logged to recovery history</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        Record Recovery Action
      </p>

      {showSalePriceInput && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm text-zinc-400">Sale price:</span>
          <div className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1">
            <span className="text-xs text-zinc-500">$</span>
            <input
              type="number"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              placeholder={String(item.price)}
              className="w-20 bg-transparent text-sm text-zinc-200 outline-none"
              autoFocus
            />
          </div>
          <button
            onClick={() => setShowSalePriceInput(false)}
            className="rounded p-1 text-zinc-600 hover:text-zinc-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const isRunning = executing === action.key;
          return (
            <button
              key={action.key}
              onClick={() => handleClick(action.key)}
              disabled={!!executing}
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-50",
                action.className,
                (showSalePriceInput && action.key === "sold") && "ring-1 ring-emerald-400"
              )}
            >
              <div className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="text-xs font-bold">
                  {isRunning ? "Saving…" : action.label}
                </span>
              </div>
              <span className="text-[10px] opacity-70">{action.description}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
