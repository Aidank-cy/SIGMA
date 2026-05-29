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

const paddedDomain: [number, (dataMax: number) => number] = [
  0,
  (dataMax: number) => Math.max(1, Math.ceil(dataMax * 1.2))
];

const darkTooltipContentStyle = {
  backgroundColor: "var(--foreground)",
  color: "var(--background)",
  border: "none",
  borderRadius: "16px",
  padding: "10px 16px",
  fontSize: "13px",
  fontWeight: 700
};

function formatTokenTick(value: number): string {
  if (value === 0) return "0";
  const thousands = value / 1000;
  return `${Number.isInteger(thousands) ? thousands.toFixed(0) : thousands.toFixed(1)}k`;
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
      <LineChart data={data} margin={{ bottom: 5, left: 5, right: 5, top: 8 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="day" interval={0} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
        <YAxis
          domain={paddedDomain}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          tickFormatter={formatTokenTick}
          width={58}
        />
        <Tooltip contentStyle={darkTooltipContentStyle} />
        <Line dataKey="input" dot={false} stroke="var(--chart-1)" strokeWidth={2} />
        <Line dataKey="output" dot={false} stroke="var(--chart-2)" strokeWidth={2} />
      </LineChart>
      <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-chart-1" />
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-chart-2" />
        <span className="font-bold">{label}</span>
      </div>
    </ChartFrame>
  );
}

export function ProviderUsageDistributionChart({ data }: { data: ProviderUsagePoint[] }) {
  return (
    <ChartFrame>
      <PieChart>
        <Tooltip contentStyle={darkTooltipContentStyle} formatter={(value: number) => value.toLocaleString()} />
        <Legend layout="horizontal" verticalAlign="bottom" />
        <Pie
          cx="50%"
          cy="44%"
          data={data}
          dataKey="tokens"
          innerRadius={35}
          nameKey="name"
          outerRadius={50}
          paddingAngle={3}
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
      <BarChart data={data} margin={{ bottom: 5, left: 0, right: 5, top: 8 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis axisLine={false} dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickLine={false} />
        <YAxis domain={paddedDomain} hide />
        <Tooltip contentStyle={darkTooltipContentStyle} />
        <Bar dataKey="tokens" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
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
          <Tooltip contentStyle={darkTooltipContentStyle} formatter={(value: number) => value.toLocaleString()} />
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
