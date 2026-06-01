// Pure TypeScript module — no server imports, no Supabase dependencies.
// Defines sync job lifecycle types and the state machine for sync orchestration.

export enum SyncJobType {
  Import        = "import",
  Export        = "export",
  PriceSync     = "price_sync",
  InventorySync = "inventory_sync",
}

export enum SyncJobStatus {
  Pending   = "pending",
  Running   = "running",
  Completed = "completed",
  Failed    = "failed",
  Cancelled = "cancelled",
}

export type SyncJob = {
  id: string;
  user_id: string;
  job_type: SyncJobType;
  status: SyncJobStatus;
  source_platform?: string;
  items_processed: number;
  items_failed: number;
  error_message?: string;
  started_at?: Date;
  completed_at?: Date;
  next_scheduled_at?: Date;
  created_at: Date;
  retry_count: number;
};

export type SyncJobTransition = {
  from: SyncJobStatus;
  to: SyncJobStatus;
  reason?: string;
};

// ---------------------------------------------------------------------------
// Valid transitions
// ---------------------------------------------------------------------------

/**
 * Map of allowed state transitions.
 * Key = "from" status, value = set of reachable "to" statuses.
 */
const VALID_TRANSITIONS: Record<SyncJobStatus, Set<SyncJobStatus>> = {
  [SyncJobStatus.Pending]:   new Set([SyncJobStatus.Running,    SyncJobStatus.Cancelled]),
  [SyncJobStatus.Running]:   new Set([SyncJobStatus.Completed,  SyncJobStatus.Failed, SyncJobStatus.Cancelled]),
  [SyncJobStatus.Failed]:    new Set([SyncJobStatus.Pending]),   // retry
  [SyncJobStatus.Completed]: new Set(),
  [SyncJobStatus.Cancelled]: new Set(),
};

/**
 * Returns true if transitioning from `from` to `to` is permitted.
 */
export function canTransition(from: SyncJobStatus, to: SyncJobStatus): boolean {
  return VALID_TRANSITIONS[from].has(to);
}

// ---------------------------------------------------------------------------
// Scheduling helpers
// ---------------------------------------------------------------------------

const MAX_BACKOFF_MINUTES = 60;

/**
 * Computes the next retry timestamp using exponential backoff.
 * Delay = min(2^retryCount minutes, 60 minutes).
 */
export function nextRetryAt(retryCount: number): Date {
  const delayMinutes = Math.min(Math.pow(2, retryCount), MAX_BACKOFF_MINUTES);
  return new Date(Date.now() + delayMinutes * 60 * 1000);
}

/**
 * Returns true when the job has reached a terminal state
 * (completed, failed, or cancelled).
 */
export function isFinalStatus(status: SyncJobStatus): boolean {
  return (
    status === SyncJobStatus.Completed ||
    status === SyncJobStatus.Failed    ||
    status === SyncJobStatus.Cancelled
  );
}

// ---------------------------------------------------------------------------
// Platform sync intervals (minutes)
// ---------------------------------------------------------------------------

/**
 * How often each platform should be synced, in minutes.
 * Use the "default" key for platforms not listed explicitly.
 */
export const PLATFORM_SYNC_INTERVALS: Record<string, number> = {
  ebay:     360,
  poshmark: 720,
  mercari:  480,
  default:  720,
};
