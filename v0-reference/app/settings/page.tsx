"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  User,
  Settings2,
  Bell,
  Brain,
  Key,
  Shield,
  Lock,
  ChevronDown,
  Check,
  Trash2,
  Monitor,
  Smartphone,
  Plus,
  X,
  Eye,
  EyeOff,
} from "lucide-react"
import { cn } from "@/lib/utils"

const sections = [
  { id: "profile", label: "Profile", icon: User },
  { id: "preferences", label: "Preferences", icon: Settings2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "llm", label: "LLM Configuration", icon: Brain },
  { id: "apikeys", label: "API Keys", icon: Key },
  { id: "security", label: "Security", icon: Shield },
]

const languages = [
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
]

const timezones = [
  { value: "utc", label: "UTC" },
  { value: "est", label: "Eastern Time (ET)" },
  { value: "pst", label: "Pacific Time (PT)" },
  { value: "cst", label: "China Standard Time (CST)" },
  { value: "jst", label: "Japan Standard Time (JST)" },
]

const llmProviders = [
  { id: "anthropic", name: "Anthropic", models: 4, icon: "A" },
  { id: "openai", name: "OpenAI", models: 6, icon: "O" },
  { id: "deepseek", name: "DeepSeek", models: 3, icon: "D" },
  { id: "google", name: "Google Gemini", models: 5, icon: "G" },
  { id: "kimi", name: "Kimi", models: 2, icon: "K" },
  { id: "minimax", name: "MiniMax", models: 2, icon: "M" },
]

const modelsByProvider: Record<string, string[]> = {
  anthropic: ["Claude 3.5 Sonnet", "Claude 3.5 Haiku", "Claude 3 Opus", "Claude 3 Sonnet"],
  openai: ["GPT-4o", "GPT-4o Mini", "GPT-4 Turbo", "GPT-4", "GPT-3.5 Turbo", "o1-preview"],
  deepseek: ["DeepSeek V3", "DeepSeek Coder", "DeepSeek Chat"],
  google: ["Gemini 2.0 Flash", "Gemini 1.5 Pro", "Gemini 1.5 Flash", "Gemini Ultra", "PaLM 2"],
  kimi: ["Moonshot v1", "Moonshot v1 128k"],
  minimax: ["abab6.5", "abab5.5"],
}

const savedApiKeys = [
  { id: 1, provider: "Anthropic", name: "Production Key", maskedValue: "sk-ant-•••••••••••••3f2a", tokenLimit: 100000, createdAt: "2024-01-15" },
  { id: 2, provider: "Anthropic", name: "Development Key", maskedValue: "sk-ant-•••••••••••••8b4c", tokenLimit: 50000, createdAt: "2024-02-20" },
  { id: 3, provider: "OpenAI", name: "Main API Key", maskedValue: "sk-•••••••••••••••••7d9e", tokenLimit: 200000, createdAt: "2024-01-10" },
]

