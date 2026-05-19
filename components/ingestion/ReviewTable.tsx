"use client";

import { useState, useMemo } from "react";
import { AlertTriangle, CheckCircle, XCircle, Eye, EyeOff, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NormalizedRow, NormalizationWarning } from "@/lib/ingestion/normalize";

export type ReviewRow = NormalizedRow & {
  rowIndex: number;
  reviewStatus: "pending" | "approved" | "excluded";
  isDuplicate: boolean;
  duplicateOfRow?: number;
};

interface ReviewTableProps {
  rows: ReviewRow[];
  errors: { rowIndex: number; message: string }[];
  warnings: { rowIndex: number; field?: string; message: string }[];
  skipped: number;
  truncated: boolean;
  onApproveAll: () => void;
  onExcludeRow: (rowIndex: number) => void;
  onRestoreRow: (rowIndex: number) => void;
  onImport: (approvedRows: ReviewRow[]) => void;
  importing: boolean;
}

function importQualityScore(row: ReviewRow): number {
  let score = 50;
  if (row.item_specifics_complete) score += 15;
  if (row.image_count >= 4) score += 10;
  if (row.image_count >= 8) score += 5;
  if (row.title_keyword_strength >= 60) score += 10;
  if (row.shipping_type === "free") score += 5;
  if (row.days_listed > 90) score -= 15;
  if (row.days_listed > 180) score -= 15;
  if (row.views > 0 && row.watchers === 0) score -= 5;
  return Math.max(0, Math.min(100, score));
}

function QualityDot({ score }: { score: number }) {
  const color = score >= 70 ? "bg-emerald-400" : score >= 50 ? "bg-yellow-400" : "bg-red-400";
  return (
    <span
      title={`Import quality: ${score}/100`}
      className={`inline-block h-2 w-2 rounded-full shrink-0 ${color}`}
    />
  );
}

function WarningDot({ warnings }: { warnings: NormalizationWarning[] }) {
  if (!warnings.length) return null;
  return (
    <span title={warnings.map((w) => `${w.field}: ${w.issue}`).join(", ")}>
      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
    </span>
  );
}

function StatusBadge({ status, isDuplicate }: { status: ReviewRow["reviewStatus"]; isDuplicate: boolean }) {
  if (isDuplicate) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-purple-400/30 bg-purple-400/10 px-2 py-0.5 text-xs font-bold text-purple-400">
        Duplicate
      </span>
    );
  }
  if (status === "excluded") {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-zinc-600/30 bg-zinc-600/10 px-2 py-0.5 text-xs font-bold text-zinc-500">
        Excluded
      </span>
    );
  }
  return null;
}

