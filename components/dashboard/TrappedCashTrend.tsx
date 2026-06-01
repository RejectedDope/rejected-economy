"use client";

import { useEffect, useReducer } from "react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface TrendPoint {
  metric_date: string;
  total_active_value?: number;
  trapped_cash?: number;
}

type State = { points: TrendPoint[]; loading: boolean };
type Action = { type: "loaded"; points: TrendPoint[] };

function reducer(_: State, action: Action): State {
  return { points: action.points, loading: false };
}

function Sparkline({ points, width = 120, height = 32 }: { points: number[]; width?: number; height?: number }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const xs = points.map((_, i) => (i / (points.length - 1)) * width);
  const ys = points.map((v) => height - ((v - min) / range) * (height - 4) - 2);

  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");

  const isDown = points[points.length - 1] < points[0];

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={d} fill="none" stroke={isDown ? "#10b981" : "#ef4444"} strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={2} fill={isDown ? "#10b981" : "#ef4444"} />
    </svg>
  );
}

export function TrappedCashTrend() {
  const [state, dispatch] = useReducer(reducer, { points: [], loading: true });

  useEffect(() => {
    let cancelled = false;
    import("@/app/actions/snapshots")
      .then(({ fetchPortfolioTrend }) => fetchPortfolioTrend(30))
      .then(({ metrics }) => {
        if (cancelled) return;
        dispatch({ type: "loaded", points: metrics as unknown as TrendPoint[] });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "loaded", points: [] });
      });
    return () => { cancelled = true; };
  }, []);

  if (state.loading || state.points.length < 2) return null;

  const values = state.points.map((p) => p.total_active_value ?? p.trapped_cash ?? 0);
  const first = values[0];
  const last = values[values.length - 1];
  const delta = last - first;
  const deltaPct = first > 0 ? Math.abs((delta / first) * 100).toFixed(0) : "0";
  const isDown = delta < 0;
  const isFlat = Math.abs(delta) < 1;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">30-Day Trend</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          {isFlat ? (
            <Minus className="h-3 w-3 text-zinc-500" />
          ) : isDown ? (
            <TrendingDown className="h-3 w-3 text-emerald-400" />
          ) : (
            <TrendingUp className="h-3 w-3 text-red-400" />
          )}
          <span className={`text-xs font-bold ${isFlat ? "text-zinc-500" : isDown ? "text-emerald-400" : "text-red-400"}`}>
            {isFlat ? "Stable" : isDown ? `↓ ${deltaPct}% less trapped` : `↑ ${deltaPct}% more trapped`}
          </span>
          <span className="text-[10px] text-zinc-600">
            ({formatCurrency(first)} → {formatCurrency(last)})
          </span>
        </div>
      </div>
      <Sparkline points={values} />
    </div>
  );
}
