"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence, useInView } from "framer-motion"
import {
  Search,
  X,
  LayoutGrid,
  List,
  ChevronDown,
  Check,
  Clock,
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Types
interface Article {
  id: number
  title: string
  excerpt: string
  source: string
  time: string
  category: "Politics" | "Finance" | "Technology" | "Macro"
  sentiment: "Bullish" | "Bearish" | "Neutral"
  isBookmarked?: boolean
}

// Mock data - 9 realistic financial news articles
const mockArticles: Article[] = [
  {
    id: 1,
    title: "Federal Reserve Maintains Hawkish Stance as Inflation Proves Persistent",
    excerpt: "Chair Powell signals that interest rates will remain elevated through year-end, citing sticky core inflation metrics and robust labor market conditions...",
    source: "Bloomberg",
    time: "8 min ago",
    category: "Macro",
    sentiment: "Bearish",
  },
  {
    id: 2,
    title: "NVIDIA Surpasses Apple to Become World's Most Valuable Company",
    excerpt: "The chipmaker's market capitalization reached $3.5 trillion amid unprecedented demand for AI accelerators and data center infrastructure...",
    source: "Reuters",
    time: "23 min ago",
    category: "Technology",
    sentiment: "Bullish",
  },
  {
    id: 3,
    title: "China's Central Bank Cuts Key Interest Rate to Boost Economic Growth",
    excerpt: "The People's Bank of China reduced its medium-term lending facility rate by 20 basis points in an effort to stimulate slowing domestic demand...",
    source: "Financial Times",
    time: "45 min ago",
    category: "Macro",
    sentiment: "Bullish",
  },
  {
    id: 4,
    title: "U.S. Senate Advances Landmark Cryptocurrency Regulation Bill",
    excerpt: "Bipartisan legislation that would establish clear regulatory frameworks for digital assets moves forward after months of negotiation...",
    source: "CNBC",
    time: "1 hour ago",
    category: "Politics",
    sentiment: "Neutral",
  },
  {
    id: 5,
    title: "Goldman Sachs Raises S&P 500 Target Citing AI-Driven Productivity Gains",
    excerpt: "The investment bank now sees the index reaching 5,800 by year-end, up from its previous forecast of 5,200, driven by technology sector strength...",
    source: "WSJ",
    time: "2 hours ago",
    category: "Finance",
    sentiment: "Bullish",
  },
  {
    id: 6,
    title: "European Natural Gas Prices Surge on Supply Disruption Fears",
    excerpt: "TTF futures jumped 12% following reports of potential maintenance issues at key Norwegian pipelines ahead of the winter heating season...",
    source: "Bloomberg",
    time: "3 hours ago",
    category: "Macro",
    sentiment: "Bearish",
  },
  {
    id: 7,
    title: "Apple Announces Strategic Partnership with OpenAI for iOS Integration",
    excerpt: "The tech giant will embed advanced AI capabilities across its product ecosystem, marking a significant shift in its artificial intelligence strategy...",
    source: "The Verge",
    time: "4 hours ago",
    category: "Technology",
    sentiment: "Bullish",
  },
  {
    id: 8,
    title: "Treasury Department Sanctions Russian Banks in Expanded Crackdown",
    excerpt: "New restrictions target financial institutions facilitating circumvention of existing sanctions, impacting global trade settlement mechanisms...",
    source: "Reuters",
    time: "5 hours ago",
    category: "Politics",
    sentiment: "Neutral",
  },
  {
    id: 9,
    title: "Morgan Stanley Downgrades Commercial Real Estate Outlook Amid Office Vacancies",
    excerpt: "The firm sees continued pressure on REIT valuations as remote work trends persist and refinancing challenges mount for property owners...",
    source: "Barron's",
    time: "6 hours ago",
    category: "Finance",
    sentiment: "Bearish",
  },
]

const categoryFilters = ["All", "Politics", "Finance", "Technology", "Macro"]
const marketFilters = ["All Markets", "US", "China", "Hong Kong", "Japan", "Europe"]
const sortOptions = [
  { value: "latest", label: "Latest" },
  { value: "relevant", label: "Most Relevant" },
  { value: "discussed", label: "Most Discussed" },
]

// Category gradient colors
const categoryGradients: Record<string, string> = {
  Politics: "from-indigo-600/80 via-indigo-500/60 to-indigo-400/40",
  Finance: "from-chart-1/80 via-chart-1/60 to-chart-1/40",
  Technology: "from-primary/80 via-primary/60 to-primary/40",
  Macro: "from-amber-500/80 via-amber-400/60 to-amber-300/40",
}

// Custom Select Component
function CustomSelect({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const selectedOption = options.find((opt) => opt.value === value)

  return (
    <div ref={ref} className="relative">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-card text-sm font-medium transition-all duration-200",
          isOpen
            ? "border-primary ring-2 ring-primary/20"
            : "border-border hover:border-muted-foreground/40"
        )}
      >
        <span className="text-foreground">{selectedOption?.label}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-2 w-full min-w-[160px] bg-popover/95 backdrop-blur-xl border border-border rounded-xl shadow-xl overflow-hidden z-50"
          >
            <div className="p-1">
              {options.map((option, index) => (
                <motion.button
                  key={option.value}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => {
                    onChange(option.value)
                    setIsOpen(false)
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 text-left text-sm rounded-lg transition-colors",
                    value === option.value
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <span>{option.label}</span>
                  {value === option.value && <Check className="w-4 h-4 text-primary" />}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Grid News Card
function GridNewsCard({
  article,
  index,
  onToggleBookmark,
}: {
  article: Article
  index: number
  onToggleBookmark: (id: number) => void
}) {
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
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={{ y: -6, transition: { duration: 0.25 } }}
      className="group bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
    >
      {/* Gradient Header */}
      <div className={cn("relative h-[120px] bg-gradient-to-br", categoryGradients[article.category])}>
        {/* Bookmark button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onToggleBookmark(article.id)}
          className="absolute top-3 right-3 p-2 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
        >
          {article.isBookmarked ? (
            <BookmarkCheck className="w-4 h-4" />
          ) : (
            <Bookmark className="w-4 h-4" />
          )}
        </motion.button>

        {/* Category badge */}
        <div className="absolute bottom-3 left-3">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-black/30 backdrop-blur-sm text-white">
            {article.category}
          </span>
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
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full",
                article.sentiment === "Bullish"
                  ? "bg-chart-1/10 text-chart-1"
                  : article.sentiment === "Bearish"
                  ? "bg-chart-2/10 text-chart-2"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  article.sentiment === "Bullish"
                    ? "bg-chart-1"
                    : article.sentiment === "Bearish"
                    ? "bg-chart-2"
                    : "bg-muted-foreground"
                )}
              />
              {article.sentiment}
            </span>
          </div>
        </div>
      </div>

      {/* Hover arrow */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        whileHover={{ opacity: 1, x: 0 }}
        className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ArrowUpRight className="w-5 h-5 text-primary" />
      </motion.div>
    </motion.article>
  )
}

// List News Card
function ListNewsCard({
  article,
  index,
  onToggleBookmark,
}: {
  article: Article
  index: number
  onToggleBookmark: (id: number) => void
}) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-30px" })

  const stripeColors: Record<string, string> = {
    Politics: "bg-indigo-500",
    Finance: "bg-chart-1",
    Technology: "bg-primary",
    Macro: "bg-amber-500",
  }

  return (
    <motion.article
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{
        delay: index * 0.05,
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={{ x: 4, transition: { duration: 0.2 } }}
      className="group flex items-stretch bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
    >
      {/* Category stripe */}
      <div className={cn("w-1 shrink-0 rounded-l-xl", stripeColors[article.category])} />

      {/* Content */}
      <div className="flex-1 p-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground mb-1 line-clamp-1 group-hover:text-primary transition-colors">
            {article.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-1">{article.excerpt}</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground/80">{article.source}</span>
            <span className="text-muted-foreground/50">|</span>
            <span>{article.time}</span>
            <span className="text-muted-foreground/50">|</span>
            <span className="text-muted-foreground">{article.category}</span>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3 shrink-0">
          <span
            className={cn(
              "flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full",
              article.sentiment === "Bullish"
                ? "bg-chart-1/10 text-chart-1"
                : article.sentiment === "Bearish"
                ? "bg-chart-2/10 text-chart-2"
                : "bg-muted text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                article.sentiment === "Bullish"
                  ? "bg-chart-1"
                  : article.sentiment === "Bearish"
                  ? "bg-chart-2"
                  : "bg-muted-foreground"
              )}
            />
            {article.sentiment}
          </span>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onToggleBookmark(article.id)}
            className={cn(
              "p-2 rounded-xl transition-colors",
              article.isBookmarked
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {article.isBookmarked ? (
              <BookmarkCheck className="w-4 h-4" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
          </motion.button>
        </div>
      </div>
    </motion.article>
  )
}

// Loading skeleton
function LoadingSkeleton({ viewMode }: { viewMode: "grid" | "list" }) {
  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
            <div className="h-[120px] bg-muted" />
            <div className="p-5 space-y-3">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex bg-card border border-border rounded-xl overflow-hidden animate-pulse">
          <div className="w-1 bg-muted" />
          <div className="flex-1 p-4 space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-full" />
            <div className="h-3 bg-muted rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Main News Page Component
export default function NewsPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")
  const [activeMarket, setActiveMarket] = useState("All Markets")
  const [sortBy, setSortBy] = useState("latest")
  const [articles, setArticles] = useState<Article[]>(mockArticles)
  const [displayedCount, setDisplayedCount] = useState(9)
  const [isLoading, setIsLoading] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const loadMoreRef = useRef(null)
  const isLoadMoreInView = useInView(loadMoreRef, { margin: "100px" })

  const totalArticles = 2847

  // Filter articles
  const filteredArticles = articles.filter((article) => {
    const matchesSearch =
      searchQuery === "" ||
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.excerpt.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = activeCategory === "All" || article.category === activeCategory
    return matchesSearch && matchesCategory
  })

  // Toggle bookmark
  const handleToggleBookmark = useCallback((id: number) => {
    setArticles((prev) =>
      prev.map((article) =>
        article.id === id ? { ...article, isBookmarked: !article.isBookmarked } : article
      )
    )
  }, [])

  // Simulate infinite scroll
  useEffect(() => {
    if (isLoadMoreInView && !isLoading && displayedCount < totalArticles) {
      setIsLoading(true)
      setTimeout(() => {
        setDisplayedCount((prev) => Math.min(prev + 9, totalArticles))
        setIsLoading(false)
      }, 1000)
    }
  }, [isLoadMoreInView, isLoading, displayedCount])

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">News</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Intelligence feed from global financial sources
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-xl">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setViewMode("grid")}
            className={cn(
              "p-2.5 rounded-lg transition-all duration-200",
              viewMode === "grid"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setViewMode("list")}
            className={cn(
              "p-2.5 rounded-lg transition-all duration-200",
              viewMode === "list"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="w-4 h-4" />
          </motion.button>
        </div>
      </motion.div>

      {/* Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative"
      >
        <Search
          className={cn(
            "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200",
            isFocused ? "text-primary" : "text-muted-foreground"
          )}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Search articles, topics, sources..."
          className={cn(
            "w-full pl-12 pr-10 py-3.5 rounded-xl border bg-card text-foreground placeholder:text-muted-foreground text-sm transition-all duration-200",
            isFocused
              ? "border-primary ring-2 ring-primary/20"
              : "border-border hover:border-muted-foreground/40"
          )}
        />
        <AnimatePresence>
          {searchQuery && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Filter Pills */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex flex-wrap items-center gap-3"
      >
        {/* Category Pills */}
        <div className="flex flex-wrap gap-2">
          {categoryFilters.map((category) => (
            <motion.button
              key={category}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveCategory(category)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                activeCategory === category
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
              )}
            >
              {category}
            </motion.button>
          ))}
        </div>

        <div className="w-px h-6 bg-border hidden sm:block" />

        {/* Market Pills */}
        <div className="flex flex-wrap gap-2">
          {marketFilters.map((market) => (
            <motion.button
              key={market}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveMarket(market)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                activeMarket === market
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
              )}
            >
              {market}
            </motion.button>
          ))}
        </div>

        <div className="ml-auto">
          <CustomSelect
            options={sortOptions}
            value={sortBy}
            onChange={setSortBy}
          />
        </div>
      </motion.div>

      {/* Articles Grid/List */}
      <AnimatePresence mode="wait">
        {viewMode === "grid" ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
          >
            {filteredArticles.map((article, index) => (
              <GridNewsCard
                key={article.id}
                article={article}
                index={index}
                onToggleBookmark={handleToggleBookmark}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {filteredArticles.map((article, index) => (
              <ListNewsCard
                key={article.id}
                article={article}
                index={index}
                onToggleBookmark={handleToggleBookmark}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading / Infinite Scroll */}
      <div ref={loadMoreRef} className="py-8">
        {isLoading && <LoadingSkeleton viewMode={viewMode} />}

        {/* Article Count */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center gap-2 mt-6 text-sm text-muted-foreground"
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>
            Showing {Math.min(displayedCount, filteredArticles.length)} of{" "}
            {totalArticles.toLocaleString()} articles
          </span>
        </motion.div>
      </div>
    </div>
  )
}
