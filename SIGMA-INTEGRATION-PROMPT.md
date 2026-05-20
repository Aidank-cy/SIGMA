# SIGMA Frontend Integration — Complete Redesign

You are working on the SIGMA project (root: ~/SIGMA).
Docker stack is running (sigma-postgres, sigma-redis, sigma-backend, sigma-frontend).
Backend is fully tested. Demo account: admin@sigma.demo / Admin123!

The v0 reference design is at `~/SIGMA/v0-reference/`.
Read EVERY file in that directory before starting any work.

Your job: integrate the v0 reference design into the SIGMA project, replacing all hardcoded mock data with real data from existing hooks and i18n.

---

## PHASE 0 — Preparation

### 0.1 Install missing dependencies

The v0 reference requires packages SIGMA doesn't have yet. Install them:

```bash
cd ~/SIGMA/sigma-frontend
npm install next-themes class-variance-authority clsx tailwind-merge @radix-ui/react-slot @radix-ui/react-switch @radix-ui/react-tabs @radix-ui/react-tooltip @radix-ui/react-select @radix-ui/react-progress @radix-ui/react-separator @radix-ui/react-scroll-area @radix-ui/react-dropdown-menu @radix-ui/react-dialog @radix-ui/react-popover @radix-ui/react-accordion
```

framer-motion and recharts are already installed — verify with `npm ls framer-motion recharts`.

### 0.2 Copy v0 reference into project

```bash
# Copy all v0 dashboard + market components
cp -r ~/SIGMA/v0-reference/components/dashboard/ ~/SIGMA/sigma-frontend/src/components/dashboard/
cp -r ~/SIGMA/v0-reference/components/markets/ ~/SIGMA/sigma-frontend/src/components/markets/

# Copy shadcn ui components (these replace the old custom ui components)
cp -r ~/SIGMA/v0-reference/components/ui/ ~/SIGMA/sigma-frontend/src/components/ui-shadcn/

# Copy the theme provider
cp ~/SIGMA/v0-reference/components/theme-provider.tsx ~/SIGMA/sigma-frontend/src/components/theme-provider.tsx

# Copy the v0 page files as reference (don't put them in app/ yet)
mkdir -p ~/SIGMA/sigma-frontend/src/v0-pages
cp ~/SIGMA/v0-reference/app/page.tsx ~/SIGMA/sigma-frontend/src/v0-pages/dashboard.tsx
cp ~/SIGMA/v0-reference/app/markets/page.tsx ~/SIGMA/sigma-frontend/src/v0-pages/markets.tsx
cp ~/SIGMA/v0-reference/app/news/page.tsx ~/SIGMA/sigma-frontend/src/v0-pages/news.tsx
cp ~/SIGMA/v0-reference/app/analytics/page.tsx ~/SIGMA/sigma-frontend/src/v0-pages/analytics.tsx
cp ~/SIGMA/v0-reference/app/sync/page.tsx ~/SIGMA/sigma-frontend/src/v0-pages/sync.tsx
cp ~/SIGMA/v0-reference/app/settings/page.tsx ~/SIGMA/sigma-frontend/src/v0-pages/settings.tsx

# Copy utility
cp ~/SIGMA/v0-reference/lib/utils.ts ~/SIGMA/sigma-frontend/src/lib/cn-utils.ts
```

### 0.3 Tailwind CSS compatibility

**CRITICAL**: The v0 reference uses Tailwind CSS v4 (`@import 'tailwindcss'`).
The SIGMA project uses Tailwind CSS v3 (`@tailwind base; @tailwind components; @tailwind utilities;`).

You have two options — pick ONE:

**Option A (Recommended): Keep Tailwind v3, convert CSS variables**

Replace `sigma-frontend/src/app/globals.css` with the v0 reference CSS, but convert the syntax:

```css
/* Replace @import 'tailwindcss' with: */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Remove @import 'tw-animate-css' — not available in v3 */
/* Remove @custom-variant dark line — not needed in v3 */
/* Remove @theme inline block — colors go in tailwind.config.ts instead */

/* Keep all :root and .dark CSS variable declarations as-is (oklch works in modern browsers) */
/* Keep @layer base, scrollbar styles, .frosted-glass, .hide-scrollbar, .animate-fade-in-up */
```

