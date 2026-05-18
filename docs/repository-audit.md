# ResaleIQ — Repository Audit

Comprehensive audit of the repository state, dependency health, deployment
configuration, and technical debt. Generated during Phase 2 stabilization.

---

## Repository Overview

| Property | Value |
|---|---|
| App name | resaleiq |
| Framework | Next.js 16.2.6 (App Router) |
| Runtime | Node.js 22.x (LTS) |
| Package manager | npm 10.x |
| Lockfile version | v3 (npm 7+) |
| TypeScript | 5.9.3 |
| React | 19.2.6 |
| Deployment target | Vercel |

---

## Dependency Map

### Production Dependencies

| Package | Version (pkg.json) | Version (lockfile) | Notes |
|---|---|---|---|
| `next` | 16.2.6 | 16.2.6 ✓ | Fixed — was 15.1.0 pre-Phase 2 |
| `react` / `react-dom` | ^19.0.0 | 19.2.6 ✓ | |
| `@supabase/ssr` | ^0.5.2 | 0.5.2 ✓ | |
| `@supabase/supabase-js` | ^2.47.10 | 2.105.4 ✓ | |
| `@radix-ui/*` | various ^2.x | locked ✓ | |
| `lucide-react` | ^0.468.0 | locked ✓ | |
| `recharts` | ^2.14.1 | locked ✓ | |
| `tailwindcss-animate` | ^1.0.7 | locked ✓ | |
| `clsx` | ^2.1.1 | locked ✓ | |
| `tailwind-merge` | ^2.5.5 | locked ✓ | |
| `class-variance-authority` | ^0.7.1 | locked ✓ | |
| `papaparse` | ^5.4.1 | locked ✓ | CSV parsing |
| `react-dropzone` | ^14.3.5 | locked ✓ | File upload |
| `react-hook-form` | ^7.54.2 | locked ✓ | |
| `@hookform/resolvers` | ^3.9.1 | locked ✓ | |
| `zod` | ^3.24.1 | locked ✓ | |

### Dev Dependencies

| Package | Version | Notes |
|---|---|---|
| `typescript` | ^5 | Resolves to 5.9.3 |
| `eslint` | ^9 | |
| `eslint-config-next` | 16.2.6 | Pinned to match Next.js |
| `tailwindcss` | ^3.4.1 | |
| `autoprefixer` | ^10.5.0 | |
| `postcss` | ^8 | |
| `@types/node` | ^20 | |
| `@types/react` | ^19 | |
| `@types/react-dom` | ^19 | |
| `@types/papaparse` | ^5.3.15 | |

---

## Identified Risks

### RESOLVED in Phase 2

| Risk | Status | Resolution |
|---|---|---|
| `package-lock.json` had `next@15.1.0` while `package.json` required `16.2.6` | FIXED | Regenerated lockfile with `npm install` |
| `npm ci` failed due to lockfile mismatch | FIXED | Lockfile now canonical |
| `vercel.json` `installCommand: "npm install"` workaround | REMOVED | No longer needed after lockfile fix |
| `supabaseConfigured` check duplicated in 3 files | FIXED | Centralized in `lib/env.ts` |
| Unsafe `process.env!` non-null assertions in server files | MITIGATED | `lib/env.ts` provides safe access |

### REMAINING

| Risk | Severity | Notes |
|---|---|---|
| `@supabase/ssr` 0.5.x imports from non-existent `dist/module/lib/types` path | Low | `skipLibCheck: true` suppresses the error; workaround documented in `lib/supabase/database.types.ts` |
| `recovery_action_type` enum missing `title_rewrite` | Medium | Scoring engine uses `title_rewrite` in app code but it's not in the DB enum. See schema-map.md |
| PostCSS moderate severity CVE (GHSA-qx2v-qp2m-jg93) | Low | `npm audit fix --force` would downgrade to Next.js 9.x. This is a transitive dependency; the XSS vector requires an attacker to control CSS input, not applicable here |
| `@radix-ui` version spread across multiple sub-packages | Low | Normal for Radix — each component is independently versioned |
| No `.nvmrc` or `engines` field in `package.json` | Low | No Node version pinning; Vercel defaults to LTS |

---

## Current Deployment Flow

```
Developer
  → git push to claude/resaleiq-platform-QTra1
  → [manual] merge to main
  → Vercel detects push to main
  → Vercel runs: npm ci (now canonical)
  → Vercel runs: npm run build
  → Vercel deploys to production
```

### Vercel Configuration

| Setting | Value |
|---|---|
| Framework preset | Next.js (auto-detected) |
| Install command | `npm ci` (default, now correct) |
| Build command | `npm run build` (default) |
| Output directory | `.next` (default) |
| Node version | Vercel default (matches LTS) |
| Root directory | `/` |

### Environment Variables (required on Vercel)

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (for auth/leads) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes (for auth/leads) | Supabase anon/public key |

Both are `NEXT_PUBLIC_` — they appear in browser bundles. They're safe to expose
(Supabase anon key is designed to be public; RLS policies enforce access control).

---

## Dependency Notes

### Why `@supabase/supabase-js` jumped from 2.47.10 → 2.105.4

The package.json specifies `^2.47.10` (any compatible 2.x). When the lockfile was
regenerated, npm resolved to the latest 2.x compatible version (2.105.4). This is
expected and correct. The breaking change boundary is major versions (3.x), which
we're not on.

### Why PostCSS CVE is acceptable

The CVE is about XSS when PostCSS stringifies CSS that an attacker controls. In
ResaleIQ, PostCSS runs at build time only; user-supplied data never passes through
PostCSS. The fix (`npm audit fix --force`) would downgrade to Next.js 9.3.3, which
is unacceptable.

### `tailwindcss-animate` peer dep

Requires Tailwind v3. The repo uses `tailwindcss: ^3.4.1`. Compatible. Tailwind v4
would require either migrating to its native animation system or replacing this
package.

---

## Unresolved Technical Debt

See also: `docs/schema-map.md` for database-layer debt.

| Item | File | Priority |
|---|---|---|
| `@supabase/ssr` GenericSchema type resolution | `lib/supabase/database.types.ts` | Low |
| No test suite | — | High (before scaling) |
| No error boundary in root layout | `app/layout.tsx` | Medium |
| `images.remotePatterns: hostname: "**"` is too permissive | `next.config.ts` | Low |
| No Node version pinned | `package.json` | Low |
| `scoring_snapshots` table missing 3 factor columns | migrations | Low |
| `recovery_action_type` enum vs app types divergence | migrations | Medium |

---

## Recommended Cleanup Actions

1. **Add `engines` field to `package.json`** — pin Node.js to `>=22.0.0` to prevent
   future drift between local and Vercel environments.

2. **Tighten `remotePatterns`** — `hostname: "**"` allows any HTTPS image host.
   When image sources are known, pin to specific domains.

3. **Add a future migration to fix DB enum** — add `title_rewrite` to
   `recovery_action_type`; remove or document `adjust_shipping`.

4. **Add Playwright or Vitest** — the platform has no test coverage. Even basic
   smoke tests on the audit form and admin leads would prevent regressions.

5. **Pin Node version** — add `.nvmrc` with `22` and `engines: { node: ">=22.0.0" }`
   in `package.json`.
