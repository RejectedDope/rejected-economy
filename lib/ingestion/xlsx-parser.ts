// XLSX parser for inventory imports.
// Uses ExcelJS — server-side only (Node.js environment).
// For browser uploads, the file is sent to a server action that calls this.

import ExcelJS from "exceljs";
import { parseCSVString, type CsvParseResult } from "./csv-parser";
import { logger } from "@/lib/logger";

export const XLSX_MAX_BYTES = 20 * 1024 * 1024; // 20 MB
export const XLSX_MAX_SHEETS = 5;

export type XlsxParseResult = CsvParseResult & {
  sheetName: string;
};

// ─── Parse from Buffer ────────────────────────────────────────────────────────
// Called in a Next.js Server Action after receiving the upload.

export async function parseXLSXBuffer(
  rawBuffer: ArrayBuffer | Uint8Array,
  fileName: string
): Promise<XlsxParseResult> {
  // Normalize to Node Buffer for ExcelJS compatibility
  const ab = rawBuffer instanceof ArrayBuffer ? rawBuffer : (rawBuffer as Uint8Array).buffer;
  const sizeBytes = ab.byteLength;
  if (sizeBytes > XLSX_MAX_BYTES) {
    logger.warn("ingestion", "XLSX file too large", { file: fileName, size: sizeBytes });
    return {
      ok: false,
      rows: [],
      errors: [{ rowIndex: 0, message: `File too large: ${(sizeBytes / 1024 / 1024).toFixed(1)} MB (max 20 MB)` }],
      warnings: [],
      skipped: 0,
      totalParsed: 0,
      truncated: false,
      sheetName: "",
    };
  }

  let workbook: ExcelJS.Workbook;
  try {
    workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (workbook.xlsx as any).load(ab);
  } catch (err) {
    logger.error("ingestion", "XLSX load failed", { file: fileName, error: String(err) });
    return {
      ok: false,
      rows: [],
      errors: [{ rowIndex: 0, message: `Cannot open file: ${String(err)}` }],
      warnings: [],
      skipped: 0,
      totalParsed: 0,
      truncated: false,
      sheetName: "",
    };
  }

  // Pick first non-empty sheet (up to XLSX_MAX_SHEETS)
  const sheets = workbook.worksheets.slice(0, XLSX_MAX_SHEETS);
  const sheet = sheets.find((s) => s.rowCount > 1) ?? sheets[0];

  if (!sheet) {
    return {
      ok: false,
      rows: [],
      errors: [{ rowIndex: 0, message: "Workbook is empty" }],
      warnings: [],
      skipped: 0,
      totalParsed: 0,
      truncated: false,
      sheetName: "",
    };
  }

  // Convert sheet → CSV string then reuse CSV parser logic
  const csvLines: string[] = [];
  sheet.eachRow((row, rowNumber) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      // Serialize cell value safely
      let val = "";
      if (cell.value === null || cell.value === undefined) {
        val = "";
      } else if (typeof cell.value === "object" && "text" in cell.value) {
        val = String((cell.value as { text: string }).text);
      } else if (typeof cell.value === "object" && "result" in cell.value) {
        val = String((cell.value as { result: unknown }).result ?? "");
      } else {
        val = String(cell.value);
      }
      // Escape commas and quotes for CSV
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        val = `"${val.replace(/"/g, '""')}"`;
      }
      cells.push(val);
    });
    if (rowNumber === 1 || cells.some((c) => c !== "")) {
      csvLines.push(cells.join(","));
    }
  });

  const csvText = csvLines.join("\n");
  const result = parseCSVString(csvText, `${fileName}[${sheet.name}]`);

  logger.info("ingestion", "XLSX parse complete", {
    file: fileName,
    sheet: sheet.name,
    rows: result.totalParsed,
    ok: result.rows.length,
    errors: result.errors.length,
  });

  return { ...result, sheetName: sheet.name };
}
