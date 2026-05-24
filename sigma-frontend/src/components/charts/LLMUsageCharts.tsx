"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
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

interface ProviderUsagePoint {
  color: string;
  name: string;
  tokens: number;
}

interface DailyUsagePoint {
  day: string;
  tokens: number;
}

export function TokenTrendChart({ data }: { data: TokenTrendPoint[] }) {
  return (
    <ChartFrame>
      <LineChart data={data} margin={{ bottom: 5, left: -18, right: 5, top: 5 }}>
        <CartesianGrid stroke="rgb(var(--sigma-line))" vertical={false} />
        <XAxis dataKey="day" tick={{ fill: "rgb(var(--sigma-muted))", fontSize: 12 }} />
        <YAxis tick={{ fill: "rgb(var(--sigma-muted))", fontSize: 12 }} width={42} />
        <Tooltip />
        <Legend />
        <Line dataKey="input" dot={false} stroke="rgb(var(--sigma-accent))" />
        <Line dataKey="output" dot={false} stroke="rgb(var(--sigma-success))" />
      </LineChart>
    </ChartFrame>
  );
}

export function ProviderUsageDistributionChart({ data }: { data: ProviderUsagePoint[] }) {
  return (
    <ChartFrame>
      <PieChart>
        <Tooltip formatter={(value: number) => value.toLocaleString()} />
        <Legend layout="horizontal" verticalAlign="bottom" />
        <Pie
          cx="50%"
          cy="44%"
          data={data}
          dataKey="tokens"
          innerRadius={58}
          nameKey="name"
          outerRadius={88}
          paddingAngle={2}
        >
          {data.map((entry) => (
            <Cell fill={entry.color} key={entry.name} />
          ))}
        </Pie>
      </PieChart>
    </ChartFrame>
  );
}

export function FunctionUsageChart({ data }: { data: FunctionUsagePoint[] }) {
  return (
    <ChartFrame>
      <BarChart data={data} margin={{ bottom: 5, left: -18, right: 5, top: 5 }}>
        <CartesianGrid stroke="rgb(var(--sigma-line))" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: "rgb(var(--sigma-muted))", fontSize: 12 }} />
        <YAxis tick={{ fill: "rgb(var(--sigma-muted))", fontSize: 12 }} width={42} />
        <Tooltip />
        <Bar dataKey="tokens" fill="rgb(var(--sigma-accent))" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartFrame>
  );
}

export function DailyUsageSparkline({ data }: { data: DailyUsagePoint[] }) {
  return (
    <div className="h-16">
      <ResponsiveContainer height="100%" width="100%">
        <LineChart data={data}>
          <Line dataKey="tokens" dot={false} stroke="var(--chart-3)" strokeWidth={2} type="linear" />
          <Tooltip formatter={(value: number) => value.toLocaleString()} />
        </LineChart>
      </ResponsiveContainer>
    </div>
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
