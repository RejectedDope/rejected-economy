"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import { Upload, Layers, ScanLine } from "lucide-react";
import { CSVUploader } from "@/components/analyzer/CSVUploader";
import { InventoryTable } from "@/components/analyzer/InventoryTable";
import { ItemScanner } from "@/components/analyzer/ItemScanner";
import { scoreAll } from "@/lib/scoring";
import { MOCK_ITEMS } from "@/lib/mock-data";
import type { InventoryItem } from "@/lib/types";

export default function AnalyzerPage() {
  const [uploaded, setUploaded] = useState<InventoryItem[] | null>(null);

  const items = useMemo(() => {
    const source = uploaded ?? MOCK_ITEMS;
    return scoreAll(source);
  }, [uploaded]);

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">

      {/* ── Section 1: Single Item Scanner ────────────────────────────────── */}
      <div className="mb-12">
        {/* Section header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ScanLine className="h-3.5 w-3.5 text-[#E935C1]" />
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">
              Single Item Scanner
            </span>
          </div>
          <h1 className="text-2xl font-black text-zinc-100">Scan a Listing</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Enter your listing details and get an instant recovery analysis.
          </p>
        </div>

        <ItemScanner />
      </div>

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      <div className="mb-12 border-t border-zinc-800" />

      {/* ── Section 2: Bulk Import ─────────────────────────────────────────── */}
      <div>
        {/* Section header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Upload className="h-3.5 w-3.5 text-[#E935C1]" />
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">
              Bulk Import
            </span>
          </div>
          <h2 className="text-2xl font-black text-zinc-100">
            Import CSV — Bulk Scan
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Drop your eBay Seller Hub CSV export to score your full inventory.
          </p>
        </div>

        {/* Upload zone */}
        <div className="mb-8 grid gap-8 xl:grid-cols-3">
          <div className="xl:col-span-1">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-600">
              Import Data
            </h3>
            <CSVUploader
              userId="demo"
              onComplete={(items) => setUploaded(items)}
            />
          </div>

          {/* Summary strip */}
          <div className="xl:col-span-2">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-600">
              Scoring Summary
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: "Total Items",
                  value: items.filter((i) => i.status === "active").length,
                  color: "text-zinc-100",
                },
                {
                  label: "Critical Risk",
                  value: items.filter((i) => i.visibility_risk === "Critical").length,
                  color: "text-[#FF2D95]",
                },
                {
                  label: "High Risk",
                  value: items.filter((i) => i.visibility_risk === "High").length,
                  color: "text-orange-400",
                },
                {
                  label: "Healthy",
                  value: items.filter((i) => i.visibility_risk === "Low").length,
                  color: "text-emerald-400",
                },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
                >
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">
                    {label}
                  </p>
                  <p className={`mt-2 text-2xl font-black ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Scoring legend */}
            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-600">
                How Scoring Works
              </p>
              <p className="mb-3 text-[11px] text-zinc-600">
                Each listing is scored 0–100 across 7 signals. Higher = more trapped cash, dead-stock risk, or weak listing. The score drives the primary recovery action.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { label: "Listing Age / Age Risk",     weight: "35%", desc: "Freshness cliff at 90d — buried by algorithm at 180d+" },
                  { label: "Pricing Position",            weight: "20%", desc: "Views without watchers = price rejection signal" },
                  { label: "Marketplace Visibility",      weight: "15%", desc: "Watcher deficit, view velocity, no promotion" },
                  { label: "Title Quality",               weight: "10%", desc: "Keyword coverage drives search placement" },
                  { label: "Listing Specifics",           weight: "10%", desc: "Missing fields = invisible in filtered search" },
                  { label: "Photo Quality",               weight: "5%",  desc: "1 photo = ~40% lower conversion than 4+" },
                  { label: "Shipping Friction",           weight: "5%",  desc: "High shipping cost kills low-value conversions" },
                ].map(({ label, weight, desc }) => (
                  <div key={label} className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 rounded bg-[#E935C1]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#E935C1]">
                      {weight}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-zinc-300">{label}</p>
                      <p className="text-[11px] text-zinc-600">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Layers className="h-4 w-4 text-zinc-600" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-600">
              {uploaded ? "Imported Inventory" : "Demo Inventory"} — Scored
            </h3>
          </div>
          <InventoryTable items={items} />
        </div>
      </div>

    </div>
  );
}
