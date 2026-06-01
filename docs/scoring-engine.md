# ResaleIQ Scoring Engine — Internal Reference

**Rejected Economy — Internal Documentation**
Last updated: 2026-05-18

---

## Overview

ResaleIQ operates two distinct scoring engines. They share a philosophy but run on different data sources and serve different moments in the product lifecycle.

| Engine | Source file | Data available | Purpose |
|---|---|---|---|
| Dead Inventory Score | `lib/scoring.ts` | Full marketplace listing data per item | Per-item risk triage for active inventory |
| Audit Lead Scoring | `lib/audit-scoring.ts` | Form fields only — no marketplace data | Severity and recovery estimate at lead intake |

Neither engine uses external market data feeds or live price lookups. All conclusions are derived from signals the reseller already has: listing age, engagement counts, listing quality fields, and their own self-reported intake answers.

---

## Engine 1 — Dead Inventory Score

**Source:** `lib/scoring.ts`
**Function:** `calcDeadScore(item: InventoryItem): number`
**Range:** 0–100, where higher = more dead.

### Philosophy

The dead inventory score is a stacked-signal model. A single weak factor does not make a listing dead — the score requires multiple compounding problems before escalating to High or Critical. A freshly listed item with one photo but a perfect title and good engagement will score low. A 200-day-old listing with high views, zero watchers, stale pricing, weak title, and incomplete specifics will score near 100.

The score is biased toward actionability, not forensic precision. It surfaces the listings that need intervention now. Because of this, it intentionally treats uncertain data conservatively: missing engagement data and null price history are treated as risk signals, not neutral blanks.

### Factor breakdown

Seven factors contribute, totaling a maximum of 100 points. Points are penalties — each factor adds to the score when it detects a problem. The result is `min(100, sum of all factor points)`.

---

#### Factor 1 — `days_listed` — 35 pts max

