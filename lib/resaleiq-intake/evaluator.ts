import type { PhotoIntakeConfig } from "@/lib/photo-intake/config";
import { getInventoryItem, listDriveFolderImages } from "@/lib/photo-intake/graph";
import { RESALEIQ_JSON_SCHEMA, gateEvaluation, resaleIqEvaluationSchema, type ResaleIqEvaluation } from "./schema";

type OpenAiResponse = { id: string; status: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }>; error?: { message?: string } };

const instructions = `You are the Rejected Treasures ResaleIQ inventory research agent. Analyze only facts visible in the supplied photos or supported by linked sources. Research current sold comparables with web search; sold evidence is primary and active listings are context only. Never invent a brand, model, material, condition fact, price, or authenticity conclusion. Do not guarantee authenticity. If a label, serial/date code, interior, measurements, hardware, functional test, or defect photo is needed, put it in missingProof and mark blocking when it prevents defensible identification, pricing, or listing. Explain uncertainty plainly. Produce drafts only when evidence is sufficient. The human approves publishing.`;

function outputText(response: OpenAiResponse): string {
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  throw new Error("ResaleIQ response contained no structured output.");
}

export async function startResaleIqEvaluation(
  config: PhotoIntakeConfig,
  input: { inventoryItemId: string; sku: string; listingReadyFolder: string }
): Promise<{ id: string; status: string }> {
  if (!config.openAiApiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const [inventory, images] = await Promise.all([
    getInventoryItem(config, input.inventoryItemId),
    listDriveFolderImages(config, input.listingReadyFolder),
  ]);
  if (!images.length) throw new Error("No processed product images are available for research.");
  const content: Array<Record<string, unknown>> = [{
    type: "input_text",
    text: JSON.stringify({ sku: input.sku, inventoryFields: inventory.fields, researchDate: new Date().toISOString() }),
  }];
  for (const image of images) {
    content.push({ type: "input_image", image_url: `data:${image.mimeType};base64,${Buffer.from(image.bytes).toString("base64")}`, detail: "high" });
  }
  const apiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${config.openAiApiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: config.resaleIqModel,
      background: true,
      store: true,
      tools: [{ type: "web_search" }],
      include: ["web_search_call.action.sources"],
      reasoning: { effort: "medium" },
      instructions,
      input: [{ role: "user", content }],
      text: { format: { type: "json_schema", name: "resaleiq_intake_evaluation", strict: true, schema: RESALEIQ_JSON_SCHEMA } },
    }),
  });
  if (!apiResponse.ok) throw new Error(`ResaleIQ start failed (${apiResponse.status}): ${(await apiResponse.text()).slice(0, 400)}`);
  const response = (await apiResponse.json()) as OpenAiResponse;
  return { id: response.id, status: response.status };
}

export async function retrieveResaleIqEvaluation(config: PhotoIntakeConfig, responseId: string): Promise<{ status: string; evaluation?: ResaleIqEvaluation; error?: string }> {
  if (!config.openAiApiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const apiResponse = await fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}`, { headers: { authorization: `Bearer ${config.openAiApiKey}` } });
  if (!apiResponse.ok) throw new Error(`ResaleIQ retrieval failed (${apiResponse.status}).`);
  const response = (await apiResponse.json()) as OpenAiResponse;
  if (response.status !== "completed") return { status: response.status, error: response.error?.message };
  const parsed = resaleIqEvaluationSchema.parse(JSON.parse(outputText(response)));
  return { status: response.status, evaluation: gateEvaluation(parsed) };
}
