-- Execution health columns for automation_runs
alter table automation_runs
  add column if not exists duration_ms  integer,
  add column if not exists status       text not null default 'completed'
    check (status in ('running', 'completed', 'failed')),
  add column if not exists error_message text;

-- Additional index for status-based queries
create index if not exists automation_runs_status
  on automation_runs (user_id, status, ran_at desc);

-- Task outcome tracking: link a completed task back to the recovery_action it triggered
alter table automation_tasks
  add column if not exists recovery_action_id uuid references recovery_actions(id) on delete set null,
  add column if not exists outcome_at timestamptz;

-- Index for cross-referencing task outcomes
create index if not exists automation_tasks_recovery_action
  on automation_tasks (recovery_action_id) where recovery_action_id is not null;
