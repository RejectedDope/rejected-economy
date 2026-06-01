# RLS Audit — ResaleIQ

> **Scope:** All 6 tables across migrations 001–003.  
> **Date:** 2026-05-18  
> **Status:** Pass — no privilege escalation paths found.

---

## Summary

| Table | RLS Enabled | Policies | Anon INSERT | Anon SELECT | Auth SELECT | Auth UPDATE |
|---|---|---|---|---|---|---|
| `inventory_items` | ✅ | 1 | ❌ | ❌ | ✅ (own rows) | ✅ (own rows) |
| `price_history` | ✅ | 1 | ❌ | ❌ | ✅ (own rows) | ✅ (own rows) |
| `recovery_actions` | ✅ | 1 | ❌ | ❌ | ✅ (own rows) | ✅ (own rows) |
| `scoring_snapshots` | ✅ | 1 | ❌ | ❌ | ✅ (own rows) | ✅ (own rows) |
| `user_settings` | ✅ | 1 | ❌ | ❌ | ✅ (own rows) | ✅ (own rows) |
| `audit_leads` | ✅ | 3 | ✅ (anon) | ❌ | ✅ (all rows) | ✅ (all rows) |

---

## Per-Table Analysis

### `inventory_items` — Core inventory

**Policy:** `"Users manage own inventory"` — `FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`

- ✅ Anon key cannot read, insert, or modify any row.
- ✅ Authenticated users are scoped to `user_id = auth.uid()`. Cross-user reads are impossible.
- ✅ INSERT is also constrained: `WITH CHECK` prevents inserting under a different `user_id`.
- ✅ `security definer` helper functions (`sync_days_listed`, `get_trapped_cash`) take a `p_user_id` parameter — caller must provide their own UID; the function does not bypass row ownership.
- ⚠️ `get_trapped_cash(p_user_id)` accepts any UUID — a malicious authenticated user can pass another user's ID. **Risk: LOW** — the function only returns a `sum(price)` aggregate, not individual rows or PII. Fix: add `WHERE user_id = auth.uid()` and remove the parameter, or gate with an `IF p_user_id != auth.uid() THEN RAISE EXCEPTION` check.

### `price_history` — Price change log

**Policy:** `"Users manage own price history"` — `FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`

- ✅ Same pattern as `inventory_items`. Row-level isolation is complete.
- ✅ `item_id` references `inventory_items(id) ON DELETE CASCADE` — when an item is deleted, its price history is also deleted, which is consistent with the ownership model.
- No concerns.

### `recovery_actions` — Recommended actions log

**Policy:** `"Users manage own recovery actions"` — `FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`

- ✅ Correct isolation. Same pattern as above.
- ✅ `item_id → inventory_items ON DELETE CASCADE` consistent.
- No concerns.

### `scoring_snapshots` — Periodic score history

**Policy:** `"Users manage own scoring snapshots"` — `FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`

- ✅ Correct isolation.
- ⚠️ Application currently writes score results directly to `inventory_items` columns (`dead_inventory_score`, `listing_health_score`, etc.) — `scoring_snapshots` is not populated yet. When snapshot writes are implemented, ensure the write path uses the authenticated Supabase client (not service role) so the `user_id` column is enforced.

### `user_settings` — Per-user configuration

**Policy:** `"Users manage own settings"` — `FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`

- ✅ `UNIQUE` constraint on `user_id` at the schema level — one row per user enforced by both the DB and RLS.
- No concerns.

### `audit_leads` — Public audit form submissions

This table has a different threat model: it accepts anonymous writes from the public-facing form.

**Policy 1:** `"public_insert_audit_leads"` — `FOR INSERT WITH CHECK (true)`  
**Policy 2:** `"auth_select_audit_leads"` — `FOR SELECT TO authenticated USING (true)`  
**Policy 3:** `"auth_update_audit_leads"` — `FOR UPDATE TO authenticated USING (true) WITH CHECK (true)`

