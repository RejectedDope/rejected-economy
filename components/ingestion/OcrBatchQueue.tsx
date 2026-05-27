"use client";

import { useEffect, useRef, useState } from "react";
import {
  Scan,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Image as ImageIcon,
} from "lucide-react";
import type { ExtractedListingFields } from "@/lib/ingestion/screenshot-parser";

export type OcrBatchEntry = {
  file: File;
  status: "queued" | "processing" | "done" | "failed";
  progress: number;
  statusText: string;
  fields: ExtractedListingFields | null;
  isDuplicate: boolean;
  previewUrl: string | null;
};

interface OcrBatchQueueProps {
  files: File[];
  onExtracted: (idx: number, fields: ExtractedListingFields) => void;
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high:   "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  medium: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  low:    "text-orange-400 bg-orange-400/10 border-orange-400/30",
  none:   "text-zinc-500 bg-zinc-800 border-zinc-700",
};

function buildInitialEntries(files: File[]): OcrBatchEntry[] {
  const seen = new Map<string, number>();
  return files.map((file) => {
    const key = `${file.name}-${file.size}`;
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    const previewUrl =
      typeof window !== "undefined" ? URL.createObjectURL(file) : null;
    return {
      file,
      status: "queued",
      progress: 0,
      statusText: "Queued",
      fields: null,
      isDuplicate: count > 0,
      previewUrl,
    };
  });
}

export function OcrBatchQueue({ files, onExtracted }: OcrBatchQueueProps) {
  const [entries, setEntries] = useState<OcrBatchEntry[]>(() =>
    buildInitialEntries(files)
  );
  const processingRef = useRef(false);

  function updateEntry(idx: number, patch: Partial<OcrBatchEntry>) {
    setEntries((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, ...patch } : e))
    );
  }

  async function processFile(idx: number, file: File) {
    updateEntry(idx, { status: "processing", progress: 5, statusText: "Starting…" });
    try {
      const { extractFromScreenshot } = await import("@/lib/ingestion/ocr");
      const result = await extractFromScreenshot(file, (pct, text) => {
        updateEntry(idx, { progress: pct, statusText: text });
      });
      updateEntry(idx, {
        status: "done",
        progress: 100,
        statusText: "Complete",
        fields: result,
      });
      onExtracted(idx, result);
    } catch {
      updateEntry(idx, {
        status: "failed",
        progress: 0,
        statusText: "Extraction failed",
        fields: { confidence: "none", extractionMethod: "none" },
      });
    }
  }

  // Drain queue sequentially on mount
  useEffect(() => {
    if (processingRef.current) return;
    processingRef.current = true;

    const initialEntries = buildInitialEntries(files);

    async function drain() {
      for (let i = 0; i < initialEntries.length; i++) {
        if (!initialEntries[i].isDuplicate) {
          await processFile(i, files[i]);
        }
      }
      processingRef.current = false;
    }

    drain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function retry(idx: number) {
    updateEntry(idx, { status: "queued", progress: 0, statusText: "Queued", fields: null });
    await processFile(idx, files[idx]);
  }

  const done      = entries.filter((e) => e.status === "done").length;
  const failed    = entries.filter((e) => e.status === "failed").length;
  const total     = entries.length;
  const dupeCount = entries.filter((e) => e.isDuplicate).length;
  const pct       = total > 0 ? Math.round(((done + failed) / total) * 100) : 0;
  const allDone   = done + failed + dupeCount >= total;

  return (
    <div className="space-y-3">
      {/* Batch header */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Scan className="h-4 w-4 text-[#E935C1]" />
            <span className="text-sm font-bold text-zinc-200">
              OCR Queue — {total} image{total !== 1 ? "s" : ""}
            </span>
            {dupeCount > 0 && (
              <span className="rounded border border-yellow-500/30 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-bold text-yellow-400">
                {dupeCount} duplicate{dupeCount !== 1 ? "s" : ""} skipped
              </span>
            )}
          </div>
          <span className="text-xs font-semibold text-zinc-500">
            {done}/{total - dupeCount} done
          </span>
        </div>

        {/* Progress bar */}
        {!allDone && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-[#E935C1] transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {allDone && failed === 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            All images processed — review extracted fields below
          </div>
        )}
        {allDone && failed > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-orange-400">
            <AlertTriangle className="h-3 w-3" />
            {failed} image{failed !== 1 ? "s" : ""} failed — retry individually or skip
          </div>
        )}
      </div>

      {/* Per-image cards */}
      <div className="space-y-2">
        {entries.map((entry, idx) => (
          <div
            key={idx}
            className={`rounded-lg border bg-zinc-900 p-3 transition-colors ${
              entry.isDuplicate
                ? "border-yellow-500/20 opacity-60"
                : entry.status === "done"
                  ? "border-emerald-500/20"
                  : entry.status === "failed"
                    ? "border-red-500/20"
                    : entry.status === "processing"
                      ? "border-[#E935C1]/30"
                      : "border-zinc-800"
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Thumbnail */}
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-zinc-700 bg-zinc-800">
                {entry.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.previewUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-5 w-5 text-zinc-600" />
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-xs font-semibold text-zinc-300">
                    {entry.file.name}
                  </p>
                  {entry.isDuplicate && (
                    <span className="shrink-0 rounded border border-yellow-500/30 bg-yellow-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-yellow-500">
                      Duplicate
                    </span>
                  )}
                </div>

                {/* Status line */}
                {!entry.isDuplicate && (
                  <div className="mt-1 flex items-center gap-2">
                    {entry.status === "processing" && (
                      <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[#E935C1]" />
                    )}
                    {entry.status === "done" && (
                      <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
                    )}
                    {entry.status === "failed" && (
                      <AlertCircle className="h-3 w-3 shrink-0 text-red-400" />
                    )}
                    <span className="text-[11px] text-zinc-500">{entry.statusText}</span>

                    {/* Progress bar inline */}
                    {entry.status === "processing" && (
                      <div className="flex-1">
                        <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-[#E935C1] transition-all"
                            style={{ width: `${entry.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Extracted fields summary */}
                {entry.status === "done" && entry.fields && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      {entry.fields.confidence && (
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                            CONFIDENCE_COLORS[entry.fields.confidence] ?? CONFIDENCE_COLORS.none
                          }`}
                        >
                          {entry.fields.confidence} confidence
                        </span>
                      )}
                    </div>
                    {entry.fields.title && (
                      <p className="truncate text-[11px] text-zinc-400">
                        <span className="text-zinc-600">Title: </span>{entry.fields.title}
                      </p>
                    )}
                    {entry.fields.price !== undefined && (
                      <p className="text-[11px] text-zinc-400">
                        <span className="text-zinc-600">Price: </span>${entry.fields.price}
                      </p>
                    )}
                    {!entry.fields.title && (
                      <p className="text-[11px] text-orange-400">
                        No title extracted — may need manual entry
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Retry button */}
              {entry.status === "failed" && !entry.isDuplicate && (
                <button
                  onClick={() => retry(idx)}
                  className="flex shrink-0 items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] font-semibold text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
                >
                  <RefreshCw className="h-2.5 w-2.5" />
                  Retry
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
