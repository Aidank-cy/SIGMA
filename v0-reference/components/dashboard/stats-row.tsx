"use client"

import { motion } from "framer-motion"
import { Newspaper, TrendingUp, Database, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

const stats = [
  {
    label: "Today's Articles",
    value: "2,847",
    change: "+124",
    icon: Newspaper,
    color: "text-chart-3",
    bgColor: "bg-chart-3/10",
    borderColor: "hover:border-chart-3/30",
  },
  {
    label: "Market Sentiment",
    value: "Bullish",
    change: "+12%",
    icon: TrendingUp,
    color: "text-chart-1",
    bgColor: "bg-chart-1/10",
    borderColor: "hover:border-chart-1/30",
  },
  {
    label: "Active Sources",
    value: "1,234",
    change: "+56",
    icon: Database,
    color: "text-chart-5",
    bgColor: "bg-chart-5/10",
    borderColor: "hover:border-chart-5/30",
  },
  {
    label: "Latest Report",
    value: "Q2 2026",
    change: "New",
    icon: FileText,
    color: "text-chart-4",
    bgColor: "bg-chart-4/10",
    borderColor: "hover:border-chart-4/30",
  },
]

export function StatsRow() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: index * 0.08, duration: 0.35 }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className={cn(
            "bg-card border border-border rounded-xl p-5 transition-all duration-300 group cursor-pointer",
            stat.borderColor
          )}
        >
          <div className="flex items-start justify-between mb-4">
            <div className={cn("p-2.5 rounded-xl transition-transform duration-300 group-hover:scale-110", stat.bgColor)}>
              <stat.icon className={cn("w-5 h-5", stat.color)} />
            </div>
            <span className={cn(
              "text-xs font-semibold px-2.5 py-1 rounded-full",
              stat.change === "New" 
                ? "bg-primary/10 text-primary" 
                : "bg-chart-1/10 text-chart-1"
            )}>
              {stat.change}
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
            {stat.value}
          </p>
          <p className="text-sm text-muted-foreground">{stat.label}</p>
        </motion.div>
      ))}
    </div>
  )
}