Then update `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: { DEFAULT: "var(--card)", foreground: "var(--card-foreground)" },
        popover: { DEFAULT: "var(--popover)", foreground: "var(--popover-foreground)" },
        primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" },
        secondary: { DEFAULT: "var(--secondary)", foreground: "var(--secondary-foreground)" },
        muted: { DEFAULT: "var(--muted)", foreground: "var(--muted-foreground)" },
        accent: { DEFAULT: "var(--accent)", foreground: "var(--accent-foreground)" },
        destructive: { DEFAULT: "var(--destructive)", foreground: "var(--destructive-foreground)" },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        "chart-1": "var(--chart-1)",
        "chart-2": "var(--chart-2)",
        "chart-3": "var(--chart-3)",
        "chart-4": "var(--chart-4)",
        "chart-5": "var(--chart-5)",
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        apple: "0 22px 70px rgba(0, 0, 0, 0.16)",
      },
      keyframes: {
        "fade-in-up": { from: { opacity: "0", transform: "translateY(20px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.5s ease-out forwards",
      },
    },
  },
  plugins: [],
};
export default config;
```

**Option B: Upgrade to Tailwind v4**

This is riskier — may break other things. Only do this if you're confident.

After choosing an option, append the old SIGMA `.report-markdown` and `@media print` styles to the new globals.css — they're still needed for report rendering.

---

## PHASE 1 — Layout & Sidebar

### 1.1 Replace Navbar with Sidebar

The v0 Sidebar is at `src/components/dashboard/sidebar.tsx`. Modify it:

**Routing**: The v0 sidebar uses flat routes (`/markets`). SIGMA uses locale routes (`/[locale]/(main)/markets`).

```tsx
// In sidebar.tsx, change:
import { useLocale } from "next-intl";

// Change navItems hrefs:
// OLD: { href: "/" }
// NEW: must be constructed dynamically with locale

// In the component:
const locale = useLocale();

const navItems = [
  { icon: LayoutDashboard, label: t("dashboard"), id: "dashboard", href: `/${locale}` },
  { icon: LineChart, label: t("markets"), id: "markets", href: `/${locale}/markets` },
  { icon: Newspaper, label: t("news"), id: "news", href: `/${locale}/news` },
  { icon: BarChart3, label: t("analytics"), id: "analytics", href: `/${locale}/analytics` },
  { icon: RefreshCw, label: t("sync"), id: "sync", href: `/${locale}/sync` },
  { icon: Settings, label: t("settings"), id: "settings", href: `/${locale}/settings` },
];
```

**Active state**: Change `getActiveId()` to handle locale prefix:
```tsx
const getActiveId = () => {
  // pathname is like "/zh/markets" or "/en"
  const pathWithoutLocale = pathname.replace(/^\/(zh|en)/, "") || "/";
  if (pathWithoutLocale === "/") return "dashboard";
  const match = navItems.find((item) => pathWithoutLocale.startsWith("/" + item.id));
  return match?.id || "dashboard";
};
```

**i18n**: Add `useTranslations("nav")` for tooltip labels.

**User avatar**: Replace hardcoded "JD" with `user?.display_name?.charAt(0)?.toUpperCase()` from `useAuth()`.

**Logout**: Add onClick handler to avatar that calls `logout()` from `useAuth()`.

**Theme toggle**: Use `next-themes` `useTheme()` (already in the v0 code).

**Use Link instead of router.push**: Replace `router.push(item.href)` with `<Link href={item.href}>` for Next.js prefetching.

### 1.2 Update main layout

Replace `src/app/[locale]/(main)/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="pl-20 transition-all duration-300">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}
```

Delete the old `Navbar.tsx` — it's fully replaced by the Sidebar.

### 1.3 Update root layout

In `src/app/[locale]/layout.tsx`, wrap children with `ThemeProvider` from `next-themes`:

```tsx
import { ThemeProvider } from "@/components/theme-provider";

// Inside the layout:
<ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
  {children}
</ThemeProvider>
```

Remove the old `useTheme` hook usage if it conflicts.

---

## PHASE 2 — Dashboard Page (Homepage)

File: `src/app/[locale]/(main)/page.tsx`

Use `v0-pages/dashboard.tsx` as the base. Key changes:

### Header
```tsx
// Replace hardcoded "Good morning, John" with:
const { user } = useAuth();
const t = useTranslations("dashboard");
// ...
<h1>{t("greeting", { name: user?.display_name })}</h1>
<p>{t("subtitle")}</p>
```

### HeroChart (`src/components/dashboard/hero-chart.tsx`)
- Replace hardcoded `marketData` with `useMarketIndices()` hook
- Map: `index.name` → market name, `index.value` → price, `index.change_pct` → change, `index.sparkline` → chart data
- If the hook returns no sparkline points, generate them from the value with random walk
- Keep all swipe/drag/animation logic unchanged

### TickerCarousel (`src/components/dashboard/ticker-carousel.tsx`)
- Replace hardcoded `tickers` with data from `useMarketIndices()`
- Map each index to: symbol, name, price, change, sparkline array

