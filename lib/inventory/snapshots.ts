// ============================================================
// RESALEIQ — Score Snapshot & Trend Analytics
// Pure functions. No side effects. No DB calls.
// Operates on ScoringSnapshot arrays from Supabase queries.
// ============================================================

import type { ScoringSnapshot } from "@/lib/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScoreTrendPoint {
  date: string;              // ISO timestamp (scored_at)
  dead_score: number;
  health_score: number;
  days_listed: number;
  price: number;
}

export interface ScoreVelocity {
  delta: number;             // latest_score - earliest_score (positive = getting worse)
  delta_per_day: number;     // average score change per day
  direction: "improving" | "stable" | "worsening";
  days_span: number;         // total days between first and last snapshot
}

export interface SnapshotSummary {
  snapshot_count: number;
  first_scored_at: string;
  last_scored_at: string;
  dead_score_current: number;
  dead_score_start: number;
  dead_score_min: number;
  dead_score_max: number;
  velocity: ScoreVelocity;
  is_escalating: boolean;    // score rising fast (>10pts in <14 days)
  trend: ScoreTrendPoint[];
}

// ─── Score Trend ──────────────────────────────────────────────────────────────

export function buildScoreTrend(snapshots: ScoringSnapshot[]): ScoreTrendPoint[] {
  if (snapshots.length === 0) return [];

  return [...snapshots]
    .sort((a, b) => new Date(a.scored_at).getTime() - new Date(b.scored_at).getTime())
    .map((s) => ({
      date: s.scored_at,
      dead_score: s.dead_inventory_score,
      health_score: s.listing_health_score,
      days_listed: s.days_at_snapshot,
      price: s.price_at_snapshot,
    }));
}

// ─── Score Velocity ───────────────────────────────────────────────────────────

export function calcScoreVelocity(snapshots: ScoringSnapshot[]): ScoreVelocity {
  if (snapshots.length < 2) {
    return { delta: 0, delta_per_day: 0, direction: "stable", days_span: 0 };
  }

  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.scored_at).getTime() - new Date(b.scored_at).getTime()
  );

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const msPerDay = 1000 * 60 * 60 * 24;
  const days_span = Math.max(
    1,
    (new Date(last.scored_at).getTime() - new Date(first.scored_at).getTime()) / msPerDay
  );

  const delta = last.dead_inventory_score - first.dead_inventory_score;
  const delta_per_day = delta / days_span;

  let direction: ScoreVelocity["direction"];
  if (delta_per_day > 0.3) direction = "worsening";
  else if (delta_per_day < -0.3) direction = "improving";
  else direction = "stable";

  return { delta, delta_per_day: Math.round(delta_per_day * 100) / 100, direction, days_span: Math.round(days_span) };
}

// ─── Escalation Detection ─────────────────────────────────────────────────────
// True when dead score rose > 10 points within the last 14 days

export function detectScoreEscalation(snapshots: ScoringSnapshot[]): boolean {
  if (snapshots.length < 2) return false;

  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.scored_at).getTime() - new Date(b.scored_at).getTime()
  );

  const latest = sorted[sorted.length - 1];
  const cutoffMs = new Date(latest.scored_at).getTime() - 14 * 24 * 60 * 60 * 1000;

  // Find the earliest snapshot within the 14-day window
  const window = sorted.filter(
    (s) => new Date(s.scored_at).getTime() >= cutoffMs
  );

  if (window.length < 2) return false;

  const windowFirst = window[0];
  const windowLast = window[window.length - 1];
  return windowLast.dead_inventory_score - windowFirst.dead_inventory_score > 10;
}

// ─── Snapshot Summary ─────────────────────────────────────────────────────────

export function calcSnapshotSummary(snapshots: ScoringSnapshot[]): SnapshotSummary | null {
  if (snapshots.length === 0) return null;

  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.scored_at).getTime() - new Date(b.scored_at).getTime()
  );

  const scores = sorted.map((s) => s.dead_inventory_score);
  const dead_score_min = Math.min(...scores);
  const dead_score_max = Math.max(...scores);

  const velocity = calcScoreVelocity(sorted);
  const is_escalating = detectScoreEscalation(sorted);
  const trend = buildScoreTrend(sorted);

  return {
    snapshot_count: sorted.length,
    first_scored_at: sorted[0].scored_at,
    last_scored_at: sorted[sorted.length - 1].scored_at,
    dead_score_current: sorted[sorted.length - 1].dead_inventory_score,
    dead_score_start: sorted[0].dead_inventory_score,
    dead_score_min,
    dead_score_max,
    velocity,
    is_escalating,
    trend,
  };
}

