"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { ReactElement } from "react";

interface TokenTrendPoint {
  day: string;
  input: number;
  output: number;
}

interface FunctionUsagePoint {
  name: string;
  tokens: number;
}

export function TokenTrendChart({ data }: { data: TokenTrendPoint[] }) {
  return (
    <ChartFrame>
      <LineChart data={data}>
        <CartesianGrid stroke="rgb(var(--sigma-line))" vertical={false} />
        <XAxis dataKey="day" tick={{ fill: "rgb(var(--sigma-muted))", fontSize: 12 }} />
        <YAxis tick={{ fill: "rgb(var(--sigma-muted))", fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Line dataKey="input" dot={false} stroke="rgb(var(--sigma-accent))" />
        <Line dataKey="output" dot={false} stroke="rgb(var(--sigma-success))" />
      </LineChart>
    </ChartFrame>
  );
}

export function FunctionUsageChart({ data }: { data: FunctionUsagePoint[] }) {
  return (
    <ChartFrame>
      <BarChart data={data}>
        <CartesianGrid stroke="rgb(var(--sigma-line))" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: "rgb(var(--sigma-muted))", fontSize: 12 }} />
        <YAxis tick={{ fill: "rgb(var(--sigma-muted))", fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="tokens" fill="rgb(var(--sigma-accent))" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartFrame>
  );
}

function ChartFrame({ children }: { children: ReactElement }) {
  return (
    <div className="h-72">
      <ResponsiveContainer height="100%" width="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
