"use server";

import { createClient } from "@/lib/supabase/server";

export type ImportSessionSummary = {
  id: string;
  file_name: string;
  file_type: string;
  status: string;
  rows_in_file: number;
  rows_imported: number;
  rows_failed: number;
  rows_duplicates: number;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
};

export type ImportSessionsResult = {
  sessions: ImportSessionSummary[];
  totalImported: number;
  lastImportAt: string | null;
  hasFailures: boolean;
};

export async function fetchRecentImportSessions(
  limit = 5
): Promise<ImportSessionsResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { sessions: [], totalImported: 0, lastImportAt: null, hasFailures: false };
    }

    const { data, error } = await supabase
      .from("upload_sessions")
      .select(
        "id, file_name, file_type, status, rows_in_file, rows_imported, rows_failed, rows_duplicates, started_at, completed_at, duration_ms"
      )
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      return { sessions: [], totalImported: 0, lastImportAt: null, hasFailures: false };
    }

    const totalImported = data.reduce((sum, s) => sum + (s.rows_imported ?? 0), 0);
    const lastImportAt = data[0]?.completed_at ?? data[0]?.started_at ?? null;
    const hasFailures = data.some(
      (s) => (s.rows_failed ?? 0) > 0 || s.status === "failed"
    );

    return {
      sessions: data as ImportSessionSummary[],
      totalImported,
      lastImportAt,
      hasFailures,
    };
  } catch {
    return { sessions: [], totalImported: 0, lastImportAt: null, hasFailures: false };
  }
}
