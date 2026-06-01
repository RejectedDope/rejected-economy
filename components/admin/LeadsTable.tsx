"use client";

import { useState, useMemo, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AuditLeadRow, AuditLeadUpdate } from "@/lib/supabase/database.types";
import { parseLeadStatusUpdate, VALID_LEAD_STATUSES } from "@/lib/validation/audit-schema";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Mail, ExternalLink } from "lucide-react";

export type AuditLead = AuditLeadRow;

const STATUS_OPTIONS = VALID_LEAD_STATUSES;
type Status = (typeof STATUS_OPTIONS)[number];

const SELECT_STYLE: Record<Status, string> = {
  new: "border-[#FF2D95]/30 bg-[#FF2D95]/10 text-[#FF2D95]",
  reviewed: "border-yellow-400/30 bg-yellow-400/10 text-yellow-400",
  contacted: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
};

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtRecovery(low: number | null, high: number | null): string {
  if (low == null || high == null) return "—";
  const fmt = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`);
  return `${fmt(low)}–${fmt(high)}`;
}

function SeverityBadge({ score }: { score: number }) {
  if (score >= 60) return <Badge variant="critical">{score}</Badge>;
  if (score >= 45) return <Badge variant="high">{score}</Badge>;
  if (score >= 28) return <Badge variant="medium">{score}</Badge>;
  return <Badge variant="low">{score}</Badge>;
}

const selectBase =
  "h-7 rounded border px-2 text-xs font-bold uppercase tracking-wider bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-[#E935C1] cursor-pointer";

export function LeadsTable({ leads: initial }: { leads: AuditLead[] }) {
  const [leads, setLeads] = useState(initial);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [, startTransition] = useTransition();

  const platforms = useMemo(
    () => Array.from(new Set(leads.map((l) => l.primary_platform))).sort(),
    [leads]
  );

  const filtered = useMemo(() => {
    let r = leads;
    if (statusFilter !== "all") r = r.filter((l) => l.status === statusFilter);
    if (platformFilter !== "all") r = r.filter((l) => l.primary_platform === platformFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.primary_platform.toLowerCase().includes(q) ||
          l.biggest_problem.toLowerCase().includes(q)
      );
    }
    return r;
  }, [leads, search, statusFilter, platformFilter]);

  const counts = useMemo(
    () => ({
      new: leads.filter((l) => l.status === "new").length,
      reviewed: leads.filter((l) => l.status === "reviewed").length,
      contacted: leads.filter((l) => l.status === "contacted").length,
    }),
    [leads]
  );

  async function updateStatus(id: string, rawStatus: string) {
    // Validate status against the canonical enum before any DB write
    const validated = parseLeadStatusUpdate({ status: rawStatus });
    if (!validated) return; // silently reject invalid status values

    const supabase = createClient();
    const patch: AuditLeadUpdate = { status: validated.status };
    if (validated.status !== "new") patch.reviewed_at = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("audit_leads") as any).update(patch).eq("id", id);
    if (!error) {
      startTransition(() =>
        setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
      );
    }
  }

  return (
    <div className="space-y-5">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-1.5 rounded border border-[#FF2D95]/30 bg-[#FF2D95]/10 px-2.5 py-1 text-xs font-bold text-[#FF2D95]">
          {counts.new} New
        </span>
        <span className="inline-flex items-center gap-1.5 rounded border border-yellow-400/30 bg-yellow-400/10 px-2.5 py-1 text-xs font-bold text-yellow-400">
          {counts.reviewed} Reviewed
        </span>
        <span className="inline-flex items-center gap-1.5 rounded border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-400">
          {counts.contacted} Contacted
        </span>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Search name, email, platform, problem…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#E935C1]"
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#E935C1]"
        >
          <option value="all">All platforms</option>
          {platforms.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-zinc-600">
        Showing {filtered.length} of {leads.length} leads
      </p>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-16 text-center">
          <p className="text-sm text-zinc-600">No leads match your filters.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80">
                  {[
                    "Lead",
                    "Platform",
                    "Inventory",
                    "Problem",
                    "Severity",
                    "Recovery Est.",
                    "Action",
                    "Received",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filtered.map((lead) => (
                  <tr
                    key={lead.id}
                    className="bg-zinc-950 transition-colors hover:bg-zinc-900/60"
                  >
                    {/* Lead */}
                    <td className="px-4 py-4">
                      <p className="font-semibold text-zinc-100">{lead.name}</p>
                      <a
                        href={`mailto:${lead.email}`}
                        className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-[#E935C1]"
                      >
                        <Mail className="h-3 w-3" />
                        {lead.email}
                      </a>
                      {lead.listing_url && (
                        <a
                          href={lead.listing_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 flex items-center gap-1 text-xs text-blue-400 transition-colors hover:text-blue-300"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View listing
                        </a>
                      )}
                    </td>

                    {/* Platform */}
                    <td className="whitespace-nowrap px-4 py-4 text-zinc-300">
                      {lead.primary_platform}
                    </td>

                    {/* Inventory count */}
                    <td className="whitespace-nowrap px-4 py-4 text-xs text-zinc-500">
                      {lead.inventory_count}
                    </td>

                    {/* Problem */}
                    <td className="max-w-[180px] px-4 py-4 text-xs text-zinc-400">
                      {lead.biggest_problem}
                    </td>

                    {/* Severity score */}
                    <td className="px-4 py-4">
                      {lead.severity_score != null ? (
                        <SeverityBadge score={lead.severity_score} />
                      ) : (
                        <span className="text-xs text-zinc-700">—</span>
                      )}
                    </td>

                    {/* Recovery estimate */}
                    <td className="whitespace-nowrap px-4 py-4 text-xs font-medium text-emerald-400">
                      {fmtRecovery(lead.recovery_est_low, lead.recovery_est_high)}
                    </td>

                    {/* Suggested action */}
                    <td className="whitespace-nowrap px-4 py-4 text-xs text-zinc-500">
                      {lead.suggested_action
                        ? lead.suggested_action.replace(/_/g, " ")
                        : "—"}
                    </td>

                    {/* Received */}
                    <td className="whitespace-nowrap px-4 py-4 text-xs text-zinc-600">
                      {relativeTime(lead.created_at)}
                    </td>

                    {/* Status dropdown */}
                    <td className="px-4 py-4">
                      <select
                        value={lead.status}
                        onChange={(e) => updateStatus(lead.id, e.target.value)}
                        className={`${selectBase} ${
                          SELECT_STYLE[(lead.status as Status) ?? "new"] ??
                          SELECT_STYLE.new
                        }`}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
