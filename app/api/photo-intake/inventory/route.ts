import { NextResponse } from "next/server";
import { z } from "zod";
import { assertPhotoIntakeRequest, getPhotoIntakeConfig } from "@/lib/photo-intake/config";
import { createInventoryDraft } from "@/lib/photo-intake/graph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  title: z.string().trim().min(3).max(160),
  purchaseCost: z.number().min(0).max(100000).optional(),
  dateAcquired: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceStore: z.string().trim().max(80).optional(),
  location: z.string().trim().min(1).max(100),
});

export async function POST(request: Request) {
  try {
    const config = getPhotoIntakeConfig();
    assertPhotoIntakeRequest(request, config.apiKey);
    const body = bodySchema.parse(await request.json());
    const created = await createInventoryDraft(config, body);
    return NextResponse.json({
      inventoryItemId: created.id,
      sku: created.sku,
      title: body.title,
      status: "Needs Research",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create inventory draft.";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