The heaviest single factor. Marketplace search algorithms (eBay's Cassini is the primary reference) progressively de-index older listings. The 90-day mark represents a well-documented freshness cliff. Past 180 days, organic impressions approach zero regardless of listing quality.

| Days listed | Points |
|---|---|
| 0–14 | 0 |
| 15–30 | 6 |
| 31–60 | 14 |
| 61–90 | 22 |
| 91–180 | 28 |
| 181+ | 35 |

The jump from 22 → 28 at the 90-day mark is intentional. The jump from 28 → 35 at 181 days represents the dead zone: no freshness remains and only a relist can restore organic placement.

---

#### Factor 2 — `pricing_competitiveness` — 20 pts max

No external price comparison is performed. This factor reads buyer engagement patterns as a price signal. Two independent sub-signals are evaluated and summed, then capped at 20.

**Sub-signal A — Price rejection** (views with no buyer commitment):

| Condition | Points |
|---|---|
| views ≥ 100 AND watchers = 0 | +12 |
| views ≥ 60 AND watchers ≤ 1 AND days_listed ≥ 30 | +8 |
| views ≥ 25 AND watchers = 0 AND days_listed ≥ 45 | +5 |
| None | 0 |

Only the first matching condition applies (cascade).

**Sub-signal B — Stale pricing** (no markdown despite age):

"No markdown" is defined as `price >= original_price * 0.97`. If `original_price` is null, the item is treated as never having been repriced — this adds penalty points, which is intentional: unknown price history is a conservative risk signal.

| Condition | Points |
|---|---|
| days_listed ≥ 90 AND no markdown on record | +8 |
| days_listed ≥ 60 AND no markdown on record | +5 |
| Otherwise | 0 |

Total pricing points = `min(20, sub-signal A + sub-signal B)`.

---

#### Factor 3 — `visibility_signals` — 15 pts max

Three sub-signals measuring algorithmic placement and traffic. Evaluated independently, summed, capped at 15.

**Sub-signal A — Watcher deficit:**

| Condition | Points |
|---|---|
| watchers = 0 AND days_listed ≥ 60 | +7 |
| watchers = 0 AND days_listed ≥ 30 | +4 |
| watchers ≤ 1 AND days_listed ≥ 90 | +3 |
| Otherwise | 0 |

First matching condition only.

**Sub-signal B — View velocity** (`views / days_listed`):

| Condition | Points |
|---|---|
| viewsPerDay < 0.5 AND days_listed ≥ 30 | +5 |
| viewsPerDay < 1.0 AND days_listed ≥ 60 | +3 |
| Otherwise | 0 |

If `days_listed = 0`, raw `views` is used directly to avoid division by zero.

**Sub-signal C — Promotion gap:**

| Condition | Points |
|---|---|
| has_promoted_listing = false AND days_listed ≥ 90 AND watchers ≤ 1 | +3 |
| Otherwise | 0 |

---

#### Factor 4 — `title_strength` — 10 pts max

Based on the `title_keyword_strength` field (0–100 integer on the item record). This field is not computed by the scoring engine — it is a pre-computed value set at import. The thresholds are calibrated to eBay's 80-character title limit as the primary case.

| title_keyword_strength | Points |
|---|---|
| < 40 | 10 |
| 40–59 | 6 |
| 60–74 | 2 |
| ≥ 75 | 0 |

---

#### Factor 5 — `item_specifics` — 10 pts max

Binary. Missing item specifics exclude a listing from filtered searches in Cassini (eBay's search engine evaluates category attributes as a ranking input). No partial credit.

| item_specifics_complete | Points |
|---|---|
| false | 10 |
| true | 0 |

---

#### Factor 6 — `photo_coverage` — 5 pts max

Listings with a single photo convert significantly worse than listings with four or more photos. Low weight (5 pts) because photo count is a CTR and trust signal, not a search indexing signal.

| image_count | Points |
|---|---|
| 1 | 5 |
| 2–3 | 3 |
| 4–5 | 1 |
| 6+ | 0 |

---

#### Factor 7 — `shipping_competitiveness` — 5 pts max

Shipping cost as a percentage of item price. Buyers comparison-shop on total delivered cost. High shipping kills conversions on low-value items.

| Condition | Points |
|---|---|
| shipping_cost > 25% of price | 5 |
| shipping_cost > 15% of price | 3 |
| shipping_type ≠ "free" AND price < $40 | 2 |
| Otherwise | 0 |

First matching condition only. When `shipping_cost` is null (calculated shipping), the first two conditions are skipped, but the third still fires for sub-$40 items with non-free shipping type. This is an intentional conservative approximation.

---

### Risk tiers

The dead inventory score maps to four named risk tiers used throughout the product.

| Score range | Tier | Meaning |
|---|---|---|
| 0–29 | Low | Within normal sell-through window. No action required. |
| 30–49 | Medium | Showing age or quality gaps. Optimize now to avoid escalation. |
| 50–74 | High | Clear compounding problems. Action needed this week. |
| 75–100 | Critical | Multiple stacked failures. Immediate recovery required. |

`calcVisibilityRisk()` calls `calcDeadScore()` and maps the result to the `VisibilityRisk` enum. This is the value displayed in the UI, stored in `inventory_items.visibility_risk`, and written to `scoring_snapshots.visibility_risk`.

---

### Listing health score

**Function:** `calcHealthScore(item: InventoryItem): number`

A companion score (0–100, higher = healthier) for positive-framing contexts. Not the inverse of the dead score — it uses different factor weights and does not include engagement behavior.

| Factor | Max pts | Logic |
|---|---|---|
| item_specifics_complete | 20 | Complete = +20 |
| image_count | 20 | 8+ = 20, 4–7 = 15, 2–3 = 8, fewer = 0 |
| title_keyword_strength | 30 | Linear: `(strength / 100) × 30`, rounded |
| days_listed (freshness) | 30 | 0–14d=30, 15–30d=25, 31–60d=18, 61–90d=10, 91–180d=4, 181d+=0 |

A listing can have a moderate health score while scoring High risk on the dead score. Health score does not factor in views or watchers; the dead score does. The two scores are complementary, not redundant.

---

### Pricing position analysis

**Function:** `calcPricingPosition(item: InventoryItem): PricingAnalysis`

A separate analytical function that returns a qualitative label (`overpriced`, `competitive`, `underpriced`, `liquidation_candidate`) with confidence level, supporting signal strings, and a suggested markdown percentage for overpriced cases.

This function does not contribute to the dead score. It is a diagnostic narrative layer on top of the engagement data, used for the pricing insight panel in the UI.

Key path: if `days_listed > 365 AND views > 30`, the function returns `liquidation_candidate` immediately, bypassing all other logic. Suggested markdown: 70%.

For overpriced detection, an internal `overpricedScore` is incremented by the same views/watchers signals used in Factor 2. Confidence thresholds:

| overpricedScore | Label | Confidence |
|---|---|---|
| ≥ 4 | Overpriced | high |
| 2–3 | Likely Overpriced | medium |
| 1 | Possibly Overpriced | low |

Underpriced fires only if `underpricedScore ≥ 3`, which requires watcher-to-view rate ≥ 15%.

---

### Primary recovery action

**Function:** `calcPrimaryAction(item: InventoryItem): RecoveryAction`

Returns a single highest-ROI recovery action for the item. Decision tree, evaluated in order:

1. `days_listed > 365` → `bundle` (if price < $15) or `liquidate`
2. Critical risk, price < $15 → `bundle`
3. Critical risk → `relist_now`
4. High risk, incomplete specifics → `optimize_specifics`
5. High risk, title_keyword_strength < 50 → `title_rewrite`
6. High risk → `strategic_markdown`
7. Medium risk, incomplete specifics → `optimize_specifics`
8. Medium risk, image_count ≤ 2 → `add_photos`
9. Medium risk, title_keyword_strength < 55 → `title_rewrite`
10. Medium risk, 60d+ with strong quality (image_count ≥ 4, title ≥ 75, specifics complete) → `sell_similar`
11. Medium risk, 60d+ with image_count ≥ 4 and title ≥ 80 → `move_platform`
12. Medium risk, 60d+ → `strategic_markdown`
13. Medium risk → `add_photos`
14. Low risk, title < 55 → `title_rewrite`
15. Low risk, title < 70 → `optimize_specifics`
16. Low risk → `hold`

### Estimated cash recovery

**Function:** `calcEstimatedRecovery(item: InventoryItem): number`

Applies a flat rate multiplier to `item.price` based on the primary recovery action. These are operational benchmarks, not guarantees.

| Action | Recovery rate | Rationale |
|---|---|---|
| hold | 100% | No action needed; full price expected |
| add_photos | 92% | CTR improvement, near-full recovery |
| title_rewrite | 90% | Free fix, high recovery potential |
| optimize_specifics | 88% | Enters filtered search, strong recovery |
| sell_similar | 82% | Fresh impressions, slight price test likely |
| relist_now | 78% | Full reset, small price concession typical |
| move_platform | 72% | Platform shift carries friction cost |
| strategic_markdown | 65% | Deliberate cut to trigger activity |
| bundle | 50% | Per-unit value decreases in bundles |
| liquidate | 25% | 20–30 cents on the dollar |

---

### Database persistence — `scoring_snapshots`

The `scoring_snapshots` table records scoring history per item on each inventory scan. It stores the composite scores and four of the seven factor component values.

**Stored components:**

| Column | Factor |
|---|---|
| `score_days_component` | days_listed points |
| `score_specifics_component` | item_specifics points |
| `score_photos_component` | photo_coverage points |
| `score_title_component` | title_strength points |

**Not stored:** pricing_competitiveness contribution, visibility_signals contribution, shipping_competitiveness contribution.

This is a significant gap. Historical snapshots cannot reconstruct why a score changed if the change was driven by engagement signals (views/watchers shifts) or shipping cost changes. You can see that the composite score moved; you cannot decompose that movement into its causes from snapshots alone without having the full item data from both points in time.

The table also defines `sell_through_probability`, `recovery_probability`, and `pricing_risk` columns. These are not populated by the current scoring engine — they are reserved schema fields.

---

### Sample outputs

**Scenario A — New listing, quality issues, no engagement yet**

Item: 8 days listed, views=10, watchers=0, title_keyword_strength=35, item_specifics_complete=false, image_count=1, shipping_type=free, price=$55.

| Factor | Points |
|---|---|
| days_listed (8d) | 0 |
| pricing_competitiveness (10 views — no rejection threshold met) | 0 |
| visibility_signals (8d — no age gates met) | 0 |
| title_strength (< 40) | 10 |
| item_specifics (incomplete) | 10 |
| photo_coverage (1 photo) | 5 |
| shipping (free) | 0 |
| **Total** | **25 — Low** |

Despite poor listing quality, the item is too fresh to score as dead. The correct action is `title_rewrite` (Low risk, title < 55).

---

**Scenario B — 45-day listing, high views, zero watchers, thin title**

Item: days_listed=45, views=80, watchers=0, title_keyword_strength=50, item_specifics_complete=true, image_count=4, shipping_type=calculated, price=$35, original_price=$35.

- pricing: 80 views / 0 watchers at 45d = +8 (second tier of rejection); no markdown at 45d — under the 60d threshold for stale penalty = 0. Total: 8
- visibility: watchers=0 at 45d = +4 (30d gate met, 60d not yet); viewsPerDay = 80/45 = 1.78, above both velocity thresholds = 0; no promo — 45d, not 90d = 0. Total: 4
- shipping: calculated type on a $35 item = +2

| Factor | Points |
|---|---|
| days_listed (45d) | 14 |
| pricing_competitiveness | 8 |
| visibility_signals | 4 |
| title_strength (50, 40–59) | 6 |
| item_specifics (complete) | 0 |
| photo_coverage (4 photos) | 0 |
| shipping (non-free, <$40) | 2 |
| **Total** | **34 — Medium** |

Action: `title_rewrite` (Medium risk, title_keyword_strength=50 < 55).

---

**Scenario C — 6-month-old listing, every factor broken**

Item: days_listed=185, views=120, watchers=0, title_keyword_strength=35, item_specifics_complete=false, image_count=1, has_promoted_listing=false, shipping_cost=$8, price=$30, original_price=$30.

- pricing: 120 views / 0 watchers = +12; 185d with no markdown = +8. Capped at 20.
- visibility: watchers=0 at 185d = +7; viewsPerDay = 120/185 = 0.65, < 1.0 at 60d+ = +3; no promo at 90d+ with ≤1 watcher = +3. Total: 13.
- shipping: $8 on $30 = 26.7%, > 25% of price = +5.

| Factor | Points |
|---|---|
| days_listed (185d) | 35 |
| pricing_competitiveness (capped) | 20 |
| visibility_signals | 13 |
| title_strength (< 40) | 10 |
| item_specifics (incomplete) | 10 |
| photo_coverage (1 photo) | 5 |
| shipping (> 25% of price) | 5 |
| **Raw total** | **98** → capped at **100** |

Risk: **Critical**. Action: `relist_now` (Critical risk, price > $15). Estimated recovery: `$30 × 0.78 = $23.40`.

---

**Scenario D — 100-day listing, fully optimized, no buyer traction**

Item: days_listed=100, views=40, watchers=0, title_keyword_strength=85, item_specifics_complete=true, image_count=8, has_promoted_listing=false, shipping_type=free, price=$60, original_price=$60.

- pricing: 40 views / 0 watchers at 100d — does not meet the 60-view threshold for rejection = 0; 100d with no markdown = +8. Total: 8.
- visibility: watchers=0 at 100d = +7; viewsPerDay = 40/100 = 0.4, < 0.5 at 30d+ = +5; no promo at 90d+ with ≤1 watcher = +3. Capped at 15.

| Factor | Points |
|---|---|
| days_listed (100d) | 28 |
| pricing_competitiveness | 8 |
| visibility_signals (capped) | 15 |
| title_strength (≥ 75) | 0 |
| item_specifics (complete) | 0 |
| photo_coverage (8 photos) | 0 |
| shipping (free) | 0 |
| **Total** | **51 — High** |

Action: `strategic_markdown` (High risk, specifics complete, title strong). A price drop triggers watcher notifications and the "Recently Lowered Price" filter — the listing quality is not the problem here.

---

## Engine 2 — Audit Lead Scoring

**Source:** `lib/audit-scoring.ts`
**Function:** `scoreAuditLead(input: AuditScoreInput): AuditScoreResult`

### Philosophy

The audit scoring engine operates at lead intake, before the user has connected any marketplace account. It has access only to three form fields submitted at `/recovery-audit`. The platform field (`primary_platform`) is collected for context but is not used in any scoring calculation.

The goal is qualified prioritization, not precision. The score tells the operator which incoming leads describe more severe, systemic problems. The recovery range estimate is wide enough to be meaningful without being falsely precise.

### Formula

```
severity_score = round(min(100, PROBLEM_SEVERITY[biggest_problem] × COUNT_MULTIPLIER[inventory_count]))
```

Both lookup tables have fallback values for unrecognized inputs (`25` for unknown problems, `0.70` for unknown count buckets).

---

### PROBLEM_SEVERITY

| biggest_problem value | Base severity |
|---|---|
| Items sitting too long | 70 |
| Listings getting views but no sales | 68 |
| Not sure how to price | 55 |
| Need to know what to relist or liquidate | 50 |
| Too much inventory | 42 |
| Not sure which platform is best | 30 |
| Other | 25 |
| (unrecognized) | 25 |

Ordering rationale: "Items sitting too long" and "views but no sales" describe active capital lock-up where the market is already signaling a problem. "Not sure which platform is best" describes an optimization question with no confirmed problem yet.

---

### COUNT_MULTIPLIER

| inventory_count value | Multiplier |
|---|---|
| Under 25 items | 0.55 |
| 25–100 items | 0.70 |
| 100–500 items | 0.85 |
| 500–1,000 items | 0.95 |
| Over 1,000 items | 1.00 |
| (unrecognized) | 0.70 |

Scale amplifies severity. A single stagnant item is an optimization issue. 1,000 stagnant items is a capital and operations problem.

---

### Severity score examples

| Problem | Count | Calculation | Score |
|---|---|---|---|
| Items sitting too long | Over 1,000 items | 70 × 1.00 | 70 |
| Listings getting views but no sales | 100–500 items | 68 × 0.85 | 58 |
| Not sure how to price | 25–100 items | 55 × 0.70 | 39 |
| Need to know what to relist or liquidate | 500–1,000 items | 50 × 0.95 | 48 |
| Too much inventory | Under 25 items | 42 × 0.55 | 23 |
| Not sure which platform is best | Over 1,000 items | 30 × 1.00 | 30 |
| Items sitting too long | Under 25 items | 70 × 0.55 | 39 |

Note: the score ceiling of 100 is never reached with current table values. The maximum achievable score is 70 (highest problem severity × 1.00 multiplier). The cap exists as a guard against future table changes.

---

### RECOVERY_RANGES

Recovery estimate is based on inventory count midpoint × approximately $28 average resale value × 15–35% recovery rate. These are display ranges for lead qualification only — they are not computed from the actual inventory the submitter has described.

| inventory_count value | Low estimate | High estimate |
|---|---|---|
| Under 25 items | $150 | $500 |
| 25–100 items | $500 | $2,000 |
| 100–500 items | $2,000 | $8,000 |
| 500–1,000 items | $8,000 | $18,000 |
| Over 1,000 items | $18,000 | $50,000 |

The problem type does not affect the recovery range — a seller with 800 items gets the same $8k–$18k range regardless of whether their problem is pricing or platform selection. This is a deliberate simplification: actual recovery potential is dominated by inventory volume, not problem type, at the intake stage.

---

### Suggested action mapping

| biggest_problem value | Suggested action |
|---|---|
| Items sitting too long | relist_now |
| Listings getting views but no sales | strategic_markdown |
| Not sure how to price | strategic_markdown |
| Need to know what to relist or liquidate | relist_now |
| Too much inventory | bundle |
| Not sure which platform is best | move_platform |
| Other | optimize_specifics |
| (unrecognized) | optimize_specifics |

This value is stored in `audit_leads.suggested_action` (text column, added in migration 003). It is a starting point for operator follow-up, not a prescription.

---

## Scoring philosophy — both engines

Both engines are designed for resellers who do not have access to external pricing data or sell-through analytics. All signals are derived from data the reseller can observe directly: how long something has been listed, how many people viewed it and whether they saved it, how the listing was built, and what the reseller says their biggest problem is.

The dead inventory score requires stacking — a listing must show problems across multiple independent dimensions before it escalates to High or Critical. This prevents a single default field value from producing an inflated risk tier. The audit score uses problem type as severity and inventory scale as a multiplier, reflecting the operational reality that systemic problems in large backlogs are harder to unwind than isolated issues in small ones.

Neither score is a prediction. Both are triage instruments for directing attention to the items and leads most likely to benefit from intervention.

---

## Known weaknesses

### Dead Inventory Score

**Views and watchers data may not be available.** Both fields default to 0 in the schema. When engagement data is missing — because the reseller has not imported a platform export — the scoring engine cannot distinguish between a listing with zero views and a listing with 200 views and 0 watchers. Factors 2 and 3 (together worth up to 35 points) become unreliable. Scores for listings without engagement data will be systematically lower than they should be.

**No actual price comparison data.** The pricing_competitiveness factor does not compare the listed price against sold comparables or active competing listings. It infers overpricing from buyer behavior. A listing can pass this check while being objectively overpriced if its view count is too low to trigger the rejection thresholds.

**`original_price` is optional.** The stale pricing sub-signal treats null `original_price` as "never repriced" and adds penalty points. This is a conservative fallback that penalizes listings where users simply never recorded the original price identically to listings that genuinely have not been marked down.

**`days_listed` is denormalized and requires an external sync job.** The schema stores `days_listed` as an integer updated by the `sync_days_listed()` SQL function, which must be called by a cron job. If that job stops running, listing ages in the database stop advancing, and scores will increasingly understate risk over time with no visible error.

**`title_keyword_strength` is not computed on the backend.** The scoring engine reads this as an externally-set integer. If it is populated at import and never updated, it will not reflect title edits made after initial entry. A user who rewrites their title on the platform gets no scoring benefit until they re-import.

**`scoring_snapshots` stores only 4 of 7 factor components.** The missing three — pricing_competitiveness, visibility_signals, and shipping_competitiveness — are the factors most likely to change between scans. This makes retrospective analysis of score changes incomplete. See the table in the persistence section above.

**Reserved columns in `scoring_snapshots` are unpopulated.** `sell_through_probability`, `recovery_probability`, and `pricing_risk` are defined in the schema but not written by the current scoring engine. Querying these columns returns nulls. Do not use them in analysis.

### Audit Lead Scoring

**No actual inventory data.** Recovery estimates use population-level assumptions. A seller with 500 high-value electronics and a seller with 500 $4 clothing items receive identical recovery range estimates.

**Problem type is self-reported and unvalidated.** The `biggest_problem` field is a free-text string matched against the lookup table. If a submitter types something outside the expected values — or the form sends an unexpected variant — the score falls through to the "Other" baseline of 25. There is no server-side enum validation on the form payload.

**No tier definitions for the severity score.** Unlike the dead inventory score, there are no documented Low/Medium/High/Critical thresholds for audit severity. The number is stored in `audit_leads.severity_score` but there is no operationalized definition of what, say, a score of 45 means for lead routing decisions.

**Count bucket granularity is coarse.** "100–500 items" covers a 5x range in inventory scale with a single multiplier (0.85). Sellers at 490 items are indistinguishable from sellers at 110 items in terms of scoring.

**No combination logic.** The form accepts a single problem selection. A seller experiencing both stale inventory and pricing confusion can only report one. The severity score reflects the stated problem, not the diagnosed complexity.

---

## Recommended future improvements

1. **Add the three missing factor columns to `scoring_snapshots`.** Add `score_pricing_component`, `score_visibility_component`, and `score_shipping_component` columns. Without these, historical score decomposition is impossible for the most volatile factors.

2. **Distinguish missing engagement data from zero engagement.** Add a boolean `has_engagement_data` flag to `inventory_items` that is set when views/watchers are imported from a platform export vs. left at default. When false, the score should display a "partial score" indicator in the UI, and factors 2 and 3 should note their reduced reliability.

3. **Add cron job observability for `sync_days_listed`.** Add a `days_last_synced_at` timestamp to `user_settings` or a dedicated sync log table. Currently there is no programmatic way to detect that the sync job has stopped running.

4. **Define audit severity tiers.** Establish documented thresholds for lead routing. A starting proposal: Low = 0–24, Medium = 25–44, High = 45–64, Critical = 65+. Make these explicit in the codebase, not just in operator convention.

5. **Populate or drop reserved `scoring_snapshots` columns.** `sell_through_probability`, `recovery_probability`, and `pricing_risk` are schema noise until they are either computed and written, or dropped. They create confusion when queried.

6. **Use `price_history` for markdown detection.** The current stale pricing check reads `original_price` on `inventory_items`. The `price_history` table records every price change. Using `price_history` for this check would handle cases where `original_price` was never set but a markdown was applied, and would allow detection of patterns like repeated small markdowns vs. a single large cut.

7. **Platform-specific view velocity thresholds.** The 0.5 views/day threshold is calibrated to eBay's traffic patterns. Poshmark and Mercari operate at different traffic volumes. If per-platform scoring is introduced, this threshold should be parameterized by `platform`.
