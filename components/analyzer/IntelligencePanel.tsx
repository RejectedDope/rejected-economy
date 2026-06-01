"use client";

import {
  Activity,
  TrendingDown,
  AlertTriangle,
  ChevronRight,
  Zap,
  BarChart2,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  MarketplaceSignals,
  VelocityRiskLevel,
  DecayStage,
  FrictionLevel,
  PlatformFit,
  PromotionROI,
  RecoveryPriority,
} from "@/lib/marketplace-intelligence";

// ─── Color helpers ────────────────────────────────────────────────────────────

function velocityColor(level: VelocityRiskLevel): string {
  if (level === "accelerating") return "text-emerald-400";
  if (level === "steady") return "text-zinc-300";
  if (level === "decelerating") return "text-yellow-400";
  if (level === "stalled") return "text-orange-400";
  return "text-[#FF2D95]"; // dead
}

function velocityBg(level: VelocityRiskLevel): string {
  if (level === "accelerating") return "bg-emerald-400/10 border-emerald-400/30";
  if (level === "steady") return "bg-zinc-800 border-zinc-700";
  if (level === "decelerating") return "bg-yellow-400/10 border-yellow-400/30";
  if (level === "stalled") return "bg-orange-400/10 border-orange-400/30";
  return "bg-[#FF2D95]/10 border-[#FF2D95]/30";
}

function decayColor(stage: DecayStage): string {
  if (stage === "fresh") return "text-emerald-400";
  if (stage === "fading") return "text-yellow-400";
  if (stage === "suppressed") return "text-orange-400";
  if (stage === "buried") return "text-red-400";
  return "text-[#FF2D95]"; // zombie
}

function frictionColor(level: FrictionLevel): string {
  if (level === "none" || level === "low") return "text-emerald-400";
  if (level === "moderate") return "text-yellow-400";
  if (level === "high") return "text-orange-400";
  return "text-[#FF2D95]";
}

function platformFitColor(fit: PlatformFit): string {
  if (fit === "strong") return "text-emerald-400";
  if (fit === "moderate") return "text-yellow-400";
  return "text-orange-400";
}

function promotionColor(roi: PromotionROI): string {
  if (roi === "high") return "text-emerald-400";
  if (roi === "moderate") return "text-blue-400";
  if (roi === "low") return "text-zinc-500";
  return "text-zinc-600";
}

function priorityColor(p: RecoveryPriority): string {
  if (p === "critical") return "text-[#FF2D95]";
  if (p === "high") return "text-orange-400";
  if (p === "medium") return "text-yellow-400";
  return "text-zinc-500";
}

function priorityDot(p: RecoveryPriority): string {
  if (p === "critical") return "bg-[#FF2D95]";
  if (p === "high") return "bg-orange-400";
  if (p === "medium") return "bg-yellow-400";
  return "bg-zinc-600";
}

