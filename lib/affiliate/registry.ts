export type EpnPriority = "highest" | "high" | "medium" | "low";

export type EpnPlacement = {
  section: string;
  surface: string;
  cta: string;
  campaign: string;
  customId: string;
  destinationType: "ebay-search" | "ebay-item" | "content-page";
  disclosure: string;
  analyticsEvent: string;
  priority: EpnPriority;
  affiliateUrl?: string;
};

export const EPN_CAMPAIGNS = [
  "RT-SHOP",
  "RT-EDITORIAL",
  "RT-RESOURCES",
  "RESALEIQ-RESEARCH",
  "RESALEIQ-COMPS",
  "CURATOR-CONTENT",
  "SOCIAL-FACEBOOK",
  "SOCIAL-INSTAGRAM",
  "SOCIAL-PINTEREST",
  "EMAIL",
  "DEALS",
  "SOURCING",
] as const;

export const EPN_DISCLOSURES = {
  website: "This site contains affiliate links for which we may be compensated.",
  tool: "Some outbound marketplace links may be affiliate links, which may earn us a commission at no additional cost to you.",
} as const;

export const EPN_PLACEMENTS: EpnPlacement[] = [
  {
    section: "Rejected Scout",
    surface: "Item discovery result",
    cta: "Search this on eBay",
    campaign: "RESALEIQ-RESEARCH",
    customId: "scout-item-search-result",
    destinationType: "ebay-search",
    disclosure: EPN_DISCLOSURES.tool,
    analyticsEvent: "epn_click_scout_search",
    priority: "high",
  },
  {
    section: "Rejected Scout",
    surface: "Item discovery result",
    cta: "See similar items",
    campaign: "RESALEIQ-RESEARCH",
    customId: "scout-item-similar-result",
    destinationType: "ebay-search",
    disclosure: EPN_DISCLOSURES.tool,
    analyticsEvent: "epn_click_scout_similar",
    priority: "high",
  },
  {
    section: "Rejected Intelligence",
    surface: "Market analysis result",
    cta: "View Current Listings on eBay",
    campaign: "RESALEIQ-RESEARCH",
    customId: "intel-item-current-result",
    destinationType: "ebay-search",
    disclosure: EPN_DISCLOSURES.tool,
    analyticsEvent: "epn_click_intel_current",
    priority: "highest",
  },
  {
    section: "Rejected Intelligence",
    surface: "Market analysis result",
    cta: "Research Comparable Listings",
    campaign: "RESALEIQ-COMPS",
    customId: "intel-item-comps-result",
    destinationType: "ebay-search",
    disclosure: EPN_DISCLOSURES.tool,
    analyticsEvent: "epn_click_intel_comps",
    priority: "highest",
  },
  {
    section: "Rejected Intelligence",
    surface: "Market analysis result",
    cta: "Shop Similar Pieces",
    campaign: "RESALEIQ-RESEARCH",
    customId: "intel-item-similar-result",
    destinationType: "ebay-search",
    disclosure: EPN_DISCLOSURES.tool,
    analyticsEvent: "epn_click_intel_similar",
    priority: "high",
  },
  {
    section: "Rejected Curator",
    surface: "Vintage Coach Worth Knowing",
    cta: "Shop Current Vintage Coach Examples",
    campaign: "CURATOR-CONTENT",
    customId: "curator-coach-guide-shop-bottom",
    destinationType: "ebay-search",
    disclosure: EPN_DISCLOSURES.website,
    analyticsEvent: "epn_click_curator_coach",
    priority: "highest",
  },
];

/**
 * EPN links must be generated through an approved EPN linking tool.
 * This registry intentionally stores the generated affiliate URL rather than
 * attempting to construct or modify EPN tracking URLs in application code.
 */
export function getEpnPlacement(customId: string): EpnPlacement | undefined {
  return EPN_PLACEMENTS.find((placement) => placement.customId === customId);
}