export function ReviewTable({
  rows,
  errors,
  warnings,
  skipped,
  truncated,
  onApproveAll,
  onExcludeRow,
  onRestoreRow,
  onImport,
  importing,
}: ReviewTableProps) {
  const [showExcluded, setShowExcluded] = useState(false);
  const [showErrors, setShowErrors] = useState(errors.length > 0);

  const approved = rows.filter((r) => r.reviewStatus === "approved" && !r.isDuplicate);
  const excluded = rows.filter((r) => r.reviewStatus === "excluded");
  const duplicates = rows.filter((r) => r.isDuplicate);
  const withWarnings = rows.filter((r) => r.warnings.length > 0);

  const visible = useMemo(
    () =>
      showExcluded
        ? rows
        : rows.filter((r) => r.reviewStatus !== "excluded"),
    [rows, showExcluded]
  );

  const warningsByRow = useMemo(() => {
    const map = new Map<number, { field?: string; message: string }[]>();
    warnings.forEach((w) => {
      if (!map.has(w.rowIndex)) map.set(w.rowIndex, []);
      map.get(w.rowIndex)!.push(w);
    });
    return map;
  }, [warnings]);

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-1.5 rounded border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-400">
          <CheckCircle className="h-3 w-3" />
          {approved.length} ready
        </span>
        {duplicates.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded border border-purple-400/30 bg-purple-400/10 px-2.5 py-1 text-xs font-bold text-purple-400">
            {duplicates.length} duplicates
          </span>
        )}
        {withWarnings.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-bold text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            {withWarnings.length} with warnings
          </span>
        )}
        {excluded.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded border border-zinc-600/30 bg-zinc-800 px-2.5 py-1 text-xs font-bold text-zinc-500">
            {excluded.length} excluded
          </span>
        )}
        {skipped > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-400">
            <XCircle className="h-3 w-3" />
            {skipped} skipped (errors)
          </span>
        )}
        {truncated && (
          <span className="inline-flex items-center gap-1.5 rounded border border-orange-400/30 bg-orange-400/10 px-2.5 py-1 text-xs font-bold text-orange-400">
            <Info className="h-3 w-3" />
            File truncated at 10,000 rows
          </span>
        )}
      </div>

      {/* Parse errors */}
      {showErrors && errors.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-red-400">
              {errors.length} rows rejected (missing required fields)
            </p>
            <button
              onClick={() => setShowErrors(false)}
              className="text-xs text-zinc-600 hover:text-zinc-400"
            >
              Hide
            </button>
          </div>
          <ul className="mt-2 space-y-1">
            {errors.slice(0, 10).map((e, i) => (
              <li key={i} className="text-xs text-red-300/80">
                Row {e.rowIndex}: {e.message}
              </li>
            ))}
            {errors.length > 10 && (
              <li className="text-xs text-zinc-600">
                …and {errors.length - 10} more
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={onApproveAll}
          className="rounded border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-400 transition-colors hover:bg-emerald-400/20"
        >
          Approve all
        </button>
        <button
          onClick={() => setShowExcluded((v) => !v)}
          className="flex items-center gap-1.5 rounded border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-400 transition-colors hover:border-zinc-600"
        >
          {showExcluded ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {showExcluded ? "Hide excluded" : "Show excluded"}
        </button>
        <span className="ml-auto text-xs text-zinc-600">
          Showing {visible.length} of {rows.length} rows
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                {["Row", "Title", "Platform", "Price", "Days", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-600"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {visible.map((row) => {
                const rowWarnings = warningsByRow.get(row.rowIndex) ?? [];
                const isExcluded = row.reviewStatus === "excluded";
                return (
                  <tr
                    key={row.rowIndex}
                    className={cn(
                      "bg-zinc-950 transition-colors",
                      isExcluded ? "opacity-40" : "hover:bg-zinc-900/60"
                    )}
                  >
                    <td className="px-4 py-3 text-xs text-zinc-600">{row.rowIndex}</td>
                    <td className="max-w-[280px] px-4 py-3">
                      <div className="flex items-center gap-2">
                        <QualityDot score={importQualityScore(row)} />
                        <WarningDot warnings={row.warnings} />
                        <span className="truncate text-xs text-zinc-200">{row.title}</span>
                      </div>
                      {rowWarnings.length > 0 && (
                        <p className="mt-0.5 text-xs text-amber-400/70">
                          {rowWarnings[0].message}
                          {rowWarnings.length > 1 && ` +${rowWarnings.length - 1} more`}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-400">
                      {row.platform}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-zinc-300">
                      ${row.price.toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">
                      {row.days_listed}d
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.reviewStatus} isDuplicate={row.isDuplicate} />
                    </td>
                    <td className="px-4 py-3">
                      {isExcluded ? (
                        <button
                          onClick={() => onRestoreRow(row.rowIndex)}
                          className="text-xs text-zinc-500 hover:text-zinc-300"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          onClick={() => onExcludeRow(row.rowIndex)}
                          className="text-xs text-zinc-600 hover:text-red-400"
                        >
                          Exclude
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {visible.length === 0 && (
          <div className="py-12 text-center text-sm text-zinc-600">
            No rows to review.
          </div>
        )}
      </div>

      {/* Import CTA */}
      <div className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-5 py-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-zinc-200">
            Import {approved.length} listing{approved.length !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-zinc-600">
            {excluded.length > 0
              ? `${excluded.length} excluded · ${duplicates.length} duplicates skipped`
              : duplicates.length > 0
              ? `${duplicates.length} duplicates will be skipped`
              : "All rows will be imported"}
          </p>
        </div>
        <button
          onClick={() => onImport(approved)}
          disabled={approved.length === 0 || importing}
          className="rounded-lg bg-[#E935C1] px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {importing ? "Importing…" : "Import to inventory"}
        </button>
      </div>
    </div>
  );
}
