"use client";

import { useParams, usePathname } from "next/navigation";
import { EbayAffiliateActions } from "@/components/affiliate/EbayAffiliateActions";
import { epnPlacements } from "@/lib/affiliate/epn";
import { useInventoryItem } from "@/lib/hooks/useInventoryItem";

export function ContextualCoachMarketActions() {
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const { item, loading } = useInventoryItem(id);

  const isInventoryDetail = pathname.startsWith("/inventory/") && id.length > 0;
  const itemText = `${item?.title ?? ""} ${item?.category ?? ""}`.toLowerCase();
  const isCoach = itemText.includes("coach");

  if (!isInventoryDetail || loading || !item || !isCoach) return null;

  return (
    <div className="px-4 pb-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <EbayAffiliateActions
          title="Research This Coach Item on eBay"
          placements={[
            epnPlacements.intelligenceCoachCurrent,
            epnPlacements.intelligenceCoachComps,
          ]}
        />
      </div>
    </div>
  );
}
