# Rejected Vault Scan — Phase 1

A real Expo/React Native Phase 1 prototype for iPhone photo-library permission and album reading.

## What works

- Requests iOS photo-library permission
- Supports Full Access and Selected Photos Only states
- Reads authorized albums directly from the device
- Displays album names, counts, and a thumbnail
- Provides Refresh and Photo Settings actions
- Sends no photos to a server

## Phone-only testing with GitHub Codespaces

1. Open this repository in GitHub.
2. Switch to the `feature/rejected-vault-scan-phase1` branch.
3. Open **Code → Codespaces → Create codespace on feature/rejected-vault-scan-phase1**.
4. In the terminal run:

```bash
cd apps/rejected-vault-scan
npm install
npx expo start --tunnel
```

5. Open the generated Expo link in Expo Go.
6. Test Full Photo Access.
7. Go to **iPhone Settings → Apps → Expo Go → Photos** and switch to Selected Photos.
8. Reopen the app and tap Refresh.

## Expected Phase 1 result

The app should show the albums and counts iOS exposes under the chosen permission mode. Limited access behavior may differ because iOS can expose only the selected assets rather than a complete album structure.

## Not included yet

- Scanning
- AI classification
- Grouping
- Pricing
- Reports
- Uploading

These belong to Phase 2 and later, after on-device album behavior is confirmed.
