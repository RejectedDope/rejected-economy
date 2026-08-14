# Photo Intake & Processing

This Phase 2 build extends `apps/rejected-vault-scan`; it does not create a competing inventory database or a second mobile app.

## Flow

1. The iPhone app reads only the albums/photos the user authorizes.
2. The user enters one existing SharePoint Inventory SKU and selects up to 25 photos.
3. The server validates the exact SKU before accepting files.
4. Each original is uploaded unchanged to the Product Photos library.
5. A resized JPEG preview is sent to the self-hosted background worker.
6. The server generates a 1600×1600 sRGB listing JPEG on white plus a transparent PNG.
7. Processing failures preserve the original and set Inventory to `Needs Review`.
8. Completion writes photo count, folder paths, primary image, batch ID, and status back to the same Inventory record.

## SharePoint folders

- `Photo Intake & Processing/01 Originals - Preserve/{SKU}/{batchId}`
- `Photo Intake & Processing/02 Listing Ready/{SKU}/{batchId}`
- `Photo Intake & Processing/03 Needs Review/{SKU}/{batchId}`
- `Photo Intake & Processing/04 Processing Errors/{SKU}/{batchId}`
- `Photo Intake & Processing/05 Manifests and Logs/{SKU}/{batchId}.json`

## Required Inventory internal field names

- `PhotoStatus`
- `OriginalPhotoFolder`
- `ListingReadyFolder`
- `PrimaryPhotoURL`
- `PhotoCount`
- `PhotoBatchID`
- `LastPhotoProcessed`
- `PhotoError`

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
3. Confirm the Inventory field internal names and Product Photos drive ID.
4. Deploy the web API.
5. Build the Expo app and enter the server URL plus Photo Intake connection key.
6. Test with one low-risk SKU and two photos before processing a full album.
