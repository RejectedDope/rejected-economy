import { NextResponse } from "next/server";
import { z } from "zod";
import { assertPhotoIntakeRequest, getPhotoIntakeConfig } from "@/lib/photo-intake/config";
import { verifyBatchClaims } from "@/lib/photo-intake/naming";
import { finalizeResaleIqRun } from "@/lib/resaleiq-intake/finalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ batchToken: z.string().min(20), responseId: z.string().min(5) });

export async function POST(request: Request) {
  try {
    const config = getPhotoIntakeConfig();
    assertPhotoIntakeRequest(request, config.apiKey);
    const body = bodySchema.parse(await request.json());
    const claims = verifyBatchClaims(body.batchToken, config.apiKey);
    const result = await finalizeResaleIqRun(config, {
      responseId: body.responseId,
      inventoryItemId: claims.inventoryItemId,
      sku: claims.sku,
      batchId: claims.batchId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to finalize ResaleIQ research.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
