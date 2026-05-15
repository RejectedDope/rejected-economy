"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { PlatformBucket } from "@/lib/types";

interface PlatformChartProps {
  buckets: PlatformBucket[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const bucket: PlatformBucket = payload[0].payload;
    const deadPct =
      bucket.count > 0 ? Math.round((bucket.dead_count / bucket.count) * 100) : 0;
    return (
      <div className="rounded-md border border-zinc-700 bg-zinc-900 p-3 shadow-lg">
        <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-zinc-400">
          {label}
        </p>
        <p className="text-sm font-semibold text-zinc-100">
          {formatCurrency(bucket.value)} trapped
        </p>
        <p className="text-xs text-zinc-500">
          {bucket.count} listing{bucket.count !== 1 ? "s" : ""}
        </p>
        {deadPct > 0 && (
          <p className="mt-1 text-xs font-bold text-[#FF2D95]">
            {deadPct}% dead inventory
          </p>
        )}
      </div>
    );
  }
  return null;
};

const BAR_COLORS = [
  "#E935C1",
  "#a855f7",
  "#6366f1",
  "#3b82f6",
  "#06b6d4",
  "#10b981",
  "#eab308",
  "#f97316",
  "#ef4444",
  "#78716c",
];

export function PlatformChart({ buckets }: PlatformChartProps) {
  if (buckets.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-sm text-zinc-600">No platform data yet.</p>
      </div>
    );
  }

  const data = buckets.map((b) => ({
    ...b,
    platform: b.platform.length > 10 ? b.platform.split(" ")[0] : b.platform,
    fullPlatform: b.platform,
  }));

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
          Platform Breakdown
        </h3>
        <p className="mt-1 text-xs text-zinc-600">
          trapped cash by marketplace · dead inventory highlighted
        </p>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={data}
          barSize={28}
          margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#27272a"
            vertical={false}
          />
          <XAxis
            dataKey="platform"
            tick={{ fill: "#71717a", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) =>
              v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
            }
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "#ffffff08" }}
          />
          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={`cell-${i}`}
                fill={BAR_COLORS[i % BAR_COLORS.length]}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Platform stat pills */}
      <div className="mt-4 space-y-1.5">
        {buckets.slice(0, 5).map((b, i) => {
          const deadPct =
            b.count > 0 ? Math.round((b.dead_count / b.count) * 100) : 0;
          return (
            <div key={b.platform} className="flex items-center gap-3">
              <div
                className="h-2 w-2 shrink-0 rounded-full"
                style={{
                  backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                }}
              />
              <span className="min-w-[110px] text-xs text-zinc-500">
                {b.platform}
              </span>
              <div className="flex-1 overflow-hidden rounded-full bg-zinc-800 h-1">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (b.value / buckets[0].value) * 100)}%`,
                    backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                    opacity: 0.7,
                  }}
                />
              </div>
              <span className="text-xs text-zinc-500">
                {b.count} listings
              </span>
              {deadPct > 0 && (
                <span className="text-xs font-bold text-[#FF2D95]">
                  {deadPct}% dead
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
