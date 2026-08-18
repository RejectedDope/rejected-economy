# Rejected Vault Scan — Photo Intake Phase 2

An Expo/React Native iPhone intake app that reads authorized albums, creates a new SharePoint inventory draft or attaches to an existing SKU, preserves originals, and starts listing-image processing.

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/RejectedDope/rejected-economy?quickstart=1&ref=main&devcontainer_path=.devcontainer%2Fdevcontainer.json)

## What works

- Requests iOS photo-library permission
- Supports Full Access and Selected Photos Only states
- Reads authorized albums directly from the device
- Displays album names, counts, and a thumbnail
- Provides Refresh and Photo Settings actions
- Opens an album and selects up to 25 photos
- Treats each selected batch as one physical item
- Creates a new `Needs Research` SharePoint record and assigns an SKU, or accepts an existing SKU
- Captures purchase cost, source store, and physical storage location for new sourcing
- Stores the private connection key in iOS SecureStore
- Uploads originals and JPEG processing previews separately
- Completes the batch only after the server returns per-photo results

## Phone testing with GitHub Codespaces

1. Tap **Open in GitHub Codespaces** above.
2. Confirm the repository is `RejectedDope/rejected-economy` and the branch is `main`.
3. Tap **Create codespace**.
4. The workspace opens directly inside `apps/rejected-vault-scan`, runs `npm install` plus `expo-doctor`, and starts Expo tunnel mode automatically.
5. Open the generated Expo link or QR code in Expo Go on the iPhone. If the startup link is not visible, run `npm start` in the Codespaces terminal to display it again.
6. Allow the requested iPhone photo-library access.
7. Open an album, choose photos for one physical item, and enter the private Photo Intake connection key the first time. The key is retained in iOS SecureStore on that device.

## Configuration

The app defaults to the live Rejected Treasures Photo Intake API:

```text
https://rejected-economy.vercel.app
```

`EXPO_PUBLIC_PHOTO_INTAKE_API_URL` remains available as an optional override for local or preview testing. Do not compile the private Photo Intake key into an `EXPO_PUBLIC_*` value. Enter the private key only inside the app; iOS SecureStore retains it on that device.

## Expected result

The app should show the albums and counts iOS exposes under the chosen permission mode. A successful intake creates or validates the SharePoint Inventory SKU, preserves originals, creates listing-ready derivatives, updates the same Inventory row, and starts ResaleIQ research.

## Server dependency

The production Next.js photo-intake API lives in the repository root and is deployed on Vercel. Background removal is optional for the first pilot; when it is not configured, the server still creates normalized listing JPEGs and continues the SharePoint + ResaleIQ flow. See `docs/photo-intake.md`.
