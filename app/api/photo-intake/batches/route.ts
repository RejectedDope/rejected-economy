import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertPhotoIntakeRequest, getPhotoIntakeConfig } from "@/lib/photo-intake/config";
import { findInventoryBySku, updateInventoryPhotoFields } from "@/lib/photo-intake/graph";
import { assertValidSku, signBatchClaims } from "@/lib/photo-intake/naming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  sku: z.string().min(3).max(64),
  expectedCount: z.number().int().min(1).max(25),
});

export async function POST(request: Request) {
  try {
    const config = getPhotoIntakeConfig();
    assertPhotoIntakeRequest(request, config.apiKey);
    const body = bodySchema.parse(await request.json());
    const sku = assertValidSku(body.sku);
    const inventory = await findInventoryBySku(config, sku);
    if (!inventory) {
      return NextResponse.json({ error: `SKU ${sku} was not found in SharePoint Inventory.` }, { status: 404 });
    }

    const batchId = `${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`;
    const batchToken = signBatchClaims(
      {
        batchId,
        sku,
        inventoryItemId: inventory.id,
        expectedCount: body.expectedCount,
        issuedAt: Date.now(),
      },
      config.apiKey
    );

    await updateInventoryPhotoFields(config, inventory.id, {
      PhotoStatus: "Intake Received",
      PhotoBatchID: batchId,
      PhotoError: "",
    });

    return NextResponse.json({
      batchId,
      batchToken,
      sku,
      inventoryTitle: inventory.fields.WebsiteTitle ?? inventory.fields.Title ?? sku,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start photo intake.";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
