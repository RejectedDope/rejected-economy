import { z } from "zod";

const marketplace = z.enum(["eBay", "Poshmark", "Vinted", "Facebook Marketplace", "Undetermined"]);

export const resaleIqEvaluationSchema = z.object({
  identification: z.object({
    confirmedFacts: z.array(z.string()),
    likelyIdentification: z.string().nullable(),
    confidence: z.enum(["low", "medium", "high"]),
    confidenceLimits: z.array(z.string()),
    authenticityReviewRequired: z.boolean(),
  }),
  condition: z.object({
    summary: z.string(),
    visibleFlaws: z.array(z.string()),
    unverifiedFunctions: z.array(z.string()),
  }),
  missingProof: z.array(z.object({ requirement: z.string(), reason: z.string(), blocking: z.boolean() })),
  evidence: z.array(z.object({
    type: z.enum(["sold_comp", "active_listing", "reference"]),
    sourceTitle: z.string(),
    url: z.string().url(),
    observedPrice: z.number().nullable(),
    currency: z.string(),
    matchQuality: z.enum(["strong", "partial", "weak"]),
    notes: z.string(),
  })),
  market: z.object({
    low: z.number().nullable(), typical: z.number().nullable(), high: z.number().nullable(), limitations: z.array(z.string()),
  }),
  pricing: z.object({
    quickSale: z.number().nullable(), market: z.number().nullable(), premium: z.number().nullable(), floor: z.number().nullable(), rationale: z.string(), assumptions: z.array(z.string()),
  }),
  platform: z.object({ primary: marketplace, crossList: z.array(marketplace), rationale: z.string() }),
  profitability: z.object({ purchaseCost: z.number().nullable(), estimatedGrossProfitAtMarket: z.number().nullable(), limitations: z.array(z.string()) }),
  decision: z.object({ status: z.enum(["Needs Research", "Ready to List"]), nextAction: z.string() }),
  listingDrafts: z.array(z.object({ platform: marketplace, title: z.string(), condition: z.string(), description: z.string(), listPrice: z.number() })),
});

export type ResaleIqEvaluation = z.infer<typeof resaleIqEvaluationSchema>;

export function gateEvaluation(evaluation: ResaleIqEvaluation): ResaleIqEvaluation {
  const soldEvidence = evaluation.evidence.filter(
    (item) => item.type === "sold_comp" && item.matchQuality !== "weak"
  );
  const blocked =
    evaluation.identification.likelyIdentification === null ||
    evaluation.identification.confidence === "low" ||
    evaluation.identification.authenticityReviewRequired ||
    evaluation.missingProof.some((item) => item.blocking) ||
    soldEvidence.length === 0 ||
    evaluation.market.typical === null ||
    evaluation.pricing.market === null ||
    evaluation.platform.primary === "Undetermined" ||
    evaluation.listingDrafts.length === 0;
  if (!blocked) return evaluation;
  return {
    ...evaluation,
    decision: {
      status: "Needs Research",
      nextAction: evaluation.decision.nextAction || "Collect the missing proof and rerun ResaleIQ.",
    },
  };
}

export const RESALEIQ_JSON_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["identification", "condition", "missingProof", "evidence", "market", "pricing", "platform", "profitability", "decision", "listingDrafts"],
  properties: {
    identification: { type: "object", additionalProperties: false, required: ["confirmedFacts", "likelyIdentification", "confidence", "confidenceLimits", "authenticityReviewRequired"], properties: {
      confirmedFacts: { type: "array", items: { type: "string" } }, likelyIdentification: { type: ["string", "null"] }, confidence: { type: "string", enum: ["low", "medium", "high"] }, confidenceLimits: { type: "array", items: { type: "string" } }, authenticityReviewRequired: { type: "boolean" },
    } },
    condition: { type: "object", additionalProperties: false, required: ["summary", "visibleFlaws", "unverifiedFunctions"], properties: { summary: { type: "string" }, visibleFlaws: { type: "array", items: { type: "string" } }, unverifiedFunctions: { type: "array", items: { type: "string" } } } },
    missingProof: { type: "array", items: { type: "object", additionalProperties: false, required: ["requirement", "reason", "blocking"], properties: { requirement: { type: "string" }, reason: { type: "string" }, blocking: { type: "boolean" } } } },
    evidence: { type: "array", items: { type: "object", additionalProperties: false, required: ["type", "sourceTitle", "url", "observedPrice", "currency", "matchQuality", "notes"], properties: { type: { type: "string", enum: ["sold_comp", "active_listing", "reference"] }, sourceTitle: { type: "string" }, url: { type: "string" }, observedPrice: { type: ["number", "null"] }, currency: { type: "string" }, matchQuality: { type: "string", enum: ["strong", "partial", "weak"] }, notes: { type: "string" } } } },
    market: { type: "object", additionalProperties: false, required: ["low", "typical", "high", "limitations"], properties: { low: { type: ["number", "null"] }, typical: { type: ["number", "null"] }, high: { type: ["number", "null"] }, limitations: { type: "array", items: { type: "string" } } } },
    pricing: { type: "object", additionalProperties: false, required: ["quickSale", "market", "premium", "floor", "rationale", "assumptions"], properties: { quickSale: { type: ["number", "null"] }, market: { type: ["number", "null"] }, premium: { type: ["number", "null"] }, floor: { type: ["number", "null"] }, rationale: { type: "string" }, assumptions: { type: "array", items: { type: "string" } } } },
    platform: { type: "object", additionalProperties: false, required: ["primary", "crossList", "rationale"], properties: { primary: { type: "string", enum: ["eBay", "Poshmark", "Vinted", "Facebook Marketplace", "Undetermined"] }, crossList: { type: "array", items: { type: "string", enum: ["eBay", "Poshmark", "Vinted", "Facebook Marketplace", "Undetermined"] } }, rationale: { type: "string" } } },
    profitability: { type: "object", additionalProperties: false, required: ["purchaseCost", "estimatedGrossProfitAtMarket", "limitations"], properties: { purchaseCost: { type: ["number", "null"] }, estimatedGrossProfitAtMarket: { type: ["number", "null"] }, limitations: { type: "array", items: { type: "string" } } } },
    decision: { type: "object", additionalProperties: false, required: ["status", "nextAction"], properties: { status: { type: "string", enum: ["Needs Research", "Ready to List"] }, nextAction: { type: "string" } } },
    listingDrafts: { type: "array", items: { type: "object", additionalProperties: false, required: ["platform", "title", "condition", "description", "listPrice"], properties: { platform: { type: "string", enum: ["eBay", "Poshmark", "Vinted", "Facebook Marketplace", "Undetermined"] }, title: { type: "string" }, condition: { type: "string" }, description: { type: "string" }, listPrice: { type: "number" } } } },
  },
} as const;
