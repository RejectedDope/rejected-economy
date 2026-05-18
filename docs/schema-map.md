# ResaleIQ — Database Schema Map

Canonical reference for all Supabase tables, enums, and RLS policies.
Keep in sync with `supabase/migrations/` and `lib/supabase/database.types.ts`.

---

## Migrations Applied (in order)

| File | Purpose |
|---|---|
| `001_initial_schema.sql` | Core tables: inventory, pricing, actions, snapshots, settings |
| `002_audit_leads.sql` | Public audit lead capture (no auth required) |
| `003_audit_scoring.sql` | Scoring columns on audit_leads + admin RLS |

---

## Enum Types

### `platform_type`
`eBay` | `Poshmark` | `Mercari` | `Depop` | `Facebook Marketplace` | `StockX` | `GOAT` | `Whatnot` | `Grailed` | `Other`

Used by: `inventory_items.platform`, `inventory_items.primary_recovery_action` (indirectly), `user_settings.primary_platform`

Note: `audit_leads.primary_platform` is `text`, not this enum — it also accepts `Vinted`, `Multiple platforms`, `Antique booth`, etc.

### `item_status`
`active` | `sold` | `ended` | `draft` | `relisted`

Used by: `inventory_items.status`

### `shipping_type`
`free` | `calculated` | `flat` | `local_pickup`

Used by: `inventory_items.shipping_type`

### `recovery_action_type`
`relist_now` | `strategic_markdown` | `bundle` | `move_platform` | `optimize_specifics` | `add_photos` | `liquidate` | `hold` | `sell_similar` | `adjust_shipping`

Used by: `inventory_items.primary_recovery_action`, `recovery_actions.action_type`, `scoring_snapshots.primary_action`

**Known divergence:** `lib/types.ts` `RecoveryAction` has `title_rewrite` but NOT `adjust_shipping`. The scoring engine (`lib/scoring.ts`) uses `title_rewrite` extensively. The DB enum has `adjust_shipping` but NOT `title_rewrite`. The app currently casts around this; it needs a migration to add `title_rewrite` to the enum.

### `action_status`
`pending` | `completed` | `skipped` | `snoozed`

Used by: `recovery_actions.action_status`

### `visibility_risk`
`Low` | `Medium` | `High` | `Critical`

Used by: `inventory_items.visibility_risk`, `recovery_actions.visibility_risk_snapshot`, `scoring_snapshots.visibility_risk`

---

## Tables

### `inventory_items`
Core listing table. One row per listed item per user.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → auth.users | RLS anchor |
| `title` | text NOT NULL | |
| `platform` | platform_type | default 'eBay' |
| `category` | text | nullable |
| `subcategory` | text | nullable |
| `price` | numeric(12,2) NOT NULL | current asking price |
| `original_price` | numeric(12,2) | first listed price |
| `cost_basis` | numeric(12,2) | what you paid |
| `days_listed` | integer | denormalized; synced by `sync_days_listed()` |
| `date_listed` | timestamptz | actual listing date |
| `item_specifics_complete` | boolean | default false |
| `image_count` | integer | default 1 |
| `title_keyword_strength` | integer 0–100 | default 50 |
| `has_promoted_listing` | boolean | default false |
| `shipping_type` | shipping_type | default 'calculated' |
| `shipping_cost` | numeric(8,2) | nullable |
| `views` | integer | default 0 |
| `watchers` | integer | default 0 |
| `impressions` | integer | default 0 |
| `status` | item_status | default 'active' |
| `platform_listing_id` | text | eBay item number, etc. |
| `external_url` | text | nullable |
| `dead_inventory_score` | integer 0–100 | scoring cache |
| `listing_health_score` | integer 0–100 | scoring cache |
| `visibility_risk` | visibility_risk | scoring cache |
| `primary_recovery_action` | recovery_action_type | scoring cache |
| `estimated_recovery` | numeric(12,2) | scoring cache |
| `last_scored_at` | timestamptz | nullable |
| `notes` | text | nullable |
| `tags` | text[] | nullable |
| `image_url` | text | nullable |
| `created_at` | timestamptz | default now() |
| `updated_at` | timestamptz | auto-updated via trigger |

**RLS:** Users see and modify only their own rows (`auth.uid() = user_id`).

---

### `price_history`
Every price change, markdown, or relist event.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `item_id` | uuid FK → inventory_items | cascade delete |
| `user_id` | uuid FK → auth.users | RLS anchor |
| `old_price` | numeric(12,2) | nullable |
| `new_price` | numeric(12,2) NOT NULL | |
| `change_pct` | numeric(6,2) | negative = markdown |
| `change_type` | text | `markdown` / `relist` / `correction` / `sale` / `increase` |
| `triggered_by` | text | `user` / `recovery_action` / `csv_import` |
| `notes` | text | nullable |
| `created_at` | timestamptz | |

**RLS:** Users see only their own history.

---

### `recovery_actions`
Log of every action recommended or taken per item.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `item_id` | uuid FK → inventory_items | cascade delete |
| `user_id` | uuid FK → auth.users | RLS anchor |
| `action_type` | recovery_action_type NOT NULL | |
| `action_status` | action_status | default 'pending' |
| `dead_score_snapshot` | integer | score at recommendation time |
| `price_snapshot` | numeric(12,2) | price at recommendation time |
| `days_listed_snapshot` | integer | |
| `visibility_risk_snapshot` | visibility_risk | |
| `outcome` | text | `sold` / `still_active` / `ended` / `no_change` |
| `days_to_outcome` | integer | |
| `recovery_amount` | numeric(12,2) | actual sale price if sold |
| `notes` | text | |
| `snoozed_until` | timestamptz | |
| `completed_at` | timestamptz | |
| `created_at` | timestamptz | |

