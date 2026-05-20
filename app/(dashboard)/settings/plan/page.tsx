"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, CheckCircle2, XCircle, Zap, AlertCircle } from "lucide-react";
import { fetchUsageSummary, type UsageSummary } from "@/app/actions/usage";
import type { FeatureKey } from "@/lib/subscription/tiers";

const FEATURE_CATALOG: { key: FeatureKey; label: string; tier: string }[] = [
  { key: "csv_import",         label: "CSV Import",           tier: "Free"    },
  { key: "column_mapper",      label: "Column Mapper",        tier: "Free"    },
  { key: "recovery_engine",    label: "Recovery Engine",      tier: "Free"    },
  { key: "xlsx_import",        label: "XLSX Import",          tier: "Starter" },
  { key: "screenshot_ocr",     label: "Screenshot OCR",       tier: "Starter" },
  { key: "multi_platform",     label: "Multi-Platform View",  tier: "Starter" },
  { key: "scoring_snapshots",  label: "Score History",        tier: "Starter" },
  { key: "platform_breakdown", label: "Platform Analytics",   tier: "Starter" },
  { key: "bulk_actions",       label: "Bulk Actions",         tier: "Pro"     },
  { key: "export_data",        label: "Export Data",          tier: "Pro"     },
  { key: "api_sync",           label: "API Sync",             tier: "Business"},
  { key: "scheduled_imports",  label: "Scheduled Imports",    tier: "Business"},
];

function UsageBar({
  label,
  used,
  max,
}: {
  label: string;
  used: number;
  max: number;
}) {
  const unlimited = max === -1;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / max) * 100));

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-semibold text-zinc-400">{label}</span>
        <span
          className={`font-bold ${
            !unlimited && pct >= 90
              ? "text-red-400"
              : !unlimited && pct >= 70
              ? "text-yellow-400"
              : "text-zinc-400"
          }`}
        >
          {unlimited ? "Unlimited" : `${used.toLocaleString()} / ${max.toLocaleString()}`}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all ${
              pct >= 90 ? "bg-red-400" : pct >= 70 ? "bg-yellow-400" : "bg-emerald-400"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-zinc-800 ${className}`} />;
}

export default function PlanPage() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsageSummary()
      .then(setUsage)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const plan = usage?.plan;
  const planFeatures = new Set(plan?.features ?? []);
  const itemPct =
    plan && plan.maxItems !== -1
      ? Math.min(100, Math.round(((usage?.itemsUsed ?? 0) / plan.maxItems) * 100))
      : 0;
  const nearItemLimit = itemPct >= 80;

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb header */}
      <div className="mb-8">
        <div className="mb-1 flex items-center gap-2">
          <CreditCard className="h-3.5 w-3.5 text-[#E935C1]" />
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">
            Settings
          </span>
          <span className="text-zinc-700">/</span>
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Plan
          </span>
        </div>
        <h1 className="text-2xl font-black text-zinc-100">Plan & Usage</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Your current plan, feature access, and usage against limits.
        </p>
      </div>

      {loading ? (
        <div className="max-w-2xl space-y-4">
          <SkeletonBlock className="h-28" />
          <SkeletonBlock className="h-44" />
          <SkeletonBlock className="h-64" />
        </div>
      ) : !usage ? (
        <div className="max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900 py-12 text-center">
          <p className="text-sm text-zinc-500">Sign in to view your plan.</p>
          <Link
            href="/login"
            className="mt-3 inline-block text-sm font-bold text-[#E935C1] hover:underline"
          >
            Sign in →
          </Link>
        </div>
      ) : (
        <div className="max-w-2xl space-y-6">
          {/* Plan card */}
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            <div className="flex items-center justify-between p-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                  Current Plan
                </p>
                <p className="mt-1 text-2xl font-black text-zinc-100">{plan?.name}</p>
                <p className="mt-1 text-xs text-zinc-600">
                  {plan?.maxItems === -1
                    ? "Unlimited items"
                    : `Up to ${plan?.maxItems} active items`}{" "}
                  ·{" "}
                  {plan?.maxImportsPerMonth === -1
                    ? "Unlimited imports"
                    : `${plan?.maxImportsPerMonth} imports/month`}
                </p>
              </div>
              <span className="rounded-lg border border-[#E935C1]/30 bg-[#E935C1]/10 px-3 py-1.5 text-sm font-bold uppercase text-[#E935C1]">
                {usage.planId}
              </span>
            </div>

            {nearItemLimit && (
              <div className="flex items-center gap-2.5 border-t border-yellow-500/20 bg-yellow-500/5 px-6 py-3">
                <AlertCircle className="h-4 w-4 shrink-0 text-yellow-400" />
                <p className="text-xs text-yellow-300">
                  You&apos;re using {itemPct}% of your item limit. Upgrade to keep importing.
                </p>
              </div>
            )}
          </div>

          {/* Usage bars */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="mb-5 text-xs font-bold uppercase tracking-widest text-zinc-500">
              Usage
            </p>
            <div className="space-y-5">
              <UsageBar
                label="Active Inventory"
                used={usage.itemsUsed}
                max={plan?.maxItems ?? -1}
              />
              <UsageBar
                label="Imports This Month"
                used={usage.importsUsedThisMonth}
                max={plan?.maxImportsPerMonth ?? -1}
              />
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-400">Max Batch Size</span>
                <span className="font-bold text-zinc-400">
                  {(plan?.maxBatchSize ?? 0).toLocaleString()} rows per import
                </span>
              </div>
            </div>
          </div>

          {/* Upgrade CTA */}
          {usage.planId === "free" && (
            <div className="rounded-xl border border-[#E935C1]/20 bg-gradient-to-br from-[#E935C1]/8 to-transparent p-6">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E935C1]/30 bg-[#E935C1]/10">
                  <Zap className="h-4.5 w-4.5 text-[#E935C1]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-zinc-200">
                    Unlock more with Starter or Pro
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Free plan caps at {plan?.maxItems} items and {plan?.maxImportsPerMonth}{" "}
                    imports/month. Starter unlocks XLSX, OCR, and 5× the inventory limit.
                  </p>
                </div>
              </div>
              <button
                disabled
                className="w-full cursor-not-allowed rounded-lg bg-[#E935C1] px-4 py-2.5 text-sm font-bold text-white opacity-50"
              >
                Upgrade — Coming Soon
              </button>
            </div>
          )}

          {/* Feature access grid */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500">
              Feature Access
            </p>
            <div className="space-y-3">
              {FEATURE_CATALOG.map(({ key, label, tier }) => {
                const included = planFeatures.has(key);
                return (
                  <div key={key} className="flex items-center gap-3">
                    {included ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-zinc-700" />
                    )}
                    <span
                      className={`flex-1 text-sm font-medium ${
                        included ? "text-zinc-200" : "text-zinc-600"
                      }`}
                    >
                      {label}
                    </span>
                    {!included && (
                      <span className="text-[10px] font-bold text-zinc-600">{tier}+</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Link
            href="/settings"
            className="block text-xs text-zinc-600 transition-colors hover:text-zinc-400"
          >
            ← Back to Settings
          </Link>
        </div>
      )}
    </div>
  );
}
