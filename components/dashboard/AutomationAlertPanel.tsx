"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, AlertTriangle, TrendingDown, RefreshCw, ChevronRight } from "lucide-react";
import { useInventory } from "@/lib/hooks/useInventory";
import { evaluateAutomationRules, type RuleEvalResult } from "@/lib/automation/engine";
import { fetchAutomationRules } from "@/app/actions/automation";
import type { AutomationRule } from "@/lib/automation/engine";

const RULE_ICONS: Record<string, React.ElementType> = {
  stale_alert:    AlertTriangle,
  auto_markdown:  TrendingDown,
  auto_relist:    RefreshCw,
  auto_crosslist: Bot,
};

const RULE_COLORS: Record<string, string> = {
  stale_alert:    "text-yellow-400",
  auto_markdown:  "text-orange-400",
  auto_relist:    "text-blue-400",
  auto_crosslist: "text-purple-400",
};

export function AutomationAlertPanel() {
  const { items, loading } = useInventory();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [rulesLoaded, setRulesLoaded] = useState(false);

  useEffect(() => {
    fetchAutomationRules()
      .then(({ rules: fetched }) => {
        setRules((fetched ?? []) as AutomationRule[]);
      })
      .catch(() => {/* unauthenticated — no rules */})
      .finally(() => setRulesLoaded(true));
  }, []);

  const results = useMemo<RuleEvalResult[]>(() => {
    if (!rulesLoaded || loading || rules.length === 0 || items.length === 0) return [];
    return evaluateAutomationRules(rules, items);
  }, [rules, items, rulesLoaded, loading]);

  if (!rulesLoaded || loading || results.length === 0) return null;

  const totalItems = results.reduce((sum, r) => sum + r.triggeredItems.length, 0);

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-[#E935C1]/25 bg-[#E935C1]/5">
      <div className="flex items-center justify-between border-b border-[#E935C1]/20 px-5 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-3.5 w-3.5 text-[#E935C1]" />
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
            Automation Alerts
          </span>
          <span className="rounded bg-[#E935C1]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#E935C1]">
            {totalItems} item{totalItems !== 1 ? "s" : ""}
          </span>
        </div>
        <Link
          href="/settings/automation"
          className="flex items-center gap-0.5 text-xs text-zinc-600 transition-colors hover:text-zinc-400"
        >
          Manage rules
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="divide-y divide-zinc-800/50">
        {results.map((result) => {
          const Icon = RULE_ICONS[result.ruleType] ?? Bot;
          const color = RULE_COLORS[result.ruleType] ?? "text-zinc-400";
          return (
            <div key={result.ruleId ?? result.ruleType} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
                <div>
                  <p className="text-sm font-semibold text-zinc-200">{result.alertMessage}</p>
                  <p className="text-xs text-zinc-600">
                    Suggested action:{" "}
                    <span className="text-zinc-400">{result.suggestedAction.replace(/_/g, " ")}</span>
                  </p>
                </div>
              </div>
              <Link
                href="/recovery"
                className="shrink-0 rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
              >
                Review →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
