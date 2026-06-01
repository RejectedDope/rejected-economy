"use client";

import { useReducer, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";
import { ImportHistory } from "@/components/ingestion/ImportHistory";

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
}

type State = { sessions: UploadSession[]; loading: boolean; error: string | null };
type Action =
  | { type: "loaded"; sessions: UploadSession[] }
  | { type: "error"; error: string };

function reducer(state: State, action: Action): State {
  if (action.type === "loaded") return { sessions: action.sessions, loading: false, error: null };
  return { ...state, loading: false, error: action.error };
}

function StatusIcon({ status }: { status: string }) {
  if (status === "complete") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-red-400" />;
  if (status === "partial") return <AlertCircle className="h-4 w-4 text-yellow-400" />;
  return <Clock className="h-4 w-4 text-zinc-500" />;
}

function StatusLabel({ status }: { status: string }) {
  const styles: Record<string, string> = {
    complete: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
    failed: "text-red-400 border-red-400/30 bg-red-400/10",
    partial: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
    parsing: "text-blue-400 border-blue-400/30 bg-blue-400/10",
    pending: "text-zinc-500 border-zinc-700 bg-zinc-800",
  };
  return (
    <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}

export default function UploadHistoryPage() {
  const [state, dispatch] = useReducer(reducer, { sessions: [], loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      return supabase
        .from("upload_sessions")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);
    }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        dispatch({ type: "error", error: error.message });
      } else {
        dispatch({ type: "loaded", sessions: (data ?? []) as UploadSession[] });
      }
    }).catch((err: unknown) => {
      if (!cancelled) dispatch({ type: "error", error: String(err) });
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href="/inventory"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Inventory
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Upload className="h-3.5 w-3.5 text-[#E935C1]" />
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">
                Import History
              </span>
            </div>
            <h1 className="text-2xl font-black text-zinc-100">Upload History</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Audit trail of all inventory imports.
            </p>
          </div>
          <Link
            href="/inventory/import"
            className="rounded-lg bg-[#E935C1] px-4 py-2 text-sm font-bold text-white hover:opacity-90"
          >
            New Import
          </Link>
        </div>
      </div>

      {state.loading && (
        <div className="py-12 text-center text-sm text-zinc-600">Loading…</div>
      )}

      {state.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {state.error}
        </div>
      )}

      {!state.loading && !state.error && state.sessions.length === 0 && (
        <div className="rounded-xl border border-zinc-800 py-16 text-center">
          <Upload className="mx-auto h-8 w-8 text-zinc-700" />
          <p className="mt-3 text-sm font-semibold text-zinc-600">No imports yet</p>
          <Link
            href="/inventory/import"
            className="mt-4 inline-block text-sm text-[#E935C1] hover:underline"
          >
            Import your first inventory file →
          </Link>
        </div>
      )}

      {state.sessions.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                {["File", "Type", "Status", "Imported", "Skipped", "Dupes", "Date", "Time"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-600">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {state.sessions.map((s) => (
                <tr key={s.id} className="bg-zinc-950 hover:bg-zinc-900/60 transition-colors">
                  <td className="max-w-[200px] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={s.status} />
                      <span className="truncate text-xs text-zinc-200">{s.file_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500 uppercase">{s.file_type}</td>
                  <td className="px-4 py-3"><StatusLabel status={s.status} /></td>
                  <td className="px-4 py-3 text-xs font-semibold text-emerald-400">{s.rows_imported}</td>
                  <td className="px-4 py-3 text-xs text-red-400">{s.rows_failed > 0 ? s.rows_failed : "—"}</td>
                  <td className="px-4 py-3 text-xs text-purple-400">{s.rows_duplicates > 0 ? s.rows_duplicates : "—"}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(s.started_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-700">
                    {s.duration_ms ? `${(s.duration_ms / 1000).toFixed(1)}s` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8">
        <ImportHistory />
      </div>
    </div>
  );
}