// ─── Price History from Snapshots ────────────────────────────────────────────
// Extracts price changes across snapshots (proxy for markdown history)

export interface PricePoint {
  date: string;
  price: number;
  dead_score: number;
}

export function extractPriceHistory(snapshots: ScoringSnapshot[]): PricePoint[] {
  if (snapshots.length === 0) return [];

  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.scored_at).getTime() - new Date(b.scored_at).getTime()
  );

  const history: PricePoint[] = [];
  let lastPrice: number | null = null;

  for (const s of sorted) {
    // Include only points where price changed (or first point)
    if (lastPrice === null || s.price_at_snapshot !== lastPrice) {
      history.push({
        date: s.scored_at,
        price: s.price_at_snapshot,
        dead_score: s.dead_inventory_score,
      });
      lastPrice = s.price_at_snapshot;
    }
  }

  return history;
}

// ─── Score Health Breakdown ───────────────────────────────────────────────────
// Returns the latest snapshot's component breakdown for transparency display

export interface ScoreBreakdown {
  days_component: number;
  specifics_component: number;
  photos_component: number;
  title_component: number;
  total: number;
}

export function getLatestScoreBreakdown(snapshots: ScoringSnapshot[]): ScoreBreakdown | null {
  if (snapshots.length === 0) return null;

  const latest = [...snapshots].sort(
    (a, b) => new Date(b.scored_at).getTime() - new Date(a.scored_at).getTime()
  )[0];

  return {
    days_component: latest.score_days_component,
    specifics_component: latest.score_specifics_component,
    photos_component: latest.score_photos_component,
    title_component: latest.score_title_component,
    total: latest.dead_inventory_score,
  };
}

// ─── Decay Acceleration ───────────────────────────────────────────────────────
// Returns true when the worsening rate in the last 7 days is significantly
// faster than the 30-day average rate (score deteriorating faster than baseline).

export interface DecayAcceleration {
  is_accelerating: boolean;
  recent_rate: number;   // points/day in last 7d
  baseline_rate: number; // points/day over 30d
  acceleration_factor: number; // recent_rate / baseline_rate
}

export function calcDecayAcceleration(snapshots: ScoringSnapshot[]): DecayAcceleration {
  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.scored_at).getTime() - new Date(b.scored_at).getTime()
  );

  const msPerDay = 86_400_000;
  const now = sorted.length > 0
    ? new Date(sorted[sorted.length - 1].scored_at).getTime()
    : Date.now();

  const sevenDayAgo = now - 7 * msPerDay;
  const thirtyDayAgo = now - 30 * msPerDay;

  const recent = sorted.filter((s) => new Date(s.scored_at).getTime() >= sevenDayAgo);
  const baseline = sorted.filter((s) => new Date(s.scored_at).getTime() >= thirtyDayAgo);

  function rateFromWindow(pts: ScoringSnapshot[]): number {
    if (pts.length < 2) return 0;
    const span = Math.max(
      1,
      (new Date(pts[pts.length - 1].scored_at).getTime() - new Date(pts[0].scored_at).getTime()) / msPerDay
    );
    return (pts[pts.length - 1].dead_inventory_score - pts[0].dead_inventory_score) / span;
  }

  const recent_rate = rateFromWindow(recent);
  const baseline_rate = rateFromWindow(baseline);

  const acceleration_factor = baseline_rate > 0.1 ? recent_rate / baseline_rate : recent_rate > 0.5 ? 2 : 1;
  const is_accelerating = recent_rate > 0.5 && acceleration_factor >= 1.5;

  return {
    is_accelerating,
    recent_rate: Math.round(recent_rate * 100) / 100,
    baseline_rate: Math.round(baseline_rate * 100) / 100,
    acceleration_factor: Math.round(acceleration_factor * 10) / 10,
  };
}
