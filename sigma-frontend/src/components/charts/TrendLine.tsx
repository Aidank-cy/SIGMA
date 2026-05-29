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

export function TrendLine({ data, height = 240, variant = "line" }: TrendLineProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer height="100%" width="100%">
        {variant === "bar" ? (
          <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <SharedAxes />
            <Bar dataKey="value" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <SharedAxes />
            <Line
              activeDot={{ r: 5 }}
              dataKey="value"
              dot={false}
              stroke="var(--chart-4)"
              strokeWidth={2}
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
        tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        tickLine={false}
        tickMargin={2}
      />
      <YAxis
        axisLine={false}
        tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        tickLine={false}
        tickMargin={2}
        width={38}
      />
      <Tooltip
        contentStyle={{
          backgroundColor: "var(--foreground)",
          border: "none",
          borderRadius: "16px",
          color: "var(--background)",
          fontSize: "13px",
          fontWeight: 700,
          padding: "10px 16px"
        }}
      />
    </>
  );
}
