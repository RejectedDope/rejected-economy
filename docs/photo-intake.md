# Photo Intake & Processing

This Phase 2 build extends `apps/rejected-vault-scan`; it does not create a competing inventory database or a second mobile app.

## Flow

1. The iPhone app reads only the albums/photos the user authorizes.
2. For a newly sourced item, the user enters a short factual title, cost when known, and physical storage location. The server creates the canonical SharePoint draft and assigns an SKU automatically.
3. For an existing item, the server validates the exact SKU before accepting files.
4. Each original is uploaded unchanged to the Product Photos library.
5. If a background-removal worker is configured, the resized JPEG preview is sent to it and the server creates a transparent PNG plus a 1600×1600 sRGB listing JPEG on white.
6. If no worker is configured, or the worker is temporarily unavailable, the server still creates a normalized 1600×1600 sRGB listing JPEG from the resized preview. Transparent PNG generation is deferred rather than blocking intake.
7. True image-processing failures preserve the original and block research until the photos are reviewed.
8. Successful photo processing sets the photo state to `Processed`; it never sets the inventory item to `Ready to List`.
9. ResaleIQ analyzes the processed copies, researches sold evidence, proposes pricing and marketplace fit, records profitability assumptions, and identifies missing proof.
10. A deterministic evidence gate writes the evaluation artifact and results to the same Inventory record. Only an identified item with non-weak sold evidence, pricing, marketplace choice, no blocking proof/authenticity requirement, and at least one listing draft can advance to `Ready to List`.
11. Publishing remains a separate human-approved action.

Each batch must represent one physical item. Group haul photos can be retained as sourcing evidence but must not be treated as the listing photo for every object in the frame.

## SharePoint folders

- `Photo Intake & Processing/01 Originals - Preserve/{SKU}/{batchId}`
- `Photo Intake & Processing/02 Listing Ready/{SKU}/{batchId}`
- `Photo Intake & Processing/03 Needs Review/{SKU}/{batchId}`
- `Photo Intake & Processing/04 Processing Errors/{SKU}/{batchId}`
- `Photo Intake & Processing/05 Manifests and Logs/{SKU}/{batchId}.json`

## Required Inventory fields

The photo fields below retain their current internal names:

- `PhotoStatus`
- `OriginalPhotoFolder`
- `ListingReadyFolder`
- `PrimaryPhotoURL`
- `PhotoCount`
- `PhotoBatchID`
- `LastPhotoProcessed`
- `PhotoError`

Add these ResaleIQ columns using the display names shown. The API resolves their actual SharePoint internal names before writing:

- `Research Status` (single line text or choice)
- `Research Run ID` (single line text)
- `Research Summary` (multiple lines text)
- `Identification Confidence` (choice: Low, Medium, High)
- `Missing Proof` (multiple lines text)
- `Sold Comp Count` (number)
- `Market Low`, `Market Typical`, `Market High` (currency)
- `Recommended List Price`, `Likely Sale Price` (currency)
- `Best Marketplace` (single line text or choice)
- `Estimated Gross Profit` (currency)
- `Research Evidence URL` (hyperlink or single line text)

The canonical `Status` remains `Needs Research` throughout upload and image processing. ResaleIQ may write `Ready to List` only after the evidence gate passes. If any required column is absent, that result is not silently stored elsewhere; provision and verify the columns before the first live run.

The complete evaluation is preserved as `05 Manifests and Logs/{SKU}/{batchId}-resaleiq-evaluation.json`, including the identification limits, evidence URLs, market range, strategy, missing proof, profitability limitations, drafts, decision, and next action.

The phone checks a new research run briefly after upload through `/api/photo-intake/research/status`. Longer-running jobs remain durable because the response ID is stored on the canonical SharePoint Inventory row. The `/api/cron/resaleiq-intake` fallback sweep runs once daily so the project remains compatible with the Vercel Hobby plan.

## Security

- The mobile connection key is entered by the operator and stored in iOS SecureStore.
- The key is never committed or compiled as an `EXPO_PUBLIC_*` value.
- Microsoft client credentials remain server-side.
- The Entra app must retain `Sites.Selected` access only to the Rejected Treasures site.
- When configured, the worker receives a resized preview, not the original HEIC/JPG.
- The product-photo library is internal; public storefronts receive approved output URLs only.

## Deployment order

1. Add the Photo Intake environment values to the existing Next/Vercel deployment. `BACKGROUND_REMOVAL_API_URL` is optional for the initial pilot.
2. Add and verify the photo and ResaleIQ Inventory fields, then confirm the Product Photos drive ID.
3. Deploy the web API.
4. Build the Expo app and enter the server URL plus Photo Intake connection key.
5. Test with one low-risk SKU and two photos before processing a full album.
6. Add a hosted background-removal worker later if transparent PNGs and automatic background removal are required.

## Operator capture standard

After photographing, put the item in its permanent bin/shelf and enter that location. Use one batch per physical item. Capture front, back, interior, brand/material label, serial/date code or chip area when applicable, hardware, corners/edges, measurements, and every flaw. A group haul photo is sourcing evidence only. Missing proof remains visible as the next action instead of being filled with a guess.
