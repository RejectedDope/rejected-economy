// Centralized recovery action registry.
// Single source of truth for action labels, urgency, rationale, steps, and recovery rates.
// Replaces scattered ACTION_LABELS maps and inline reasoning across pages.

import type { RecoveryAction, Platform } from "@/lib/types";

export type RecoveryUrgency = "immediate" | "this_week" | "this_month";

export type RecoveryActionMeta = {
  id: RecoveryAction;
  label: string;
  shortLabel: string;     // for compact UI (badges, chips)
  urgency: RecoveryUrgency;
  estimatedRecoveryMultiplier: number; // fraction of asking price expected to recover
  rationale: string;
  steps: string[];                          // generic platform-agnostic steps
  platformSteps?: Partial<Record<Platform, string[]>>;
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const RECOVERY_REGISTRY: Record<RecoveryAction, RecoveryActionMeta> = {
  relist_now: {
    id: "relist_now",
    label: "Relist Now",
    shortLabel: "Relist",
    urgency: "immediate",
    estimatedRecoveryMultiplier: 0.78,
    rationale:
      "End the listing and create a fresh one to reset algorithm position. Platforms give new listings a visibility boost in the first 24–72 hours.",
    steps: [
      "End the active listing",
      "Create a new listing (don't copy-paste — retype to trigger algorithm signals)",
      "Update title with fresh keywords",
      "Add or rotate photos if possible",
      "List at the same price or 5–10% lower",
    ],
    platformSteps: {
      eBay: [
        "Go to Active Listings → End Item",
        "Click 'Sell Similar' on the ended listing",
        "Update title, description, and at least one photo",
        "Don't copy-paste the old listing — Cassini tracks duplicate content",
      ],
      Poshmark: [
        "Archive the listing",
        "Re-list as new (fresh timestamp = fresh boost)",
        "Share immediately after re-listing",
      ],
      Mercari: [
        "Delete the listing",
        "Relist — Mercari surfaces new listings in search",
      ],
      Depop: [
        "Delete the listing",
        "Re-list with fresh photos and description",
        "Engage with followers immediately after posting",
      ],
    },
  },

  sell_similar: {
    id: "sell_similar",
    label: "Sell Similar",
    shortLabel: "Sell Similar",
    urgency: "this_week",
    estimatedRecoveryMultiplier: 0.82,
    rationale:
      "Create a fresh copy of the listing while keeping the original active. Generates new impressions without losing listing history. Best for eBay.",
    steps: [
      "Find the listing in Active Listings",
      "Click 'Sell Similar'",
      "Update at least the title and one photo",
      "List at the same price or slightly lower",
    ],
    platformSteps: {
      eBay: [
        "Active Listings → ⋮ → Sell Similar",
        "Refresh title keywords (fill all 80 characters)",
        "Update first photo — thumbnail is the most important conversion driver",
      ],
    },
  },

  strategic_markdown: {
    id: "strategic_markdown",
    label: "Strategic Markdown",
    shortLabel: "Markdown",
    urgency: "this_week",
    estimatedRecoveryMultiplier: 0.65,
    rationale:
      "A 10%+ price drop triggers watcher notifications and surfaces the item in 'Recently Lowered Price' filters — creating a fresh visibility event without relisting.",
    steps: [
      "Reduce price by at least 10% to trigger watcher alerts",
      "Add 'Price Drop' messaging if the platform allows edits",
      "Share/promote immediately after the markdown",
    ],
    platformSteps: {
      eBay: [
        "Edit listing → reduce price by 10%+ (minimum to trigger watcher notifications)",
        "Markdown triggers 'Price Drop' badge automatically in search",
        "Combined with 'Send Offer' to watchers for maximum effect",
      ],
      Poshmark: [
        "Offer to Likers: reduces price by $10 minimum",
        "Share the listing immediately after Offer to Likers sends",
        "Drop 10%+ to appear in 'Price Drop' feed",
      ],
      Mercari: [
        "Edit listing price — drops get surfaced in the price drop section",
        "Items under $10 get extra placement boost",
      ],
    },
  },

  title_rewrite: {
    id: "title_rewrite",
    label: "Rewrite Title",
    shortLabel: "Fix Title",
    urgency: "immediate",
    estimatedRecoveryMultiplier: 0.90,
    rationale:
      "Title is the primary search index signal. Weak or generic titles are invisible in search. Fill all available characters with specific, searchable keywords.",
    steps: [
      "Research titles of top-performing comparable listings",
      "Fill the character limit: Brand + Model + Style + Color + Size + Condition",
      "Remove filler words like 'nice', 'great', 'rare', 'vintage'",
      "Include the exact terms buyers search for (check autocomplete suggestions)",
    ],
    platformSteps: {
      eBay: [
        "80 characters — fill every one",
        "Start with Brand (capital), then Model, then specifics",
        "Check eBay autocomplete for keyword variants",
        "Include style codes, SKUs, and colorway names for indexed categories",
      ],
      Poshmark: [
        "80 characters — lead with brand prominently (Poshmark indexes heavily on brand)",
        "Include size, color, and style number",
      ],
      Mercari: [
        "Include exact brand name, model, and condition",
        "Mercari buyers search for specific models — be precise",
      ],
    },
  },

  bundle: {
    id: "bundle",
    label: "Bundle It",
    shortLabel: "Bundle",
    urgency: "this_week",
    estimatedRecoveryMultiplier: 0.50,
    rationale:
      "Low-value items rarely justify solo listings after fees. Bundling reduces per-item fee drag, creates perceived value, and appeals to buyers shopping in volume.",
    steps: [
      "Identify 3–5 related low-value items that could sell together",
      "End individual listings",
      "Create a single bundle listing with all items clearly photographed",
      "Price the bundle at 75–85% of the combined individual prices",
      "Emphasize the value in the title: 'Bundle of 3 — Nike socks, belts, caps'",
    ],
    platformSteps: {
      eBay: ["Use 'Lot' in the title: '5-piece Levi denim lot'", "Shoot all items flat-lay together for the thumbnail"],
      Poshmark: ["Poshmark has a native Bundle feature — buyers can request", "Listing bundles directly: combine multiple closet items"],
    },
  },

  move_platform: {
    id: "move_platform",
    label: "Move Platform",
    shortLabel: "Move",
    urgency: "this_week",
    estimatedRecoveryMultiplier: 0.72,
    rationale:
      "Each platform has a distinct buyer demographic. A well-optimized listing that isn't converting is likely on the wrong marketplace. Cross-list first, then migrate if it sells.",
    steps: [
      "Research which platform has the most active buyers for your category",
      "Cross-list to 1–2 other platforms",
      "If the item sells on the new platform within 30 days, end the original",
      "Update pricing to reflect different fee structures per platform",
    ],
    platformSteps: {
      eBay: ["Strongest for: branded electronics, collectibles, trading cards, tools"],
      Poshmark: ["Strongest for: women's brands, designer handbags, formal wear"],
      Mercari: ["Strongest for: general goods, electronics, housewares, toys"],
      Depop: ["Strongest for: vintage, streetwear, Y2K, Gen Z aesthetics"],
      StockX: ["Sneakers only — sell at current market bid instantly"],
      GOAT: ["Authenticated sneakers — slightly lower fees than StockX"],
    },
  },

  optimize_specifics: {
    id: "optimize_specifics",
    label: "Fix Item Specifics",
    shortLabel: "Specifics",
    urgency: "immediate",
    estimatedRecoveryMultiplier: 0.88,
    rationale:
      "Missing specifics make your listing invisible to buyers using category filters. This is a free, zero-risk fix that directly impacts search placement within hours.",
    steps: [
      "Open the listing editor",
      "Scroll to Item Specifics section",
      "Fill every available field — size, color, material, brand, style, condition",
      "Don't leave fields blank — every unfilled field narrows your search reach",
    ],
    platformSteps: {
      eBay: [
        "Item Specifics are a Cassini ranking factor — prioritize highlighted fields",
        "Use eBay's 'Recommended' suggestions as a checklist",
        "Brand, Type, Size, Color, Material are the highest-impact fields",
      ],
    },
  },

  add_photos: {
    id: "add_photos",
    label: "Add More Photos",
    shortLabel: "Photos",
    urgency: "this_week",
    estimatedRecoveryMultiplier: 0.92,
    rationale:
      "Listings with 1–3 photos convert significantly worse than those with 8+. Buyers need multiple angles, close-ups of tags, size reference, and flaw documentation.",
    steps: [
      "Add at least 8 photos — most platforms allow 12–24",
      "Required angles: front, back, left side, right side, tag/label, size reference",
      "Include a photo of any flaw — reduces return requests",
      "Shoot in natural daylight against a white or neutral background",
      "First photo = thumbnail: show the full item clearly, no clutter",
    ],
  },

  liquidate: {
    id: "liquidate",
    label: "Liquidate",
    shortLabel: "Liquidate",
    urgency: "immediate",
    estimatedRecoveryMultiplier: 0.25,
    rationale:
      "This item has been listed for a year or more with zero conversion. The market has rejected this price. Recover 20–30% and redeploy the capital into faster-moving inventory.",
    steps: [
      "Price at 20–30% of current asking price",
      "List as Buy It Now — no auction (auctions for stale items rarely work)",
      "Enable Best Offer to capture lowball buyers",
      "Consider liquidation-specific platforms: Whatnot, ThredUp, Poshmark Bundles",
      "Last resort: donate and take the tax write-off",
    ],
  },

  hold: {
    id: "hold",
    label: "Hold",
    shortLabel: "Hold",
    urgency: "this_month",
    estimatedRecoveryMultiplier: 1.00,
    rationale:
      "This listing is within its normal sell-through window. No intervention needed — monitor weekly for engagement changes.",
    steps: [
      "No action required at this time",
      "Revisit if the listing ages past 30 days without views or watchers",
      "Keep photos and specifics current",
    ],
  },
};

// ─── Accessor Helpers ─────────────────────────────────────────────────────────

export function getActionMeta(action: RecoveryAction): RecoveryActionMeta {
  return RECOVERY_REGISTRY[action];
}

export function getActionLabel(action: RecoveryAction): string {
  return RECOVERY_REGISTRY[action]?.label ?? action;
}

export function getActionShortLabel(action: RecoveryAction): string {
  return RECOVERY_REGISTRY[action]?.shortLabel ?? action;
}

export function getActionUrgency(action: RecoveryAction): RecoveryUrgency {
  return RECOVERY_REGISTRY[action]?.urgency ?? "this_month";
}

export function getActionSteps(action: RecoveryAction, platform?: Platform): string[] {
  const meta = RECOVERY_REGISTRY[action];
  if (!meta) return [];
  if (platform && meta.platformSteps?.[platform]?.length) {
    return meta.platformSteps[platform]!;
  }
  return meta.steps;
}

export function getRecoveryMultiplier(action: RecoveryAction): number {
  return RECOVERY_REGISTRY[action]?.estimatedRecoveryMultiplier ?? 0.6;
}

export function sortActionsByUrgency(actions: RecoveryAction[]): RecoveryAction[] {
  const order: Record<RecoveryUrgency, number> = { immediate: 0, this_week: 1, this_month: 2 };
  return [...actions].sort(
    (a, b) => order[getActionUrgency(a)] - order[getActionUrgency(b)]
  );
}
