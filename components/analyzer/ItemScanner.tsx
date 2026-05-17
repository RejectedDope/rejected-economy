"use client";

import { useState, useMemo } from "react";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  ArrowRight,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { scoreItem, RISK_COLORS, RISK_BG } from "@/lib/scoring";
import { analyzeItem } from "@/lib/recovery-engine";
import { cn, formatCurrencyDecimal } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type {
  Platform,
  ShippingType,
  InventoryItem,
  VisibilityRisk,
  RecoveryAction,
} from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS: Platform[] = [
  "eBay",
  "Poshmark",
  "Mercari",
  "Depop",
  "Facebook Marketplace",
  "StockX",
  "GOAT",
  "Whatnot",
  "Grailed",
  "Other",
];

const SHIPPING_OPTIONS: { value: ShippingType; label: string }[] = [
  { value: "free", label: "Free Shipping" },
  { value: "calculated", label: "Calculated" },
  { value: "flat", label: "Flat Rate" },
  { value: "local_pickup", label: "Local Pickup" },
];

const ACTION_LABELS: Record<RecoveryAction, string> = {
  relist_now:          "Relist Now",
  sell_similar:        "Use Sell Similar",
  strategic_markdown:  "Strategic Markdown",
  title_rewrite:       "Rewrite Title",
  bundle:              "Bundle It",
  move_platform:       "Move Platform",
  optimize_specifics:  "Fix Item Specifics",
  add_photos:          "Add More Photos",
  liquidate:           "Liquidate",
  hold:                "Hold — Monitor",
};

// ─── Form State ───────────────────────────────────────────────────────────────

interface FormState {
  title: string;
  platform: Platform;
  category: string;
  price: number;
  days_listed: number;
  image_count: number;
  title_keyword_strength: number;
  item_specifics_complete: boolean;
  has_promoted_listing: boolean;
  shipping_type: ShippingType;
  views: number;
  watchers: number;
}

const DEFAULT_FORM: FormState = {
  title: "",
  platform: "eBay",
  category: "",
  price: 50,
  days_listed: 45,
  image_count: 3,
  title_keyword_strength: 55,
  item_specifics_complete: false,
  has_promoted_listing: false,
  shipping_type: "calculated",
  views: 0,
  watchers: 0,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-600">
      {children}
    </p>
  );
}

