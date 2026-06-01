"use server";

import { parseXLSXBuffer } from "@/lib/ingestion/xlsx-parser";
import type { CsvParseResult } from "@/lib/ingestion/csv-parser";

export type ParseFileResult = CsvParseResult & {
  sheetName?: string;
};

export async function parseXLSXAction(formData: FormData): Promise<ParseFileResult> {
  const file = formData.get("file") as File | null;
  if (!file) {
    return {
      ok: false,
      rows: [],
      errors: [{ rowIndex: 0, message: "No file provided" }],
      warnings: [],
      skipped: 0,
      totalParsed: 0,
      truncated: false,
    };
  }

  const buffer = await file.arrayBuffer();
  const result = await parseXLSXBuffer(buffer, file.name);
  return result;
}
