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
import type { AgingBucket } from "@/lib/types";

const BUCKET_COLORS = [
  "#22c55e", // 0-30d green
  "#eab308", // 31-60d yellow
  "#f97316", // 61-90d orange
  "#ef4444", // 91-180d red
  "#FF2D95", // 180d+ magenta
];

interface AgingChartProps {
  buckets: AgingBucket[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-md border border-zinc-700 bg-zinc-900 p-3 shadow-lg">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-400">{label}</p>
        <p className="text-sm font-semibold text-zinc-100">
          {payload[0].payload.count} listings
        </p>
        <p className="text-xs text-zinc-500">{formatCurrency(payload[0].value)} trapped</p>
      </div>
    );
  }
  return null;
};

export function AgingChart({ buckets }: AgingChartProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
          Inventory Aging Breakdown
        </h3>
        <p className="mt-1 text-xs text-zinc-600">cash trapped by listing age</p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={buckets} barSize={32} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#ffffff08" }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {buckets.map((_, i) => (
              <Cell key={`cell-${i}`} fill={BUCKET_COLORS[i]} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3">
        {buckets.map((bucket, i) => (
          <div key={bucket.label} className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: BUCKET_COLORS[i] }}
            />
            <span className="text-xs text-zinc-500">
              {bucket.label} — {bucket.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
