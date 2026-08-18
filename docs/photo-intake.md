# Photo Intake & Processing

This Phase 2 build extends `apps/rejected-vault-scan`; it does not create a competing inventory database or a second mobile app.

## Flow

1. The iPhone app reads only the albums/photos the user authorizes.
2. For a newly sourced item, the user enters a short factual title, cost when known, and physical storage location. The server creates the canonical SharePoint draft and assigns an SKU automatically.
3. For an existing item, the server validates the exact SKU before accepting files.
4. Each original is uploaded unchanged to the Product Photos library.
5. A resized JPEG preview is sent to the self-hosted background worker.
6. The server generates a 1600×1600 sRGB listing JPEG on white plus a transparent PNG.
7. Processing failures preserve the original and block research until the photos are reviewed.
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

Add these ResaleIQ columns using the display names shown. The API resolves their
actual SharePoint internal names before writing:

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

The canonical `Status` remains `Needs Research` throughout upload and image
processing. ResaleIQ may write `Ready to List` only after the evidence gate passes.
If any required column is absent, that result is not silently stored elsewhere;
provision and verify the columns before the first live run.

The complete evaluation is preserved as
`05 Manifests and Logs/{SKU}/{batchId}-resaleiq-evaluation.json`, including the
identification limits, evidence URLs, market range, strategy, missing proof,
profitability limitations, drafts, decision, and next action.

The phone checks a new research run briefly after upload through
`/api/photo-intake/research/status`. Longer-running jobs remain durable because
the response ID is stored on the canonical SharePoint Inventory row. The
`/api/cron/resaleiq-intake` fallback sweep runs once daily so the project remains
compatible with the Vercel Hobby plan. If more frequent unattended finalization
is later required, the same authenticated endpoint can be called by an approved
external scheduler without changing the inventory architecture.

Create these fields before the first live upload. The API fails closed if SharePoint rejects a write; it does not silently create a second record.

## Security

- The mobile connection key is entered by the operator and stored in iOS SecureStore.
- The key is never committed or compiled as an `EXPO_PUBLIC_*` value.
- Microsoft client credentials remain server-side.
- The Entra app must retain `Sites.Selected` access only to the Rejected Treasures site.
- The worker receives a resized preview, not the original HEIC/JPG.
- The product-photo library is internal; public storefronts receive approved output URLs only.

## Deployment order

1. Deploy the background worker privately and set its token.
2. Add the Photo Intake environment values to the existing Next/Vercel deployment.
3. Add and verify the photo and ResaleIQ Inventory fields, then confirm the Product Photos drive ID.
4. Deploy the web API.
5. Build the Expo app and enter the server URL plus Photo Intake connection key.
6. Test with one low-risk SKU and two photos before processing a full album.

## Operator capture standard

After photographing, put the item in its permanent bin/shelf and enter that
location. Use one batch per physical item. Capture front, back, interior,
brand/material label, serial/date code or chip area when applicable, hardware,
corners/edges, measurements, and every flaw. A group haul photo is sourcing
evidence only. Missing proof remains visible as the next action instead of being
filled with a guess.
