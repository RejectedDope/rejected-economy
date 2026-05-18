"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  AlertCircle,
  Info,
  TrendingDown,
  CheckCircle,
  Eye,
  Heart,
  Calendar,
  DollarSign,
} from "lucide-react";
import { MOCK_ITEMS } from "@/lib/mock-data";
import { scoreItem } from "@/lib/scoring";
import { analyzeItem } from "@/lib/recovery-engine";
import { analyzeMarketplaceSignals } from "@/lib/marketplace-intelligence";
import { IntelligencePanel } from "@/components/analyzer/IntelligencePanel";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatCurrencyDecimal } from "@/lib/utils";
import type { WarningSignal } from "@/lib/types";

const ACTION_LABELS: Record<string, string> = {
  relist_now: "Relist Now",
  strategic_markdown: "Strategic Markdown",
  bundle: "Bundle It",
  move_platform: "Move Platform",
  optimize_specifics: "Fix Item Specifics",
  add_photos: "Add Photos",
  liquidate: "Liquidate",
  hold: "Hold — Monitor",
};

function WarningSignalCard({ signal }: { signal: WarningSignal }) {
  const borderClass =
    signal.severity === "critical"
      ? "border-l-[#FF2D95]"
      : signal.severity === "danger"
      ? "border-l-orange-500"
      : signal.severity === "warning"
      ? "border-l-yellow-500"
      : "border-l-zinc-600";

  const IconComponent =
    signal.severity === "critical" || signal.severity === "danger"
      ? AlertTriangle
      : signal.severity === "warning"
      ? AlertCircle
      : Info;

  const iconClass =
    signal.severity === "critical"
      ? "text-[#FF2D95]"
      : signal.severity === "danger"
      ? "text-orange-400"
      : signal.severity === "warning"
      ? "text-yellow-400"
      : "text-zinc-500";

  return (
    <div
      className={`rounded-md border border-zinc-800 bg-zinc-950 p-3 border-l-2 ${borderClass}`}
    >
      <div className="flex items-start gap-2.5">
        <IconComponent className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-zinc-200">{signal.title}</p>
            {signal.metric && (
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">
                {signal.metric}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-zinc-400">{signal.body}</p>
        </div>
      </div>
    </div>
  );
}

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();

  const item = useMemo(() => {
    const found = MOCK_ITEMS.find((i) => i.id === id);
    if (!found) return null;
    return scoreItem(found);
  }, [id]);

  const analysis = useMemo(() => {
    if (!item) return null;
    return analyzeItem(item);
  }, [item]);

  const intelligence = useMemo(() => {
    if (!item) return null;
    return analyzeMarketplaceSignals(item);
  }, [item]);

  if (!item || !analysis || !intelligence) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <p className="text-lg font-bold text-zinc-400">Item not found</p>
          <Link href="/inventory" className="mt-4 text-sm text-[#E935C1]">
            ← Back to inventory
          </Link>
        </div>
      </div>
    );
  }

  const healthColor =
    item.listing_health_score >= 70
      ? "bg-emerald-400"
      : item.listing_health_score >= 40
      ? "bg-yellow-400"
      : "bg-[#FF2D95]";

  const pricingRiskColor =
    analysis.pricing_risk === "Critical"
      ? "bg-red-500/10 border-red-500/30 text-red-400"
      : analysis.pricing_risk === "High"
      ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
      : analysis.pricing_risk === "Medium"
      ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
      : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";

  const velocityColor =
    analysis.sell_through_velocity === "Fast"
      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
      : analysis.sell_through_velocity === "Normal"
      ? "bg-zinc-800 border-zinc-700 text-zinc-400"
      : analysis.sell_through_velocity === "Slow"
      ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
      : "bg-red-500/10 border-red-500/30 text-red-400";

  const saturationColor =
    analysis.competition_saturation === "High"
      ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
      : analysis.competition_saturation === "Medium"
      ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
      : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";

  const lift =
    analysis.recovery_probability - analysis.sell_through_probability;

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      {/* Back */}
      <Link
        href="/inventory"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Inventory
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left Column (2/3) ─────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Item Header Card */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-bold text-zinc-100 leading-snug">
                  {item.title}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="text-sm text-zinc-500">{item.platform}</span>
                  <span className="text-zinc-700">·</span>
                  <span className="text-sm text-zinc-500">{item.category}</span>
                  <span className="text-zinc-700">·</span>
                  <span className="text-sm font-semibold text-zinc-300">
                    {formatCurrency(item.price)}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Badge
                  variant={
                    item.visibility_risk.toLowerCase() as
                      | "critical"
                      | "high"
                      | "medium"
                      | "low"
                  }
                >
                  {item.visibility_risk}
                </Badge>
                <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                  active
                </span>
              </div>
            </div>
          </div>

          {/* Engagement Metrics Row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                icon: Eye,
                label: "Views",
                value: item.views.toLocaleString(),
              },
              {
                icon: Heart,
                label: "Watchers",
                value: item.watchers.toLocaleString(),
              },
              {
                icon: Calendar,
                label: "Days Listed",
                value: `${item.days_listed}d`,
              },
              {
                icon: DollarSign,
                label: "Est. Recovery",
                value: formatCurrencyDecimal(analysis.estimated_recovery),
              },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon className="h-3 w-3 text-zinc-600" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-600">
                    {label}
                  </span>
                </div>
                <p className="text-base font-black text-zinc-200">{value}</p>
              </div>
            ))}
          </div>

          {/* Warning Signals */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#E935C1]" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
                Listing Signals
              </h2>
            </div>

            {analysis.warning_signals.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-md border border-emerald-800/40 bg-emerald-900/10 p-3">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
                <p className="text-sm font-semibold text-emerald-300">
                  No critical issues detected
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {analysis.warning_signals.map((signal) => (
                  <WarningSignalCard key={signal.code} signal={signal} />
                ))}
              </div>
            )}
          </div>

          {/* Recovery Probability Simulation */}
          <div className="rounded-lg border border-[#E935C1]/25 bg-[#E935C1]/5 p-6">
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[#E935C1]">
              Recovery Simulation
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">
                  Without changes
                </span>
                <span className="text-sm font-black text-zinc-300">
                  {analysis.sell_through_probability}% sell-through probability
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">
                  After{" "}
                  <span className="font-semibold text-zinc-200">
                    {analysis.platform_guidance.title}
                  </span>
                </span>
                <span className="text-sm font-black text-emerald-400">
                  {analysis.recovery_probability}% sell-through probability
                </span>
              </div>
              <div className="border-t border-[#E935C1]/20 pt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-300">
                  Lift
                </span>
                <span className="text-sm font-black text-emerald-400">
                  +{lift} percentage points
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">
                  Estimated time to sale
                </span>
                <span className="text-sm font-bold text-zinc-300">
                  {analysis.estimated_days_to_sale} days after action
                </span>
              </div>
            </div>
          </div>
          {/* Marketplace Diagnostics */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <IntelligencePanel signals={intelligence} />
          </div>
        </div>

        {/* ── Right Column (1/3) ────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Score Summary */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-600">
              Performance Scores
            </h2>
            <div className="space-y-5">

              {/* Dead score */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-400">
                    Dead Inventory Score
                  </span>
                  <span
                    className={`text-sm font-black ${
                      item.dead_inventory_score >= 75
                        ? "text-[#FF2D95]"
                        : item.dead_inventory_score >= 55
                        ? "text-orange-400"
                        : item.dead_inventory_score >= 30
                        ? "text-yellow-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {item.dead_inventory_score}/100
                  </span>
                </div>
                <Progress
                  value={item.dead_inventory_score}
                  className="h-2"
                  indicatorClassName={
                    item.dead_inventory_score >= 75
                      ? "bg-[#FF2D95]"
                      : item.dead_inventory_score >= 55
                      ? "bg-orange-400"
                      : item.dead_inventory_score >= 30
                      ? "bg-yellow-400"
                      : "bg-emerald-400"
                  }
                />
                <p className="mt-1 text-[11px] text-zinc-600">
                  Higher = more dead. Based on age + listing quality.
                </p>
              </div>

              {/* Health score */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-400">
                    Listing Health Score
                  </span>
                  <span className="text-sm font-black text-zinc-300">
                    {item.listing_health_score}/100
                  </span>
                </div>
                <Progress
                  value={item.listing_health_score}
                  className="h-2"
                  indicatorClassName={healthColor}
                />
                <p className="mt-1 text-[11px] text-zinc-600">
                  Photos, specifics, title, freshness.
                </p>
              </div>

              {/* Title keyword strength */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-400">
                    Title Keyword Strength
                  </span>
                  <span className="text-sm font-black text-zinc-300">
                    {item.title_keyword_strength}/100
                  </span>
                </div>
                <Progress
                  value={item.title_keyword_strength}
                  className="h-2"
                  indicatorClassName="bg-blue-400"
                />
              </div>
            </div>
          </div>

          {/* Primary Recovery Action */}
          <div className="rounded-lg border border-[#E935C1]/30 bg-[#E935C1]/5 p-6">
            <div className="mb-3 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-[#E935C1]" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#E935C1]">
                Recommended Action
              </h2>
            </div>

            <p className="text-base font-black text-zinc-100">
              {analysis.platform_guidance.title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              {analysis.platform_guidance.overview}
            </p>

            <div className="mt-4 rounded-md border border-zinc-700 bg-zinc-900 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-600">
                Steps
              </p>
              <ol className="space-y-2.5">
                {analysis.platform_guidance.steps.map((step, i) => (
                  <li
                    key={i}
                    className={`${
                      step.critical
                        ? "rounded-sm border-l-2 border-[#E935C1] pl-2"
                        : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[9px] font-bold text-zinc-500">
                        {i + 1}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {step.instruction}
                      </span>
                    </div>
                    {step.note && (
                      <p className="ml-6 mt-0.5 text-xs text-zinc-600">
                        {step.note}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-3 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-zinc-500">Est. recovery</span>
                  {analysis.platform_guidance.estimated_time_to_outcome && (
                    <p className="text-[10px] text-zinc-600">
                      {analysis.platform_guidance.estimated_time_to_outcome}
                    </p>
                  )}
                </div>
                <span className="text-sm font-black text-emerald-400">
                  {formatCurrencyDecimal(analysis.estimated_recovery)}
                </span>
              </div>
            </div>
          </div>

          {/* Platform Tips */}
          {analysis.platform_guidance.platform_tips.length > 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-600">
                Platform Tips
              </p>
              <ul className="space-y-2">
                {analysis.platform_guidance.platform_tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="shrink-0 text-[#E935C1] font-bold leading-tight">
                      ·
                    </span>
                    <span className="text-xs text-zinc-500">{tip}</span>
                  </li>
                ))}
              </ul>
              {analysis.platform_guidance.timing_tip && (
                <p className="mt-3 border-t border-zinc-800 pt-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                  {analysis.platform_guidance.timing_tip}
                </p>
              )}
            </div>
          )}

          {/* Secondary Actions */}
          {analysis.secondary_actions.length > 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-600">
                Also Consider
              </p>
              <div className="flex flex-wrap gap-2">
                {analysis.secondary_actions.map((action) => (
                  <span
                    key={action}
                    className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-400"
                  >
                    {ACTION_LABELS[action] ?? action}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Market Signals */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-600">
              Market Signals
            </p>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Pricing Risk</span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${pricingRiskColor}`}
                >
                  {analysis.pricing_risk}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Saturation</span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${saturationColor}`}
                >
                  {analysis.competition_saturation}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Sell-Through Velocity</span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${velocityColor}`}
                >
                  {analysis.sell_through_velocity}
                </span>
              </div>
            </div>
          </div>

          {/* Full Recovery Plan link */}
          <Link
            href="/recovery"
            className="block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-center text-sm font-semibold text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
          >
            View Full Recovery Plan →
          </Link>
        </div>
      </div>
    </div>
  );
}
