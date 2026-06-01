import { redirect } from "next/navigation";
import Link from "next/link";
import { BarChart3, AlertTriangle, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { requireAdmin, isPermissionError } from "@/lib/auth/admin";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

interface UploadSession {
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
  error_log: string | null;
}

interface IngestionFailure {
  id: string;
  session_id: string;
  row_index: number;
  error_type: string;
  error_message: string;
  raw_row: Record<string, unknown>;
  created_at: string;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    complete: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
    failed: "text-red-400 border-red-400/30 bg-red-400/10",
    partial: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
    parsing: "text-blue-400 border-blue-400/30 bg-blue-400/10",
    pending: "text-zinc-500 border-zinc-700 bg-zinc-800",
  };
  const icons: Record<string, React.ReactNode> = {
    complete: <CheckCircle2 className="h-3 w-3" />,
    failed: <XCircle className="h-3 w-3" />,
    partial: <AlertCircle className="h-3 w-3" />,
    pending: <Clock className="h-3 w-3" />,
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold ${styles[status] ?? styles.pending}`}>
      {icons[status] ?? <Clock className="h-3 w-3" />}
      {status}
    </span>
  );
}

export default async function AdminIngestionPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/login");

  let sessions: UploadSession[] = [];
  let failures: IngestionFailure[] = [];
  let fetchError: string | null = null;

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const [sessionsRes, failuresRes] = await Promise.all([
      supabase
        .from("upload_sessions")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(100),
      supabase
        .from("ingestion_failures")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (sessionsRes.error) {
      fetchError = isPermissionError(sessionsRes.error)
        ? "Permission denied — run migration 007_upload_audit.sql"
        : sessionsRes.error.message;
      logger.supabaseError("upload_sessions", "select", sessionsRes.error.message, { adminUserId: auth.userId });
    } else {
      sessions = (sessionsRes.data ?? []) as UploadSession[];
      failures = (failuresRes.data ?? []) as IngestionFailure[];
      logger.info("admin", "Ingestion monitor loaded", {
        sessions: sessions.length,
        failures: failures.length,
        adminUserId: auth.userId,
      });
    }
  } catch (err) {
    fetchError = "Failed to connect to database";
    logger.error("admin", "Unexpected error loading ingestion data", err, { adminUserId: auth.userId });
  }

  const failuresBySession = failures.reduce<Record<string, IngestionFailure[]>>((acc, f) => {
    (acc[f.session_id] ??= []).push(f);
    return acc;
  }, {});

  const totalFailed = sessions.reduce((s, r) => s + (r.rows_failed ?? 0), 0);
  const totalImported = sessions.reduce((s, r) => s + (r.rows_imported ?? 0), 0);

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-[#E935C1]">
                <BarChart3 className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-xs font-black uppercase tracking-widest">
                <span className="text-zinc-400">Resale</span>
                <span className="text-[#E935C1]">IQ</span>
              </span>
            </Link>
            <span className="text-zinc-700">/</span>
            <Link href="/admin/audit-leads" className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300">
              Admin
            </Link>
            <span className="text-zinc-700">/</span>
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-300">
              Ingestion Monitor
            </span>
          </div>
          <Link href="/dashboard" className="text-xs text-zinc-600 transition-colors hover:text-zinc-400">
            Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="border-b border-zinc-800/60 bg-zinc-900/30 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#E935C1]">Internal Admin</p>
          <h1 className="mt-1 text-xl font-black text-zinc-100">Ingestion Monitor</h1>
          {!fetchError && (
            <p className="mt-1 text-sm text-zinc-600">
              {sessions.length} import sessions · {totalImported.toLocaleString()} rows imported · {totalFailed.toLocaleString()} failed
            </p>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        {fetchError ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-6">
            <p className="text-sm font-bold text-red-400">Failed to load ingestion data</p>
            <p className="mt-1 text-xs text-zinc-600">{fetchError}</p>
          </div>
        ) : (
          <>
            {/* Admin nav */}
            <div className="flex flex-wrap gap-3">
              <Link href="/admin/audit-leads" className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:border-zinc-500 hover:text-zinc-200">
                Audit Leads
              </Link>
              <span className="rounded-lg border border-[#E935C1]/40 bg-[#E935C1]/10 px-3 py-1.5 text-xs font-semibold text-[#E935C1]">
                Ingestion Monitor
              </span>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Total Sessions", value: sessions.length, color: "text-zinc-100" },
                { label: "Rows Imported", value: totalImported.toLocaleString(), color: "text-emerald-400" },
                { label: "Rows Failed", value: totalFailed.toLocaleString(), color: totalFailed > 0 ? "text-red-400" : "text-zinc-500" },
                { label: "Failed Sessions", value: sessions.filter(s => s.status === "failed").length, color: "text-red-400" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">{stat.label}</p>
                  <p className={`mt-1 text-2xl font-black ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Sessions table */}
            {sessions.length === 0 ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 py-16 text-center">
                <p className="text-sm font-semibold text-zinc-600">No import sessions yet</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-zinc-800">
                <div className="border-b border-zinc-800 bg-zinc-900/80 px-4 py-3">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Import Sessions</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800/60 bg-zinc-900/40">
                        {["File", "Type", "Status", "In File", "Imported", "Failed", "Dupes", "Duration", "Date"].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40">
                      {sessions.map((s) => {
                        const sessionFailures = failuresBySession[s.id] ?? [];
                        return (
                          <>
                            <tr key={s.id} className="bg-zinc-950 hover:bg-zinc-900/50 transition-colors">
                              <td className="max-w-[200px] px-4 py-3">
                                <p className="truncate text-xs font-medium text-zinc-200">{s.file_name}</p>
                                {s.error_log && (
                                  <p className="mt-0.5 truncate text-[10px] text-red-400">{s.error_log}</p>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs uppercase text-zinc-500">{s.file_type}</td>
                              <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                              <td className="px-4 py-3 text-xs text-zinc-400">{s.rows_in_file ?? "—"}</td>
                              <td className="px-4 py-3 text-xs font-semibold text-emerald-400">{s.rows_imported}</td>
                              <td className="px-4 py-3 text-xs text-red-400">
                                {s.rows_failed > 0 ? (
                                  <span className="flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    {s.rows_failed}
                                  </span>
                                ) : "—"}
                              </td>
                              <td className="px-4 py-3 text-xs text-purple-400">{s.rows_duplicates > 0 ? s.rows_duplicates : "—"}</td>
                              <td className="px-4 py-3 text-xs text-zinc-600">
                                {s.duration_ms ? `${(s.duration_ms / 1000).toFixed(1)}s` : "—"}
                              </td>
                              <td className="px-4 py-3 text-xs text-zinc-600">
                                {new Date(s.started_at).toLocaleDateString()}
                              </td>
                            </tr>
                            {sessionFailures.length > 0 && (
                              <tr key={`${s.id}-failures`} className="bg-red-950/20">
                                <td colSpan={9} className="px-4 py-2">
                                  <details className="text-xs">
                                    <summary className="cursor-pointer font-semibold text-red-400 hover:text-red-300">
                                      {sessionFailures.length} row failure{sessionFailures.length !== 1 ? "s" : ""} — expand
                                    </summary>
                                    <div className="mt-2 space-y-1">
                                      {sessionFailures.slice(0, 10).map((f) => (
                                        <div key={f.id} className="flex items-start gap-3 rounded border border-red-900/30 bg-red-950/30 px-3 py-1.5">
                                          <span className="shrink-0 text-zinc-600">Row {f.row_index}</span>
                                          <span className="text-red-300">{f.error_message}</span>
                                          <span className="ml-auto shrink-0 text-zinc-700">{f.error_type}</span>
                                        </div>
                                      ))}
                                      {sessionFailures.length > 10 && (
                                        <p className="px-3 text-zinc-700">+ {sessionFailures.length - 10} more failures</p>
                                      )}
                                    </div>
                                  </details>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
