-- Recovery attribution: tracks whether each recovery action followed a platform
-- recommendation, and surfaces per-action-type effectiveness for ranking.

-- ─── recovery_actions: attribution columns ────────────────────────────────────

alter table recovery_actions
  add column if not exists was_recommended       boolean not null default false,
  add column if not exists recommendation_source text check (recommendation_source in ('scoring_engine', 'automation_rule', 'manual', 'crosslist_suggestion')),
  add column if not exists recommendation_id     uuid references recovery_actions(id) on delete set null;

comment on column recovery_actions.was_recommended       is 'True when the user followed a platform recommendation for this item+action_type.';
comment on column recovery_actions.recommendation_source is 'Which subsystem generated the recommendation: scoring_engine, automation_rule, manual, or crosslist_suggestion.';
comment on column recovery_actions.recommendation_id     is 'Optional reference to the originating recovery_action row that carried the recommendation.';

-- ─── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists recovery_actions_was_recommended
  on recovery_actions (user_id, action_type, was_recommended)
  where was_recommended = true;

create index if not exists recovery_actions_attribution_outcome
  on recovery_actions (user_id, was_recommended, outcome, created_at desc);

-- ─── action_type_effectiveness view ──────────────────────────────────────────
-- Aggregates completed recovery actions to produce a per-(user, action_type)
-- effectiveness summary used for recommendation ranking.

create or replace view action_type_effectiveness as
select
  user_id,
  action_type,
  count(*)                                                          as total_actions,
  count(*) filter (where outcome = 'sold')                          as sold_count,
  count(*) filter (where was_recommended = true)                    as recommended_count,
  count(*) filter (where was_recommended = true and outcome = 'sold') as recommended_sold_count,
  round(
    count(*) filter (where outcome = 'sold')::numeric
    / nullif(count(*), 0) * 100,
    1
  )                                                                 as overall_success_rate,
  round(
    count(*) filter (where was_recommended = true and outcome = 'sold')::numeric
    / nullif(count(*) filter (where was_recommended = true), 0) * 100,
    1
  )                                                                 as recommended_success_rate,
  coalesce(avg(recovery_amount) filter (where outcome = 'sold'), 0) as avg_recovery_amount,
  max(created_at)                                                   as last_action_at
from recovery_actions
where action_status = 'completed'
group by user_id, action_type;

-- ─── Row-level security on view ───────────────────────────────────────────────
-- Views in Postgres inherit the caller's RLS from underlying tables; no extra
-- policy is required because recovery_actions already enforces user_id = auth.uid().
