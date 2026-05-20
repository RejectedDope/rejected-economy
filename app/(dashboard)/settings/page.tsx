"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Settings, Database, Bell, User, Zap, CheckCircle2, CreditCard, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const PLATFORMS = ["eBay", "Poshmark", "Mercari", "Depop", "Facebook Marketplace", "StockX", "GOAT", "Whatnot"];

export default function SettingsPage() {
  const [primaryPlatform, setPrimaryPlatform] = useState("eBay");
  const [thresholds, setThresholds] = useState({
    stale_warning: 60,
    stale_critical: 90,
    dead_threshold: 180,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load existing settings on mount
  useEffect(() => {
    import("@/app/actions/settings").then(({ fetchUserSettings }) => {
      fetchUserSettings().then(({ settings }) => {
        if (!settings) return;
        setPrimaryPlatform(settings.primary_platform ?? "eBay");
        setThresholds({
          stale_warning: settings.stale_warning_days ?? 60,
          stale_critical: settings.stale_critical_days ?? 90,
          dead_threshold: settings.dead_threshold_days ?? 180,
        });
      }).catch(() => {/* unauthenticated — use defaults */});
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const { saveUserSettings } = await import("@/app/actions/settings");
      const result = await saveUserSettings({
        primary_platform: primaryPlatform as Parameters<typeof saveUserSettings>[0]["primary_platform"],
        stale_warning_days: thresholds.stale_warning,
        stale_critical_days: thresholds.stale_critical,
        dead_threshold_days: thresholds.dead_threshold,
      });
      if (!result.ok) {
        setSaveError(result.error ?? "Save failed");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (err) {
      setSaveError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Settings className="h-3.5 w-3.5 text-[#E935C1]" />
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">
            Settings
          </span>
        </div>
        <h1 className="text-2xl font-black text-zinc-100">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Configure your ResaleIQ to match your operation.
        </p>
      </div>

      <div className="max-w-2xl space-y-8">
        {/* Plan & Usage quick-link */}
        <Link
          href="/settings/plan"
          className="group flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-600"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800">
              <CreditCard className="h-4 w-4 text-[#E935C1]" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-200">Plan & Usage</p>
              <p className="text-xs text-zinc-500">View your current plan, quota usage, and feature access</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400" />
        </Link>

        {/* Profile section */}
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-5 flex items-center gap-2">
            <User className="h-4 w-4 text-zinc-600" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
              Profile
            </h2>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                defaultValue="seller@rejectedeconomy.com"
                disabled
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-name">Store Name</Label>
              <Input
                id="store-name"
                placeholder="Your eBay / resale store name"
                defaultValue="Rejected Economy Store"
              />
            </div>
          </div>
        </section>

        {/* Platform & scoring */}
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-5 flex items-center gap-2">
            <Database className="h-4 w-4 text-zinc-600" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
              Platform & Scoring
            </h2>
          </div>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label>Primary Platform</Label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPrimaryPlatform(p)}
                    className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                      primaryPlatform === p
                        ? "bg-[#E935C1] text-white"
                        : "border border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-600">
                Affects scoring weights — eBay has stricter item specifics penalties.
              </p>
            </div>

            <Separator />

            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-600">
                Aging Thresholds (days)
              </p>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { key: "stale_warning" as const, label: "Stale Warning" },
                  { key: "stale_critical" as const, label: "Critical Threshold" },
                  { key: "dead_threshold" as const, label: "Dead Inventory" },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      type="number"
                      value={thresholds[key]}
                      onChange={(e) =>
                        setThresholds((t) => ({
                          ...t,
                          [key]: parseInt(e.target.value) || 0,
                        }))
                      }
                      min={1}
                      max={730}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-5 flex items-center gap-2">
            <Bell className="h-4 w-4 text-zinc-600" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
              Notifications
            </h2>
          </div>
          <div className="space-y-3">
            {[
              {
                label: "Critical inventory alerts",
                desc: "When listings hit Critical risk level",
              },
              {
                label: "Weekly recovery report",
                desc: "Summary of trapped cash and recommended actions",
              },
              {
                label: "New death pile entrants",
                desc: "When items cross the dead inventory threshold",
              },
            ].map(({ label, desc }) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-300">{label}</p>
                  <p className="text-xs text-zinc-600">{desc}</p>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="peer sr-only"
                    id={label}
                  />
                  <label
                    htmlFor={label}
                    className="flex h-5 w-9 cursor-pointer items-center rounded-full border border-zinc-700 bg-zinc-800 transition-colors peer-checked:border-[#E935C1]/50 peer-checked:bg-[#E935C1]/20"
                  >
                    <span className="ml-0.5 h-4 w-4 rounded-full bg-zinc-600 transition-transform peer-checked:translate-x-4 peer-checked:bg-[#E935C1]" />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Supabase / integrations */}
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-5 flex items-center gap-2">
            <Zap className="h-4 w-4 text-zinc-600" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
              Database Connection
            </h2>
          </div>
          <div className="rounded-md border border-zinc-700 bg-zinc-950 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-yellow-400" />
              <span className="text-xs font-bold text-zinc-400">
                Using Demo Data
              </span>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Configure your Supabase project URL and anon key in{" "}
              <code className="rounded bg-zinc-800 px-1 py-0.5 text-[11px] text-zinc-400">
                .env.local
              </code>{" "}
              to connect live inventory data. See the setup guide.
            </p>
          </div>
        </section>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving} className={saved ? "bg-emerald-600 hover:bg-emerald-600" : ""}>
            {saving ? "Saving…" : saved ? (
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Saved</span>
            ) : "Save Settings"}
          </Button>
          {saveError && (
            <p className="text-xs text-red-400">{saveError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
