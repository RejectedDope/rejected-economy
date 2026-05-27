"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Plug, RefreshCw } from "lucide-react";
import { fetchMarketplaceConnections, type MarketplaceConnection } from "@/app/actions/integrations";

export function SyncHealthWarning() {
  const [connections, setConnections] = useState<MarketplaceConnection[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchMarketplaceConnections()
      .then(({ connections: c }) => setConnections(c))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  const expired = connections.filter(
    (c) =>
      c.status === "expired" ||
      (c.token_expires_at != null && new Date(c.token_expires_at) < new Date())
  );
  const errored = connections.filter((c) => c.status === "error");

  // Only show if there are actionable sync issues
  if (expired.length === 0 && errored.length === 0) return null;

  return (
    <div className="mb-5 flex items-start gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-400" />
      <div className="min-w-0 flex-1">
        {expired.length > 0 && (
          <p className="text-sm font-semibold text-zinc-200">
            {expired.length} marketplace connection{expired.length !== 1 ? "s" : ""} need{expired.length === 1 ? "s" : ""} reconnecting
          </p>
        )}
        {errored.length > 0 && (
          <p className={`text-sm font-semibold text-zinc-200 ${expired.length > 0 ? "mt-0.5" : ""}`}>
            {errored.length} sync connection{errored.length !== 1 ? "s" : ""} reporting errors
          </p>
        )}
        <p className="mt-0.5 text-xs text-zinc-500">
          Recurring inventory sync paused — reconnect to resume automatic updates.
        </p>
      </div>
      <Link
        href="/settings/integrations"
        className="flex shrink-0 items-center gap-1.5 rounded border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-1 text-[11px] font-bold text-yellow-400 hover:bg-yellow-500/20"
      >
        {expired.length > 0 ? (
          <><RefreshCw className="h-3 w-3" /> Reconnect</>
        ) : (
          <><Plug className="h-3 w-3" /> Fix</>
        )}
      </Link>
    </div>
  );
}
