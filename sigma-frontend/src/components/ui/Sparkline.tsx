"use client";

import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";

interface SparklineProps {
  data: { value: number }[];
  width?: number;
  height?: number;
  color?: string;
  positive?: boolean;
}

function sparklineDomain(data: { value: number }[]): [number, number] | ["dataMin", "dataMax"] {
  const values = data.map((point) => point.value).filter((value) => Number.isFinite(value));
  if (values.length === 0) {
    return ["dataMin", "dataMax"];
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min !== max) {
    return [min, max];
  }
  const padding = Math.max(Math.abs(min), 1) * 0.001;
  return [min - padding, max + padding];
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
          <YAxis domain={sparklineDomain(data)} hide />
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
