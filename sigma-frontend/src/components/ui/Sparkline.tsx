"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";

interface SparklineProps {
  data: { value: number }[];
  width?: number;
  height?: number;
  color?: string;
  positive?: boolean;
}

export function Sparkline({
  color,
  data,
  height = 32,
  positive,
  width = 120
}: SparklineProps) {
  const stroke =
    color ??
    (positive === true
      ? "rgb(var(--sigma-success))"
      : positive === false
        ? "rgb(var(--sigma-danger))"
        : "rgb(var(--sigma-accent))");

  return (
    <div aria-hidden style={{ height, width }}>
      <ResponsiveContainer height="100%" width="100%">
        <LineChart data={data}>
          <Line
            dataKey="value"
            dot={false}
            isAnimationActive={false}
            stroke={stroke}
            strokeLinecap="round"
            strokeWidth={1.5}
            type="linear"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