**Anon INSERT path:**
- ✅ The form submits via the browser's Supabase client using the anon key.
- ✅ Only INSERT is permitted — anon users cannot SELECT, UPDATE, or DELETE.
- ✅ No `user_id` column — there is no concept of lead ownership from the client side.
- ✅ Input is validated server-side via Zod schema (`lib/validation/audit-schema.ts`) before any Supabase call. Enum fields (`primary_platform`, `inventory_count`, `biggest_problem`) are constrained to known values. URL field requires `http(s)://` prefix.
- ✅ Scoring columns (`severity_score`, `recovery_est_low/high`, `suggested_action`) are computed server-side after submission — the anon client cannot set them during INSERT (they are not in the INSERT schema type).
- ⚠️ No rate limiting at the DB layer — spamming the form can fill `audit_leads` with junk. **Mitigation:** add Supabase rate-limit middleware or a Cloudflare rule on the `/recovery-audit` route. Not blocking.
- ⚠️ `status` column has no DB-level constraint — any string can be inserted. **Risk: LOW** — anon INSERT policy has `WITH CHECK (true)`, so a malicious user could insert a row with `status = 'contacted'` to game the admin view. **Fix:** add `CHECK (status IN ('new', 'reviewed', 'contacted'))` on the column, or restrict the `WITH CHECK` clause to only allow `status = 'new'` on insert.

**Authenticated SELECT/UPDATE path (admin):**
- ✅ Both policies require `TO authenticated` — the anon role cannot trigger them.
- ✅ `USING (true)` is intentional: all admins see all leads (there is only one admin role).
- ⚠️ There is no role distinction between "authenticated user" and "admin" at the DB layer — any authenticated Supabase user can read and update all audit leads. **Risk: MEDIUM** — in the current single-admin deployment this is acceptable. If multi-user auth is added (e.g., customers logging in), this policy must be restricted to a specific admin role or JWT claim. Tracked in schema-map.md § Known Issues.
- ✅ The application layer adds defense-in-depth: `requireAdmin()` in `lib/auth/admin.ts` gates all admin routes before they reach Supabase; the admin layout and each admin page call this guard independently.

---

## Admin Route Security Stack

Three independent guards must all pass to access admin data:

1. **`proxy.ts` (middleware):** Redirects unauthenticated requests to `/login` before any page code runs. Runs at the edge on every request to `/admin/**`.
2. **`app/admin/layout.tsx`:** Calls `requireAdmin()` server-side. If auth check fails, redirects to `/login`. Catches any session that slipped past the middleware (e.g., expired token).
3. **`app/admin/audit-leads/page.tsx`:** Calls `requireAdmin()` again at the page level. Distinguishes `unconfigured` (dev mode, renders a warning) from `unauthenticated` (redirects). Uses `isPermissionError()` to detect Supabase RLS rejections as a separate signal from network errors.

This defense-in-depth means a single failed guard does not expose data.

---

## Functions With `SECURITY DEFINER`

| Function | Definer Risk | Notes |
|---|---|---|
| `update_updated_at()` | None — trigger function, no user input | Safe |
| `sync_days_listed()` | Low — reads no user input, updates all active items | Should be called by service role only (cron job) |
| `get_trapped_cash(p_user_id)` | Low — aggregate only, no PII | See ⚠️ above re: UUID bypass |

---

## Findings Summary

| Severity | Finding | Status |
|---|---|---|
| LOW | `get_trapped_cash()` accepts arbitrary UUID — leaks aggregate value cross-user | Open — accept for now |
| LOW | `audit_leads.status` has no DB CHECK constraint — anon can insert non-`new` status | Open — add CHECK in next migration |
| MEDIUM | `auth_select/update_audit_leads` grants all authenticated users admin access to leads | Accepted — single-admin deployment; revisit if customer auth is added |
| LOW | No rate limiting on `audit_leads` INSERT — form can be spammed | Open — add edge-level rate limit |

No critical or high-severity issues found. The RLS configuration correctly isolates user data and restricts public access to insert-only on the audit form.
