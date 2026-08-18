import sharp from "sharp";
import type { PhotoIntakeConfig } from "./config";

export type ListingDerivative = {
  transparentPng: Uint8Array;
  listingJpeg: Uint8Array;
};

export async function removeBackground(
  config: PhotoIntakeConfig,
  previewJpeg: Uint8Array
): Promise<Uint8Array> {
  if (!config.backgroundRemovalUrl) {
    throw new Error("Background removal worker is not configured.");
  }
  const form = new FormData();
  form.append("file", new Blob([Buffer.from(previewJpeg)], { type: "image/jpeg" }), "preview.jpg");
  const response = await fetch(config.backgroundRemovalUrl, {
    method: "POST",
    headers: config.backgroundRemovalToken
      ? { authorization: `Bearer ${config.backgroundRemovalToken}` }
      : undefined,
    body: form,
  });
  if (!response.ok) throw new Error(`Background removal failed (${response.status}).`);
  return new Uint8Array(await response.arrayBuffer());
}

export async function createListingDerivative(
  transparentPng: Uint8Array
): Promise<ListingDerivative> {
  const trimmed = sharp(transparentPng).ensureAlpha().trim({ background: "#00000000" });
  const metadata = await trimmed.metadata();
  if (!metadata.width || !metadata.height || metadata.width < 100 || metadata.height < 100) {
    throw new Error("Background removal returned an unusable subject area.");
  }

  const listingJpeg = await trimmed
    .resize(1400, 1400, { fit: "inside", withoutEnlargement: true })
    .extend({
      top: 100,
      bottom: 100,
      left: 100,
      right: 100,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .resize(1600, 1600, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .flatten({ background: "#FFFFFF" })
    .toColourspace("srgb")
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();

  return { transparentPng, listingJpeg };
}

export async function createPreviewListingDerivative(
  previewJpeg: Uint8Array
): Promise<Uint8Array> {
  return sharp(previewJpeg)
    .rotate()
    .resize(1600, 1600, {
      fit: "contain",
      withoutEnlargement: true,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .flatten({ background: "#FFFFFF" })
    .toColourspace("srgb")
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}