### StatsRow (`src/components/dashboard/stats-row.tsx`)
- Wire to real hooks:
  ```tsx
  const { data: todayData } = useItems({ date_from: todayStart, page_size: 1 });
  const { data: sentiment } = useSentimentStats();
  const { data: sourcesData } = useSources();
  const { data: reportsData } = useReports(undefined, 1);
  ```
- Map: Today's Articles → `todayData?.pages[0]?.total`, Market Sentiment → `sentiment?.bullish_pct`, Active Sources → active count, Latest Report → latest report time

### SearchBar (`src/components/dashboard/search-bar.tsx`)
- Replace hardcoded categories with: `["politics", "finance", "technology", "macro"]`
- Replace hardcoded markets with: `["us", "cn", "hk", "jp", "eu"]`
- Use `useTranslations("feed")` for labels: `t("categories.politics")`, `t("markets.us")`, etc.
- Wire search/filter state to parent component's filter state (pass as props)

### NewsFeed (`src/components/dashboard/news-feed.tsx`)
- Replace hardcoded `articles` with `useItems(filters)` + infinite scroll
- The v0 news cards have images — since SIGMA items don't have images:
  - Replace the `<img>` with a colored gradient div based on category
  - Politics → indigo gradient, Finance → green gradient, Technology → purple gradient, Macro → amber gradient
- Wire: `item.title`, `item.summary`, `item.source_name`, `item.published_at` → relative time, `item.category`, sentiment from `inferSentiment()`
- Add IntersectionObserver for infinite scroll (existing logic from current homepage)
- Link each card to `/${locale}/items/${item.id}`

### RightSidebar (`src/components/dashboard/right-sidebar.tsx`)
- Watchlist: wire to `useWatchlists()` → show items from first watchlist
- Trending: derive from item categories or keywords (or use sentiment stats)
- Market Overview: wire to market indices data
- "View Full Portfolio" → `<Link href={\`/${locale}/markets\`}>`

---

## PHASE 3 — New Pages

### 3.1 Markets Page

Create: `src/app/[locale]/(main)/markets/page.tsx`

Use `v0-pages/markets.tsx` as base. Key changes:
- REMOVE the `<Sidebar />` import and wrapper (sidebar is in layout now)
- REMOVE the `<div className="min-h-screen bg-background">` and `<main className="pl-20">` wrapper
- The page should just return the content starting with `<div className="p-6 lg:p-8 space-y-8">`
- Tab labels → `useTranslations("markets")` : `t("indices")`, `t("watchlist")`, `t("sectors")`
- IndicesTab: wire to `useMarketIndices()`
- WatchlistTab: wire to `useWatchlists()`
- SectorsTab: can keep mock data initially or derive from item categories

### 3.2 News Page

Create: `src/app/[locale]/(main)/news/page.tsx`

Use `v0-pages/news.tsx` as base. Key changes:
- Remove Sidebar wrapper if present
- Replace ALL hardcoded `mockArticles` with `useItems(filters)` + infinite scroll
- Replace category filter chips labels with `useTranslations("feed")`: `t("all")`, `t("categories.politics")`, etc.
- Replace market filter options with SIGMA's markets
- Keep the grid/list view toggle
- Keep the custom dropdown animation
- Wire bookmark button to watchlist add (or just visual toggle for now)
- Category gradient colors for cards (no images):
  ```
  politics → "from-indigo-600/80 via-indigo-500/60 to-indigo-400/40"
  finance → "from-emerald-600/80 via-emerald-500/60 to-emerald-400/40"
  technology → "from-purple-600/80 via-purple-500/60 to-purple-400/40"
  macro → "from-amber-500/80 via-amber-400/60 to-amber-300/40"
  ```

### 3.3 Analytics Page

Create: `src/app/[locale]/(main)/analytics/page.tsx`

Use `v0-pages/analytics.tsx` as base. Key changes:
- Remove Sidebar wrapper if present
- Sentiment Overview: wire PieChart to `useSentimentStats()` → bullish_pct, bearish_pct, neutral_pct
- Sentiment Trend: wire AreaChart to sentiment history (if available) or keep mock
- Article Volume: wire BarChart to daily item counts from `useItems()` grouped by day
- Reports section: wire to `useReports()` → map each report to a card
- "+ Generate Report" → trigger report generation API call
- Report cards link to `/${locale}/reports/${report.id}` (keep existing report detail page)

### 3.4 Sync Page

Create: `src/app/[locale]/(main)/sync/page.tsx`

