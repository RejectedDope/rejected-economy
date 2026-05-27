"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap, Clock, TrendingDown, Bell, Settings2, Loader2 } from "lucide-react";
import {
  fetchAutomationRules,
  upsertAutomationRule,
  type AutomationRule,
} from "@/app/actions/automation";
import { fetchUsageSummary } from "@/app/actions/usage";
import { hasFeature } from "@/lib/subscription/tiers";
import { FeatureGate } from "@/components/subscription/FeatureGate";
import { AutomationQueue } from "@/components/automation/AutomationQueue";
import { AutomationHistory } from "@/components/automation/AutomationHistory";

type RuleConfig = {
  type: AutomationRule["rule_type"];
  label: string;
  description: string;
  icon: typeof Zap;
  conditionLabel: string;
  conditionKey: string;
  conditionUnit: string;
  conditionDefault: number;
  conditionMin: number;
  conditionMax: number;
  actionLabel?: string;
  actionKey?: string;
  actionUnit?: string;
  actionDefault?: number;
  proOnly?: boolean;
};

const RULE_CONFIGS: RuleConfig[] = [
  {
    type: "stale_alert",
    label: "Stale Inventory Alert",
    description: "Get notified when listings sit past a threshold without selling.",
    icon: Bell,
    conditionLabel: "Alert after",
    conditionKey: "min_days_listed",
    conditionUnit: "days",
    conditionDefault: 60,
    conditionMin: 14,
    conditionMax: 365,
  },
  {
    type: "auto_markdown",
    label: "Scheduled Markdown",
    description: "Queue a price reduction after a listing stalls for a set number of days.",
    icon: TrendingDown,
    conditionLabel: "Trigger after",
    conditionKey: "min_days_listed",
    conditionUnit: "days",
    conditionDefault: 90,
    conditionMin: 30,
    conditionMax: 365,
    actionLabel: "Reduce price by",
    actionKey: "markdown_pct",
    actionUnit: "%",
    actionDefault: 15,
    proOnly: true,
  },
  {
    type: "auto_relist",
    label: "Auto-Relist Flag",
    description: "Flag listings for relisting after extended inactivity.",
    icon: Clock,
    conditionLabel: "Flag after",
    conditionKey: "min_days_listed",
    conditionUnit: "days",
    conditionDefault: 90,
    conditionMin: 30,
    conditionMax: 365,
  },
  {
    type: "auto_crosslist",
    label: "Cross-List Suggestion",
    description: "Surface cross-listing candidates when items stall on a single platform.",
    icon: Settings2,
    conditionLabel: "Suggest after",
    conditionKey: "min_days_listed",
    conditionUnit: "days",
    conditionDefault: 60,
    conditionMin: 14,
    conditionMax: 365,
    proOnly: true,
  },
];

type RuleState = {
  enabled: boolean;
  conditionValue: number;
  actionValue?: number;
  id?: string;
  saving: boolean;
  saved: boolean;
};

