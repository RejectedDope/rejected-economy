# Rejected Vault Scan — Phase 1

A real Expo/React Native Phase 1 prototype for iPhone photo-library permission and album reading.

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/RejectedDope/rejected-economy?quickstart=1&ref=main&devcontainer_path=.devcontainer%2Fdevcontainer.json)

## What works

- Requests iOS photo-library permission
- Supports Full Access and Selected Photos Only states
- Reads authorized albums directly from the device
- Displays album names, counts, and a thumbnail
- Provides Refresh and Photo Settings actions
- Sends no photos to a server

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
