"use client";

import { useReducer, useEffect } from "react";
import type { ScoringSnapshot } from "@/lib/types";
import { calcSnapshotSummary, calcDecayAcceleration } from "@/lib/inventory/snapshots";

type State = {
  summary: ReturnType<typeof calcSnapshotSummary>;
  snapshots: ScoringSnapshot[];
  loading: boolean;
};
type Action = { type: "loaded"; snapshots: ScoringSnapshot[] };

function reducer(_: State, action: Action): State {
  return {
    summary: calcSnapshotSummary(action.snapshots),
    snapshots: action.snapshots,
    loading: false,
  };
}

export function ScoreTrendBar({ itemId }: { itemId: string }) {
  const [state, dispatch] = useReducer(reducer, { summary: null, snapshots: [], loading: true });

  useEffect(() => {
    let cancelled = false;
    import("@/app/actions/snapshots")
      .then(({ fetchItemSnapshots }) => fetchItemSnapshots(itemId, 30))
      .then((result) => {
        if (!cancelled) {
          dispatch({
            type: "loaded",
            snapshots: (result.snapshots as unknown as ScoringSnapshot[]).reverse(),
          });
        }
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "loaded", snapshots: [] });
      });
    return () => { cancelled = true; };
  }, [itemId]);

  const { summary, snapshots } = state;
  if (state.loading || !summary || summary.snapshot_count < 2) return null;

  const { velocity, trend, is_escalating } = summary;
  const acceleration = calcDecayAcceleration(snapshots);

  // Normalize trend points for mini sparkline (dead_score 0–100)
  const maxScore = Math.max(...trend.map((t) => t.dead_score), 1);
  const points = trend
    .map((t, i) => {
      const x = (i / (trend.length - 1)) * 100;
      const y = 100 - (t.dead_score / maxScore) * 100;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const dirColor =
    velocity.direction === "worsening"
      ? "text-red-400"
      : velocity.direction === "improving"
      ? "text-emerald-400"
      : "text-zinc-500";

  const lineColor =
    velocity.direction === "worsening"
      ? "#FF2D95"
      : velocity.direction === "improving"
      ? "#34d399"
      : "#71717a";

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">
          Score Trend ({summary.snapshot_count} snapshots)
        </p>
        <div className="flex items-center gap-1.5">
          {acceleration.is_accelerating && (
            <span className="rounded border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-400">
              Accelerating ↑{acceleration.acceleration_factor}×
            </span>
          )}
          {is_escalating && (
            <span className="rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400">
              Escalating
            </span>
          )}
        </div>
      </div>

      {/* Sparkline */}
      <svg viewBox="0 0 100 40" className="w-full h-10 mb-3" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke={lineColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-600">
          {summary.dead_score_start} → {summary.dead_score_current}
        </span>
        <span className={`font-bold ${dirColor}`}>
          {velocity.direction === "worsening" && `+${velocity.delta}`}
          {velocity.direction === "improving" && velocity.delta}
          {velocity.direction === "stable" && "Stable"}
          {velocity.direction !== "stable" && ` pts (${velocity.days_span}d)`}
        </span>
      </div>
    </div>
  );
}
