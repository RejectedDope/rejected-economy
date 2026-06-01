"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export type ColumnMapping = Record<string, string>;

interface ColumnMapperProps {
  detectedColumns: string[];
  onMappingConfirmed: (mapping: ColumnMapping) => void;
  onSkip: () => void;
}

const TARGET_FIELDS: { key: string; label: string; required: boolean }[] = [
  { key: "title",         label: "Title",          required: true },
  { key: "price",         label: "Price",          required: true },
  { key: "platform",      label: "Platform",       required: false },
  { key: "category",      label: "Category",       required: false },
  { key: "days_listed",   label: "Days Listed",    required: false },
  { key: "image_count",   label: "Photo Count",    required: false },
  { key: "views",         label: "Views",          required: false },
  { key: "watchers",      label: "Watchers",       required: false },
  { key: "shipping_type", label: "Shipping Type",  required: false },
  { key: "shipping_cost", label: "Shipping Cost",  required: false },
];

function guessMapping(columns: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const lower = columns.map((c) => c.toLowerCase().trim());

  TARGET_FIELDS.forEach(({ key }) => {
    const guesses: Record<string, string[]> = {
      title:         ["title", "item title", "listing title", "name"],
      price:         ["price", "current price", "buy it now price", "listing price", "sold price"],
      platform:      ["platform", "marketplace", "site"],
      category:      ["category", "ebay category", "item category"],
      days_listed:   ["days listed", "days_listed", "age", "listing age"],
      image_count:   ["photo count", "image count", "photos", "num photos"],
      views:         ["views", "page views", "total views"],
      watchers:      ["watchers", "watching", "total watchers"],
      shipping_type: ["shipping type", "shipping service"],
      shipping_cost: ["shipping cost", "shipping price"],
    };

    const candidates = guesses[key] ?? [];
    for (const candidate of candidates) {
      const idx = lower.indexOf(candidate);
      if (idx !== -1) {
        mapping[key] = columns[idx];
        break;
      }
    }
  });

  return mapping;
}

export function ColumnMapper({ detectedColumns, onMappingConfirmed, onSkip }: ColumnMapperProps) {
  const [mapping, setMapping] = useState<ColumnMapping>(() => guessMapping(detectedColumns));

  const missingRequired = TARGET_FIELDS.filter(
    (f) => f.required && (!mapping[f.key] || mapping[f.key] === "")
  );

  function handleChange(targetKey: string, sourceColumn: string) {
    setMapping((prev) => ({ ...prev, [targetKey]: sourceColumn }));
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-zinc-200">Map your columns</h3>
        <p className="mt-1 text-xs text-zinc-500">
          We detected {detectedColumns.length} columns. Match them to inventory fields below.
          Auto-matched columns are pre-filled — correct any mismatches.
        </p>
      </div>

      <div className="space-y-3">
        {TARGET_FIELDS.map(({ key, label, required }) => (
          <div key={key} className="grid grid-cols-2 items-center gap-4">
            <div>
              <span className="text-sm text-zinc-300">{label}</span>
              {required && (
                <span className="ml-1.5 text-xs font-bold text-[#E935C1]">required</span>
              )}
            </div>
            <div className="relative">
              <select
                value={mapping[key] ?? ""}
                onChange={(e) => handleChange(key, e.target.value)}
                className="w-full appearance-none rounded border border-zinc-700 bg-zinc-900 px-3 py-2 pr-8 text-sm text-zinc-100 focus:border-[#E935C1] focus:outline-none"
              >
                <option value="">— skip this field —</option>
                {detectedColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            </div>
          </div>
        ))}
      </div>

      {missingRequired.length > 0 && (
        <p className="text-xs text-amber-400">
          Map required fields before continuing:{" "}
          {missingRequired.map((f) => f.label).join(", ")}
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => onMappingConfirmed(mapping)}
          disabled={missingRequired.length > 0}
          className="flex-1 rounded-lg bg-[#E935C1] px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Apply mapping
        </button>
        <button
          onClick={onSkip}
          className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
        >
          Use auto-detect
        </button>
      </div>
    </div>
  );
}
