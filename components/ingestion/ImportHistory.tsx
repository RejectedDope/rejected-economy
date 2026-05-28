"use client";

import { useEffect, useState } from "react";
import { History, Trash2, Package, Loader2, ChevronDown } from "lucide-react";
import { fetchImportBatches, type ImportBatch } from "@/app/actions/imports";
import { undoImportBatch } from "@/app/actions/inventory";

const SOURCE_LABELS: Record<string, string> = {
  csv_import: "CSV",
  ocr_import: "OCR",
  ebay_sync: "eBay Sync",
  manual: "Manual",
};

function SourceBadge({ source }: { source: string | null }) {
  const label = source ? (SOURCE_LABELS[source] ?? source) : "Import";
  return (
    <span className="rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">
      {label}
    </span>
  );
}

function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return null;
  return (
    <span className="rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">
      {platform}
    </span>
  );
}

function BatchRow({
  batch,
  onUndo,
}: {
  batch: ImportBatch;
  onUndo: (batchId: string) => void;
}) {
  const [undoing, setUndoing] = useState(false);

  async function handleUndo() {
    const confirmed = window.confirm(
      `Remove ${batch.item_count} item${batch.item_count === 1 ? "" : "s"} from this import?`
    );
    if (!confirmed) return;

    setUndoing(true);
    try {
      const result = await undoImportBatch(batch.batch_id);
      if (result.ok) {
        onUndo(batch.batch_id);
      }
    } finally {
      setUndoing(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-zinc-800/50 last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <Package className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
        <span className="text-xs text-zinc-500 whitespace-nowrap">
          {new Date(batch.imported_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        <span className="text-xs font-semibold text-emerald-400 whitespace-nowrap">
          {batch.item_count} item{batch.item_count === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <PlatformBadge platform={batch.platform} />
          <SourceBadge source={batch.source} />
        </div>
      </div>
      <button
        onClick={handleUndo}
        disabled={undoing}
        className="flex items-center gap-1 rounded border border-red-400/40 px-2 py-1 text-[11px] font-semibold text-red-400 hover:bg-red-500/20 hover:border-red-400/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
      >
        {undoing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Trash2 className="h-3 w-3" />
        )}
        Undo
      </button>
    </div>
  );
}

const PAGE_SIZE = 10;

export function ImportHistory() {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchImportBatches(20)
      .then(({ batches: data }) => {
        if (!cancelled) {
          setBatches(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleUndo(batchId: string) {
    setBatches((prev) => prev.filter((b) => b.batch_id !== batchId));
    setSuccessMsg("Import removed successfully.");
    setTimeout(() => setSuccessMsg(null), 3000);
  }

  const visible = expanded ? batches : batches.slice(0, PAGE_SIZE);
  const hasMore = batches.length > PAGE_SIZE;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center gap-2 mb-4">
        <History className="h-4 w-4 text-zinc-500" />
        <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Import History</h2>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
        </div>
      )}

      {!loading && batches.length === 0 && (
        <p className="py-6 text-center text-sm text-zinc-600">No imports yet</p>
      )}

      {!loading && batches.length > 0 && (
        <>
          {successMsg && (
            <div className="mb-3 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
              {successMsg}
            </div>
          )}

          <div>
            {visible.map((batch) => (
              <BatchRow key={batch.batch_id} batch={batch} onUndo={handleUndo} />
            ))}
          </div>

          {hasMore && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="mt-3 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              View all ({batches.length} batches)
            </button>
          )}
        </>
      )}
    </div>
  );
}
