"use client";

import { useState } from "react";
import { Settings, Database, Bell, User, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const PLATFORMS = ["eBay", "Poshmark", "Mercari", "Depop", "Facebook Marketplace", "StockX", "GOAT", "Whatnot"];
const CATEGORIES = ["Vintage Clothing", "Sneakers", "Electronics", "Streetwear", "Collectibles", "Handbags", "Cameras", "Accessories", "Other"];

export default function SettingsPage() {
  const [primaryPlatform, setPrimaryPlatform] = useState("eBay");
  const [thresholds, setThresholds] = useState({
    stale_warning: 60,
    stale_critical: 90,
    dead_threshold: 180,
  });
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
          <Button onClick={handleSave} className={saved ? "bg-emerald-600 hover:bg-emerald-600" : ""}>
            {saved ? "Saved!" : "Save Settings"}
          </Button>
          <Button variant="ghost">Cancel</Button>
        </div>
      </div>
    </div>
  );
}
