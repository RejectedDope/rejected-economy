# Rejected Vault Scan — Photo Intake Phase 2

An Expo/React Native iPhone intake app that reads authorized albums, associates a selected batch to one existing SharePoint SKU, preserves originals, and starts listing-image processing.

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/RejectedDope/rejected-economy?quickstart=1&ref=main&devcontainer_path=.devcontainer%2Fdevcontainer.json)

## What works

- Requests iOS photo-library permission
- Supports Full Access and Selected Photos Only states
- Reads authorized albums directly from the device
- Displays album names, counts, and a thumbnail
- Provides Refresh and Photo Settings actions
- Opens an album and selects up to 25 photos
- Requires one existing SharePoint SKU for the entire batch
- Stores the private connection key in iOS SecureStore
- Uploads originals and JPEG processing previews separately
- Completes the batch only after the server returns per-photo results

## Phone-only testing with GitHub Codespaces

1. Tap **Open in GitHub Codespaces** above.
2. Confirm the repository is `RejectedDope/rejected-economy` and the branch is `main`.
3. Tap **Create codespace**.
4. The workspace opens directly inside `apps/rejected-vault-scan` and runs `npm install` plus `expo-doctor` automatically.
5. In the terminal run:

```bash
npx expo start --tunnel
```

6. Open the generated Expo link in Expo Go.
7. Test Full Photo Access.
8. Go to **iPhone Settings → Apps → Expo Go → Photos** and switch to Selected Photos.
9. Reopen the app and tap Refresh.

## Configuration

Set only the server URL in the Expo environment:

```bash
EXPO_PUBLIC_PHOTO_INTAKE_API_URL=https://your-resaleiq-api.example.com
```

Do not compile the private Photo Intake key into an `EXPO_PUBLIC_*` value. Enter it once in the app; iOS SecureStore retains it on that device.

## Expected result

The app should show the albums and counts iOS exposes under the chosen permission mode. Limited access behavior may differ because iOS can expose only the selected assets rather than a complete album structure.

## Server dependency

The Next.js API and self-hosted worker live in the repository root. See `docs/photo-intake.md`.

These belong to Phase 2 and later, after on-device album behavior is confirmed.
