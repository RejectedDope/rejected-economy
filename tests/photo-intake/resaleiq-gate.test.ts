import { describe, expect, it } from "vitest";
import { gateEvaluation, resaleIqEvaluationSchema } from "@/lib/resaleiq-intake/schema";

function evaluation() {
  return resaleIqEvaluationSchema.parse({
    identification: { confirmedFacts: ["Black wallet"], likelyIdentification: "Example wallet", confidence: "high", confidenceLimits: [], authenticityReviewRequired: false },
    condition: { summary: "Visible wear", visibleFlaws: [], unverifiedFunctions: [] },
    missingProof: [],
    evidence: [{ type: "sold_comp", sourceTitle: "Sold example", url: "https://example.com/sold", observedPrice: 30, currency: "USD", matchQuality: "strong", notes: "Close match" }],
    market: { low: 25, typical: 30, high: 40, limitations: [] },
    pricing: { quickSale: 25, market: 38, premium: 45, floor: 20, rationale: "Sold evidence", assumptions: [] },
    platform: { primary: "eBay", crossList: ["Poshmark"], rationale: "Buyer fit" },
    profitability: { purchaseCost: 5, estimatedGrossProfitAtMarket: 33, limitations: ["Before fees"] },
    decision: { status: "Ready to List", nextAction: "Approve the draft." },
    listingDrafts: [{ platform: "eBay", title: "Example wallet", condition: "Preowned", description: "Visible wear shown.", listPrice: 38 }],
  });
}

describe("ResaleIQ intake evidence gate", () => {
  it("allows a complete, evidence-backed item to become Ready to List", () => {
    expect(gateEvaluation(evaluation()).decision.status).toBe("Ready to List");
  });

  it("keeps an item in Needs Research when proof or authenticity review is required", () => {
    const item = evaluation();
    item.identification.authenticityReviewRequired = true;
    item.missingProof.push({ requirement: "Interior date-code area", reason: "Needed before attribution", blocking: true });
    expect(gateEvaluation(item).decision.status).toBe("Needs Research");
  });

  it("does not treat weak or active-only evidence as a sold-comps basis", () => {
    const item = evaluation();
    item.evidence[0].type = "active_listing";
    expect(gateEvaluation(item).decision.status).toBe("Needs Research");
  });
});