function effortImpactBadge(val: "low" | "medium" | "high", type: "effort" | "impact"): string {
  if (type === "effort") {
    if (val === "low") return "bg-emerald-400/10 text-emerald-400";
    if (val === "medium") return "bg-yellow-400/10 text-yellow-400";
    return "bg-orange-400/10 text-orange-400";
  }
  if (val === "high") return "bg-emerald-400/10 text-emerald-400";
  if (val === "medium") return "bg-yellow-400/10 text-yellow-400";
  return "bg-zinc-800 text-zinc-500";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatChip({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{label}</p>
      <p className={cn("mt-1 text-sm font-black", valueClass ?? "text-zinc-300")}>{value}</p>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-zinc-500" />
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{title}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface IntelligencePanelProps {
  signals: MarketplaceSignals;
  compact?: boolean;
}

export function IntelligencePanel({ signals, compact = false }: IntelligencePanelProps) {
  const { velocityRisk, visibilityDecay, pricingFriction, saturationScore, promotionPotential, conversionRisk, staleProbability, recoveryPriority } = signals;

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>

      {/* Section header */}
      {!compact && (
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-[#E935C1]" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
            Marketplace Diagnostics
          </h2>
        </div>
      )}

      {/* ── Signal Overview Row ────────────────────────────────────────────── */}
      <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
        <StatChip
          label="Velocity"
          value={capitalize(velocityRisk.level)}
          valueClass={velocityColor(velocityRisk.level)}
        />
        <StatChip
          label="Decay Stage"
          value={capitalize(visibilityDecay.stage)}
          valueClass={decayColor(visibilityDecay.stage)}
        />
        <StatChip
          label="Suppression"
          value={`${visibilityDecay.suppression_probability}%`}
          valueClass={
            visibilityDecay.suppression_probability >= 70
              ? "text-[#FF2D95]"
              : visibilityDecay.suppression_probability >= 40
              ? "text-orange-400"
              : "text-zinc-300"
          }
        />
        <StatChip
          label="Stale Risk"
          value={`${staleProbability}%`}
          valueClass={
            staleProbability >= 70 ? "text-[#FF2D95]" : staleProbability >= 40 ? "text-orange-400" : "text-zinc-300"
          }
        />
      </div>

      {/* ── Recovery Priority ─────────────────────────────────────────────── */}
      {recoveryPriority.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <SectionHeader icon={Zap} title="Recovery Priority" />
          <div className="space-y-3">
            {(compact ? recoveryPriority.slice(0, 3) : recoveryPriority).map((item, i) => (
              <div key={i} className="group">
                <div className="flex items-start gap-2.5">
                  <div className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", priorityDot(item.priority))} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("text-xs font-bold", priorityColor(item.priority))}>
                        {item.priority.toUpperCase()}
                      </span>
                      <span className="text-xs font-semibold text-zinc-200">{item.label}</span>
                    </div>
                    {!compact && (
                      <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{item.reasoning}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", effortImpactBadge(item.effort, "effort"))}>
                        {capitalize(item.effort)} effort
                      </span>
                      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", effortImpactBadge(item.impact, "impact"))}>
                        {capitalize(item.impact)} impact
                      </span>
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
                        {item.time_to_impact}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Friction Analysis ─────────────────────────────────────────────── */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <SectionHeader icon={ShieldAlert} title="Friction Analysis" />

        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn("text-sm font-black", frictionColor(pricingFriction.level))}>
              {capitalize(pricingFriction.level)}
            </span>
            <span className="text-xs text-zinc-600">friction</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  pricingFriction.score >= 70
                    ? "bg-[#FF2D95]"
                    : pricingFriction.score >= 50
                    ? "bg-orange-400"
                    : pricingFriction.score >= 30
                    ? "bg-yellow-400"
                    : "bg-emerald-400"
                )}
                style={{ width: `${pricingFriction.score}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-zinc-500">{pricingFriction.score}/100</span>
          </div>
        </div>

        {/* Friction flags */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {pricingFriction.price_rejection_signals && (
            <span className="rounded bg-[#FF2D95]/10 px-2 py-0.5 text-[10px] font-semibold text-[#FF2D95]">
              Price rejection
            </span>
          )}
          {pricingFriction.shipping_friction && (
            <span className="rounded bg-orange-400/10 px-2 py-0.5 text-[10px] font-semibold text-orange-400">
              Shipping friction
            </span>
          )}
          {pricingFriction.trust_gap && (
            <span className="rounded bg-yellow-400/10 px-2 py-0.5 text-[10px] font-semibold text-yellow-400">
              Trust gap
            </span>
          )}
          {!pricingFriction.price_rejection_signals && !pricingFriction.shipping_friction && !pricingFriction.trust_gap && (
            <span className="text-[11px] text-zinc-600">No significant friction signals detected</span>
          )}
        </div>

        {!compact && pricingFriction.recommendations.length > 0 && (
          <ul className="space-y-1.5">
            {pricingFriction.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-zinc-600" />
                <span className="text-[11px] leading-relaxed text-zinc-500">{rec}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Saturation + Promotion Row ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Saturation */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <SectionHeader icon={Activity} title="Saturation" />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-500">Platform fit</span>
              <span className={cn("text-[11px] font-bold", platformFitColor(saturationScore.platform_fit))}>
                {capitalize(saturationScore.platform_fit)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-500">Price competition</span>
              <span className={cn(
                "text-[11px] font-bold",
                saturationScore.price_tier_competition === "low" ? "text-emerald-400"
                  : saturationScore.price_tier_competition === "moderate" ? "text-yellow-400"
                  : "text-orange-400"
              )}>
                {capitalize(saturationScore.price_tier_competition)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-500">Score</span>
              <span className="text-[11px] font-bold text-zinc-400">{saturationScore.score}/100</span>
            </div>
          </div>
          {!compact && (
            <p className="mt-2.5 border-t border-zinc-800 pt-2.5 text-[10px] leading-relaxed text-zinc-600">
              {saturationScore.diagnosis}
            </p>
          )}
        </div>

        {/* Promotion */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <SectionHeader icon={TrendingDown} title="Promotion ROI" />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-500">ROI class</span>
              <span className={cn("text-[11px] font-bold", promotionColor(promotionPotential.roi_class))}>
                {capitalize(promotionPotential.roi_class).replace("_", " ")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-500">Est. visibility lift</span>
              <span className="text-[11px] font-bold text-zinc-400">
                {promotionPotential.estimated_visibility_lift > 0
                  ? `+${promotionPotential.estimated_visibility_lift}%`
                  : "—"}
              </span>
            </div>
            {promotionPotential.recommended_rate !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-500">Suggested rate</span>
                <span className="text-[11px] font-bold text-blue-400">
                  {Math.round(promotionPotential.recommended_rate * 100)}%
                </span>
              </div>
            )}
          </div>
          {!compact && (
            <p className="mt-2.5 border-t border-zinc-800 pt-2.5 text-[10px] leading-relaxed text-zinc-600">
              {promotionPotential.diagnosis}
            </p>
          )}
        </div>
      </div>

      {/* ── Conversion Barriers ───────────────────────────────────────────── */}
      {conversionRisk.barriers.length > 0 && !compact && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <SectionHeader icon={AlertTriangle} title="Conversion Barriers" />
          <div className="flex flex-wrap gap-2">
            {conversionRisk.barriers.map((b, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px]",
                  b.severity === "high"
                    ? "border-[#FF2D95]/20 bg-[#FF2D95]/5 text-zinc-300"
                    : b.severity === "medium"
                    ? "border-orange-400/20 bg-orange-400/5 text-zinc-400"
                    : "border-zinc-700 bg-zinc-800 text-zinc-500"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    b.severity === "high" ? "bg-[#FF2D95]" : b.severity === "medium" ? "bg-orange-400" : "bg-zinc-600"
                  )}
                />
                {b.label}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-zinc-600">Overall conversion risk</span>
            <span className={cn(
              "text-xs font-bold",
              conversionRisk.score >= 60 ? "text-[#FF2D95]" : conversionRisk.score >= 35 ? "text-orange-400" : "text-zinc-400"
            )}>
              {conversionRisk.score}/100
            </span>
          </div>
        </div>
      )}

      {/* ── Velocity Diagnosis ────────────────────────────────────────────── */}
      {!compact && (
        <div className={cn("rounded-lg border px-4 py-3", velocityBg(velocityRisk.level))}>
          <div className="flex items-start gap-2">
            <Activity className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", velocityColor(velocityRisk.level))} />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Velocity Diagnosis · {velocityRisk.signal}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">
                {velocityRisk.diagnosis}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
