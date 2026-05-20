"use client"

import { motion } from "framer-motion"
import { HeroChart } from "@/components/dashboard/hero-chart"
import { TickerCarousel } from "@/components/dashboard/ticker-carousel"
import { StatsRow } from "@/components/dashboard/stats-row"
import { SearchBar } from "@/components/dashboard/search-bar"
import { NewsFeed } from "@/components/dashboard/news-feed"
import { RightSidebar } from "@/components/dashboard/right-sidebar"

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen">
      {/* Primary Content */}
      <div className="flex-1 min-w-0 p-6 lg:p-8 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground text-balance">
              Good morning, John
            </h1>
            <p className="text-muted-foreground mt-1">
              Here&apos;s what&apos;s happening in the markets today
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              Last updated: <span className="text-foreground font-medium">2 min ago</span>
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-chart-1 animate-pulse" />
              <span className="text-xs text-chart-1 font-medium">Live</span>
            </div>
          </div>
        </motion.div>

        {/* Hero Market Chart */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <HeroChart />
        </motion.section>

        {/* Ticker Carousel */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Market Movers
          </h2>
          <TickerCarousel />
        </motion.section>

        {/* Stats Row */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <StatsRow />
        </motion.section>

        {/* Search Bar */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <SearchBar />
        </motion.section>

        {/* News Feed */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <NewsFeed />
        </motion.section>
      </div>

      {/* Right Sidebar */}
      <aside className="hidden xl:block w-80 shrink-0 p-6 lg:p-8 pl-0">
        <div className="sticky top-6">
          <RightSidebar />
        </div>
      </aside>
    </div>
  )
}
