"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  AlertTriangle,
  Calendar,
  DollarSign,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { RecoveryActionDetail } from "@/lib/types";

const URGENCY_CONFIG = {
  immediate: {
    label: "Immediate",
    color: "text-[#FF2D95]",
    bg: "border-[#FF2D95]/30 bg-[#FF2D95]/5",
    icon: AlertTriangle,
  },
  this_week: {
    label: "This Week",
    color: "text-orange-400",
    bg: "border-orange-400/30 bg-orange-400/5",
    icon: Clock,
  },
  this_month: {
    label: "This Month",
    color: "text-zinc-400",
    bg: "border-zinc-700 bg-zinc-800/50",
    icon: Calendar,
  },
};

interface ActionCardProps {
  plan: RecoveryActionDetail;
}

function ActionCard({ plan }: ActionCardProps) {
  const [expanded, setExpanded] = useState(plan.urgency === "immediate");
  const config = URGENCY_CONFIG[plan.urgency];
  const UrgencyIcon = config.icon;

  return (
    <div className={`rounded-lg border ${config.bg}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <UrgencyIcon className={`h-4 w-4 ${config.color}`} />
            <h3 className="text-sm font-bold text-zinc-100">{plan.label}</h3>
            <span className={`text-xs font-bold uppercase tracking-wide ${config.color}`}>
              · {config.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {plan.items.length} listing{plan.items.length !== 1 ? "s" : ""} ·{" "}
            <span className="text-zinc-400">
              est. {formatCurrency(plan.estimated_cash_recovery)} recoverable
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 sm:flex">
            <DollarSign className="h-3 w-3 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400">
              {formatCurrency(plan.estimated_cash_recovery)}
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-zinc-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-600" />
          )}
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="border-t border-zinc-800/50 px-5 pb-5 pt-4">
          {/* Reasoning */}
          <p className="mb-4 text-sm leading-relaxed text-zinc-400">{plan.reasoning}</p>

          {/* Items */}
          <div className="space-y-2">
            {plan.items.map((item) => (
              <Link
                key={item.id}
                href={`/inventory/${item.id}`}
                className="flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3 transition-colors hover:border-zinc-700 hover:bg-zinc-800"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-300">{item.title}</p>
                  <p className="text-xs text-zinc-600">
                    {item.days_listed}d listed · {formatCurrency(item.price)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-zinc-500">
                    recover {formatCurrency(item.estimated_recovery)}
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      item.dead_inventory_score >= 75
                        ? "text-[#FF2D95]"
                        : item.dead_inventory_score >= 55
                        ? "text-orange-400"
                        : "text-yellow-400"
                    }`}
                  >
                    {item.dead_inventory_score}/100
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ActionCardsProps {
  plan: RecoveryActionDetail[];
}

export function ActionCards({ plan }: ActionCardsProps) {
  if (plan.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-12 text-center">
        <p className="text-sm text-zinc-600">
          No active inventory to generate a recovery plan for.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {plan.map((p) => (
        <ActionCard key={p.action} plan={p} />
      ))}
    </div>
  );
}
