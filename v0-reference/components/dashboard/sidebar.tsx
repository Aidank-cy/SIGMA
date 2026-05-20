"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard,
  LineChart,
  Newspaper,
  BarChart3,
  RefreshCw,
  Settings,
  Moon,
  Sun,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", id: "dashboard", href: "/" },
  { icon: LineChart, label: "Markets", id: "markets", href: "/markets" },
  { icon: Newspaper, label: "News", id: "news", href: "/news" },
  { icon: BarChart3, label: "Analytics", id: "analytics", href: "/analytics" },
  { icon: RefreshCw, label: "Sync", id: "sync", href: "/sync" },
  { icon: Settings, label: "Settings", id: "settings", href: "/settings" },
]

export function Sidebar() {
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()
  const router = useRouter()
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  const getActiveId = () => {
    if (pathname === "/") return "dashboard"
    const match = navItems.find((item) => item.href !== "/" && pathname.startsWith(item.href))
    return match?.id || "dashboard"
  }
  
  const activeId = getActiveId()

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="fixed left-0 top-0 z-50 h-screen w-20 frosted-glass border-r border-sidebar-border flex flex-col items-center py-6"
    >
      {/* Logo */}
      <motion.div 
        className="mb-8"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className="w-11 h-11 rounded-xl bg-sidebar-primary/90 flex items-center justify-center shadow-lg shadow-sidebar-primary/20">
          <span className="text-sidebar-primary-foreground font-bold text-lg">N</span>
        </div>
      </motion.div>

      {/* Menu Label */}
      <span className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest mb-4">
        Menu
      </span>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col items-center gap-1">
        {navItems.map((item) => {
          const isActive = activeId === item.id
          const isHovered = hoveredId === item.id
          
          return (
            <div key={item.id} className="relative">
              <motion.button
                onClick={() => router.push(item.href)}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/30"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <item.icon className="w-5 h-5" />
                
                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute -left-6 w-1 h-6 bg-sidebar-primary rounded-r-full"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </motion.button>

              {/* Tooltip */}
              <AnimatePresence>
                {isHovered && !isActive && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-popover text-popover-foreground rounded-lg text-sm font-medium shadow-xl border border-border whitespace-nowrap z-50"
                  >
                    {item.label}
                    <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-popover border-l border-b border-border rotate-45" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </nav>

      {/* Bottom Section */}
      <div className="flex flex-col items-center gap-3 mt-auto">
        {/* Theme Toggle */}
        <motion.button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200"
        >
          {mounted ? (
            theme === "dark" ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )
          ) : (
            <Sun className="w-5 h-5" />
          )}
        </motion.button>

        {/* User Avatar */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="w-10 h-10 rounded-full bg-gradient-to-br from-sidebar-primary to-accent flex items-center justify-center cursor-pointer ring-2 ring-sidebar-border hover:ring-sidebar-primary/50 transition-all duration-200"
        >
          <span className="text-white text-sm font-semibold">JD</span>
        </motion.div>
      </div>
    </motion.aside>
  )
}
