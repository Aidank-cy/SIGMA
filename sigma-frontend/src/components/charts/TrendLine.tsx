"use client";

import {
  Bar,
  BarChart,
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
  variant?: "bar" | "line";
}

export function TrendLine({ data, height = 280, variant = "line" }: TrendLineProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer height="100%" width="100%">
        {variant === "bar" ? (
          <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <SharedAxes />
            <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <SharedAxes />
            <Line
              activeDot={{ r: 5 }}
              dataKey="value"
              dot={false}
              stroke="rgb(var(--sigma-accent))"
              strokeWidth={2.5}
              type="linear"
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function SharedAxes() {
  return (
    <>
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
    </>
  );
}
