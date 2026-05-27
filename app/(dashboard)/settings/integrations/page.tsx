"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plug,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Unplug,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Link2,
} from "lucide-react";
import {
  fetchMarketplaceConnections,
  getEbayAuthUrl,
  disconnectMarketplace,
  type MarketplaceConnection,
  type MarketplacePlatform,
} from "@/app/actions/integrations";
import { fetchUsageSummary } from "@/app/actions/usage";
import { hasFeature } from "@/lib/subscription/tiers";
import { FeatureGate } from "@/components/subscription/FeatureGate";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const PLATFORM_META: Record<string, { label: string; color: string; oauthSupported: boolean; comingSoon?: boolean }> = {
  ebay:      { label: "eBay",               color: "#E1A100", oauthSupported: true },
  poshmark:  { label: "Poshmark",           color: "#D83B6A", oauthSupported: false, comingSoon: true },
  mercari:   { label: "Mercari",            color: "#FF4F4F", oauthSupported: false, comingSoon: true },
  depop:     { label: "Depop",              color: "#FF4040", oauthSupported: false, comingSoon: true },
  facebook:  { label: "Facebook Marketplace", color: "#1877F2", oauthSupported: false, comingSoon: true },
  grailed:   { label: "Grailed",            color: "#E02020", oauthSupported: false, comingSoon: true },
  whatnot:   { label: "Whatnot",            color: "#6C5CE7", oauthSupported: false, comingSoon: true },
  stockx:    { label: "StockX",             color: "#00FF87", oauthSupported: false, comingSoon: true },
  goat:      { label: "GOAT",               color: "#AAAAAA", oauthSupported: false, comingSoon: true },
};

const ALL_PLATFORMS = Object.keys(PLATFORM_META) as MarketplacePlatform[];

function statusIcon(status: MarketplaceConnection["status"] | "disconnected") {
  switch (status) {
    case "connected":     return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
    case "expired":       return <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />;
    case "error":         return <AlertCircle   className="h-3.5 w-3.5 text-red-400" />;
    case "pending":       return <Loader2 className="h-3.5 w-3.5 animate-spin text-[#E935C1]" />;
    default:              return <Unplug className="h-3.5 w-3.5 text-zinc-600" />;
  }
}

function statusLabel(status: MarketplaceConnection["status"] | "disconnected") {
  switch (status) {
    case "connected":   return "Connected";
    case "expired":     return "Token expired";
    case "error":       return "Error";
    case "pending":     return "Connecting…";
    default:            return "Not connected";
  }
}

function formatSyncAge(lastSyncAt: string | null): string {
  if (!lastSyncAt) return "Never synced";
  const diff = Date.now() - new Date(lastSyncAt).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1)   return "Synced recently";
  if (hours < 24)  return `Synced ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Synced ${days}d ago`;
}

