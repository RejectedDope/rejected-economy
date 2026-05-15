"use client";

import { AlertTriangle, TrendingDown, Zap, Package } from "lucide-react";
import type { DashboardStats, ScoredItem } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface InsightCardsProps {
  stats: DashboardStats;
  items: ScoredItem[];
}

export function InsightCards({ stats, items }: InsightCardsProps) {
  const criticalItems = items.filter((i) => i.visibility_risk === "Critical");
  const missingSpecifics = items.filter(
    (i) => !i.item_specifics_complete && i.status === "active"
  );
  const over180 = items.filter(
    (i) => i.days_listed > 180 && i.status === "active"
  );
  const recoverable = items
    .filter((i) => i.status === "active")
    .reduce((sum, i) => sum + i.estimated_recovery, 0);

  const insights = [
    {
      icon: AlertTriangle,
      color: "text-[#FF2D95]",
      bg: "border-[#FF2D95]/20 bg-[#FF2D95]/5",
      title: "Death Pile Alert",
      body:
        criticalItems.length > 0
          ? `${criticalItems.length} listings are in critical decay. These items are functionally invisible on platform search. Immediate action required — every day they sit costs you shelf space AND algorithm equity.`
          : "No critical listings right now. Stay on top of your aging inventory to keep it this way.",
    },
    {
      icon: TrendingDown,
      color: "text-orange-400",
      bg: "border-orange-400/20 bg-orange-400/5",
      title: "Stale Traffic Warning",
      body:
        missingSpecifics.length > 0
          ? `${missingSpecifics.length} listings are missing item specifics. eBay's Cassini algorithm downranks incomplete listings — buyers using filters will never see these. Quick fix, big impact.`
          : "All listings have item specifics filled. Good discipline — keep it up on new listings.",
    },
    {
      icon: Zap,
      color: "text-yellow-400",
      bg: "border-yellow-400/20 bg-yellow-400/5",
      title: "Recoverable Cash",
      body: `Based on current pricing and listing age, you can realistically recover ${formatCurrency(recoverable)} by executing the suggested actions. That's not found money — it's already yours, just buried.`,
    },
    {
      icon: Package,
      color: "text-zinc-400",
      bg: "border-zinc-700 bg-zinc-800/50",
      title: "Long-Term Holders",
      body:
        over180.length > 0
          ? `${over180.length} items have been listed for 6+ months. These aren't investments — they're clutter. Either relist fresh, markdown aggressively, or liquidate. Carrying cost is real.`
          : "No items over 180 days. Clean operation.",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {insights.map(({ icon: Icon, color, bg, title, body }) => (
        <div key={title} className={`rounded-lg border p-5 ${bg}`}>
          <div className="flex items-start gap-3">
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
            <div>
              <h4 className={`text-sm font-bold uppercase tracking-wide ${color}`}>
                {title}
              </h4>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{body}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
