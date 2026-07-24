export type EpnPlacement = {
  key: string;
  campaign: string;
  campaignId: string;
  customId: string;
  label: string;
  href: string;
  analyticsEvent: string;
};

export const EPN_DISCLOSURE =
  "Some outbound marketplace links are affiliate links. Rejected Treasures may earn a commission at no additional cost to you.";

export const epnPlacements: Record<string, EpnPlacement> = {
  intelligenceCoachCurrent: {
    key: "intelligenceCoachCurrent",
    campaign: "RESALEIQ-RESEARCH",
    campaignId: "5339172309",
    customId: "intelcoachcurrentresult",
    label: "View Current Listings on eBay",
    href: "https://www.ebay.com/sch/i.html?_nkw=vintage+coach+bag&mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=5339172309&customid=intelcoachcurrentresult&toolid=10001&mkevt=1",
    analyticsEvent: "epn_click_intel_current",
  },
  intelligenceCoachComps: {
    key: "intelligenceCoachComps",
    campaign: "RESALEIQ-COMPS",
    campaignId: "5339172312",
    customId: "intelcoachcompsresult",
    label: "Research Comparable Listings",
    href: "https://www.ebay.com/sch/i.html?_nkw=vintage+coach+bag&LH_Sold=1&LH_Complete=1&mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=5339172312&customid=intelcoachcompsresult&toolid=10001&mkevt=1",
    analyticsEvent: "epn_click_intel_comps",
  },
  curatorCoachGuide: {
    key: "curatorCoachGuide",
    campaign: "CURATOR-CONTENT",
    campaignId: "5339172314",
    customId: "curatorcoachguideshopbottom",
    label: "Shop Current Vintage Coach Examples",
    href: "https://www.ebay.com/sch/i.html?_nkw=vintage+coach+bag&mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=5339172314&customid=curatorcoachguideshopbottom&toolid=10001&mkevt=1",
    analyticsEvent: "epn_click_curator_coach",
  },
  facebookCoachGuide: {
    key: "facebookCoachGuide",
    campaign: "SOCIAL-FACEBOOK",
    campaignId: "5339172315",
    customId: "facebookcoachguide0726",
    label: "Browse Vintage Coach on eBay",
    href: "https://www.ebay.com/sch/i.html?_nkw=vintage+coach+bag&mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=5339172315&customid=facebookcoachguide0726&toolid=10001&mkevt=1",
    analyticsEvent: "epn_social_facebook_coach",
  },
  pinterestCoachGuide: {
    key: "pinterestCoachGuide",
    campaign: "SOCIAL-PINTEREST",
    campaignId: "5339172317",
    customId: "pinterestcoachguide0726",
    label: "Browse Vintage Coach on eBay",
    href: "https://www.ebay.com/sch/i.html?_nkw=vintage+coach+bag&mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=5339172317&customid=pinterestcoachguide0726&toolid=10001&mkevt=1",
    analyticsEvent: "epn_social_pinterest_coach",
  },
};
