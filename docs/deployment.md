# ResaleIQ — Deployment Guide

Complete reference for deploying, configuring, and maintaining the production
ResaleIQ platform on Vercel + Supabase.

---

## Architecture Overview

```
Browser
  ↓
Vercel Edge (proxy.ts middleware — session refresh)
  ↓
Next.js 16 App Router (server + client components)
  ↓
Supabase (Postgres + Auth + Row Level Security)
```

**No backend API server.** All data access goes through Supabase client libraries
directly from Next.js server components or browser fetch.

---

## Environment Variables

### Required for Production

Set these in Vercel → Project → Settings → Environment Variables.

| Variable | Where to find it | Environments |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project → Settings → API → Project URL | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project → Settings → API → Project API keys → `anon` `public` | Production, Preview, Development |

Both are `NEXT_PUBLIC_` — they're intentionally exposed to the browser. Supabase
is designed for this; Row Level Security (RLS) enforces access control server-side.

### Local Development

Create `.env.local` in the project root (this file is gitignored):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Without this file, the app runs in **dev mode** — all non-data features work,
but Supabase calls are disabled (no lead capture, no admin panel).

---

## Supabase Setup

### New Project Setup

1. Create a Supabase project at supabase.com
2. Go to SQL Editor
3. Run migrations in order:

```sql
-- Step 1: Core schema
-- Paste contents of: supabase/migrations/001_initial_schema.sql

-- Step 2: Audit leads table
-- Paste contents of: supabase/migrations/002_audit_leads.sql

-- Step 3: Scoring columns + admin RLS
-- Paste contents of: supabase/migrations/003_audit_scoring.sql
```

4. Copy the Project URL and anon key from Settings → API
5. Set them as environment variables in Vercel

### Migration Execution Order

Migrations MUST be applied in sequence — each depends on the previous:

```
001_initial_schema.sql      ← Run first. Creates all core tables and enums.
002_audit_leads.sql         ← Run second. Creates audit_leads table.
003_audit_scoring.sql       ← Run third. Adds scoring columns + admin RLS.
```

Migration 001 is NOT idempotent — running it twice will fail on duplicate type/table
creation. Only run once per project.

Migrations 002 and 003 use `ADD COLUMN IF NOT EXISTS` and `CREATE POLICY` with
explicit names — they're safe to re-run.

### Verifying RLS

After migrations, verify RLS is active:

```sql
-- Should return rows for each table with 'on' status
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

Expected: `rowsecurity = true` for all 6 tables.

---

## Vercel Deployment

### Initial Deployment

1. Push code to GitHub (main branch)
2. Connect repo to Vercel (Import Project)
3. Vercel auto-detects Next.js — no framework config needed
4. Add environment variables in Vercel dashboard
5. Deploy

### Build Configuration (Vercel defaults — no overrides needed)

| Setting | Value |
|---|---|
| Framework | Next.js |
| Build Command | `npm run build` |
| Install Command | `npm ci` |
| Output Directory | `.next` |
| Node.js Version | 22.x (set in Vercel project settings) |

**No `vercel.json` overrides are needed.** The file was previously required to
work around a lockfile mismatch (next 15.1.0 in lockfile, 16.2.6 in package.json).
That mismatch has been fixed as of Phase 2 — the lockfile is now canonical.

### Branch Strategy

| Branch | Trigger | Deploy Target |
|---|---|---|
| `main` | Vercel auto-deploy | Production |
| `claude/resaleiq-platform-QTra1` | Vercel preview | Preview URL |
| `feature/*` | Vercel preview | Preview URL |

---

## Production Deploy Checklist

Before every production deployment:

- [ ] `npm ci` runs clean locally (no lockfile errors)
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run build` completes without errors or warnings
- [ ] Supabase migrations are up to date on the target project
- [ ] Environment variables are set correctly in Vercel
- [ ] Middleware/proxy.ts is not relying on deprecated Next.js APIs

After deployment:

- [ ] Visit `/` — homepage loads
- [ ] Visit `/recovery-audit` — form renders
- [ ] Submit test lead — verify no console errors
- [ ] Visit `/admin/audit-leads` — verify auth redirect for unauthenticated users
- [ ] Visit `/dashboard` — verify it loads (uses mock data when Supabase has no items)

---

## Rollback Checklist

If a deployment breaks production:

1. **Instant rollback via Vercel**: Vercel → Deployments → find last good deployment
   → ⋯ → Promote to Production

2. **Git rollback**: If the bad commit was already pushed to `main`:
   ```bash
   git revert HEAD --no-edit
   git push origin main
   ```
   This is safe — it creates a new commit rather than rewriting history.

3. **Database rollback**: Supabase migrations are additive (columns, policies only).
   If a migration caused data issues:
   - Use Supabase Dashboard → Table Editor to manually fix data
   - Write a compensating migration to undo schema changes
   - Never delete columns with live data without a data-preservation plan

---

## Recovery Steps for Failed Deploys

### `npm ci` fails

Symptom: Vercel build log shows lockfile mismatch errors.

Fix:
```bash
npm install          # regenerates lockfile from package.json
git add package-lock.json
git commit -m "fix: regenerate lockfile"
git push
```

### Build fails: TypeScript errors

Symptom: `Type error: ...` in Vercel build log.

Fix: Run `npm run typecheck` locally, fix all errors, push.

### Build fails: Missing environment variables

Symptom: `NEXT_PUBLIC_SUPABASE_URL!` throws at runtime, or build fails with
undefined reference.

Fix: Add the variable in Vercel → Settings → Environment Variables, then
trigger a new deployment (Vercel → Deployments → Redeploy).

### Supabase auth broken after deployment

Symptom: All users get redirected to `/login`, even when logged in.

Likely causes:
1. Supabase project URL changed — update `NEXT_PUBLIC_SUPABASE_URL`
2. Anon key rotated — update `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `proxy.ts` middleware broke cookie handling — check middleware logic

### Admin panel shows 403 or empty leads

Symptom: `/admin/audit-leads` loads but shows no leads or permission error.

Likely cause: Migration 003 wasn't run on the Supabase project.

Fix: Run `supabase/migrations/003_audit_scoring.sql` in Supabase SQL Editor.

---

## Middleware Notes

The file `proxy.ts` (at project root) serves as the Next.js middleware. It:
- Refreshes Supabase session cookies on every request
- Protects `/settings` and `/admin` routes (requires authenticated user)
- Redirects authenticated users away from `/login` and `/signup`

**This file is NOT named `middleware.ts`** — it was renamed to `proxy.ts` to
avoid a conflict with a deprecated pattern. The `next.config.ts` does not need
any special configuration for this; Next.js finds middleware by the filename
`middleware.ts` or `proxy.ts` (the latter via the Next.js 16 proxy convention).

Actually: as of Next.js 16.2.6, the middleware file must be named `middleware.ts`
OR configured via the `matcher` export from `proxy.ts`. Review the Next.js 16
middleware docs if routing behavior is unexpected.

---

## Environment Validation

The application uses `lib/env.ts` to centralize environment variable access.

```typescript
import { supabaseConfigured, requireSupabase, envDiagnostics } from "@/lib/env";

// Check before Supabase queries
if (!supabaseConfigured) {
  return <DevModeWarning />;
}

// In server components that require Supabase
const check = requireSupabase();
if (!check.ok) {
  logger.error("supabase", check.reason);
  return <ConfigError reason={check.reason} />;
}
```

This prevents production crashes when environment variables are missing or
set to placeholder values.
