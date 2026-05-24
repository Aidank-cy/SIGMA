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
import { Children, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";

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

export function TokenTrendChart({
  data,
  legendLabel,
  locale
}: {
  data: TokenTrendPoint[];
  legendLabel?: string;
  locale?: string;
}) {
  const label = legendLabel ?? (locale?.startsWith("zh") ? "输入/输出" : "Input/Output");
  return (
    <ChartFrame>
      <LineChart data={data} margin={{ bottom: 5, left: -18, right: 5, top: 5 }}>
        <CartesianGrid stroke="rgb(var(--sigma-line))" vertical={false} />
        <XAxis dataKey="day" tick={{ fill: "rgb(var(--sigma-muted))", fontSize: 12 }} />
        <YAxis tick={{ fill: "rgb(var(--sigma-muted))", fontSize: 12 }} width={42} />
        <Tooltip />
        <Line dataKey="input" dot={false} stroke="rgb(var(--sigma-accent))" />
        <Line dataKey="output" dot={false} stroke="rgb(var(--sigma-success))" />
      </LineChart>
      <div className="mt-2 flex items-center justify-center gap-2 text-xs text-sigma-muted">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[rgb(var(--sigma-accent))]" />
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[rgb(var(--sigma-success))]" />
        <span className="font-medium">{label}</span>
      </div>
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
        <XAxis axisLine={false} dataKey="name" tick={{ fill: "rgb(var(--sigma-muted))", fontSize: 12 }} tickLine={false} />
        <YAxis axisLine={false} tick={{ fill: "rgb(var(--sigma-muted))", fontSize: 12 }} tickLine={false} width={42} />
        <Tooltip />
        <Bar dataKey="tokens" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
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

function ChartFrame({ children }: { children: ReactNode }) {
  const [chart, ...extra] = Children.toArray(children);
  if (!isValidElement(chart)) {
    return <div className="h-72">{children}</div>;
  }

  return (
    <div className="h-72">
      <div className={extra.length > 0 ? "h-[calc(100%-2rem)]" : "h-full"}>
        <ResponsiveContainer height="100%" width="100%">
          {chart as ReactElement}
        </ResponsiveContainer>
      </div>
      {extra}
    </div>
  );
}
