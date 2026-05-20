"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

const timeRanges = ["1D", "1W", "1M", "3M", "1Y"]

const marketData = {
  "S&P 500": {
    symbol: "SPX",
    price: 5847.32,
    change: 1.24,
    data: generateChartData(60, 5750, 5900, true),
  },
  "NASDAQ": {
    symbol: "IXIC",
    price: 18432.65,
    change: 1.87,
    data: generateChartData(60, 18100, 18500, true),
  },
  "DOW JONES": {
    symbol: "DJI",
    price: 43876.12,
    change: -0.32,
    data: generateChartData(60, 43500, 44000, false),
  },
  "RUSSELL 2000": {
    symbol: "RUT",
    price: 2287.45,
    change: 0.89,
    data: generateChartData(60, 2250, 2300, true),
  },
}

function generateChartData(points: number, min: number, max: number, positive: boolean) {
  const data = []
  let value = positive ? min + (max - min) * 0.3 : max - (max - min) * 0.3
  
  for (let i = 0; i < points; i++) {
    const trend = positive ? 0.6 : 0.4
    const change = (Math.random() - trend) * (max - min) * 0.04
    value = Math.max(min, Math.min(max, value + change))
    data.push({
      time: i,
      value: Math.round(value * 100) / 100,
    })
  }
  return data
}

const markets = Object.keys(marketData) as (keyof typeof marketData)[]

export function HeroChart() {
  const [activeMarket, setActiveMarket] = useState<keyof typeof marketData>("S&P 500")
  const [activeRange, setActiveRange] = useState("1D")
  const [direction, setDirection] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragX = useMotionValue(0)
  
  const currentData = marketData[activeMarket]
  const isPositive = currentData.change >= 0

  const handleDragEnd = (event: PointerEvent, info: { offset: { x: number }; velocity: { x: number } }) => {
    const threshold = 50
    const velocity = info.velocity.x
    const offset = info.offset.x
    
    if (Math.abs(velocity) > 500 || Math.abs(offset) > threshold) {
      if (offset > 0 || velocity > 500) {
        handlePrev()
      } else {
        handleNext()
      }
    }
    
    animate(dragX, 0, { type: "spring", stiffness: 300, damping: 30 })
  }

  const handlePrev = () => {
    const currentIndex = markets.indexOf(activeMarket)
    const prevIndex = (currentIndex - 1 + markets.length) % markets.length
    setDirection(-1)
    setActiveMarket(markets[prevIndex])
  }

  const handleNext = () => {
    const currentIndex = markets.indexOf(activeMarket)
    const nextIndex = (currentIndex + 1) % markets.length
    setDirection(1)
    setActiveMarket(markets[nextIndex])
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev()
      if (e.key === "ArrowRight") handleNext()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeMarket])

  const chartOpacity = useTransform(dragX, [-100, 0, 100], [0.5, 1, 0.5])

  return (
    <div className="bg-card rounded-2xl border border-border p-6 lg:p-8 relative overflow-hidden group">
      {/* Subtle gradient background */}
      <div className={cn(
        "absolute inset-0 opacity-5 transition-opacity duration-500",
        isPositive ? "bg-gradient-to-br from-chart-1 to-transparent" : "bg-gradient-to-br from-chart-2 to-transparent"
      )} />
      
      {/* Header */}
      <div className="flex items-start justify-between mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">
              {currentData.symbol}
            </span>
            <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-chart-1/10 text-chart-1">
              <span className="w-1.5 h-1.5 rounded-full bg-chart-1 animate-pulse" />
              Live
            </span>
          </div>
          <motion.h2 
            key={activeMarket}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl lg:text-3xl font-bold text-foreground"
          >
            {activeMarket}
          </motion.h2>
        </div>

        <div className="text-right">
          <motion.p 
            key={`${activeMarket}-price`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight"
          >
            {currentData.price.toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </motion.p>
          <motion.div
            key={`${activeMarket}-change`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn(
              "flex items-center justify-end gap-1.5 text-base font-semibold mt-1",
              isPositive ? "text-chart-1" : "text-chart-2"
            )}
          >
            {isPositive ? (
              <TrendingUp className="w-5 h-5" />
            ) : (
              <TrendingDown className="w-5 h-5" />
            )}
            <span>
              {isPositive ? "+" : ""}
              {currentData.change}%
            </span>
          </motion.div>
        </div>
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={handlePrev}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-background/90 backdrop-blur-sm border border-border text-foreground hover:bg-muted hover:scale-110 transition-all duration-200 opacity-0 group-hover:opacity-100 shadow-lg"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={handleNext}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-background/90 backdrop-blur-sm border border-border text-foreground hover:bg-muted hover:scale-110 transition-all duration-200 opacity-0 group-hover:opacity-100 shadow-lg"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Chart with drag/swipe */}
      <motion.div
        ref={containerRef}
        className="h-56 lg:h-72 relative cursor-grab active:cursor-grabbing touch-pan-y"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={(event, info) => {
          setIsDragging(false)
          handleDragEnd(event as PointerEvent, info)
        }}
        style={{ x: dragX }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeMarket}
            initial={{ opacity: 0, x: direction * 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -80 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute inset-0"
            style={{ opacity: isDragging ? chartOpacity : 1 }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={currentData.data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPositive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.65 0.22 145)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="oklch(0.65 0.22 145)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorNegative" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.6 0.22 25)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="oklch(0.6 0.22 25)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <YAxis hide domain={["dataMin - 10", "dataMax + 10"]} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-xl px-4 py-2.5 shadow-xl">
                          <p className="text-base font-bold text-foreground">
                            {payload[0].value?.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={isPositive ? "oklch(0.65 0.22 145)" : "oklch(0.6 0.22 25)"}
                  strokeWidth={2.5}
                  fill={isPositive ? "url(#colorPositive)" : "url(#colorNegative)"}
                  animationDuration={800}
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        </AnimatePresence>
        
        {/* Swipe hint */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">
          Swipe or use arrow keys to navigate
        </div>
      </motion.div>

      {/* Market Dots Navigation */}
      <div className="flex items-center justify-center gap-2 mt-6 mb-5">
        {markets.map((market) => (
          <button
            key={market}
            onClick={() => {
              setDirection(markets.indexOf(market) > markets.indexOf(activeMarket) ? 1 : -1)
              setActiveMarket(market)
            }}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              activeMarket === market
                ? "bg-primary w-8"
                : "bg-muted-foreground/25 hover:bg-muted-foreground/40 w-2"
            )}
          />
        ))}
      </div>

      {/* Time Range Selector */}
      <div className="flex items-center justify-center gap-1 bg-muted/50 rounded-xl p-1.5 max-w-fit mx-auto">
        {timeRanges.map((range) => (
          <button
            key={range}
            onClick={() => setActiveRange(range)}
            className={cn(
              "relative px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200",
              activeRange === range
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {activeRange === range && (
              <motion.div
                layoutId="timeRange"
                className="absolute inset-0 bg-background rounded-lg shadow-sm"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{range}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
