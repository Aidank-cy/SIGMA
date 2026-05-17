"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

interface TrendPoint {
  label: string;
  value: number;
}

interface TrendLineProps {
  data: TrendPoint[];
  height?: number;
}

export function TrendLine({ data, height = 280 }: TrendLineProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer height="100%" width="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <XAxis
            axisLine={false}
            dataKey="label"
            tick={{ fill: "rgb(var(--sigma-muted))", fontSize: 12 }}
            tickLine={false}
            tickMargin={2}
          />
          <YAxis
            axisLine={false}
            tick={{ fill: "rgb(var(--sigma-muted))", fontSize: 12 }}
            tickLine={false}
            tickMargin={2}
            width={38}
          />
          <Tooltip
            contentStyle={{
              background: "rgb(var(--sigma-elevated))",
              border: "1px solid rgb(var(--sigma-line))",
              borderRadius: 8,
              color: "rgb(var(--sigma-text))"
            }}
          />
          <Line
            activeDot={{ r: 5 }}
            dataKey="value"
            dot={false}
            stroke="rgb(var(--sigma-accent))"
            strokeWidth={2.5}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
