"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CSVRow, InventoryItem } from "@/lib/types";

function mapCSVToItem(row: CSVRow, userId: string): Omit<InventoryItem, "id" | "created_at"> | null {
  const title = row["Title"] || row["title"] || row["Item Title"] || "";
  if (!title) return null;

  const priceRaw = row["Start Price"] || row["Buy It Now Price"] || row["price"] || row["Price"] || "0";
  const price = parseFloat(priceRaw.replace(/[$,]/g, "")) || 0;

  const daysRaw = row["Days Listed"] || row["days_listed"] || "";
  const daysListed = parseInt(daysRaw) || 30;

  const platform = (row["Platform"] || row["platform"] || "eBay") as InventoryItem["platform"];
  const category = row["Category"] || row["category"] || row["Primary Category"] || "Uncategorized";
  const imageCount = parseInt(row["Photo Count"] || row["image_count"] || "1") || 1;

  const viewsRaw = parseInt(row["Views"] || row["views"] || "0") || 0;
  const watchersRaw = parseInt(row["Watchers"] || row["watchers"] || "0") || 0;
  const impressionsRaw = parseInt(row["Impressions"] || row["impressions"] || "0") || 0;

  return {
    user_id: userId,
    title: title.slice(0, 200),
    platform,
    price,
    days_listed: daysListed,
    category: category.slice(0, 100),
    item_specifics_complete:
      (row["Item Specifics"] || row["item_specifics_complete"] || "").toLowerCase() === "true" ||
      (row["Item Specifics"] || "").toLowerCase() === "complete",
    image_count: imageCount,
    title_keyword_strength: Math.min(
      100,
      Math.round((title.split(" ").filter((w) => w.length > 2).length / 10) * 100)
    ),
    has_promoted_listing: false,
    shipping_type: "calculated" as const,
    views: viewsRaw,
    watchers: watchersRaw,
    impressions: impressionsRaw,
    status: "active",
    updated_at: new Date().toISOString(),
    image_url: row["Picture URL"] || row["image_url"] || undefined,
  };
}

interface CSVUploaderProps {
  userId: string;
  onComplete: (items: InventoryItem[]) => void;
}

export function CSVUploader({ userId, onComplete }: CSVUploaderProps) {
  const [status, setStatus] = useState<"idle" | "parsing" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [count, setCount] = useState(0);

  const processFile = useCallback(
    (file: File) => {
      setStatus("parsing");
      setMessage("Parsing your inventory data...");

      Papa.parse<CSVRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const items: InventoryItem[] = results.data
              .map((row, i) => {
                const mapped = mapCSVToItem(row, userId);
                if (!mapped) return null;
                return {
                  ...mapped,
                  id: `csv-${Date.now()}-${i}`,
                  created_at: new Date().toISOString(),
                } as InventoryItem;
              })
              .filter(Boolean) as InventoryItem[];

            setCount(items.length);
            setStatus("done");
            setMessage(`${items.length} listings imported and scored.`);
            onComplete(items);
          } catch {
            setStatus("error");
            setMessage("Parse failed. Check CSV format.");
          }
        },
        error: () => {
          setStatus("error");
          setMessage("Failed to read file.");
        },
      });
    },
    [userId, onComplete]
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) processFile(accepted[0]);
    },
    [processFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "relative cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition-colors",
          isDragActive
            ? "border-[#E935C1] bg-[#E935C1]/5"
            : status === "done"
            ? "border-emerald-500/50 bg-emerald-500/5"
            : status === "error"
            ? "border-red-500/50 bg-red-500/5"
            : "border-zinc-700 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-800/50"
        )}
      >
        <input {...getInputProps()} />

        {status === "idle" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800">
              <Upload className="h-6 w-6 text-zinc-400" />
            </div>
            <p className="text-sm font-semibold text-zinc-300">
              Drop your eBay CSV export here
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              or click to browse — supports eBay Active Listings export
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5">
              <FileText className="h-3 w-3 text-zinc-500" />
              <span className="text-[11px] text-zinc-500">.CSV files only</span>
            </div>
          </>
        )}

        {status === "parsing" && (
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-[#E935C1]" />
            <p className="text-sm text-zinc-400">{message}</p>
          </div>
        )}

        {status === "done" && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle className="h-10 w-10 text-emerald-400" />
            <p className="text-sm font-semibold text-emerald-400">{message}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setStatus("idle");
              }}
            >
              Upload Another
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-3">
            <AlertCircle className="h-10 w-10 text-red-400" />
            <p className="text-sm text-red-400">{message}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setStatus("idle");
              }}
            >
              Try Again
            </Button>
          </div>
        )}
      </div>

      {/* eBay export hint */}
      <div className="rounded-md border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">
          How to export from eBay
        </p>
        <ol className="mt-2 space-y-1 text-xs text-zinc-600">
          <li>1. Go to Seller Hub → Active Listings</li>
          <li>2. Click "Download report" → Select CSV</li>
          <li>3. Upload the downloaded file above</li>
        </ol>
      </div>
    </div>
  );
}
