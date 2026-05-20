"use client"

import { useRef, useState, useEffect } from "react"
import { motion } from "framer-motion"
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const tickers = [
  { symbol: "AAPL", name: "Apple Inc.", price: 189.84, change: 2.34, sparkline: [45, 52, 48, 55, 60, 58, 65, 62, 68, 72, 70, 75] },
  { symbol: "MSFT", name: "Microsoft", price: 378.91, change: 1.12, sparkline: [40, 42, 45, 43, 48, 52, 50, 55, 58, 60, 62, 65] },
  { symbol: "GOOGL", name: "Alphabet", price: 141.80, change: -0.45, sparkline: [55, 52, 50, 48, 52, 49, 46, 48, 45, 43, 44, 42] },
  { symbol: "AMZN", name: "Amazon", price: 178.25, change: 3.21, sparkline: [30, 35, 32, 40, 38, 45, 50, 48, 55, 60, 58, 65] },
  { symbol: "NVDA", name: "NVIDIA", price: 875.28, change: 4.56, sparkline: [20, 25, 30, 35, 32, 40, 45, 50, 55, 65, 68, 75] },
  { symbol: "META", name: "Meta", price: 505.95, change: -1.23, sparkline: [60, 58, 55, 52, 55, 50, 48, 52, 48, 45, 43, 40] },
  { symbol: "TSLA", name: "Tesla", price: 177.48, change: 2.87, sparkline: [35, 40, 38, 45, 42, 48, 52, 55, 50, 58, 60, 62] },
  { symbol: "BRK.B", name: "Berkshire", price: 408.32, change: 0.78, sparkline: [48, 50, 52, 51, 53, 55, 54, 56, 58, 57, 59, 60] },
  { symbol: "JPM", name: "JPMorgan", price: 198.45, change: 1.45, sparkline: [42, 45, 48, 46, 50, 52, 55, 53, 58, 60, 62, 64] },
  { symbol: "V", name: "Visa Inc.", price: 278.32, change: 0.92, sparkline: [50, 52, 54, 53, 56, 58, 57, 60, 62, 61, 64, 66] },
]

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  
  const points = data
    .map((value, i) => {
      const x = (i / (data.length - 1)) * 64
      const y = 22 - ((value - min) / range) * 18
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg width="64" height="26" className="overflow-visible">
      <defs>
        <linearGradient id={`sparkline-${positive ? 'pos' : 'neg'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={positive ? "oklch(0.65 0.22 145)" : "oklch(0.6 0.22 25)"} stopOpacity={0.3} />
          <stop offset="100%" stopColor={positive ? "oklch(0.65 0.22 145)" : "oklch(0.6 0.22 25)"} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "oklch(0.65 0.22 145)" : "oklch(0.6 0.22 25)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function TickerCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
    }
  }

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.addEventListener("scroll", checkScroll)
      checkScroll()
      return () => el.removeEventListener("scroll", checkScroll)
    }
  }, [])

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 320
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      })
    }
  }

  return (
    <div className="relative group">
      {/* Scroll Buttons */}
      <button
        onClick={() => scroll("left")}
        className={cn(
          "absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-background/95 backdrop-blur-sm border border-border text-foreground hover:bg-muted hover:scale-110 transition-all duration-200 shadow-lg",
          canScrollLeft ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        onClick={() => scroll("right")}
        className={cn(
          "absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-background/95 backdrop-blur-sm border border-border text-foreground hover:bg-muted hover:scale-110 transition-all duration-200 shadow-lg",
          canScrollRight ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Gradient Masks */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent z-[5] pointer-events-none transition-opacity",
        canScrollLeft ? "opacity-100" : "opacity-0"
      )} />
      <div className={cn(
        "absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent z-[5] pointer-events-none transition-opacity",
        canScrollRight ? "opacity-100" : "opacity-0"
      )} />

      {/* Ticker List */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto hide-scrollbar px-8 py-2 scroll-smooth"
      >
        {tickers.map((ticker, index) => {
          const isPositive = ticker.change >= 0
          return (
            <motion.div
              key={ticker.symbol}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.04, duration: 0.3 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="flex-shrink-0 bg-card border border-border rounded-xl p-4 min-w-[190px] hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer group/card"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-foreground group-hover/card:text-primary transition-colors text-base">
                    {ticker.symbol}
                  </p>
                  <p className="text-xs text-muted-foreground truncate max-w-[85px]">
                    {ticker.name}
                  </p>
                </div>
                <Sparkline data={ticker.sparkline} positive={isPositive} />
              </div>
              <div className="flex items-end justify-between">
                <p className="font-bold text-foreground text-lg">
                  ${ticker.price.toFixed(2)}
                </p>
                <div
                  className={cn(
                    "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
                    isPositive ? "text-chart-1 bg-chart-1/10" : "text-chart-2 bg-chart-2/10"
                  )}
                >
                  {isPositive ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span>
                    {isPositive ? "+" : ""}
                    {ticker.change}%
                  </span>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