Use `v0-pages/sync.tsx` as base. Key changes:
- Remove Sidebar wrapper if present
- Pipeline stats: wire to `useSources()` for active count, `useItems()` for today's total
- Data Sources grid: wire to `useSources()` → map each source to a card
- Source status: derive from `source.is_active` and last collection log
- Collection Log: wire to admin logs endpoint via `useAdmin()` hook
- "Sync Now" button: call the backend sync endpoint
- Enable/disable toggle: call source update endpoint
- NOTE: Some admin endpoints require admin role. Show the sync page to all users but disable admin-only actions for non-admin users.

### 3.5 Settings Page

Create: `src/app/[locale]/(main)/settings/page.tsx`

Use `v0-pages/settings.tsx` as base. Key changes:
- Remove Sidebar wrapper if present
- Profile section: wire to `useAuth()` for user data, `useSettings()` for preferences
- Language selector: wire to locale switching logic (existing in SIGMA)
- LLM Configuration: wire to `useLLMSettings()` hook
- Provider cards: show all 6 providers (Anthropic, OpenAI, DeepSeek, MiniMax, Kimi, Gemini)
- API Keys: wire to LLM settings API for key management
- Save: call the settings update endpoint
- Security: wire password change to auth endpoint

---

## PHASE 4 — Preserve Existing Pages

### 4.1 Item Detail Page

Keep `src/app/[locale]/(main)/items/[id]/page.tsx` — just update CSS classes from `sigma-*` to the new design tokens.

### 4.2 Report Detail Page

Keep `src/app/[locale]/(main)/reports/[id]/page.tsx` — update CSS classes. Keep the `.report-markdown` styles.

### 4.3 Login & Register Pages

Keep `src/app/[locale]/login/page.tsx` and `src/app/[locale]/register/page.tsx` — update CSS classes:
- `bg-sigma-bg` → `bg-background`
- `text-sigma-text` → `text-foreground`
- `text-sigma-muted` → `text-muted-foreground`
- `border-sigma-line` → `border-border`
- `bg-sigma-surface` → `bg-card`
- `text-sigma-accent` → `text-primary`
- Keep all form logic and auth flow unchanged

### 4.4 Remove old routes that are now consolidated

Delete these files (their content is now in the new pages):
- `src/app/[locale]/(main)/watchlist/page.tsx` → consolidated into Markets page watchlist tab
- `src/app/[locale]/(main)/reports/page.tsx` → consolidated into Analytics page reports section

Keep `src/app/[locale]/(main)/reports/[id]/page.tsx` (individual report detail).

---

## PHASE 5 — i18n

Update `sigma-frontend/messages/zh.json` and `en.json`.