function FieldWrapper({
  label,
  children,
  fullWidth,
}: {
  label: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "col-span-2" : ""}>
      <label className="mb-1.5 block text-xs font-semibold text-zinc-400">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition-colors focus:border-[#E935C1]/60 focus:ring-1 focus:ring-[#E935C1]/20";

const selectCls =
  "w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none transition-colors focus:border-[#E935C1]/60 focus:ring-1 focus:ring-[#E935C1]/20 appearance-none";

// ─── Dead Score Display ────────────────────────────────────────────────────────

function deadScoreColor(score: number): string {
  if (score >= 75) return "text-[#FF2D95]";
  if (score >= 50) return "text-orange-400";
  if (score >= 30) return "text-yellow-400";
  return "text-emerald-400";
}

// ─── Visibility Risk Badge variant ───────────────────────────────────────────

function riskBadgeVariant(
  risk: VisibilityRisk
): "critical" | "high" | "medium" | "low" {
  const map: Record<VisibilityRisk, "critical" | "high" | "medium" | "low"> = {
    Critical: "critical",
    High: "high",
    Medium: "medium",
    Low: "low",
  };
  return map[risk];
}

// ─── Warning Signal Icon ──────────────────────────────────────────────────────

function SignalIcon({ severity }: { severity: string }) {
  if (severity === "critical" || severity === "danger") {
    return (
      <AlertTriangle
        className={cn(
          "mt-0.5 h-3.5 w-3.5 shrink-0",
          severity === "critical" ? "text-[#FF2D95]" : "text-orange-400"
        )}
      />
    );
  }
  if (severity === "warning") {
    return (
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-400" />
    );
  }
  return <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />;
}

function signalTitleColor(severity: string): string {
  if (severity === "critical") return "text-[#FF2D95]";
  if (severity === "danger") return "text-orange-400";
  if (severity === "warning") return "text-yellow-400";
  return "text-zinc-400";
}

// ─── Health Bar ───────────────────────────────────────────────────────────────

function HealthBar({ score }: { score: number }) {
  let barColor = "bg-emerald-400";
  if (score < 30) barColor = "bg-[#FF2D95]";
  else if (score < 50) barColor = "bg-orange-400";
  else if (score < 70) barColor = "bg-yellow-400";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">Listing Health Score</span>
        <span className="text-xs font-bold text-zinc-300">{score}/100</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// ─── Checkbox Toggle ──────────────────────────────────────────────────────────

function CheckToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <div
        onClick={() => onChange(!checked)}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
          checked
            ? "border-[#E935C1] bg-[#E935C1]/20"
            : "border-zinc-600 bg-zinc-800"
        )}
      >
        {checked && <CheckCircle2 className="h-3.5 w-3.5 text-[#E935C1]" />}
      </div>
      <span className="text-xs font-semibold text-zinc-400">{label}</span>
    </label>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ItemScanner() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Build InventoryItem + run scoring + analysis on every render (all sync)
  const { analysis, scored } = useMemo(() => {
    const item: InventoryItem = {
      id: "scanner-preview",
      user_id: "demo",
      title: form.title || "Untitled Listing",
      platform: form.platform,
      category: form.category || "Uncategorized",
      price: form.price,
      days_listed: form.days_listed,
      image_count: form.image_count,
      item_specifics_complete: form.item_specifics_complete,
      title_keyword_strength: form.title_keyword_strength,
      has_promoted_listing: form.has_promoted_listing,
      shipping_type: form.shipping_type,
      views: form.views,
      watchers: form.watchers,
      impressions: form.views,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const scored = scoreItem(item);
    const analysis = analyzeItem(scored);
    return { scored, analysis };
  }, [form]);

  const deadScore = analysis.dead_risk_score;
  const healthScore = analysis.listing_health_score;
  const primaryActionLabel = ACTION_LABELS[analysis.primary_action] ?? analysis.primary_action;
  const lift = analysis.recovery_probability - analysis.sell_through_probability;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* ── Left: Form ─────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <SectionLabel>Listing Details</SectionLabel>

        <div className="grid grid-cols-2 gap-4">
          {/* Title — full width */}
          <FieldWrapper label="Listing Title" fullWidth>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Nike Air Jordan 1 Retro High OG Chicago 2022 DS"
              className={inputCls}
            />
          </FieldWrapper>

          {/* Platform */}
          <FieldWrapper label="Platform">
            <select
              value={form.platform}
              onChange={(e) => set("platform", e.target.value as Platform)}
              className={selectCls}
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </FieldWrapper>

          {/* Category */}
          <FieldWrapper label="Category">
            <input
              type="text"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder="e.g. Sneakers"
              className={inputCls}
            />
          </FieldWrapper>

          {/* Price */}
          <FieldWrapper label="Asking Price ($)">
            <input
              type="number"
              value={form.price}
              min={0}
              step={0.01}
              onChange={(e) => set("price", parseFloat(e.target.value) || 0)}
              className={inputCls}
            />
          </FieldWrapper>

          {/* Days Listed */}
          <FieldWrapper label="Days Listed">
            <input
              type="number"
              value={form.days_listed}
              min={0}
              onChange={(e) =>
                set("days_listed", parseInt(e.target.value) || 0)
              }
              className={inputCls}
            />
          </FieldWrapper>

          {/* Photo Count */}
          <FieldWrapper label="Photo Count">
            <input
              type="number"
              value={form.image_count}
              min={1}
              max={24}
              onChange={(e) =>
                set("image_count", Math.max(1, Math.min(24, parseInt(e.target.value) || 1)))
              }
              className={inputCls}
            />
          </FieldWrapper>

          {/* Title Keyword Strength — full width slider */}
          <div className="col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-zinc-400">
              Title Keyword Strength
              <span className="ml-2 font-bold text-zinc-200">
                {form.title_keyword_strength}
              </span>
              <span className="text-zinc-600">/100</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={form.title_keyword_strength}
              onChange={(e) =>
                set("title_keyword_strength", parseInt(e.target.value))
              }
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-[#E935C1]"
            />
            <div className="mt-1 flex justify-between text-[10px] text-zinc-700">
              <span>Weak</span>
              <span>Strong</span>
            </div>
          </div>

          {/* Shipping */}
          <FieldWrapper label="Shipping">
            <select
              value={form.shipping_type}
              onChange={(e) =>
                set("shipping_type", e.target.value as ShippingType)
              }
              className={selectCls}
            >
              {SHIPPING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FieldWrapper>

          {/* Views */}
          <FieldWrapper label="Total Views">
            <input
              type="number"
              value={form.views}
              min={0}
              onChange={(e) => set("views", parseInt(e.target.value) || 0)}
              className={inputCls}
            />
          </FieldWrapper>

          {/* Watchers */}
          <FieldWrapper label="Watchers">
            <input
              type="number"
              value={form.watchers}
              min={0}
              onChange={(e) => set("watchers", parseInt(e.target.value) || 0)}
              className={inputCls}
            />
          </FieldWrapper>

          {/* Toggles — full width row */}
          <div className="col-span-2 flex flex-wrap gap-6 pt-1">
            <CheckToggle
              label="Item Specifics Complete"
              checked={form.item_specifics_complete}
              onChange={(v) => set("item_specifics_complete", v)}
            />
            <CheckToggle
              label="Promoted Listing"
              checked={form.has_promoted_listing}
              onChange={(v) => set("has_promoted_listing", v)}
            />
          </div>
        </div>
      </div>

      {/* ── Right: Live Analysis ────────────────────────────────────────────── */}
      <div className="space-y-4">

        {/* 1. Dead Inventory Score + Health */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">
                Dead Inventory Score
              </p>
              <p className={cn("mt-1 text-5xl font-black tabular-nums", deadScoreColor(deadScore))}>
                {deadScore}
                <span className="ml-1 text-xl font-bold text-zinc-600">/100</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">
                Visibility Risk
              </p>
              <div className="mt-1.5">
                <Badge variant={riskBadgeVariant(analysis.visibility_risk)}>
                  {analysis.visibility_risk}
                </Badge>
              </div>
            </div>
          </div>

          {/* Health bar */}
          <HealthBar score={healthScore} />
        </div>

        {/* 2. Sell-Through vs Recovery Probability */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-600">
            Sell-Through Probability
          </p>
          <div className="flex items-center gap-3">
            {/* Without action */}
            <div className="flex-1 rounded-md border border-zinc-800 bg-zinc-950 p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                Without Action
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums text-zinc-400">
                {analysis.sell_through_probability}%
              </p>
            </div>

            {/* Arrow + lift */}
            <div className="flex shrink-0 flex-col items-center gap-1">
              <ArrowRight className="h-5 w-5 text-[#E935C1]" />
              {lift > 0 && (
                <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                  +{lift}%
                </span>
              )}
            </div>

            {/* After action */}
            <div className="flex-1 rounded-md border border-emerald-400/20 bg-emerald-400/5 p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                After {primaryActionLabel}
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums text-emerald-400">
                {analysis.recovery_probability}%
              </p>
            </div>
          </div>

          {/* Est. days to sale */}
          <div className="mt-3 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-zinc-600" />
            <p className="text-xs text-zinc-500">
              Est.{" "}
              <span className="font-semibold text-zinc-300">
                {analysis.estimated_days_to_sale} days
              </span>{" "}
              to sale after action
            </p>
          </div>
        </div>

        {/* 3. Warning Signals */}
        {analysis.warning_signals.length > 0 && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-600">
              Warning Signals
            </p>
            <div className="space-y-3">
              {analysis.warning_signals.map((signal) => (
                <div key={signal.code} className="flex gap-2.5">
                  <SignalIcon severity={signal.severity} />
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-xs font-bold",
                        signalTitleColor(signal.severity)
                      )}
                    >
                      {signal.title}
                      {signal.metric && (
                        <span className="ml-2 font-normal text-zinc-600">
                          · {signal.metric}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                      {signal.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Recommended Action + Platform Steps */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-600">
            Recommended Action
          </p>
          <p className="text-sm font-bold text-zinc-100">
            {analysis.platform_guidance.title}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
            {analysis.platform_guidance.overview}
          </p>

          {/* Steps */}
          {analysis.platform_guidance.steps.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-700">
                Steps
              </p>
              {analysis.platform_guidance.steps.map((step, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex gap-2.5 rounded-md border px-3 py-2",
                    step.critical
                      ? "border-[#E935C1]/20 bg-[#E935C1]/5"
                      : "border-zinc-800 bg-zinc-950"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                      step.critical
                        ? "bg-[#E935C1]/20 text-[#E935C1]"
                        : "bg-zinc-800 text-zinc-500"
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-xs leading-relaxed",
                        step.critical ? "text-zinc-200" : "text-zinc-400"
                      )}
                    >
                      {step.instruction}
                    </p>
                    {step.note && (
                      <p className="mt-0.5 text-[11px] text-zinc-600 italic">
                        {step.note}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Platform tips */}
          {analysis.platform_guidance.platform_tips.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-700">
                Platform Tips
              </p>
              {analysis.platform_guidance.platform_tips.map((tip, i) => (
                <div key={i} className="flex gap-2 text-[11px] text-zinc-500">
                  <span className="mt-0.5 shrink-0 text-[#E935C1]">·</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5. Recovery Timeline Simulation */}
        <div className="rounded-lg border border-[#E935C1]/30 bg-[#E935C1]/5 p-5">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[#E935C1]">
            Recovery Simulation
          </p>
          <p className="text-sm leading-relaxed text-zinc-300">
            If you{" "}
            <span className="font-bold text-zinc-100">{primaryActionLabel.toLowerCase()}</span>{" "}
            within{" "}
            <span className="font-bold text-zinc-100">
              {analysis.platform_guidance.estimated_time_to_outcome}
            </span>
            , your sell-through probability increases from{" "}
            <span className="font-bold text-zinc-400">
              {analysis.sell_through_probability}%
            </span>{" "}
            <ArrowRight className="inline-block h-3.5 w-3.5 text-[#E935C1]" />{" "}
            <span className="font-bold text-emerald-400">
              {analysis.recovery_probability}%
            </span>{" "}
            {lift > 0 && (
              <span className="font-bold text-emerald-400">(a +{lift}% lift)</span>
            )}
            . Estimated time to sale:{" "}
            <span className="font-bold text-zinc-100">
              {analysis.estimated_days_to_sale} days
            </span>
            .
          </p>
          {analysis.estimated_recovery > 0 && (
            <p className="mt-2 text-xs text-zinc-500">
              Estimated recovery:{" "}
              <span className="font-bold text-zinc-300">
                {formatCurrencyDecimal(analysis.estimated_recovery)}
              </span>{" "}
              of the{" "}
              <span className="font-bold text-zinc-300">
                {formatCurrencyDecimal(form.price)}
              </span>{" "}
              asking price.
            </p>
          )}
          {analysis.platform_guidance.timing_tip && (
            <p className="mt-2 text-[11px] text-[#E935C1]/70">
              {analysis.platform_guidance.timing_tip}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
