"use client";

import Link from "next/link";
import { Flame, TrendingDown, AlertTriangle, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import type { ScoredItem } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type Props = {
  items: ScoredItem[];
};

type Tier = {
  label: string;
  daysMin: number;
  daysMax: number;
  icon: React.ElementType;
  textColor: string;
  borderColor: string;
  bgColor: string;
  actionHint: string;
};

const TIERS: Tier[] = [
  {
    label: "Fresh",
    daysMin: 0,
    daysMax: 13,
    icon: CheckCircle2,
    textColor: "text-emerald-400",
    borderColor: "border-emerald-400/20",
    bgColor: "bg-emerald-400/5",
    actionHint: "Hold — peak algorithm visibility",
  },
  {
    label: "Active",
    daysMin: 14,
    daysMax: 59,
    icon: TrendingDown,
    textColor: "text-zinc-400",
    borderColor: "border-zinc-700/50",
    bgColor: "bg-zinc-900",
    actionHint: "Monitor — within normal sell-through",
  },
  {
    label: "Slowing",
    daysMin: 60,
    daysMax: 89,
    icon: Clock,
    textColor: "text-yellow-400",
    borderColor: "border-yellow-400/20",
    bgColor: "bg-yellow-400/5",
    actionHint: "Act soon — approaching freshness cliff",
  },
  {
    label: "Stale",
    daysMin: 90,
    daysMax: 179,
    icon: AlertTriangle,
    textColor: "text-orange-400",
    borderColor: "border-orange-400/20",
    bgColor: "bg-orange-400/5",
    actionHint: "Markdown or relist — past the cliff",
  },
  {
    label: "Critical",
    daysMin: 180,
    daysMax: Infinity,
    icon: Flame,
    textColor: "text-[#FF2D95]",
    borderColor: "border-[#FF2D95]/20",
    bgColor: "bg-[#FF2D95]/5",
    actionHint: "Immediate action — deep decay",
  },
];

export function InventoryHealthDigest({ items }: Props) {
  if (items.length === 0) return null;

  const active = items.filter((i) => i.status === "active");

  const tiers = TIERS.map((tier) => {
    const inTier = active.filter(
      (i) => i.days_listed >= tier.daysMin && i.days_listed <= tier.daysMax
    );
    return {
      ...tier,
      count: inTier.length,
      value: inTier.reduce((s, i) => s + i.price, 0),
      pct: active.length > 0 ? Math.round((inTier.length / active.length) * 100) : 0,
    };
  });

  const actionableTiers = tiers.filter((t) => ["Slowing", "Stale", "Critical"].includes(t.label) && t.count > 0);

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <div className="flex items-center gap-2">
          <Flame className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Inventory Health
          </span>
        </div>
        {actionableTiers.length > 0 && (
          <Link
            href="/recovery"
            className="flex items-center gap-1 text-xs font-bold text-[#E935C1] hover:underline"
          >
            Recovery plan <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {/* Tier breakdown */}
      <div className="grid grid-cols-2 gap-0 divide-x divide-zinc-800 sm:grid-cols-5">
        {tiers.map((tier) => {
          const Icon = tier.icon;
          return (
            <div
              key={tier.label}
              className={`p-4 ${tier.count === 0 ? "opacity-40" : ""}`}
            >
              <div className="mb-2 flex items-center gap-1.5">
                <Icon className={`h-3 w-3 ${tier.textColor}`} />
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  {tier.label}
                </p>
              </div>
              <p className={`text-xl font-black ${tier.count > 0 ? tier.textColor : "text-zinc-700"}`}>
                {tier.count}
              </p>
              {tier.count > 0 && (
                <p className="mt-0.5 text-[10px] text-zinc-600">
                  {formatCurrency(tier.value)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Stacked progress bar */}
      {active.length > 0 && (
        <div className="flex h-1.5 overflow-hidden">
          {tiers.map((tier) =>
            tier.pct > 0 ? (
              <div
                key={tier.label}
                style={{ width: `${tier.pct}%` }}
                className={`h-full transition-all ${
                  tier.label === "Fresh" ? "bg-emerald-400" :
                  tier.label === "Active" ? "bg-zinc-600" :
                  tier.label === "Slowing" ? "bg-yellow-400" :
                  tier.label === "Stale" ? "bg-orange-400" :
                  "bg-[#FF2D95]"
                }`}
                title={`${tier.label}: ${tier.count} items (${tier.pct}%)`}
              />
            ) : null
          )}
        </div>
      )}

      {/* Actionable summary row */}
      {actionableTiers.length > 0 && (
        <div className="border-t border-zinc-800 px-5 py-2.5">
          <p className="text-[11px] text-zinc-500">
            {actionableTiers.map((t, i) => (
              <span key={t.label}>
                <span className={t.textColor}>{t.count} {t.label.toLowerCase()}</span>
                {i < actionableTiers.length - 1 ? " · " : ""}
              </span>
            ))}{" "}
            — needs attention. {formatCurrency(actionableTiers.reduce((s, t) => s + t.value, 0))} at risk.
          </p>
        </div>
      )}
    </div>
  );
}
