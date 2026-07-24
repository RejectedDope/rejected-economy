"use client";

import { ExternalLink } from "lucide-react";
import { EPN_DISCLOSURE, type EpnPlacement } from "@/lib/affiliate/epn";

type Props = {
  title?: string;
  placements: EpnPlacement[];
};

export function EbayAffiliateActions({
  title = "Explore the Market",
  placements,
}: Props) {
  const trackClick = (placement: EpnPlacement) => {
    if (typeof window === "undefined") return;

    window.dispatchEvent(
      new CustomEvent("resaleiq:affiliate-click", {
        detail: {
          event: placement.analyticsEvent,
          campaign: placement.campaign,
          campaignId: placement.campaignId,
          customId: placement.customId,
          placement: placement.key,
        },
      }),
    );
  };

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E935C1]">
          Marketplace research
        </p>
        <h2 className="mt-1 text-xl font-black text-zinc-100">{title}</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {placements.map((placement) => (
          <a
            key={placement.key}
            href={placement.href}
            target="_blank"
            rel="sponsored nofollow noopener noreferrer"
            onClick={() => trackClick(placement)}
            className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-bold text-zinc-100 transition hover:border-[#E935C1]/70 hover:text-white"
          >
            <span>{placement.label}</span>
            <ExternalLink className="h-4 w-4 shrink-0 text-[#E935C1]" />
          </a>
        ))}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-zinc-500">
        {EPN_DISCLOSURE}
      </p>
    </section>
  );
}