const activeSessions = [
  { id: 1, device: "desktop", browser: "Chrome on macOS", location: "San Francisco, CA", lastActive: "Now", current: true },
  { id: 2, device: "mobile", browser: "Safari on iPhone", location: "San Francisco, CA", lastActive: "2 hours ago", current: false },
  { id: 3, device: "desktop", browser: "Firefox on Windows", location: "New York, NY", lastActive: "Yesterday", current: false },
]

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("profile")
  const [language, setLanguage] = useState("en")
  const [timezone, setTimezone] = useState("pst")
  const [selectedProvider, setSelectedProvider] = useState("anthropic")
  const [selectedModel, setSelectedModel] = useState("Claude 3.5 Sonnet")
  const [showAddKey, setShowAddKey] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  
  // Preference toggles
  const [darkMode, setDarkMode] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [showTicker, setShowTicker] = useState(true)
  const [compactCards, setCompactCards] = useState(false)
  const [costGuard, setCostGuard] = useState(true)
  
  // Password visibility
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account and platform preferences
        </p>
      </motion.div>

      {/* Main Content */}
      <div className="flex gap-8">
        {/* Section Navigation */}
        <motion.nav
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-56 flex-shrink-0 sticky top-8 self-start"
        >
          <div className="space-y-1">
            {sections.map((section) => {
              const Icon = section.icon
              const isActive = activeSection === section.id
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200",
                    isActive
                      ? "text-primary font-semibold border-l-2 border-primary bg-primary/5"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {section.label}
                </button>
              )
            })}
          </div>
        </motion.nav>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {activeSection === "profile" && (
              <ProfileSection
                key="profile"
                language={language}
                setLanguage={setLanguage}
                timezone={timezone}
                setTimezone={setTimezone}
              />
            )}
            {activeSection === "preferences" && (
              <PreferencesSection
                key="preferences"
                darkMode={darkMode}
                setDarkMode={setDarkMode}
                autoRefresh={autoRefresh}
                setAutoRefresh={setAutoRefresh}
                showTicker={showTicker}
                setShowTicker={setShowTicker}
                compactCards={compactCards}
                setCompactCards={setCompactCards}
              />
            )}
            {activeSection === "notifications" && (
              <NotificationsSection key="notifications" />
            )}
            {activeSection === "llm" && (
              <LLMSection
                key="llm"
                selectedProvider={selectedProvider}
                setSelectedProvider={setSelectedProvider}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                costGuard={costGuard}
                setCostGuard={setCostGuard}
              />
            )}
            {activeSection === "apikeys" && (
              <APIKeysSection
                key="apikeys"
                showAddKey={showAddKey}
                setShowAddKey={setShowAddKey}
              />
            )}
            {activeSection === "security" && (
              <SecuritySection
                key="security"
                showCurrentPw={showCurrentPw}
                setShowCurrentPw={setShowCurrentPw}
                showNewPw={showNewPw}
                setShowNewPw={setShowNewPw}
                showConfirmPw={showConfirmPw}
                setShowConfirmPw={setShowConfirmPw}
                showDeleteModal={showDeleteModal}
                setShowDeleteModal={setShowDeleteModal}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// Custom Select Component
function CustomSelect({
  value,
  options,
  onChange,
  placeholder = "Select...",
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  placeholder?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedOption = options.find((opt) => opt.value === value)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-12 px-4 rounded-xl border border-border bg-card text-foreground text-sm flex items-center justify-between hover:border-primary/40 transition-colors"
      >
        <span>{selectedOption?.label || placeholder}</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50"
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onChange(option.value)
                    setIsOpen(false)
                  }}
                  className={cn(
                    "w-full px-4 py-3 text-sm text-left flex items-center justify-between hover:bg-muted transition-colors",
                    value === option.value && "text-primary"
                  )}
                >
                  {option.label}
                  {value === option.value && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// Toggle Switch Component
function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "w-11 h-6 rounded-full relative transition-colors duration-200",
        checked ? "bg-primary" : "bg-muted"
      )}
    >
      <motion.div
        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
        animate={{ left: checked ? 24 : 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  )
}

// Profile Section
function ProfileSection({
  language,
  setLanguage,
  timezone,
  setTimezone,
}: {
  language: string
  setLanguage: (v: string) => void
  timezone: string
  setTimezone: (v: string) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Avatar */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold">
            JD
          </div>
          <div>
            <h3 className="text-foreground font-medium">Profile Photo</h3>
            <p className="text-sm text-muted-foreground mb-3">
              JPG, PNG or GIF. Max size 2MB.
            </p>
            <button className="px-4 py-2 rounded-xl border border-border text-sm text-foreground hover:bg-muted transition-colors">
              Change Avatar
            </button>
          </div>
        </div>
      </div>

      {/* Form Fields */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Display Name
            </label>
            <input
              type="text"
              defaultValue="John Doe"
              className="w-full h-12 px-4 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Email
            </label>
            <div className="relative">
              <input
                type="email"
                defaultValue="john@example.com"
                disabled
                className="w-full h-12 px-4 pr-10 rounded-xl border border-border bg-muted text-muted-foreground text-sm cursor-not-allowed"
              />
              <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Language
            </label>
            <CustomSelect
              value={language}
              options={languages}
              onChange={setLanguage}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Timezone
            </label>
            <CustomSelect
              value={timezone}
              options={timezones}
              onChange={setTimezone}
            />
          </div>
        </div>

        <button className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
          Save Changes
        </button>
      </div>
    </motion.div>
  )
}

// Preferences Section
function PreferencesSection({
  darkMode,
  setDarkMode,
  autoRefresh,
  setAutoRefresh,
  showTicker,
  setShowTicker,
  compactCards,
  setCompactCards,
}: {
  darkMode: boolean
  setDarkMode: (v: boolean) => void
  autoRefresh: boolean
  setAutoRefresh: (v: boolean) => void
  showTicker: boolean
  setShowTicker: (v: boolean) => void
  compactCards: boolean
  setCompactCards: (v: boolean) => void
}) {
  const preferences = [
    {
      title: "Dark Mode",
      description: "Switch between light and dark themes",
      checked: darkMode,
      onChange: setDarkMode,
    },
    {
      title: "Auto-refresh Data",
      description: "Automatically refresh market data every 60 seconds",
      checked: autoRefresh,
      onChange: setAutoRefresh,
    },
    {
      title: "Show Market Ticker",
      description: "Display the scrolling ticker carousel on dashboard",
      checked: showTicker,
      onChange: setShowTicker,
    },
    {
      title: "Compact News Cards",
      description: "Use smaller card layout in the news feed",
      checked: compactCards,
      onChange: setCompactCards,
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {preferences.map((pref, index) => (
        <motion.div
          key={pref.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.08 }}
          className="bg-card border border-border rounded-xl p-5 flex items-center justify-between"
        >
          <div>
            <h3 className="text-foreground font-medium">{pref.title}</h3>
            <p className="text-sm text-muted-foreground">{pref.description}</p>
          </div>
          <ToggleSwitch checked={pref.checked} onChange={pref.onChange} />
        </motion.div>
      ))}
    </motion.div>
  )
}

// Notifications Section
function NotificationsSection() {
  const [emailNotifs, setEmailNotifs] = useState(true)
  const [pushNotifs, setPushNotifs] = useState(false)
  const [priceAlerts, setPriceAlerts] = useState(true)
  const [newsAlerts, setNewsAlerts] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(true)

  const notifications = [
    {
      title: "Email Notifications",
      description: "Receive notifications via email",
      checked: emailNotifs,
      onChange: setEmailNotifs,
    },
    {
      title: "Push Notifications",
      description: "Receive push notifications in your browser",
      checked: pushNotifs,
      onChange: setPushNotifs,
    },
    {
      title: "Price Alerts",
      description: "Get notified when stocks hit your target prices",
      checked: priceAlerts,
      onChange: setPriceAlerts,
    },
    {
      title: "Breaking News Alerts",
      description: "Instant alerts for major market-moving news",
      checked: newsAlerts,
      onChange: setNewsAlerts,
    },
    {
      title: "Weekly Digest",
      description: "Receive a weekly summary of market activity",
      checked: weeklyDigest,
      onChange: setWeeklyDigest,
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {notifications.map((notif, index) => (
        <motion.div
          key={notif.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.08 }}
          className="bg-card border border-border rounded-xl p-5 flex items-center justify-between"
        >
          <div>
            <h3 className="text-foreground font-medium">{notif.title}</h3>
            <p className="text-sm text-muted-foreground">{notif.description}</p>
          </div>
          <ToggleSwitch checked={notif.checked} onChange={notif.onChange} />
        </motion.div>
      ))}
    </motion.div>
  )
}

// LLM Configuration Section
function LLMSection({
  selectedProvider,
  setSelectedProvider,
  selectedModel,
  setSelectedModel,
  costGuard,
  setCostGuard,
}: {
  selectedProvider: string
  setSelectedProvider: (v: string) => void
  selectedModel: string
  setSelectedModel: (v: string) => void
  costGuard: boolean
  setCostGuard: (v: boolean) => void
}) {
  const models = modelsByProvider[selectedProvider] || []

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Provider Selection */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-foreground font-medium mb-4">LLM Provider</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {llmProviders.map((provider) => (
            <button
              key={provider.id}
              onClick={() => {
                setSelectedProvider(provider.id)
                setSelectedModel(modelsByProvider[provider.id][0])
              }}
              className={cn(
                "p-4 rounded-xl border-2 transition-all duration-200 text-left",
                selectedProvider === provider.id
                  ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                  : "border-border hover:border-primary/40"
              )}
            >
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-foreground font-bold mb-3">
                {provider.icon}
              </div>
              <div className="text-foreground font-medium text-sm">
                {provider.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {provider.models} models
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Model Selection */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Model
          </label>
          <CustomSelect
            value={selectedModel}
            options={models.map((m) => ({ value: m, label: m }))}
            onChange={setSelectedModel}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Daily Token Limit
          </label>
          <input
            type="number"
            defaultValue={100000}
            className="w-full h-12 px-4 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Maximum tokens that can be used per day across all requests
          </p>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
          <div>
            <h4 className="text-foreground font-medium">Cost Protection</h4>
            <p className="text-sm text-muted-foreground">
              Enable cost guard to prevent exceeding budget
            </p>
          </div>
          <ToggleSwitch checked={costGuard} onChange={setCostGuard} />
        </div>
      </div>
    </motion.div>
  )
}

// API Keys Section
function APIKeysSection({
  showAddKey,
  setShowAddKey,
}: {
  showAddKey: boolean
  setShowAddKey: (v: boolean) => void
}) {
  const groupedKeys = savedApiKeys.reduce(
    (acc, key) => {
      if (!acc[key.provider]) acc[key.provider] = []
      acc[key.provider].push(key)
      return acc
    },
    {} as Record<string, typeof savedApiKeys>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {Object.entries(groupedKeys).map(([provider, keys], index) => (
        <motion.div
          key={provider}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
          className="bg-card border border-border rounded-xl overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-foreground font-medium">{provider}</span>
              <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                {keys.length} keys
              </span>
            </div>
          </div>
          <div className="divide-y divide-border">
            {keys.map((key) => (
              <div
                key={key.id}
                className="px-6 py-4 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="text-foreground font-medium text-sm">
                    {key.name}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono mt-1">
                    {key.maskedValue}
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-sm text-foreground">
                      {key.tokenLimit.toLocaleString()} tokens
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Created {key.createdAt}
                    </div>
                  </div>
                  <button className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      ))}

      {/* Add Key Button / Form */}
      <AnimatePresence mode="wait">
        {!showAddKey ? (
          <motion.button
            key="add-button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAddKey(true)}
            className="w-full p-4 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add API Key
          </motion.button>
        ) : (
          <motion.div
            key="add-form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-card border border-border rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-foreground font-medium">Add New API Key</h3>
              <button
                onClick={() => setShowAddKey(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Provider
                </label>
                <CustomSelect
                  value="anthropic"
                  options={llmProviders.map((p) => ({
                    value: p.id,
                    label: p.name,
                  }))}
                  onChange={() => {}}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Key Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Production Key"
                  className="w-full h-12 px-4 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                API Key
              </label>
              <input
                type="password"
                placeholder="sk-..."
                className="w-full h-12 px-4 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Token Limit
              </label>
              <input
                type="number"
                placeholder="100000"
                className="w-full h-12 px-4 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
                Save Key
              </button>
              <button
                onClick={() => setShowAddKey(false)}
                className="flex-1 h-12 rounded-xl border border-border text-foreground font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Security Section
function SecuritySection({
  showCurrentPw,
  setShowCurrentPw,
  showNewPw,
  setShowNewPw,
  showConfirmPw,
  setShowConfirmPw,
  showDeleteModal,
  setShowDeleteModal,
}: {
  showCurrentPw: boolean
  setShowCurrentPw: (v: boolean) => void
  showNewPw: boolean
  setShowNewPw: (v: boolean) => void
  showConfirmPw: boolean
  setShowConfirmPw: (v: boolean) => void
  showDeleteModal: boolean
  setShowDeleteModal: (v: boolean) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Change Password */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h3 className="text-foreground font-medium">Change Password</h3>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Current Password
          </label>
          <div className="relative">
            <input
              type={showCurrentPw ? "text" : "password"}
              className="w-full h-12 px-4 pr-12 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
            <button
              onClick={() => setShowCurrentPw(!showCurrentPw)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showCurrentPw ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            New Password
          </label>
          <div className="relative">
            <input
              type={showNewPw ? "text" : "password"}
              className="w-full h-12 px-4 pr-12 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
            <button
              onClick={() => setShowNewPw(!showNewPw)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showNewPw ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Confirm New Password
          </label>
          <div className="relative">
            <input
              type={showConfirmPw ? "text" : "password"}
              className="w-full h-12 px-4 pr-12 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
            <button
              onClick={() => setShowConfirmPw(!showConfirmPw)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showConfirmPw ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
        <button className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
          Update Password
        </button>
      </div>

      {/* Active Sessions */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-foreground font-medium">Active Sessions</h3>
        </div>
        <div className="divide-y divide-border">
          {activeSessions.map((session) => (
            <div
              key={session.id}
              className="px-6 py-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  {session.device === "desktop" ? (
                    <Monitor className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <Smartphone className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <div className="text-foreground text-sm font-medium flex items-center gap-2">
                    {session.browser}
                    {session.current && (
                      <span className="px-2 py-0.5 rounded-full bg-chart-1/10 text-chart-1 text-xs font-semibold">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {session.location} · {session.lastActive}
                  </div>
                </div>
              </div>
              {!session.current && (
                <button className="px-4 py-2 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors">
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Delete Account */}
      <div className="bg-card border border-destructive/30 rounded-xl p-6">
        <h3 className="text-foreground font-medium">Danger Zone</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Permanently delete your account and all associated data. This action
          cannot be undone.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="px-4 py-2 rounded-xl text-sm text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors"
        >
          Delete Account
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-foreground">
                Delete Account
              </h3>
              <p className="text-sm text-muted-foreground mt-2">
                Are you sure you want to delete your account? This will
                permanently remove all your data, watchlists, and preferences.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 h-10 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button className="flex-1 h-10 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors">
                  Delete Account
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
