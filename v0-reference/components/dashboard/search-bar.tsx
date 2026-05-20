"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, ChevronDown, X, Check } from "lucide-react"
import { cn } from "@/lib/utils"

const categories = [
  { value: "all", label: "All Categories" },
  { value: "stocks", label: "Stocks" },
  { value: "crypto", label: "Crypto" },
  { value: "forex", label: "Forex" },
  { value: "commodities", label: "Commodities" },
  { value: "bonds", label: "Bonds" },
]

const markets = [
  { value: "all", label: "All Markets" },
  { value: "us", label: "US Markets" },
  { value: "eu", label: "European" },
  { value: "asia", label: "Asian" },
  { value: "emerging", label: "Emerging" },
]

interface CustomSelectProps {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  placeholder: string
}

function CustomSelect({ options, value, onChange, placeholder }: CustomSelectProps) {
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
          "flex items-center gap-2 px-4 py-3 rounded-xl border bg-card text-sm font-medium transition-all duration-200 min-w-[150px]",
          isOpen
            ? "border-primary ring-2 ring-primary/20 shadow-lg"
            : "border-border hover:border-muted-foreground/40"
        )}
      >
        <span className={selectedOption?.value === "all" ? "text-muted-foreground" : "text-foreground"}>
          {selectedOption?.label || placeholder}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="ml-auto"
        >
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full left-0 mt-2 w-full min-w-[180px] bg-popover/95 backdrop-blur-xl border border-border rounded-xl shadow-xl overflow-hidden z-50"
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
                  {value === option.value && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function SearchBar() {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("all")
  const [market, setMarket] = useState("all")
  const [isFocused, setIsFocused] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="flex flex-col sm:flex-row gap-3"
    >
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className={cn(
          "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200",
          isFocused ? "text-primary" : "text-muted-foreground"
        )} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Search news, stocks, reports..."
          className={cn(
            "w-full pl-12 pr-10 py-3.5 rounded-xl border bg-card text-foreground placeholder:text-muted-foreground text-sm transition-all duration-200",
            isFocused
              ? "border-primary ring-2 ring-primary/20 shadow-lg"
              : "border-border hover:border-muted-foreground/40"
          )}
        />
        <AnimatePresence>
          {query && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <CustomSelect
          options={categories}
          value={category}
          onChange={setCategory}
          placeholder="Category"
        />
        <CustomSelect
          options={markets}
          value={market}
          onChange={setMarket}
          placeholder="Market"
        />
      </div>
    </motion.div>
  )
}
