# eBay Partner Network Operating Plan

## Scope

This implementation belongs inside the existing Rejected ecosystem. Do not create a separate affiliate app.

The operating model is:

**Create → Track → Measure → Diagnose → Expand or Remove**

Affiliate monetization should occur after Rejected Scout, Rejected Intelligence, ResaleIQ, or Rejected Curator has delivered useful value. Rejected Systems should remain operational rather than affiliate-heavy. Rejected Archive should use sparse contextual links only.

## Phase A — Tracking Foundation

Create these EPN campaigns in the EPN portal:

- RT-SHOP
- RT-EDITORIAL
- RT-RESOURCES
- RESALEIQ-RESEARCH
- RESALEIQ-COMPS
- CURATOR-CONTENT
- SOCIAL-FACEBOOK
- SOCIAL-INSTAGRAM
- SOCIAL-PINTEREST
- EMAIL
- DEALS
- SOURCING

Use Custom IDs for placement-level attribution. Standard:

`section-topic-action-placement`

Examples:

- `intel-coach-current-result`
- `intel-coach-comps-result`
- `curator-coach-guide-shop-inline`
- `curator-coach-guide-shop-bottom`
- `scout-handbag-search-result`
- `facebook-coach-guide-0726`

Do not place personal information in Custom IDs.

## Phase B — ResaleIQ Contextual Integration

The affiliate block belongs after the intelligence result, not before it.

Preferred flow:

1. Upload photo
2. Identify item
3. Estimate market
4. Recommend platform
5. Explain reasoning
6. Show Explore the Market actions

Initial actions:

- View Current Listings on eBay
- Research Comparable Listings
- Shop Similar Pieces

Each action must have:

- EPN campaign
- Custom ID
- generated affiliate URL
- analytics event
- nearby disclosure

Do not construct or modify EPN tracking URLs manually. Generate links through an approved EPN linking tool and save the resulting URL in the placement registry.

## Phase C — Vintage Coach Pilot

Flagship page:

**The Vintage Coach Bags Worth Knowing**

Supporting cluster:

- How to Recognize Different Eras of Vintage Coach
- The Y2K Coach Styles Resellers Should Watch
- Coach Bags People Mistake for Ordinary Thrift Finds
- Understanding Coach Creed and Manufacturing Details
- How Condition Changes Vintage Coach Value

The Coach pilot should distinguish:

- everyday vintage
- Y2K-era demand
- early/pre-logo pieces

Content should discuss observable characteristics such as manufacturing marks, hardware, leather, color, condition, and design-era context without presenting unsupported values as guaranteed market outcomes.

Primary affiliate action:

**Shop Current Vintage Coach Examples**

Campaign: `CURATOR-CONTENT`

Custom ID: `curator-coach-guide-shop-bottom`

## Phase D — Distribution

First tracked distribution tests:

### Facebook

Campaign: `SOCIAL-FACEBOOK`

Custom ID: `facebook-coach-guide-0726`

### Pinterest

Campaign: `SOCIAL-PINTEREST`

Custom ID: `pinterest-coach-guide-0726`

Every promotional placement must include a compliant affiliate disclosure close to the promotional content.

## Phase E — Measurement

Review performance by:

- Campaign
- Custom ID
- Content page
- Placement
- Clicks
- Transactions
- Earnings
- EPC

Decision rules:

- Traffic but no clicks → review CTA and placement
- Clicks but no transactions → review destination and intent match
- Transactions with strong EPC → expand topic and placement pattern
- Broken or stale destination → replace immediately
- Low-value clutter → remove rather than preserving links for volume

EPN reporting remains the source of truth until traffic volume justifies automated reporting imports.

## Compliance Guardrails

- Affiliate disclosure must be close to promotional content and links.
- Do not rely only on a footer, Terms page, or linked disclosure page.
- Clearly indicate that outbound marketplace actions lead to eBay.
- Do not auto-redirect users to eBay through affiliate links.
- Do not place EPN affiliate links inside eBay listings, eBay Store pages, or eBay Messages.
- Verify approval requirements before using restricted promotional methods such as messaging or software/tool integrations.
