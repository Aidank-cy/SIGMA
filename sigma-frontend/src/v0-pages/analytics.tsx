"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import {
  TrendingUp,
  TrendingDown,
  FileText,
  Plus,
  ArrowRight,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Mock data
const sentimentData = [
  { name: "Bullish", value: 62, color: "oklch(0.65 0.22 145)" },
  { name: "Bearish", value: 24, color: "oklch(0.6 0.22 25)" },
  { name: "Neutral", value: 14, color: "oklch(0.4 0 0)" },
]

const trendData = [
  { day: "Mon", sentiment: 58 },
  { day: "Tue", sentiment: 62 },
  { day: "Wed", sentiment: 55 },
  { day: "Thu", sentiment: 68 },
  { day: "Fri", sentiment: 72 },
  { day: "Sat", sentiment: 65 },
  { day: "Sun", sentiment: 62 },
]

const volumeData = [
  { day: "Mon", articles: 342 },
  { day: "Tue", articles: 456 },
  { day: "Wed", articles: 389 },
  { day: "Thu", articles: 512 },
  { day: "Fri", articles: 478 },
  { day: "Sat", articles: 234 },
  { day: "Sun", articles: 198 },
]

const sourceData = [
  { name: "Bloomberg", value: 35, color: "oklch(0.65 0.22 145)" },
  { name: "Reuters", value: 28, color: "oklch(0.6 0.18 250)" },
  { name: "CNBC", value: 22, color: "oklch(0.7 0.15 60)" },
  { name: "WSJ", value: 15, color: "oklch(0.55 0.18 275)" },
]

const categoryData = [
  { name: "Politics", bullish: 45, bearish: 35, neutral: 20, articles: 847, trend: 12 },
  { name: "Finance", bullish: 68, bearish: 18, neutral: 14, articles: 1234, trend: 8 },
  { name: "Technology", bullish: 72, bearish: 15, neutral: 13, articles: 956, trend: -5 },
  { name: "Macro", bullish: 52, bearish: 32, neutral: 16, articles: 623, trend: 3 },
]

const categoryColors: Record<string, string> = {
  Politics: "oklch(0.6 0.22 25)",
  Finance: "oklch(0.65 0.22 145)",
  Technology: "oklch(0.6 0.18 250)",
  Macro: "oklch(0.7 0.15 60)",
}

const reports = [
  { id: 1, type: "Daily", title: "Daily Intelligence Brief", date: "May 19, 2026", articles: 247, sources: 8, time: "6 hours ago" },
  { id: 2, type: "Weekly", title: "Weekly Market Digest", date: "May 12-18, 2026", articles: 1847, sources: 12, time: "2 days ago" },
  { id: 3, type: "Monthly", title: "Monthly Trend Analysis", date: "April 2026", articles: 8234, sources: 15, time: "3 weeks ago" },
  { id: 4, type: "Daily", title: "Daily Intelligence Brief", date: "May 18, 2026", articles: 231, sources: 8, time: "1 day ago" },
  { id: 5, type: "Weekly", title: "Weekly Market Digest", date: "May 5-11, 2026", articles: 1654, sources: 11, time: "1 week ago" },
  { id: 6, type: "Daily", title: "Daily Intelligence Brief", date: "May 17, 2026", articles: 219, sources: 7, time: "2 days ago" },
]

const keywords = [
  { word: "FederalReserve", count: 1247, hot: true },
  { word: "InterestRates", count: 892, hot: true },
  { word: "AIStocks", count: 756, hot: true },
  { word: "Inflation", count: 634, hot: false },
  { word: "TechEarnings", count: 589, hot: false },
  { word: "OilPrices", count: 478, hot: false },
  { word: "CryptoRegulation", count: 423, hot: false },
  { word: "SupplyChain", count: 367, hot: false },
  { word: "BankingCrisis", count: 312, hot: false },
  { word: "GreenEnergy", count: 289, hot: false },
]

const timeRanges = ["24h", "7d", "30d", "90d"]

