"use client"

import { useEffect, useRef } from "react"
import { motion, useInView } from "framer-motion"
import { Clock, ArrowUpRight, Bookmark } from "lucide-react"
import { cn } from "@/lib/utils"

const articles = [
  {
    id: 1,
    title: "Federal Reserve Signals Potential Rate Cuts Amid Cooling Inflation Data",
    excerpt: "The latest CPI data shows inflation cooling faster than expected, leading to speculation about policy shifts...",
    source: "Bloomberg",
    time: "12 min ago",
    category: "Monetary Policy",
    image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=250&fit=crop",
    sentiment: "bullish",
  },
  {
    id: 2,
    title: "Tech Giants Report Record AI Revenue as Enterprise Adoption Accelerates",
    excerpt: "Cloud computing divisions see unprecedented growth driven by generative AI workloads and enterprise demand...",
    source: "Reuters",
    time: "28 min ago",
    category: "Technology",
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=250&fit=crop",
    sentiment: "bullish",
  },
  {
    id: 3,
    title: "Oil Prices Retreat as OPEC+ Production Concerns Ease",
    excerpt: "Crude oil futures dropped 2.3% following reports of increased output from major producing nations...",
    source: "CNBC",
    time: "45 min ago",
    category: "Commodities",
    image: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=400&h=250&fit=crop",
    sentiment: "bearish",
  },
  {
    id: 4,
    title: "European Markets Rally on Strong Economic Data",
    excerpt: "The Euro Stoxx 50 gained 1.8% as manufacturing PMI data exceeded analyst expectations across the region...",
    source: "Financial Times",
    time: "1 hour ago",
    category: "Markets",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=250&fit=crop",
    sentiment: "bullish",
  },
  {
    id: 5,
    title: "Cryptocurrency Markets See Volatility After Regulatory Announcement",
    excerpt: "Bitcoin and Ethereum experienced sharp price swings following new proposed regulations from the SEC...",
    source: "CoinDesk",
    time: "2 hours ago",
    category: "Crypto",
    image: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=400&h=250&fit=crop",
    sentiment: "neutral",
  },
  {
    id: 6,
    title: "Retail Sales Data Shows Consumer Spending Remains Resilient",
    excerpt: "May retail sales exceeded forecasts, indicating continued strength in consumer spending despite higher rates...",
    source: "WSJ",
    time: "3 hours ago",
    category: "Economy",
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=250&fit=crop",
    sentiment: "bullish",
  },
]

function NewsCard({ article, index }: { article: typeof articles[0]; index: number }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })

  return (
    <motion.article
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ 
        delay: index * 0.08,
        duration: 0.5,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      whileHover={{ y: -6, transition: { duration: 0.25 } }}
      className="group bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
    >
      {/* Image */}
      <div className="relative h-44 overflow-hidden">
        <img
          src={article.image}
          alt={article.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <span
            className={cn(
              "text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm",
              article.sentiment === "bullish"
                ? "bg-chart-1/25 text-chart-1"
                : article.sentiment === "bearish"
                ? "bg-chart-2/25 text-chart-2"
                : "bg-white/20 text-white"
            )}
          >
            {article.category}
          </span>
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
          >
            <Bookmark className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors leading-snug">
          {article.title}
        </h3>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2 leading-relaxed">
          {article.excerpt}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground/80">{article.source}</span>
            <span className="text-muted-foreground/50">|</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {article.time}
            </span>
          </div>
          <motion.button 
            whileHover={{ scale: 1.1, x: 2 }}
            whileTap={{ scale: 0.9 }}
            className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
          >
            <ArrowUpRight className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.article>
  )
}

export function NewsFeed() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground">Latest News</h2>
        <motion.button 
          whileHover={{ x: 4 }}
          className="text-sm text-primary hover:underline font-semibold flex items-center gap-1"
        >
          View All
          <ArrowUpRight className="w-4 h-4" />
        </motion.button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {articles.map((article, index) => (
          <NewsCard key={article.id} article={article} index={index} />
        ))}
      </div>
    </div>
  )
}