function IntegrationsContent() {
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<Map<MarketplacePlatform, MarketplaceConnection>>(new Map());
  const [loading, setLoading] = useState(true);
  const [connectingPlatform, setConnectingPlatform] = useState<MarketplacePlatform | null>(null);
  const [disconnectingPlatform, setDisconnectingPlatform] = useState<MarketplacePlatform | null>(null);
  const [hasIntegrationAccess, setHasIntegrationAccess] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(() => {
    const connected = searchParams.get("connected");
    const error     = searchParams.get("error");
    if (connected) {
      const meta = PLATFORM_META[connected];
      return { message: `${meta?.label ?? connected} connected successfully`, type: "success" };
    }
    if (error === "ebay_auth_failed") {
      return { message: "eBay connection failed — please try again", type: "error" };
    }
    return null;
  });

  // Clean OAuth redirect params from URL on mount (side-effect only, no setState)
  useEffect(() => {
    if (searchParams.get("connected") || searchParams.get("error")) {
      window.history.replaceState({}, "", "/settings/integrations");
    }
    // intentional: only on mount to clean OAuth callback params
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    fetchUsageSummary()
      .then((usage) => setHasIntegrationAccess(hasFeature(usage?.planId ?? null, "api_sync")))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchMarketplaceConnections().then(({ connections: fetched }) => {
      const map = new Map<MarketplacePlatform, MarketplaceConnection>();
      for (const c of fetched) map.set(c.platform, c);
      setConnections(map);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleConnect(platform: MarketplacePlatform) {
    if (platform !== "ebay") return;
    setConnectingPlatform(platform);
    try {
      const { url, error } = await getEbayAuthUrl();
      if (error || !url) {
        setToast({ message: error ?? "Could not initiate connection", type: "error" });
        return;
      }
      window.location.href = url;
    } finally {
      setConnectingPlatform(null);
    }
  }

  async function handleDisconnect(platform: MarketplacePlatform) {
    setDisconnectingPlatform(platform);
    try {
      const result = await disconnectMarketplace(platform);
      if (!result.ok) {
        setToast({ message: result.error ?? "Disconnect failed", type: "error" });
        return;
      }
      setConnections((prev) => {
        const next = new Map(prev);
        const existing = next.get(platform);
        if (existing) next.set(platform, { ...existing, status: "disconnected", access_token: undefined } as MarketplaceConnection);
        else next.delete(platform);
        return next;
      });
      setToast({ message: `${PLATFORM_META[platform]?.label ?? platform} disconnected`, type: "success" });
    } finally {
      setDisconnectingPlatform(null);
    }
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed right-4 top-4 z-50 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold shadow-lg transition-all ${
          toast.type === "success"
            ? "border-emerald-500/30 bg-zinc-900 text-emerald-400"
            : "border-red-500/30 bg-zinc-900 text-red-400"
        }`}>
          {toast.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="mb-1 flex items-center gap-2">
          <Plug className="h-3.5 w-3.5 text-[#E935C1]" />
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">Settings</span>
          <span className="text-zinc-700">/</span>
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Integrations</span>
        </div>
        <h1 className="text-2xl font-black text-zinc-100">Marketplace Connections</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Connect your selling accounts to enable recurring sync and automated inventory management.
          Tokens are stored securely and never shared.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading connections…
        </div>
      ) : (
        <div className="max-w-2xl space-y-4">
          {/* Access gate notice */}
          {!hasIntegrationAccess && (
            <div className="rounded-lg border border-[#E935C1]/20 bg-[#E935C1]/5 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Link2 className="h-4 w-4 text-[#E935C1]" />
                  <div>
                    <p className="text-sm font-semibold text-zinc-200">Marketplace Sync</p>
                    <p className="text-xs text-zinc-500">
                      Direct marketplace connections require a Business plan
                    </p>
                  </div>
                </div>
                <a
                  href="/settings/plan"
                  className="shrink-0 rounded border border-[#E935C1]/30 bg-[#E935C1]/10 px-2.5 py-1 text-[11px] font-bold text-[#E935C1] hover:bg-[#E935C1]/20"
                >
                  Upgrade →
                </a>
              </div>
            </div>
          )}

          {/* Platform cards */}
          {ALL_PLATFORMS.map((platform) => {
            const meta       = PLATFORM_META[platform];
            const connection = connections.get(platform);
            const status     = connection?.status ?? "disconnected";
            const isConnected = status === "connected";
            const isExpired   = status === "expired";
            const isOAuth     = meta.oauthSupported;
            const isConnecting   = connectingPlatform === platform;
            const isDisconnecting = disconnectingPlatform === platform;

            return (
              <FeatureGate
                key={platform}
                hasAccess={hasIntegrationAccess || isConnected}
                requiredTier="Business"
                label={meta.label}
              >
                <div className={`rounded-xl border bg-zinc-900 p-4 transition-colors ${
                  isConnected
                    ? "border-emerald-500/20"
                    : isExpired
                      ? "border-yellow-500/20"
                      : "border-zinc-800"
                }`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {/* Platform color dot */}
                      <div
                        className="h-8 w-8 shrink-0 rounded-md border border-zinc-700 bg-zinc-800 flex items-center justify-center"
                        style={{ borderColor: isConnected ? `${meta.color}40` : undefined, backgroundColor: isConnected ? `${meta.color}15` : undefined }}
                      >
                        <span className="text-[10px] font-black uppercase" style={{ color: meta.color }}>
                          {meta.label.slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-zinc-200">{meta.label}</p>
                          {meta.comingSoon && !isConnected && (
                            <span className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-600">
                              Coming Soon
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          {statusIcon(status)}
                          <span className={`text-[11px] ${
                            isConnected ? "text-emerald-400" : isExpired ? "text-yellow-400" : "text-zinc-600"
                          }`}>
                            {statusLabel(status)}
                            {isConnected && connection?.account_name
                              ? ` — ${connection.account_name}`
                              : ""}
                          </span>
                        </div>
                        {isConnected && (
                          <p className="mt-0.5 text-[10px] text-zinc-600">
                            <Clock className="inline h-2.5 w-2.5 mr-0.5" />
                            {formatSyncAge(connection?.last_sync_at ?? null)}
                          </p>
                        )}
                        {connection?.last_sync_error && (
                          <p className="mt-0.5 text-[10px] text-red-400 truncate max-w-xs">
                            {connection.last_sync_error}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-2">
                      {isConnected ? (
                        <>
                          <button
                            onClick={() => {}}
                            className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                            title="Trigger manual sync"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Sync Now
                          </button>
                          <button
                            onClick={() => handleDisconnect(platform)}
                            disabled={isDisconnecting}
                            className="flex items-center gap-1 rounded border border-red-500/20 bg-red-500/5 px-2.5 py-1.5 text-[11px] font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                          >
                            {isDisconnecting ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Unplug className="h-3 w-3" />
                            )}
                            Disconnect
                          </button>
                        </>
                      ) : isExpired ? (
                        <button
                          onClick={() => isOAuth ? handleConnect(platform) : undefined}
                          disabled={isConnecting || !isOAuth}
                          className="flex items-center gap-1 rounded border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-yellow-400 hover:bg-yellow-500/20 disabled:opacity-50"
                        >
                          {isConnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                          Reconnect
                        </button>
                      ) : isOAuth ? (
                        <button
                          onClick={() => handleConnect(platform)}
                          disabled={isConnecting || !hasIntegrationAccess}
                          className="flex items-center gap-1 rounded border border-[#E935C1]/30 bg-[#E935C1]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#E935C1] hover:bg-[#E935C1]/20 disabled:opacity-50"
                        >
                          {isConnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                          Connect
                        </button>
                      ) : (
                        <span className="text-[10px] text-zinc-700 italic">Manual import only</span>
                      )}
                    </div>
                  </div>
                </div>
              </FeatureGate>
            );
          })}

          {/* Disclaimer */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="text-xs text-zinc-600 leading-relaxed">
              Connecting a marketplace account enables read-only inventory sync — ResaleIQ never modifies
              your listings automatically. All sync activity is logged and can be reviewed below.
              Disconnect at any time to revoke access.
            </p>
          </div>

          <Link
            href="/settings"
            className="block text-xs text-zinc-600 transition-colors hover:text-zinc-400"
          >
            ← Back to Settings
          </Link>
        </div>
      )}
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center gap-2 px-4 py-8 text-sm text-zinc-600">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    }>
      <IntegrationsContent />
    </Suspense>
  );
}
