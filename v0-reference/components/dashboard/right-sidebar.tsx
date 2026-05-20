"use client"

import { motion } from "framer-motion"
import { TrendingUp, TrendingDown, Plus, MoreHorizontal, Flame, Hash, Star } from "lucide-react"
import { cn } from "@/lib/utils"

const watchlistItems = [
  { symbol: "AAPL", name: "Apple Inc.", price: 189.84, change: 2.34, positive: true },
  { symbol: "TSLA", name: "Tesla Inc.", price: 177.48, change: 2.87, positive: true },
  { symbol: "NVDA", name: "NVIDIA Corp.", price: 875.28, change: 4.56, positive: true },
  { symbol: "META", name: "Meta Platforms", price: 505.95, change: -1.23, positive: false },
  { symbol: "GOOGL", name: "Alphabet Inc.", price: 141.80, change: -0.45, positive: false },
]

const trendingTopics = [
  { tag: "FederalReserve", count: "12.4K", trending: true },
  { tag: "AIStocks", count: "8.7K", trending: true },
  { tag: "EarningsSeason", count: "6.2K", trending: false },
  { tag: "OilPrices", count: "4.8K", trending: false },
  { tag: "CryptoRegulation", count: "3.9K", trending: true },
  { tag: "TechSector", count: "3.1K", trending: false },
]

export function RightSidebar() {
  return (
    <div className="space-y-6">
      {/* Watchlist */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-chart-4" />
            <h3 className="font-semibold text-foreground">Watchlist</h3>
          </div>
          <div className="flex items-center gap-1">
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <Plus className="w-4 h-4" />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="w-4 h-4" />
            </motion.button>
          </div>
        </div>

        <div className="space-y-1">
          {watchlistItems.map((item, index) => (
            <motion.div
              key={item.symbol}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              whileHover={{ x: 4, backgroundColor: "var(--muted)" }}
              className="flex items-center justify-between p-3 rounded-xl transition-all duration-200 cursor-pointer group"
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">
                  {item.symbol}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {item.name}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-foreground text-sm">
                  ${item.price.toFixed(2)}
                </p>
                <div
                  className={cn(
                    "flex items-center justify-end gap-0.5 text-xs font-semibold",
                    item.positive ? "text-chart-1" : "text-chart-2"
                  )}
                >
                  {item.positive ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span>
                    {item.positive ? "+" : ""}
                    {item.change}%
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full mt-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10 rounded-xl transition-colors"
        >
          View Full Portfolio
        </motion.button>
      </motion.div>

      {/* Trending Topics */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card border border-border rounded-xl p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-5 h-5 text-chart-2" />
          <h3 className="font-semibold text-foreground">Trending Topics</h3>
        </div>

        <div className="space-y-1">
          {trendingTopics.map((topic, index) => (
            <motion.button
              key={topic.tag}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.05 }}
              whileHover={{ x: 4, backgroundColor: "var(--muted)" }}
              className="w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 group"
            >
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">
                  {topic.tag}
                </span>
                {topic.trending && (
                  <span className="w-1.5 h-1.5 rounded-full bg-chart-1 animate-pulse" />
                )}
              </div>
              <span className="text-xs text-muted-foreground font-medium">
                {topic.count}
              </span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Quick Stats / Market Overview */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-gradient-to-br from-primary/15 via-card to-accent/10 border border-primary/20 rounded-xl p-5"
      >
        <h3 className="font-semibold text-foreground mb-4">Market Overview</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-background/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Fear & Greed</p>
            <p className="text-xl font-bold text-chart-1">72</p>
            <p className="text-xs text-chart-1 font-medium">Greed</p>
          </div>
          <div className="bg-background/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">VIX Index</p>
            <p className="text-xl font-bold text-foreground">14.32</p>
            <p className="text-xs text-chart-1 font-medium">-2.1%</p>
          </div>
          <div className="bg-background/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Put/Call</p>
            <p className="text-xl font-bold text-foreground">0.87</p>
            <p className="text-xs text-muted-foreground font-medium">Neutral</p>
          </div>
          <div className="bg-background/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Volume</p>
            <p className="text-xl font-bold text-foreground">1.2B</p>
            <p className="text-xs text-chart-1 font-medium">+8%</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
