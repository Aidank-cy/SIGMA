"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useMarketClock } from "@/hooks/useMarketClock";
import { useMarketIndices } from "@/hooks/useMarketIndices";
import {
  buildChartBoundaryTicks,
  buildChartTicks,
  buildChartXAxisDomain,
  calculateActiveRangeChange,
  toMarketChartDataByRange
} from "@/lib/marketChart";
import { computeChartYDomain, isTradingHoursActive } from "@/lib/marketSessions";

import {
  HeroChartCanvas,
  HeroChartEmpty,
  HeroChartHeader,
  HeroChartSkeleton,
  MarketDots,
  RangeSelector,
  type MarketChartData
} from "./hero-chart-parts";

interface HeroChartProps {
  activeMarket?: string;
  onActiveMarketChange?: (symbol: string) => void;
}

export function HeroChart({ activeMarket, onActiveMarketChange }: HeroChartProps) {
  const state = useHeroChartState(activeMarket, onActiveMarketChange);
  if (state.isLoading) {
    return <HeroChartSkeleton />;
  }
  if (!state.currentData) {
    return <HeroChartEmpty />;
  }
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 lg:p-8">
      <div className={state.backgroundClassName} />
      <HeroChartHeader changePct={state.changePct} changeSign={state.changeSign} currentData={state.currentData} isPositive={state.isPositive} pointChange={state.pointChange} selectedMarket={state.selectedMarket} />
      <HeroChartCanvas activeRange={state.activeRange} boundaryTicks={state.boundaryTicks} chartData={state.chartData} chartSessions={state.chartSessions} chartTicks={state.chartTicks} chartTimeZone={state.chartTimeZone} direction={state.direction} isPositive={state.isPositive} now={state.now} selectedMarket={state.selectedMarket} xAxisDomain={state.xAxisDomain} yAxisDomain={state.yAxisDomain} />
      <MarketDots markets={state.markets} onActiveMarketChange={onActiveMarketChange} selectedMarket={state.selectedMarket} setDirection={state.setDirection} />
      <RangeSelector activeRange={state.activeRange} setActiveRange={state.setActiveRange} />
    </div>
  );
}

function useHeroChartState(activeMarket?: string, onActiveMarketChange?: (symbol: string) => void) {
  const { data, isLoading } = useMarketIndices();
  const now = useMarketClock();
  const [activeRange, setActiveRange] = useState("1D");
  const markets = useMemo<MarketChartData[]>(() => {
    const indices = data?.indices ?? [];
    return indices.map((index) => {
      const dataByRange = toMarketChartDataByRange(index, now);
      return {
        change: index.change_pct,
        data: dataByRange["1D"] ?? [],
        dataByRange,
        name: index.name,
        price: index.value,
        previousClose: index.previous_close,
        symbol: index.symbol,
        currency: index.currency,
        isTrading: index.is_trading || isTradingHoursActive(index.trading_hours, now),
        tradingHours: index.trading_hours
      };
    });
  }, [data, now]);
  const [direction, setDirection] = useState(0);
  const previousMarketRef = useRef<string | undefined>(undefined);
  const selectedMarket = activeMarket ?? markets[0]?.symbol ?? "SIGMA";

  useEffect(() => {
    if (markets.length > 0 && !markets.some((market) => market.symbol === selectedMarket)) {
      onActiveMarketChange?.(markets[0].symbol);
    }
  }, [markets, onActiveMarketChange, selectedMarket]);

  useEffect(() => {
    const previousMarket = previousMarketRef.current;
    if (previousMarket && previousMarket !== selectedMarket) {
      const previousIndex = markets.findIndex((market) => market.symbol === previousMarket);
      const nextIndex = markets.findIndex((market) => market.symbol === selectedMarket);
      if (previousIndex !== -1 && nextIndex !== -1) {
        setDirection(nextIndex > previousIndex ? 1 : -1);
      }
    }
    previousMarketRef.current = selectedMarket;
  }, [markets, selectedMarket]);

  const currentData = useMemo(() => markets.find((market) => market.symbol === selectedMarket) ?? markets[0], [markets, selectedMarket]);
  const chartData = useMemo(() => currentData?.dataByRange[activeRange] ?? currentData?.data ?? [], [activeRange, currentData]);
  const { changePct, changeSign, isPositive, pointChange } = calculateActiveRangeChange({
    activeRange,
    chartData,
    currentValue: currentData?.price ?? 0,
    fallbackChangePct: currentData?.change ?? 0,
    previousClose: currentData?.previousClose ?? 0
  });
  const chartSessions = useMemo(() => currentData?.tradingHours.beijing_sessions?.length ? currentData.tradingHours.beijing_sessions : currentData?.tradingHours.sessions ?? [], [currentData]);
  const chartTimeZone = "Asia/Shanghai";
  const chartTicks = useMemo(() => buildChartTicks(activeRange, chartSessions, chartTimeZone, now, chartData), [activeRange, chartData, chartSessions, chartTimeZone, now]);
  const xAxisDomain = useMemo(() => buildChartXAxisDomain(activeRange, chartSessions, chartData), [activeRange, chartData, chartSessions]);
  const boundaryTicks = useMemo(() => buildChartBoundaryTicks(activeRange, chartData, chartSessions, chartTimeZone), [activeRange, chartData, chartSessions, chartTimeZone]);
  const yAxisDomain = useMemo(() => computeChartYDomain(chartData, currentData?.previousClose), [chartData, currentData?.previousClose]);
  const backgroundClassName = `absolute inset-0 opacity-5 transition-opacity duration-500 ${isPositive ? "bg-gradient-to-br from-chart-1 to-transparent" : "bg-gradient-to-br from-chart-2 to-transparent"}`;
  return { activeRange, backgroundClassName, boundaryTicks, changePct, changeSign, chartData, chartSessions, chartTicks, chartTimeZone, currentData, direction, isLoading, isPositive, markets, now, pointChange, selectedMarket, setActiveRange, setDirection, xAxisDomain, yAxisDomain };
}
