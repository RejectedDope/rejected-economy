import type { PhotoIntakeConfig } from "@/lib/photo-intake/config";
import { updateInventoryDisplayFields, uploadDriveFile } from "@/lib/photo-intake/graph";
import { batchPaths } from "@/lib/photo-intake/paths";
import { retrieveResaleIqEvaluation } from "./evaluator";

export async function finalizeResaleIqRun(
  config: PhotoIntakeConfig,
  input: { responseId: string; inventoryItemId: string; sku: string; batchId: string }
) {
  const result = await retrieveResaleIqEvaluation(config, input.responseId);
  if (!result.evaluation) {
    if (result.error) {
      await updateInventoryDisplayFields(config, input.inventoryItemId, {
        Status: "Needs Research",
        "Research Status": "Needs Review",
        "Next Action": `ResaleIQ run stopped: ${result.error}`,
      });
    }
    return result;
  }

  const evaluation = result.evaluation;
  const paths = batchPaths(input.sku, input.batchId);
  const artifact = await uploadDriveFile(
    config,
    paths.manifests,
    `${input.batchId}-resaleiq-evaluation.json`,
    new TextEncoder().encode(JSON.stringify({
      version: 1,
      responseId: input.responseId,
      evaluatedAt: new Date().toISOString(),
      evaluation,
    }, null, 2)),
    "application/json"
  );
  const soldComps = evaluation.evidence.filter((item) => item.type === "sold_comp");
  const summary = [
    evaluation.identification.likelyIdentification ?? "Identification unresolved",
    evaluation.condition.summary,
    evaluation.pricing.rationale,
  ].join(" | ");

  await updateInventoryDisplayFields(config, input.inventoryItemId, {
    Status: evaluation.decision.status,
    "Research Status": evaluation.decision.status === "Ready to List" ? "Complete" : "Missing Proof",
    "Research Run ID": input.responseId,
    "Research Summary": summary,
    "Identification Confidence": evaluation.identification.confidence,
    "Missing Proof": evaluation.missingProof.map((item) => item.requirement).join("; "),
    "Sold Comp Count": soldComps.length,
    "Market Low": evaluation.market.low,
    "Market Typical": evaluation.market.typical,
    "Market High": evaluation.market.high,
    "Recommended List Price": evaluation.pricing.market,
    "Likely Sale Price": evaluation.market.typical,
    "Best Marketplace": evaluation.platform.primary,
    "Estimated Gross Profit": evaluation.profitability.estimatedGrossProfitAtMarket,
    "Research Evidence URL": artifact.webUrl,
    "Next Action": evaluation.decision.nextAction,
  });
  return { ...result, artifactUrl: artifact.webUrl };
}
