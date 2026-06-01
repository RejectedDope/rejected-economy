"use client";

import { useState, useEffect, useRef } from "react";
import { Scan, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExtractedListingFields } from "@/lib/ingestion/screenshot-parser";

interface ScreenshotReviewerProps {
  file: File;
  onExtracted: (fields: ExtractedListingFields, file: File) => void;
}

const PLATFORM_OPTIONS = [
  "eBay","Poshmark","Mercari","Depop","Facebook Marketplace",
  "StockX","GOAT","Whatnot","Grailed","Other",
];

export function ScreenshotReviewer({ file, onExtracted }: ScreenshotReviewerProps) {
  const [extracting, setExtracting] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState("");
  const [fields, setFields] = useState<ExtractedListingFields | null>(null);
  const autoScannedRef = useRef(false);
  // Stable preview URL: create once per file instance
  const previewUrl = useState(() =>
    typeof window !== "undefined" ? URL.createObjectURL(file) : null
  )[0];
  // No cleanup needed — component unmounts when import flow ends

  // Auto-scan on mobile (where camera capture was used) — small files are likely single-listing shots
  const isMobileCapture = file.name.startsWith("image") || file.name.match(/^(IMG|photo|capture)/i);

  // Auto-scan on mount for mobile camera captures
  useEffect(() => {
    if (!isMobileCapture || autoScannedRef.current) return;
    autoScannedRef.current = true;
    const t = setTimeout(() => runOCR(), 50);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runOCR() {
    setExtracting(true);
    setOcrProgress(0);
    setOcrStatus("Starting…");
    try {
      const { extractFromScreenshot } = await import("@/lib/ingestion/ocr");
      const result = await extractFromScreenshot(file, (pct, status) => {
        setOcrProgress(pct);
        setOcrStatus(status);
      });
      setOcrProgress(100);
      setFields(result);
      onExtracted(result, file);
    } catch {
      setFields({ confidence: "none", extractionMethod: "none" });
    } finally {
      setExtracting(false);
    }
  }

  function handleFieldChange(key: keyof ExtractedListingFields, value: string) {
    if (!fields) return;
    const updated = { ...fields, [key]: value || undefined };
    setFields(updated);
    onExtracted(updated, file);
  }

  const confidenceColor = {
    high: "text-emerald-400",
    medium: "text-yellow-400",
    low: "text-orange-400",
    none: "text-zinc-600",
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Scan className="h-3.5 w-3.5 text-[#E935C1]" />
          <span className="text-xs font-bold text-zinc-300 truncate max-w-[200px]">
            {file.name}
          </span>
        </div>
        {!extracting && !fields && (
          <button
            onClick={runOCR}
            className="rounded-md border border-[#E935C1]/30 bg-[#E935C1]/10 px-3 py-1.5 text-xs font-bold text-[#E935C1] hover:bg-[#E935C1]/20 transition-colors"
          >
            Extract Text
          </button>
        )}
        {extracting && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>{ocrStatus || "Scanning…"}</span>
            <span className="font-bold text-zinc-400">{ocrProgress}%</span>
          </div>
        )}
        {fields && (
          <div className={cn("flex items-center gap-1 text-xs font-bold", confidenceColor[fields.confidence])}>
            {fields.confidence === "none"
              ? <><AlertCircle className="h-3.5 w-3.5" /> No data</>
              : <><CheckCircle2 className="h-3.5 w-3.5" /> {fields.confidence} confidence</>
            }
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
        {/* Image preview */}
        {previewUrl && (
          <div className="border-b border-zinc-800 sm:border-b-0 sm:border-r">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Screenshot preview"
              className="h-48 w-full object-contain bg-zinc-950 p-2"
            />
          </div>
        )}

        {/* Extracted fields form */}
        <div className="p-4 space-y-3">
          {!fields && !extracting && (
            <p className="text-xs text-zinc-600 text-center py-4">
              Click &ldquo;Extract Text&rdquo; to scan this screenshot
            </p>
          )}
          {extracting && (
            <div className="flex flex-col items-center justify-center gap-3 py-6">
              <Loader2 className="h-5 w-5 animate-spin text-[#E935C1]" />
              <div className="w-full max-w-[180px]">
                <div className="mb-1 flex justify-between text-[10px] text-zinc-600">
                  <span>{ocrStatus || "Processing…"}</span>
                  <span className="font-bold text-zinc-400">{ocrProgress}%</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-[#E935C1] transition-all duration-200"
                    style={{ width: `${ocrProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}
          {fields && (
            <>
              <Field
                label="Title"
                value={fields.title ?? ""}
                onChange={(v) => handleFieldChange("title", v)}
                placeholder="Item title from screenshot"
              />
              <div className="grid grid-cols-2 gap-2">
                <Field
                  label="Price"
                  value={fields.price ?? ""}
                  onChange={(v) => handleFieldChange("price", v)}
                  placeholder="0.00"
                  prefix="$"
                />
                <SelectField
                  label="Platform"
                  value={fields.platform ?? ""}
                  options={["", ...PLATFORM_OPTIONS]}
                  onChange={(v) => handleFieldChange("platform", v)}
                />
              </div>
              {fields.category && (
                <Field
                  label="Category (detected)"
                  value={fields.category}
                  onChange={(v) => handleFieldChange("category", v)}
                  placeholder="e.g. Shoes"
                />
              )}
              <div className="grid grid-cols-3 gap-2">
                <Field
                  label="Days Listed"
                  value={fields.days_listed ?? ""}
                  onChange={(v) => handleFieldChange("days_listed", v)}
                  placeholder="0"
                />
                <Field
                  label="Views"
                  value={fields.views ?? ""}
                  onChange={(v) => handleFieldChange("views", v)}
                  placeholder="0"
                />
                <Field
                  label="Watchers"
                  value={fields.watchers ?? ""}
                  onChange={(v) => handleFieldChange("watchers", v)}
                  placeholder="0"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, prefix }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  prefix?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-600">
        {label}
      </label>
      <div className="flex items-center rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5">
        {prefix && <span className="mr-1 text-xs text-zinc-500">{prefix}</span>}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-700"
        />
      </div>
    </div>
  );
}

function SelectField({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-600">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o || "Select…"}</option>
        ))}
      </select>
    </div>
  );
}