Add these new keys (merge with existing, don't delete existing keys):

```json
{
  "nav": {
    "dashboard": "Dashboard / 仪表盘",
    "markets": "Markets / 市场",
    "news": "News / 新闻",
    "analytics": "Analytics / 分析",
    "sync": "Sync / 同步",
    "settings": "Settings / 设置",
    "logout": "Logout / 退出",
    "themeLight": "Light mode / 浅色模式",
    "themeDark": "Dark mode / 深色模式"
  },
  "dashboard": {
    "greeting": "Good morning, {name} / 早上好, {name}",
    "subtitle": "Here's what's happening in the markets today / 以下是今日市场动态",
    "lastUpdated": "Last updated / 最后更新",
    "live": "Live / 实时",
    "marketMovers": "Market Movers / 市场热点",
    "latestNews": "Latest News / 最新资讯",
    "viewAll": "View All / 查看全部"
  },
  "markets": {
    "title": "Markets / 市场",
    "subtitle": "Real-time market data and portfolio tracking / 实时行情与持仓跟踪",
    "indices": "Indices / 指数",
    "watchlist": "Watchlist / 关注列表",
    "sectors": "Sectors / 板块",
    "addStock": "Add Stock / 添加股票",
    "viewPortfolio": "View Full Portfolio / 查看完整持仓",
    "marketSummary": "Market Summary / 市场概览"
  },
  "analytics": {
    "title": "Analytics / 分析",
    "subtitle": "Sentiment analysis and intelligence reports / 情绪分析与情报报告",
    "sentimentOverview": "Sentiment Overview / 情绪概览",
    "sentimentTrend": "Sentiment Trend / 情绪趋势",
    "articleVolume": "Article Volume / 文章数量",
    "sourceDistribution": "Source Distribution / 来源分布",
    "reports": "Intelligence Reports / 情报报告",
    "generateReport": "Generate Report / 生成报告",
    "topKeywords": "Top Keywords / 热门关键词"
  },
  "sync": {
    "title": "Sync / 同步",
    "subtitle": "Data pipeline status and collection management / 数据管线状态与采集管理",
    "syncAll": "Sync All Now / 立即全部同步",
    "activeSources": "Active Sources / 活跃源",
    "todayCollections": "Today's Collections / 今日采集",
    "pipelineHealth": "Pipeline Health / 管线健康",
    "recentActivity": "Recent Activity / 近期活动",
    "scheduleOverview": "Schedule Overview / 计划概览",
    "syncNow": "Sync Now / 立即同步",
    "configure": "Configure / 配置"
  },
  "settings": {
    "title": "Settings / 设置",
    "subtitle": "Manage your account and platform preferences / 管理账户与平台偏好",
    "profile": "Profile / 个人资料",
    "preferences": "Preferences / 偏好设置",
    "notifications": "Notifications / 通知",
    "llm": "LLM Configuration / LLM 配置",
    "apikeys": "API Keys / API 密钥",
    "security": "Security / 安全"
  },
  "sidebar": {
    "watchlist": "Watchlist / 关注列表",
    "trending": "Trending Topics / 热门话题",
    "marketOverview": "Market Overview / 市场概览",
    "fearGreed": "Fear & Greed / 恐惧与贪婪",
    "volume": "Volume / 成交量"
  }
}
```

(The format above shows "English / 中文" — split them into their respective files.)

---

## PHASE 6 — Mobile Responsiveness

The v0 sidebar is 80px fixed — doesn't work on mobile. Add mobile handling:

1. Below `md` breakpoint: hide the sidebar (`hidden md:flex`)
2. Add a mobile top bar with hamburger menu that slides the sidebar in from the left using a Sheet/Drawer component
3. Or add a mobile bottom tab bar with the 6 nav items (simpler approach)
4. The right sidebar on dashboard is already `hidden xl:block` — that's fine

---

## PHASE 7 — Cleanup & Verify

### 7.1 Remove old files
- Delete `src/components/Navbar.tsx`
- Delete `src/components/PageTransition.tsx` (animations now handled by framer-motion in each page)
- Delete `src/components/MarketTickerCarousel.tsx` (replaced by dashboard/ticker-carousel)
- Delete `src/components/charts/MarketIndexChart.tsx` (replaced by dashboard/hero-chart)
- Delete `src/components/feed/FeaturedStory.tsx` (replaced by dashboard news)
- Delete `src/components/feed/ItemCard.tsx` (replaced by news page cards)
- Delete `src/components/sidebar/HomeSidebar.tsx` (replaced by dashboard/right-sidebar)
- Delete `src/components/ui/Select.tsx` and `CustomSelect.tsx` (replaced by search-bar's custom select)
- Delete `src/hooks/useTheme.ts` (replaced by next-themes)
- Delete `src/v0-pages/` (reference files no longer needed)

### 7.2 Build and verify

```bash
cd sigma-frontend && npm run build
```

Fix ALL TypeScript errors. Common issues:
- `cn()` import path: ensure `src/lib/cn.ts` exports the same function as v0's `lib/utils.ts`
- Missing i18n keys: add any missing translation keys
- Hook return type mismatches: adjust the data mapping

### 7.3 Visual verification

Use Playwright MCP (if available) or manually check every page:

| URL | What to verify |
|-----|----------------|
| /zh/login | Login form renders, can login |
| /zh | Dashboard: chart loads, stats show numbers, feed shows articles |
| /zh/markets | Tab switching works, indices show data |
| /zh/news | Search works, filters work, cards animate on scroll |
| /zh/analytics | Charts render, reports list loads |
| /zh/sync | Sources show status, logs load |
| /zh/settings | All sections render, save works |
| /en | Same pages in English |

Dark/light mode toggle works on every page.

---

## ABSOLUTE RULES

1. **NEVER modify** any file in `src/hooks/` — these are tested and working
2. **NEVER modify** `src/lib/api.ts` or `src/lib/auth.ts` — auth flow is tested
3. **NEVER modify** any backend code
4. **NEVER modify** `src/middleware.ts` or `src/i18n/` — locale routing is tested
5. **KEEP** `src/components/AuthProvider.tsx` and `src/components/ProtectedRoute.tsx` unchanged
6. **KEEP** the `src/app/[locale]/(main)/reports/[id]/page.tsx` detail page
7. **KEEP** the `src/app/[locale]/(main)/items/[id]/page.tsx` detail page
8. All pages MUST use `useTranslations()` for user-facing text — no hardcoded strings
9. All routes MUST use locale prefix (`/[locale]/...`)
10. Run `npm run build` after EVERY major phase — do not accumulate errors