**RLS:** Users see only their own action logs.

---

### `scoring_snapshots`
Periodic scoring history for trend analysis. Written on each inventory scan.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `item_id` | uuid FK → inventory_items | cascade delete |
| `user_id` | uuid FK → auth.users | RLS anchor |
| `dead_inventory_score` | integer NOT NULL | |
| `listing_health_score` | integer NOT NULL | |
| `visibility_risk` | visibility_risk NOT NULL | |
| `primary_action` | recovery_action_type | nullable |
| `estimated_recovery` | numeric(12,2) | nullable |
| `score_days_component` | integer | pts from days_listed (max 35) |
| `score_specifics_component` | integer | pts from missing specifics (max 10) |
| `score_photos_component` | integer | pts from low photos (max 5) |
| `score_title_component` | integer | pts from weak title (max 10) |
| `sell_through_probability` | integer 0–100 | |
| `recovery_probability` | integer 0–100 | |
| `pricing_risk` | text | |
| `price_at_snapshot` | numeric(12,2) | |
| `days_at_snapshot` | integer | |
| `scored_at` | timestamptz NOT NULL | |

**Known divergence:** The scoring engine has 7 factors (days_listed, pricing_competitiveness, visibility_signals, title_strength, item_specifics, photo_coverage, shipping_competitiveness) but only 4 are stored as components. Missing: `score_pricing_component`, `score_visibility_component`, `score_shipping_component`.

**RLS:** Users see only their own snapshots.

---

### `user_settings`
Per-user defaults for platform fees, aging thresholds, and notification prefs.

| Column | Type | Default |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → auth.users | UNIQUE |
| `primary_platform` | platform_type | 'eBay' |
| `active_platforms` | text[] | ['eBay'] |
| `ebay_fee_pct` | numeric(5,2) | 13.25 |
| `poshmark_fee_pct` | numeric(5,2) | 20.00 |
| `mercari_fee_pct` | numeric(5,2) | 10.00 |
| `depop_fee_pct` | numeric(5,2) | 10.00 |
| `avg_shipping_cost` | numeric(8,2) | 5.00 |
| `free_shipping_threshold` | numeric(8,2) | 50.00 |
| `stale_warning_days` | integer | 60 |
| `stale_critical_days` | integer | 90 |
| `dead_threshold_days` | integer | 180 |
| `notify_critical_items` | boolean | true |
| `notify_weekly_report` | boolean | true |
| `notify_new_death_pile` | boolean | true |
| `created_at` | timestamptz | now() |
| `updated_at` | timestamptz | auto-updated |

Note: `active_platforms` is `text[]` not `platform_type[]` — allows flexibility but loses enum validation.

**RLS:** Users see only their own settings.

---

### `audit_leads`
Public-facing intake form submissions. No auth required to insert.
Added by migration 002, extended by migration 003.

| Column | Type | Migration | Notes |
|---|---|---|---|
| `id` | uuid PK | 002 | |
| `created_at` | timestamptz | 002 | default now() |
| `name` | text NOT NULL | 002 | |
| `email` | text NOT NULL | 002 | |
| `primary_platform` | text NOT NULL | 002 | free text — not platform_type enum |
| `inventory_count` | text NOT NULL | 002 | e.g. "25–100 items" |
| `biggest_problem` | text NOT NULL | 002 | |
| `listing_url` | text | 002 | nullable |
| `notes` | text | 002 | nullable |
| `status` | text | 002 | default 'new' — unconstrained |
| `source` | text | 002 | default 'recovery_audit' |
| `severity_score` | integer | 003 | nullable; 0–100 |
| `recovery_est_low` | integer | 003 | nullable; USD |
| `recovery_est_high` | integer | 003 | nullable; USD |
| `suggested_action` | text | 003 | nullable |
| `reviewed_at` | timestamptz | 003 | nullable |

**RLS:**
- Anon: INSERT only (public form submission)
- Authenticated: SELECT + UPDATE (admin review workflow)

**Known issue:** `status` has no CHECK constraint. Admin code expects only `new | reviewed | contacted`. A future migration should add `CHECK (status IN ('new', 'reviewed', 'contacted'))`.

---

## Helper Functions

### `sync_days_listed()`
Recomputes `days_listed` for all active items from `date_listed`. Call via cron or manually.

```sql
select sync_days_listed();
```

### `get_trapped_cash(p_user_id uuid)`
Returns total value of active inventory for a user.

```sql
select get_trapped_cash('user-uuid-here');
```

---

## Known Technical Debt

| Issue | Location | Severity | Fix |
|---|---|---|---|
| `recovery_action_type` enum missing `title_rewrite` | migration 001 | Medium | Add to enum in new migration |
| `recovery_action_type` enum has unused `adjust_shipping` | migration 001 | Low | Deprecate in new migration |
| `scoring_snapshots` missing 3 factor columns | migration 001 | Low | Add `score_pricing_component`, `score_visibility_component`, `score_shipping_component` |
| `audit_leads.status` unconstrained | migration 002 | Medium | Add CHECK constraint in new migration |
| `audit_leads.primary_platform` is text, not enum | migration 002 | Low | Intentional — wider platform support |
| Migration 001 not idempotent (no IF NOT EXISTS) | migration 001 | Low | Add guards; only matters for re-runs |
| `user_settings.active_platforms` is text[], not platform_type[] | migration 001 | Low | Intentional — allows unknown platforms |