export default function AutomationPage() {
  const [rules, setRules] = useState<Map<AutomationRule["rule_type"], RuleState>>(
    () =>
      new Map(
        RULE_CONFIGS.map((c) => [
          c.type,
          {
            enabled: false,
            conditionValue: c.conditionDefault,
            actionValue: c.actionDefault,
            saving: false,
            saved: false,
          },
        ])
      )
  );
  const [loading, setLoading] = useState(true);
  const [hasAutomationAccess, setHasAutomationAccess] = useState(false);

  useEffect(() => {
    fetchUsageSummary()
      .then((usage) => {
        setHasAutomationAccess(hasFeature(usage?.planId ?? null, "automation_rules"));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchAutomationRules().then(({ rules: fetched }) => {
      setRules((prev) => {
        const next = new Map(prev);
        for (const rule of fetched) {
          const existing = next.get(rule.rule_type);
          if (existing) {
            const cond = rule.conditions as Record<string, number>;
            const act = rule.actions as Record<string, number>;
            const config = RULE_CONFIGS.find((c) => c.type === rule.rule_type);
            next.set(rule.rule_type, {
              ...existing,
              id: rule.id,
              enabled: rule.enabled,
              conditionValue: cond[config?.conditionKey ?? "min_days_listed"] ?? existing.conditionValue,
              actionValue: config?.actionKey ? (act[config.actionKey] ?? existing.actionValue) : existing.actionValue,
            });
          }
        }
        return next;
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function save(ruleType: AutomationRule["rule_type"]) {
    const state = rules.get(ruleType);
    const config = RULE_CONFIGS.find((c) => c.type === ruleType);
    if (!state || !config) return;

    setRules((prev) => {
      const next = new Map(prev);
      next.set(ruleType, { ...state, saving: true, saved: false });
      return next;
    });

    const conditions: Record<string, unknown> = {
      [config.conditionKey]: state.conditionValue,
    };
    const actions: Record<string, unknown> = {};
    if (config.actionKey && state.actionValue != null) {
      actions[config.actionKey] = state.actionValue;
    }

    const result = await upsertAutomationRule({
      ruleType,
      enabled: state.enabled,
      conditions,
      actions,
    });

    setRules((prev) => {
      const next = new Map(prev);
      next.set(ruleType, { ...state, saving: false, saved: result.ok });
      return next;
    });

    if (result.ok) {
      setTimeout(() => {
        setRules((prev) => {
          const next = new Map(prev);
          const s = next.get(ruleType);
          if (s) next.set(ruleType, { ...s, saved: false });
          return next;
        });
      }, 2000);
    }
  }

  function update(
    ruleType: AutomationRule["rule_type"],
    patch: Partial<RuleState>
  ) {
    setRules((prev) => {
      const next = new Map(prev);
      const existing = next.get(ruleType);
      if (existing) next.set(ruleType, { ...existing, ...patch });
      return next;
    });
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="mb-1 flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-[#E935C1]" />
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">
            Settings
          </span>
          <span className="text-zinc-700">/</span>
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Automation
          </span>
        </div>
        <h1 className="text-2xl font-black text-zinc-100">Automation Rules</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Configure automatic triggers to surface recovery tasks before inventory stalls.
          No marketplace actions execute automatically — rules queue tasks for your review.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading rules…
        </div>
      ) : (
        <div className="max-w-2xl space-y-4">
          {RULE_CONFIGS.map((config) => {
            const Icon = config.icon;
            const state = rules.get(config.type)!;
            const hasAccess = !config.proOnly || hasAutomationAccess;

            return (
              <FeatureGate key={config.type} hasAccess={hasAccess} requiredTier="Pro" label={config.label}>
              <div
                className={`rounded-xl border bg-zinc-900 p-5 transition-colors ${
                  state.enabled
                    ? "border-[#E935C1]/30"
                    : "border-zinc-800"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
                        state.enabled
                          ? "border-[#E935C1]/30 bg-[#E935C1]/10"
                          : "border-zinc-700 bg-zinc-800"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 ${state.enabled ? "text-[#E935C1]" : "text-zinc-600"}`}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-200">{config.label}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">{config.description}</p>
                    </div>
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => update(config.type, { enabled: !state.enabled })}
                    className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
                      state.enabled
                        ? "border-[#E935C1]/50 bg-[#E935C1]/20"
                        : "border-zinc-700 bg-zinc-800"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full transition-transform ${
                        state.enabled
                          ? "translate-x-4 bg-[#E935C1]"
                          : "translate-x-0.5 bg-zinc-600"
                      }`}
                    />
                  </button>
                </div>

                {/* Threshold inputs */}
                {state.enabled && (
                  <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-zinc-800 pt-4">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                        {config.conditionLabel}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={state.conditionValue}
                          min={config.conditionMin}
                          max={config.conditionMax}
                          onChange={(e) =>
                            update(config.type, {
                              conditionValue: parseInt(e.target.value) || config.conditionDefault,
                            })
                          }
                          className="w-20 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm font-semibold text-zinc-200 focus:border-zinc-500 focus:outline-none"
                        />
                        <span className="text-xs text-zinc-500">{config.conditionUnit}</span>
                      </div>
                    </div>

                    {config.actionKey && (
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                          {config.actionLabel}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={state.actionValue ?? config.actionDefault}
                            min={1}
                            max={80}
                            onChange={(e) =>
                              update(config.type, {
                                actionValue: parseInt(e.target.value) || config.actionDefault,
                              })
                            }
                            className="w-20 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm font-semibold text-zinc-200 focus:border-zinc-500 focus:outline-none"
                          />
                          <span className="text-xs text-zinc-500">{config.actionUnit}</span>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => save(config.type)}
                      disabled={state.saving}
                      className={`ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                        state.saved
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-[#E935C1]/20 text-[#E935C1] hover:bg-[#E935C1]/30"
                      } disabled:opacity-50`}
                    >
                      {state.saving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : null}
                      {state.saved ? "Saved ✓" : "Save Rule"}
                    </button>
                  </div>
                )}
              </div>
              </FeatureGate>
            );
          })}

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="text-xs text-zinc-600 leading-relaxed">
              Automation rules queue tasks for your review — they do not execute marketplace
              actions automatically. When a rule fires, the relevant items surface in your
              Recovery Priority Queue with the suggested action pre-selected.
            </p>
          </div>

          {/* Task Queue */}
          <AutomationQueue />

          {/* Run History */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">
              Run History
            </p>
            <AutomationHistory />
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
