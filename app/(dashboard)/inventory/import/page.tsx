"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, AlertCircle, Lock } from "lucide-react";
import Link from "next/link";
import { FileUploader, type UploadedFile } from "@/components/ingestion/FileUploader";
import { ReviewTable, type ReviewRow } from "@/components/ingestion/ReviewTable";
import { ScreenshotReviewer } from "@/components/ingestion/ScreenshotReviewer";
import { OcrBatchQueue } from "@/components/ingestion/OcrBatchQueue";
import { ColumnMapper, type ColumnMapping } from "@/components/ingestion/ColumnMapper";
import {
  parseCSVFile,
  parseCSVHeaders,
  parseCSVFileWithMapping,
  detectMappedFields,
  detectPlatformFromFilename,
  type CsvParseResult,
  type CsvRowError,
} from "@/lib/ingestion/csv-parser";
import { validateScreenshotFile, type ExtractedListingFields } from "@/lib/ingestion/screenshot-parser";
import { normalizePlatform, normalizePrice } from "@/lib/ingestion/normalize";
import { detectDuplicates, type NormalizedRow } from "@/lib/ingestion/normalize";
import { checkBatchTrust, type QuarantinedRow } from "@/lib/ingestion/trust-layer";
import { importInventoryItems } from "@/app/actions/inventory";
import { parseXLSXAction } from "@/app/actions/import";
import { fetchUsageSummary } from "@/app/actions/usage";
import { hasFeature } from "@/lib/subscription/tiers";
import { logger } from "@/lib/logger";

type Stage = "upload" | "map" | "review" | "done";

type ImportState = {
  result: CsvParseResult | null;
  rows: ReviewRow[];
  errors: CsvRowError[];
  warnings: CsvRowError[];
  screenshotCount: number;
};

type ScreenshotEntry = {
  file: File;
  fields: ExtractedListingFields | null;
};

function ocrFieldsToNormalizedRow(fields: ExtractedListingFields): NormalizedRow | null {
  const priceResult = normalizePrice(fields.price);
  if (!priceResult.ok) return null;
  return {
    title: fields.title ?? "Untitled Screenshot Import",
    platform: normalizePlatform(fields.platform),
    category: fields.category ?? "Other",
    price: priceResult.value,
    days_listed: fields.days_listed ? parseInt(fields.days_listed, 10) || 0 : 0,
    item_specifics_complete: false,
    image_count: 0,
    title_keyword_strength: 50,
    has_promoted_listing: false,
    shipping_type: "free",
    views: fields.views ? parseInt(fields.views, 10) || 0 : 0,
    watchers: fields.watchers ? parseInt(fields.watchers, 10) || 0 : 0,
    impressions: 0,
    status: "active",
    warnings: [],
  };
}

function buildReviewRows(normalizedRows: NormalizedRow[]): ReviewRow[] {
  const { duplicates } = detectDuplicates(normalizedRows);
  const dupeKeys = new Set(duplicates.map((d) => d.item));

  return normalizedRows.map((row, idx) => ({
    ...row,
    rowIndex: idx + 1,
    reviewStatus: "approved" as const,
    isDuplicate: dupeKeys.has(row),
    duplicateOfRow: duplicates.find((d) => d.item === row)?.firstSeenAt,
  }));
}