const reportTypeBadge: Record<string, { bg: string; text: string }> = {
  Daily: { bg: "bg-chart-3/10", text: "text-chart-3" },
  Weekly: { bg: "bg-chart-4/10", text: "text-chart-4" },
  Monthly: { bg: "bg-chart-5/10", text: "text-chart-5" },
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("7d")

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Sentiment analysis and intelligence reports
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl">
          {timeRanges.map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                "relative px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                timeRange === range
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {timeRange === range && (
                <motion.div
                  layoutId="timeRange"
                  className="absolute inset-0 bg-primary rounded-lg"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
              <span className="relative z-10">{range}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Section 1: Sentiment Overview */}
      <motion.section
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {/* Overall Sentiment */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -4 }}
          className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all"
        >
          <h3 className="text-sm font-medium text-muted-foreground mb-4">
            Overall Sentiment
          </h3>
          <div className="relative flex items-center justify-center">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie
                  data={sentimentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={55}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {sentimentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-chart-1">62%</span>
              <span className="text-xs text-muted-foreground">Bullish</span>
            </div>
          </div>
          <div className="flex justify-center gap-4 mt-4 text-xs">
            {sentimentData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-muted-foreground">{item.value}%</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Sentiment Trend */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -4 }}
          className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all"
        >
          <h3 className="text-sm font-medium text-muted-foreground mb-4">
            Sentiment Trend
          </h3>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.65 0.22 145)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="oklch(0.65 0.22 145)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="sentiment"
                stroke="oklch(0.65 0.22 145)"
                strokeWidth={2}
                fill="url(#sentimentGradient)"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "oklch(0.13 0 0)",
                  border: "1px solid oklch(0.2 0 0)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "oklch(0.7 0 0)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-2 mt-2">
            <TrendingUp className="w-4 h-4 text-chart-1" />
            <span className="text-sm text-chart-1 font-medium">+4.2%</span>
            <span className="text-xs text-muted-foreground">vs last period</span>
          </div>
        </motion.div>

        {/* Article Volume */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -4 }}
          className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all"
        >
          <h3 className="text-sm font-medium text-muted-foreground mb-4">
            Article Volume
          </h3>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={volumeData}>
              <Bar
                dataKey="articles"
                fill="oklch(0.55 0.18 275)"
                radius={[4, 4, 0, 0]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "oklch(0.13 0 0)",
                  border: "1px solid oklch(0.2 0 0)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "oklch(0.7 0 0)" }}
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xl font-bold text-foreground">2,609</span>
            <span className="text-xs text-muted-foreground">articles this week</span>
          </div>
        </motion.div>

        {/* Source Distribution */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -4 }}
          className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all"
        >
          <h3 className="text-sm font-medium text-muted-foreground mb-4">
            Source Distribution
          </h3>
          <ResponsiveContainer width="100%" height={80}>
            <PieChart>
              <Pie
                data={sourceData}
                cx="50%"
                cy="50%"
                innerRadius={25}
                outerRadius={40}
                paddingAngle={2}
                dataKey="value"
              >
                {sourceData.map((entry, index) => (
                  <Cell key={`source-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {sourceData.map((source) => (
              <div key={source.name} className="flex items-center gap-1.5 text-xs">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: source.color }}
                />
                <span className="text-muted-foreground truncate">{source.name}</span>
                <span className="text-foreground font-medium">{source.value}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.section>

      {/* Section 2: Sentiment by Category */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-4"
      >
        <h2 className="text-lg font-semibold text-foreground">Sentiment by Category</h2>
        <div className="grid gap-3">
          {categoryData.map((category, index) => (
            <motion.div
              key={category.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.08 }}
              whileHover={{ y: -2 }}
              className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-[140px]">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: categoryColors[category.name] }}
                  />
                  <span className="font-medium text-foreground">{category.name}</span>
                </div>

                {/* Sentiment Bar */}
                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden flex">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${category.bullish}%`,
                      backgroundColor: "oklch(0.65 0.22 145)",
                    }}
                  />
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${category.bearish}%`,
                      backgroundColor: "oklch(0.6 0.22 25)",
                    }}
                  />
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${category.neutral}%`,
                      backgroundColor: "oklch(0.4 0 0)",
                    }}
                  />
                </div>

                <div className="flex items-center gap-4 min-w-[180px] justify-end">
                  <span className="text-sm text-muted-foreground">
                    {category.articles.toLocaleString()} articles
                  </span>
                  <div
                    className={cn(
                      "flex items-center gap-1 text-sm font-medium",
                      category.trend >= 0 ? "text-chart-1" : "text-chart-2"
                    )}
                  >
                    {category.trend >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    <span>{category.trend >= 0 ? "+" : ""}{category.trend}%</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Section 3: Intelligence Reports */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Intelligence Reports</h2>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Generate Report
          </motion.button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((report, index) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + index * 0.08 }}
              whileHover={{ y: -4 }}
              className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <span
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-semibold",
                    reportTypeBadge[report.type].bg,
                    reportTypeBadge[report.type].text
                  )}
                >
                  {report.type}
                </span>
                <FileText className="w-5 h-5 text-muted-foreground" />
              </div>

              <h3 className="font-semibold text-foreground mb-1">{report.title}</h3>
              <p className="text-sm text-muted-foreground mb-1">{report.date}</p>
              <p className="text-xs text-muted-foreground mb-4">
                Covering {report.articles.toLocaleString()} articles across {report.sources} sources
              </p>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-xs text-muted-foreground">{report.time}</span>
                <button className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors group-hover:gap-2">
                  Read Report
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Section 4: Top Keywords */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Top Keywords</h2>
        </div>

        <div className="flex flex-wrap gap-3">
          {keywords.map((keyword, index) => (
            <motion.div
              key={keyword.word}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 + index * 0.05 }}
              whileHover={{ scale: 1.05 }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm cursor-pointer transition-all",
                keyword.hot
                  ? "bg-primary/10 border border-primary/20 text-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <span className="text-muted-foreground">#</span>
              <span>{keyword.word}</span>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded text-xs font-medium",
                  keyword.hot ? "bg-primary/20 text-primary" : "bg-background text-muted-foreground"
                )}
              >
                {keyword.count >= 1000
                  ? `${(keyword.count / 1000).toFixed(1)}K`
                  : keyword.count}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.section>
    </div>
  )
}
