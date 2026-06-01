"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Upload, Clock, CheckCircle2, AlertCircle, Package } from "lucide-react";
import { fetchRecentImportSessions, type ImportSessionsResult } from "@/app/actions/sessions";
import { formatRelativeTime } from "@/lib/utils";

type Props = {
  totalInventoryCount: number;
  isAuthenticated: boolean;
};

export function ImportStatusPanel({ totalInventoryCount, isAuthenticated }: Props) {
  const [data, setData] = useState<ImportSessionsResult | null>(null);
  const [daysSinceLastImport, setDaysSinceLastImport] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchRecentImportSessions(3).then((result) => {
      setData(result);
      if (result?.lastImportAt) {
        setDaysSinceLastImport(
          Math.floor((Date.now() - new Date(result.lastImportAt).getTime()) / 86_400_000)
        );
      }
    }).catch(() => {});
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  const hasImports = (data?.sessions.length ?? 0) > 0;
  const lastSession = data?.sessions[0];

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <div className="flex items-center gap-2">
          <Upload className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Ingestion Status
          </span>
        </div>
        <Link
          href="/inventory/uploads"
          className="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
        >
          View history →
        </Link>
      </div>

      <div className="grid grid-cols-2 divide-x divide-zinc-800 sm:grid-cols-4">
        {/* Total active items */}
        <div className="p-4">
          <div className="mb-1 flex items-center gap-1.5">
            <Package className="h-3 w-3 text-zinc-600" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
              Active Items
            </p>
          </div>
          <p className="text-xl font-black text-zinc-100">{totalInventoryCount}</p>
        </div>

        {/* Last import timestamp */}
        <div className="p-4">
          <div className="mb-1 flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-zinc-600" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
              Last Import
            </p>
          </div>
          {hasImports && data?.lastImportAt ? (
            <p className="text-sm font-bold text-zinc-300">
              {formatRelativeTime(data.lastImportAt)}
            </p>
          ) : (
            <p className="text-sm text-zinc-600">Never</p>
          )}
        </div>

        {/* Import health */}
        <div className="p-4">
          <div className="mb-1 flex items-center gap-1.5">
            {data?.hasFailures ? (
              <AlertCircle className="h-3 w-3 text-yellow-500" />
            ) : (
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            )}
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
              Health
            </p>
          </div>
          <p
            className={`text-sm font-bold ${
              !hasImports
                ? "text-zinc-600"
                : data?.hasFailures
                ? "text-yellow-400"
                : "text-emerald-400"
            }`}
          >
            {!hasImports ? "No imports" : data?.hasFailures ? "Has failures" : "All clean"}
          </p>
        </div>

        {/* Last source file */}
        <div className="p-4">
          <div className="mb-1 flex items-center gap-1.5">
            <Upload className="h-3 w-3 text-zinc-600" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
              Last Source
            </p>
          </div>
          {lastSession ? (
            <p className="truncate text-sm font-bold text-zinc-300" title={lastSession.file_name}>
              {lastSession.file_name}
            </p>
          ) : (
            <Link
              href="/inventory/import"
              className="text-sm font-bold text-[#E935C1] hover:underline"
            >
              Import now →
            </Link>
          )}
        </div>
      </div>

      {/* Last session row breakdown */}
      {lastSession && (
        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800 px-5 py-2">
          <span className="text-[10px] text-zinc-600">Last session:</span>
          <span className="text-[10px] font-bold text-emerald-400">
            {lastSession.rows_imported} imported
          </span>
          {lastSession.rows_duplicates > 0 && (
            <span className="text-[10px] text-purple-400">
              {lastSession.rows_duplicates} duplicates
            </span>
          )}
          {lastSession.rows_failed > 0 && (
            <span className="text-[10px] text-red-400">
              {lastSession.rows_failed} failed
            </span>
          )}
          <span
            className={`ml-auto text-[10px] font-bold uppercase ${
              lastSession.status === "complete"
                ? "text-emerald-400"
                : lastSession.status === "partial"
                ? "text-yellow-400"
                : lastSession.status === "failed"
                ? "text-red-400"
                : "text-zinc-500"
            }`}
          >
            {lastSession.status}
          </span>
        </div>
      )}

      {/* Freshness warning — stale inventory data */}
      {daysSinceLastImport !== null && daysSinceLastImport >= 7 && (
        <div className="flex items-center justify-between gap-3 border-t border-yellow-500/20 bg-yellow-500/5 px-5 py-2.5">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-yellow-400" />
            <p className="text-xs text-yellow-300">
              Last import was {daysSinceLastImport} day{daysSinceLastImport !== 1 ? "s" : ""} ago — your inventory data may be stale.
            </p>
          </div>
          <Link
            href="/inventory/import"
            className="shrink-0 text-xs font-bold text-yellow-400 hover:underline"
          >
            Import now →
          </Link>
        </div>
      )}
    </div>
  );
}