export default function ImportPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("upload");
  const [importState, setImportState] = useState<ImportState>({
    result: null,
    rows: [],
    errors: [],
    warnings: [],
    screenshotCount: 0,
  });
  const [screenshotEntries, setScreenshotEntries] = useState<ScreenshotEntry[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0); // 0–100 simulated progress
  const [quotaWarning, setQuotaWarning] = useState<string | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [importSkipped, setImportSkipped] = useState(0);
  const [importDuplicates, setImportDuplicates] = useState(0);
  const [importQuarantined, setImportQuarantined] = useState(0);
  const [quarantinedRows, setQuarantinedRows] = useState<QuarantinedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [featureBlocked, setFeatureBlocked] = useState<"xlsx" | "ocr" | null>(null);
  // Plan feature access (fetched once on mount)
  const [hasXlsxAccess, setHasXlsxAccess] = useState(true);
  const [hasOcrAccess, setHasOcrAccess] = useState(true);
  // Column mapping state
  const [pendingCsvFile, setPendingCsvFile] = useState<File | null>(null);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);

  useEffect(() => {
    fetchUsageSummary().then((summary) => {
      if (summary) {
        setHasXlsxAccess(hasFeature(summary.planId, "xlsx_import"));
        setHasOcrAccess(hasFeature(summary.planId, "screenshot_ocr"));
      }
    }).catch(() => {});
  }, []);

  const handleFilesAccepted = useCallback((files: UploadedFile[]) => {
    setParseError(null);
    const csvFiles = files.filter((f) => f.type === "csv" || f.type === "xlsx");
    const screenshots = files.filter((f) => f.type === "screenshot");

    let screenshotWarnings = 0;
    screenshots.forEach((s) => {
      const v = validateScreenshotFile({ name: s.file.name, size: s.file.size, type: s.file.type });
      if (!v.valid) screenshotWarnings++;
    });

    if (csvFiles.length === 0 && screenshots.length > 0) {
      // Gate OCR for free-plan users
      if (!hasOcrAccess) {
        setFeatureBlocked("ocr");
        return;
      }
      // Screenshots only — stage for OCR review
      const validScreenshots = screenshots.filter((s) =>
        validateScreenshotFile({ name: s.file.name, size: s.file.size, type: s.file.type }).valid
      );
      setScreenshotEntries(validScreenshots.map((s) => ({ file: s.file, fields: null })));
      setImportState({
        result: null,
        rows: [],
        errors: [],
        warnings: [],
        screenshotCount: screenshots.length - screenshotWarnings,
      });
      setStage("review");
      return;
    }

    if (csvFiles.length === 0) {
      setParseError("No parseable files found. Upload a CSV, XLSX, or screenshot.");
      return;
    }

    // Process first CSV file (batch: future enhancement)
    const first = csvFiles[0];

    if (first.type === "xlsx") {
      // Gate XLSX for free-plan users
      if (!hasXlsxAccess) {
        setFeatureBlocked("xlsx");
        return;
      }
      const fd = new FormData();
      fd.append("file", first.file);
      parseXLSXAction(fd).then((result) => {
        if (result.rows.length === 0 && result.errors.length > 0) {
          setParseError("Could not parse XLSX. Check the file is a valid inventory spreadsheet.");
          return;
        }
        const trust = checkBatchTrust(result.rows);
        setQuarantinedRows(trust.quarantined);
        const reviewRows = buildReviewRows(trust.valid);
        setImportState({ result, rows: reviewRows, errors: result.errors, warnings: result.warnings, screenshotCount: screenshots.length });
        setStage("review");
      }).catch((err: unknown) => {
        setParseError(`XLSX parse failed: ${String(err)}`);
      });
      return;
    }

    // Extract headers first to enable column mapping step
    parseCSVHeaders(first.file).then((headers) => {
      setPendingCsvFile(first.file);
      setDetectedHeaders(headers);
      setImportState((prev) => ({ ...prev, screenshotCount: screenshots.length }));
      setStage("map");
    });
  }, [hasOcrAccess, hasXlsxAccess]);

  function processCsvWithMapping(file: File, mapping: ColumnMapping | null) {
    const parse = mapping
      ? (cb: Parameters<typeof parseCSVFile>[1]) => parseCSVFileWithMapping(file, mapping, cb)
      : (cb: Parameters<typeof parseCSVFile>[1]) => parseCSVFile(file, cb);

    parse((result) => {
      logger.info("ingestion", "CSV parsed", { file: file.name, rows: result.totalParsed, ok: result.rows.length });
      if (result.rows.length === 0) {
        // Surface what went wrong so the user can act
        const topErrors = result.errors.slice(0, 3).map((e) => e.message).join("; ");
        const hint = detectMappedFields(detectedHeaders);
        const missing: string[] = [];
        if (!hint.hasTitle) missing.push("title");
        if (!hint.hasPrice) missing.push("price");
        const missingMsg = missing.length > 0
          ? ` Missing required columns: ${missing.join(", ")}.`
          : "";
        const platformHint = detectPlatformFromFilename(file.name);
        const platformMsg = platformHint ? ` Platform detected: ${platformHint}.` : "";
        setParseError(
          `No rows could be imported.${missingMsg}${platformMsg}` +
          (topErrors ? ` Errors: ${topErrors}` : " Try re-mapping columns.")
        );
        setStage("upload");
        return;
      }
      const trust = checkBatchTrust(result.rows);
      setQuarantinedRows(trust.quarantined);
      const reviewRows = buildReviewRows(trust.valid);
      setImportState((prev) => ({ ...prev, result, rows: reviewRows, errors: result.errors, warnings: result.warnings }));
      setStage("review");
    });
  }

  function handleMappingConfirmed(mapping: ColumnMapping) {
    if (pendingCsvFile) processCsvWithMapping(pendingCsvFile, mapping);
  }

  function handleMappingSkipped() {
    if (pendingCsvFile) processCsvWithMapping(pendingCsvFile, null);
  }

  function handleApproveAll() {
    setImportState((prev) => ({
      ...prev,
      rows: prev.rows.map((r) =>
        r.isDuplicate ? r : { ...r, reviewStatus: "approved" }
      ),
    }));
  }

  function handleExcludeRow(rowIndex: number) {
    setImportState((prev) => ({
      ...prev,
      rows: prev.rows.map((r) =>
        r.rowIndex === rowIndex ? { ...r, reviewStatus: "excluded" } : r
      ),
    }));
  }

  function handleRestoreRow(rowIndex: number) {
    setImportState((prev) => ({
      ...prev,
      rows: prev.rows.map((r) =>
        r.rowIndex === rowIndex ? { ...r, reviewStatus: "approved" } : r
      ),
    }));
  }

  async function handleImport(approvedRows: ReviewRow[]) {
    setIsImporting(true);
    setImportProgress(5);

    // Simulate progress while server-side insert runs (100 rows ≈ 500ms per batch)
    const rowCount = approvedRows.length;
    const estimatedMs = Math.max(2000, Math.ceil(rowCount / 100) * 800);
    const tickMs = 200;
    const tickStep = Math.floor(80 / (estimatedMs / tickMs)); // advance to ~85% over estimated time
    progressRef.current = setInterval(() => {
      setImportProgress((p) => Math.min(85, p + tickStep));
    }, tickMs);

    try {
      const normalizedRows: NormalizedRow[] = approvedRows.map(
        ({ rowIndex: _r, reviewStatus: _s, isDuplicate: _d, duplicateOfRow: _o, ...row }) =>
          row as NormalizedRow
      );
      const result = await importInventoryItems(normalizedRows, true);

      if (progressRef.current) clearInterval(progressRef.current);
      setImportProgress(100);

      setImportedCount(result.inserted);
      setImportSkipped(result.skipped ?? 0);
      setImportDuplicates(result.duplicates ?? 0);
      setImportQuarantined(result.quarantined ?? 0);
      if (result.quota_warning) setQuotaWarning(result.quota_warning);
      if (result.errors.length > 0) {
        logger.warn("ingestion", "Import completed with errors", { errors: result.errors });
      }
      logger.info("ingestion", "Import complete", { inserted: result.inserted, skipped: result.skipped, duplicates: result.duplicates });
      import("@/app/actions/snapshots").then(({ writePortfolioSnapshot, writeItemSnapshots }) => {
        writePortfolioSnapshot("import_trigger").catch(() => {});
        writeItemSnapshots().catch(() => {});
      }).catch(() => {});
      setStage("done");
    } catch (err) {
      if (progressRef.current) clearInterval(progressRef.current);
      setImportProgress(0);
      logger.error("ingestion", "Import failed", { error: String(err) });
      setParseError(String(err));
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/inventory"
          className="flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to inventory
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-black tracking-tight text-zinc-100">
          Import Inventory
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Upload CSV exports, spreadsheets, or listing screenshots. Review before importing.
        </p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-4">
        {[
          { id: "upload", label: "Upload" },
          { id: "map", label: "Map Columns" },
          { id: "review", label: "Review" },
          { id: "done", label: "Done" },
        ].map((step, idx) => {
          const stages: Stage[] = ["upload", "map", "review", "done"];
          const current = stages.indexOf(stage);
          const stepIdx = stages.indexOf(step.id as Stage);
          return (
            <div key={step.id} className="flex items-center gap-3">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  stepIdx < current
                    ? "bg-emerald-500 text-white"
                    : stepIdx === current
                    ? "bg-[#E935C1] text-white"
                    : "border border-zinc-700 text-zinc-600"
                }`}
              >
                {stepIdx < current ? "✓" : idx + 1}
              </div>
              <span
                className={`text-sm font-semibold ${
                  stepIdx === current ? "text-zinc-100" : "text-zinc-600"
                }`}
              >
                {step.label}
              </span>
              {idx < 3 && <div className="h-px w-8 bg-zinc-800" />}
            </div>
          );
        })}
      </div>

      {/* Stage content */}
      {stage === "upload" && (
        <div className="space-y-6">
          <FileUploader onFilesAccepted={handleFilesAccepted} />

          {/* Feature gate: XLSX or OCR blocked by plan */}
          {featureBlocked && (
            <div className="flex items-start justify-between gap-4 rounded-xl border border-[#E935C1]/30 bg-[#E935C1]/5 px-5 py-4">
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#E935C1]" />
                <div>
                  <p className="text-sm font-bold text-zinc-200">
                    {featureBlocked === "xlsx" ? "XLSX Import" : "Screenshot OCR"} requires Starter or higher
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {featureBlocked === "xlsx"
                      ? "Upgrade to import Excel spreadsheets directly."
                      : "Upgrade to extract listing data from screenshots."}
                  </p>
                </div>
              </div>
              <Link
                href="/settings/plan"
                onClick={() => setFeatureBlocked(null)}
                className="shrink-0 rounded-lg bg-[#E935C1] px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
              >
                View Plans →
              </Link>
            </div>
          )}

          {parseError && (
            <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
              <p className="text-sm text-red-300">{parseError}</p>
            </div>
          )}

          {/* Export guides */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-600">
              How to export your inventory
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                {
                  platform: "eBay",
                  steps: ["Seller Hub → Reports", "Request a report → Active listings", "Download CSV when ready"],
                  color: "text-yellow-400",
                },
                {
                  platform: "Poshmark",
                  steps: ["Account Settings → My Inventory", "Export Closet → Download CSV", "Use the exported file directly"],
                  color: "text-red-400",
                },
                {
                  platform: "Mercari",
                  steps: ["Profile → Selling → All listings", "Screenshot or manually export", "Upload screenshots for OCR extraction"],
                  color: "text-blue-400",
                },
                {
                  platform: "Other / Custom",
                  steps: ["Export any CSV with Title, Price, Days Listed", "Column mapper will align headers", "Supports any structured spreadsheet"],
                  color: "text-zinc-400",
                },
              ].map((guide) => (
                <div key={guide.platform} className="rounded-lg border border-zinc-800 p-3">
                  <p className={`mb-2 text-xs font-bold ${guide.color}`}>{guide.platform}</p>
                  <ol className="space-y-0.5">
                    {guide.steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-zinc-600">
                        <span className="mt-0.5 shrink-0 font-bold text-zinc-700">{i + 1}.</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {stage === "map" && detectedHeaders.length > 0 && (
        <ColumnMapper
          detectedColumns={detectedHeaders}
          onMappingConfirmed={handleMappingConfirmed}
          onSkip={handleMappingSkipped}
        />
      )}

      {stage === "review" && (
        <div className="space-y-4">
          {/* Screenshot OCR Review */}
          {screenshotEntries.length > 0 && importState.rows.length === 0 && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-zinc-400">
                {screenshotEntries.length === 1
                  ? "Review extracted fields below. Correct any errors, then import."
                  : `Processing ${screenshotEntries.length} screenshots. Review extracted fields, then import.`}
              </p>

              {screenshotEntries.length === 1 ? (
                <ScreenshotReviewer
                  file={screenshotEntries[0].file}
                  onExtracted={(fields) => {
                    setScreenshotEntries((prev) =>
                      prev.map((e, i) => i === 0 ? { ...e, fields } : e)
                    );
                  }}
                />
              ) : (
                <OcrBatchQueue
                  files={screenshotEntries.map((e) => e.file)}
                  onExtracted={(idx, fields) => {
                    setScreenshotEntries((prev) =>
                      prev.map((e, i) => i === idx ? { ...e, fields } : e)
                    );
                  }}
                />
              )}

              <button
                onClick={() => {
                  const validRows: NormalizedRow[] = screenshotEntries
                    .filter((e) => e.fields && e.fields.title)
                    .map((e) => ocrFieldsToNormalizedRow(e.fields!))
                    .filter((r): r is NormalizedRow => r !== null);
                  if (validRows.length > 0) {
                    const reviewRows = buildReviewRows(validRows);
                    setImportState((prev) => ({ ...prev, rows: reviewRows }));
                  }
                }}
                className="w-full rounded-lg border border-[#E935C1]/30 bg-[#E935C1]/10 py-2.5 text-sm font-bold text-[#E935C1] hover:bg-[#E935C1]/20 transition-colors"
              >
                Continue to Review →
              </button>
            </div>
          )}

          {/* Quarantined rows panel */}
          {quarantinedRows.length > 0 && (
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-400" />
                <p className="text-sm font-bold text-yellow-300">
                  {quarantinedRows.length} row{quarantinedRows.length !== 1 ? "s" : ""} quarantined — blocked from import
                </p>
              </div>
              <p className="mb-3 text-xs text-zinc-500">
                These rows failed data validation. Fix the source file and re-import to include them.
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {quarantinedRows.slice(0, 20).map(({ row, rowIndex, violations }) => (
                  <div key={rowIndex} className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2">
                    <p className="text-xs font-semibold text-zinc-300 truncate">{row.title || "(no title)"}</p>
                    <p className="text-[11px] text-yellow-500">
                      {violations.map((v) => v.message).join(" · ")}
                    </p>
                  </div>
                ))}
                {quarantinedRows.length > 20 && (
                  <p className="text-[11px] text-zinc-600 text-center pt-1">
                    …and {quarantinedRows.length - 20} more
                  </p>
                )}
              </div>
            </div>
          )}

          {importState.rows.length > 0 && (
            <>
              {isImporting && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-zinc-300">
                      Importing {importState.rows.length} items…
                    </p>
                    <p className="text-xs text-zinc-500">{importProgress}%</p>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-[#E935C1] transition-all duration-200"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-zinc-600">
                    Scoring and deduplicating — this may take a few seconds for large batches.
                  </p>
                </div>
              )}
              <ReviewTable
                rows={importState.rows}
                errors={importState.errors}
                warnings={importState.warnings}
                skipped={importState.result?.skipped ?? 0}
                truncated={importState.result?.truncated ?? false}
                onApproveAll={handleApproveAll}
                onExcludeRow={handleExcludeRow}
                onRestoreRow={handleRestoreRow}
                onImport={handleImport}
                importing={isImporting}
              />
            </>
          )}

          {importState.rows.length === 0 && importState.screenshotCount === 0 && (
            <div className="rounded-lg border border-zinc-800 px-6 py-12 text-center">
              <p className="text-sm text-zinc-600">No rows to review.</p>
              <button
                onClick={() => setStage("upload")}
                className="mt-3 text-sm text-[#E935C1] hover:underline"
              >
                Go back and try again
              </button>
            </div>
          )}
        </div>
      )}

      {stage === "done" && (
        <div className="space-y-4">
          {/* Success header */}
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-8 py-10 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
            <h2 className="mt-4 text-xl font-bold text-zinc-100">
              Import Complete
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {importedCount} listings scored and ready for analysis.
            </p>
          </div>

          {/* Import summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
              <p className="text-2xl font-black text-emerald-400">{importedCount}</p>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-widest text-zinc-600">Imported</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
              <p className="text-2xl font-black text-purple-400">{importDuplicates}</p>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-widest text-zinc-600">Duplicates</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
              <p className="text-2xl font-black text-yellow-400">{importQuarantined}</p>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-widest text-zinc-600">Quarantined</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
              <p className="text-2xl font-black text-zinc-500">{importSkipped}</p>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-widest text-zinc-600">Skipped</p>
            </div>
          </div>

          {/* Quota warning */}
          {quotaWarning && (
            <div className="flex items-start gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
              <p className="text-sm text-yellow-300">{quotaWarning}</p>
            </div>
          )}

          {/* What happens next — first-import walkthrough */}
          {importedCount > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500">
                What happens next
              </p>
              <div className="space-y-3">
                {[
                  {
                    step: "1",
                    title: "View your scored inventory",
                    body: "Each listing has been scored 0–100 for inventory decay. Higher score = more urgent action needed.",
                    href: "/inventory",
                    cta: "View Inventory →",
                  },
                  {
                    step: "2",
                    title: "See your trapped cash",
                    body: "The dashboard shows total value locked in stale listings — sorted by recovery urgency.",
                    href: "/dashboard",
                    cta: "Open Dashboard →",
                  },
                  {
                    step: "3",
                    title: "Run a recovery audit",
                    body: "Get a prioritized action list: what to relist, what to markdown, what to liquidate — with specific steps per platform.",
                    href: "/recovery",
                    cta: "Recovery Center →",
                  },
                ].map(({ step, title, body, href, cta }) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 text-xs font-black text-zinc-400">
                      {step}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-200">{title}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">{body}</p>
                    </div>
                    <Link href={href} className="shrink-0 text-xs font-bold text-[#E935C1] hover:underline">
                      {cta}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next step CTAs */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => router.push("/dashboard")}
              className="flex-1 rounded-lg bg-[#E935C1] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90"
            >
              View Dashboard →
            </button>
            <button
              onClick={() => router.push("/recovery")}
              className="flex-1 rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
            >
              Recovery Center →
            </button>
            <button
              onClick={() => router.push("/inventory")}
              className="flex-1 rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-400 hover:border-zinc-500"
            >
              View Inventory
            </button>
          </div>

          <button
            onClick={() => {
              setStage("upload");
              setImportState({ result: null, rows: [], errors: [], warnings: [], screenshotCount: 0 });
              setImportedCount(0);
              setImportSkipped(0);
              setImportDuplicates(0);
              setImportQuarantined(0);
              setQuarantinedRows([]);
              setImportProgress(0);
              setQuotaWarning(null);
            }}
            className="w-full text-xs text-zinc-600 hover:text-zinc-400 py-1"
          >
            Import another file
          </button>
        </div>
      )}
    </div>
  );
}
