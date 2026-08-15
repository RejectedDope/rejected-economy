import { NextResponse } from "next/server";
import { z } from "zod";
import { assertPhotoIntakeRequest, getPhotoIntakeConfig } from "@/lib/photo-intake/config";
import {
  ensureDriveFolder,
  updateInventoryDisplayFields,
  updateInventoryPhotoFields,
  uploadDriveFile,
} from "@/lib/photo-intake/graph";
import { verifyBatchClaims } from "@/lib/photo-intake/naming";
import { batchPaths } from "@/lib/photo-intake/paths";
import { startResaleIqEvaluation } from "@/lib/resaleiq-intake/evaluator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  batchToken: z.string().min(20),
  completedCount: z.number().int().min(0).max(25),
  failedCount: z.number().int().min(0).max(25),
  primaryPhotoUrl: z.string().url().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ batchId: string }> }
) {
  try {
    const config = getPhotoIntakeConfig();
    assertPhotoIntakeRequest(request, config.apiKey);
    const { batchId } = await context.params;
    const body = bodySchema.parse(await request.json());
    const claims = verifyBatchClaims(body.batchToken, config.apiKey);
    if (claims.batchId !== batchId) throw new Error("Batch identifier does not match token.");

    const paths = batchPaths(claims.sku, claims.batchId);
    const status = body.failedCount > 0 ? "Needs Review" : "Processed";
    const [originalFolder, listingReadyFolder] = await Promise.all([
      ensureDriveFolder(config, paths.originals),
      ensureDriveFolder(config, paths.listingReady),
    ]);
    const manifest = {
      version: 1,
      batchId: claims.batchId,
      sku: claims.sku,
      expectedCount: claims.expectedCount,
      completedCount: body.completedCount,
      failedCount: body.failedCount,
      status,
      completedAt: new Date().toISOString(),
    };
    const manifestResult = await uploadDriveFile(
      config,
      paths.manifests,
      `${claims.batchId}.json`,
      new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
      "application/json"
    );

    await updateInventoryPhotoFields(config, claims.inventoryItemId, {
      PhotoStatus: status,
      PhotoBatchID: claims.batchId,
      PhotoCount: body.completedCount,
      LastPhotoProcessed: new Date().toISOString(),
      OriginalPhotoFolder: originalFolder.webUrl ?? paths.originals,
      ListingReadyFolder: listingReadyFolder.webUrl ?? paths.listingReady,
      PrimaryPhotoURL: body.primaryPhotoUrl ?? "",
      PhotoError: body.failedCount ? `${body.failedCount} photo(s) require review.` : "",
    });

    let researchStatus = body.failedCount > 0 ? "Blocked - Photo Review" : "Pending";
    let researchRunId: string | undefined;
    if (body.failedCount === 0) {
      try {
        const research = await startResaleIqEvaluation(config, {
          inventoryItemId: claims.inventoryItemId,
          sku: claims.sku,
          listingReadyFolder: paths.listingReady,
        });
        researchStatus = research.status === "completed" ? "Ready to Finalize" : "Running";
        researchRunId = research.id;
      } catch (error) {
        researchStatus = config.openAiApiKey ? "Needs Review" : "Configuration Required";
        console.error("Unable to start ResaleIQ intake evaluation", error);
      }
    }

    await updateInventoryDisplayFields(config, claims.inventoryItemId, {
      Status: "Needs Research",
      "Research Status": researchStatus,
      "Research Run ID": researchRunId ?? "",
      "Next Action": body.failedCount > 0
        ? "Review failed photos, collect missing product views, then rerun ResaleIQ."
        : researchRunId
          ? "ResaleIQ is identifying the item, researching sold evidence, pricing, marketplace fit, and missing proof."
          : "Configure ResaleIQ, then run the evidence-backed inventory evaluation.",
    });

    return NextResponse.json({ ok: true, status, researchStatus, researchRunId, manifestUrl: manifestResult.webUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete photo intake.";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
