# ResaleIQ Intelligence Engine — Implementation Runbook

## What is implemented in this branch

1. Master ResaleIQ agent instructions with LIST, SOURCE, PRICE, ROUTE, RECOVER, and OPERATE modes.
2. A live `POST /api/resale/research` endpoint using the eBay Browse API.
3. Strict separation between active marketplace supply and sold evidence.
4. A GPT Action OpenAPI schema for the research endpoint.
5. A Supabase evidence-graph schema for items, evidence, decisions, listings, offers, and actual sales.
6. A knowledge-library architecture separating durable playbooks, live evidence, community signals, and proprietary seller results.

## Environment variables required

Set these server-side in the deployment environment:

- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`

Never expose `EBAY_CLIENT_SECRET` to client-side code or commit it to GitHub.

## Custom GPT configuration

### Instructions
Copy the full contents of:

`docs/gpt/resaleiq-master-instructions.md`

into the GPT's Instructions field.

### Action
1. Deploy this branch to a test URL.
2. Open `docs/gpt/resaleiq-action-openapi.yaml`.
3. Replace `https://YOUR-RESALEIQ-DOMAIN.com` with the deployed HTTPS domain.
4. Add the schema to the GPT Action configuration.
5. Test `researchResaleMarket` with a precise item query.
6. Confirm the GPT describes the returned evidence as active competition or active supply, never sold comps.

## Supabase

Review and run:

`supabase/resaleiq-intelligence.sql`

The schema intentionally preserves separate evidence types. Do not merge `active_comp` and `sold_comp` records.

Before exposing item records to multiple users, add authentication-linked `owner_id` constraints and Row Level Security policies. Do not ship a multi-user production database with unrestricted public table access.

## Recommended next backend actions

Build these capabilities against the shared evidence graph rather than creating one disconnected marketplace action per feature:

- `research_item`: current market and product evidence
- `identify_item`: image and marking-based identification hypotheses
- `calculate_profit`: current fee and shipping assumptions
- `recommend_marketplace`: platform-fit comparison
- `save_inventory_item`: persist research and decisions
- `get_inventory_item`: retrieve prior evidence and listing history
- `analyze_stale_inventory`: diagnose underperforming inventory
- `create_listing_draft`: generate structured marketplace drafts
- `mark_sold`: record outcome and trigger supported delisting workflows

Only add `push_listing_draft` for marketplaces where the account, API access, and platform terms permit automated listing creation.

## Sold-comparable data

The current eBay Browse API endpoint supplies active purchasable listings. It must not be used as a sold-comps endpoint.

To add legitimate sold evidence, connect a data source that explicitly provides completed transaction information under terms that permit your use. Normalize the results into `resale_evidence` records with `evidence_type = 'sold_comp'`.

Until that source exists, ResaleIQ should state that exact sold evidence is unavailable rather than fabricate it.

## ChatGPT app / MCP path

The current Custom GPT plus Action is the shortest path to a working ResaleIQ research agent.

The next architectural layer should expose the same ResaleIQ backend through an MCP server so a ChatGPT app can provide richer interfaces such as:

- comp explorer
- price strategy card
- marketplace match card
- stale inventory action center
- listing draft editor

Do not create a second intelligence system for the ChatGPT app. The Custom GPT, website, and future MCP app should all call the same ResaleIQ services and evidence graph.

## Model strategy for an API-powered ResaleIQ application

Use a strong vision-capable reasoning model for ambiguous item identification and multi-source synthesis. Use a cheaper model for deterministic transformations such as converting an already-researched item into marketplace-specific listing variants.

Keep tool descriptions concise and expose only tools relevant to the current operating mode. The agent should use tools for current facts and use the core prompt for durable decision rules.

## Testing checklist

Before merging:

- Run `npm run typecheck`.
- Run `npm run lint`.
- Run `npm test`.
- Test the endpoint with valid eBay Production credentials.
- Test missing credentials and invalid request bodies.
- Confirm active listing prices are never labeled sold comps.
- Confirm unknown product facts remain unknown rather than being filled in.
- Confirm a platform-only follow-up continues directly into listing generation.
- Test LIST, SOURCE, PRICE, ROUTE, RECOVER, and OPERATE intents separately.

## Product boundary

Do not rebuild commodity crosslisting infrastructure unless ResaleIQ gains a clear strategic advantage or required marketplace integrations cannot be purchased or connected economically.

ResaleIQ should own the decision layer: identification, evidence, valuation, platform selection, recovery strategy, prioritization, and outcome learning.
