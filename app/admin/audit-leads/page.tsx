import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { LeadsTable, type AuditLead } from "@/components/admin/LeadsTable";
import { supabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AdminAuditLeadsPage() {
  let leads: AuditLead[] = [];
  let fetchError: string | null = null;

  if (supabaseConfigured) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("audit_leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) fetchError = error.message;
    else leads = (data ?? []) as AuditLead[];
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
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
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Admin
            </span>
            <span className="text-zinc-700">/</span>
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-300">
              Audit Leads
            </span>
          </div>
          <Link
            href="/dashboard"
            className="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      {/* Page header */}
      <div className="border-b border-zinc-800/60 bg-zinc-900/30 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#E935C1]">
            Internal Admin
          </p>
          <h1 className="mt-1 text-xl font-black text-zinc-100">Audit Leads</h1>
          {!fetchError && (
            <p className="mt-1 text-sm text-zinc-600">
              {leads.length} total ·{" "}
              {leads.filter((l) => l.status === "new").length} unreviewed
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {fetchError ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-6">
            <p className="text-sm font-bold text-red-400">Failed to load leads</p>
            <p className="mt-1 text-xs text-zinc-600">{fetchError}</p>
            <p className="mt-3 text-xs text-zinc-700">
              Make sure migration 003_audit_scoring.sql has been run and the
              authenticated select policy is in place.
            </p>
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-16 text-center">
            <p className="text-sm font-bold text-zinc-500">No leads yet</p>
            <p className="mt-2 text-xs text-zinc-700">
              Leads appear here after someone submits the{" "}
              <Link
                href="/recovery-audit"
                className="text-[#E935C1] hover:underline"
              >
                Free Recovery Audit
              </Link>{" "}
              form.
            </p>
          </div>
        ) : (
          <LeadsTable leads={leads} />
        )}
      </main>
    </div>
  );
}
