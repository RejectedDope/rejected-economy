import { NextResponse } from "next/server";
import { assertPhotoIntakeRequest, getPhotoIntakeConfig } from "@/lib/photo-intake/config";
import { updateInventoryPhotoFields, uploadDriveFile } from "@/lib/photo-intake/graph";
import {
  listingFileName,
  originalFileName,
  PHOTO_ROLES,
  transparentFileName,
  verifyBatchClaims,
  type PhotoRole,
} from "@/lib/photo-intake/naming";
import { batchPaths } from "@/lib/photo-intake/paths";
import {
  createListingDerivative,
  createPreviewListingDerivative,
  removeBackground,
} from "@/lib/photo-intake/processor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName) return fromName;
  return file.type.split("/").pop() || "jpg";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ batchId: string }> }
) {
  let inventoryItemId: string | undefined;
  try {
    const config = getPhotoIntakeConfig();
    assertPhotoIntakeRequest(request, config.apiKey);
    const { batchId } = await context.params;
    const form = await request.formData();
    const claims = verifyBatchClaims(String(form.get("batchToken") ?? ""), config.apiKey);
    inventoryItemId = claims.inventoryItemId;
    if (claims.batchId !== batchId) throw new Error("Batch identifier does not match token.");

    const sequence = Number(form.get("sequence"));
    const role = String(form.get("role")) as PhotoRole;
    if (!Number.isInteger(sequence) || sequence < 1 || sequence > claims.expectedCount) {
      throw new Error("Invalid photo sequence.");
    }
    if (!PHOTO_ROLES.includes(role)) throw new Error("Invalid photo role.");

    const original = form.get("original");
    const preview = form.get("preview");
    if (!(original instanceof File) || !(preview instanceof File)) {
      throw new Error("Both original and preview image files are required.");
    }
    if (original.size > 30 * 1024 * 1024 || preview.size > 12 * 1024 * 1024) {
      throw new Error("One of the selected photos is too large to process.");
    }

    const previewBytes = new Uint8Array(await preview.arrayBuffer());
    const paths = batchPaths(claims.sku, claims.batchId);
    const originalName = originalFileName(claims.sku, role, sequence, extensionFor(original));
    const originalResult = await uploadDriveFile(
      config,
      paths.originals,
      originalName,
      new Uint8Array(await original.arrayBuffer()),
      original.type || "application/octet-stream"
    );

    try {
      let listingJpeg: Uint8Array;
      let transparentUrl: string | undefined;
      let backgroundRemovalApplied = false;
      let processingWarning: string | undefined;

      if (config.backgroundRemovalUrl) {
        try {
          const transparent = await removeBackground(config, previewBytes);
          const derivative = await createListingDerivative(transparent);
          listingJpeg = derivative.listingJpeg;
          const transparentResult = await uploadDriveFile(
            config,
            paths.listingReady,
            transparentFileName(claims.sku, role, sequence),
            derivative.transparentPng,
            "image/png"
          );
          transparentUrl = transparentResult.webUrl;
          backgroundRemovalApplied = true;
        } catch (backgroundError) {
          processingWarning = backgroundError instanceof Error
            ? `${backgroundError.message} Used the original preview for the listing derivative.`
            : "Background removal failed. Used the original preview for the listing derivative.";
          listingJpeg = await createPreviewListingDerivative(previewBytes);
        }
      } else {
        processingWarning = "Background removal worker is not configured; used the original preview for the listing derivative.";
        listingJpeg = await createPreviewListingDerivative(previewBytes);
      }

      const listingResult = await uploadDriveFile(
        config,
        paths.listingReady,
        listingFileName(claims.sku, role, sequence),
        listingJpeg,
        "image/jpeg"
      );

      return NextResponse.json({
        ok: true,
        sequence,
        role,
        originalUrl: originalResult.webUrl,
        listingUrl: listingResult.webUrl,
        transparentUrl,
        backgroundRemovalApplied,
        processingWarning,
      });
    } catch (processingError) {
      const message = processingError instanceof Error ? processingError.message : "Processing failed.";
      await uploadDriveFile(
        config,
        paths.needsReview,
        `${claims.sku}_${String(sequence).padStart(2, "0")}_preview.jpg`,
        previewBytes,
        preview.type || "image/jpeg"
      );
      await uploadDriveFile(
        config,
        paths.errors,
        `${claims.sku}_${String(sequence).padStart(2, "0")}_error.txt`,
        new TextEncoder().encode(message),
        "text/plain"
      );
      await updateInventoryPhotoFields(config, claims.inventoryItemId, {
        PhotoStatus: "Needs Review",
        PhotoError: message,
        OriginalPhotoFolder: originalResult.webUrl,
      });
      return NextResponse.json(
        { ok: false, needsReview: true, error: message, originalUrl: originalResult.webUrl },
        { status: 422 }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload photo.";
    if (inventoryItemId) {
      try {
        const config = getPhotoIntakeConfig();
        await updateInventoryPhotoFields(config, inventoryItemId, {
          PhotoStatus: "Error",
          PhotoError: message,
        });
      } catch {
        // Preserve the original error response even when status writeback also fails.
      }
    }
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
