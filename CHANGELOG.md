# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project uses Semantic Versioning.

## [Unreleased]

### Added
- Add region sections and filtering to Markets index cards.
- Add compact X-axis labels to Markets index charts using the selected market chart range.
- Add range-specific historical market index sparklines for Dashboard hero chart 5D, 1M, 3M, and 1Y labels.
- Add currency labels to Markets index card prices.
- Add a bold closed-market indicator dot to dashboard hero chart status badges.
- Add previous-close values to market index API responses so frontend charts can anchor their Y-axis ranges around the prior session close.
- Add timestamped per-minute intraday market index series with Beijing-time trading sessions and real-data candle fetches.
- Add a database cleanup script that removes collected content, reports, watchlists, logs, and non-admin/test users.
- Add persisted drag-and-drop region ordering for the Markets sectors grid.
- Add route loading states for the main authenticated pages.
- Add admin LLM provider distribution and daily token budget visualizations backed by provider and model usage rollups.
- Add Markets index range controls, Korea and Taiwan index coverage, watchlist creation from Markets, and region-grouped sector sections.
- Add visible hero chart time labels, richer price tooltips, and browser-time dashboard greetings.
- Add index logo badges and currency labels to the dashboard hero market chart.
- Add v0 redesign Phase 0 foundations with shadcn-compatible UI components, next-themes, Tailwind v3 design tokens, and copied reference pages.
- Add a locale-aware v0 sidebar shell with protected routing, live auth avatar logout, and theme controls.
- Add a live-data dashboard page with market index charts, ticker cards, stats, search filters, infinite news feed, watchlist, trending keyword, and market overview panels.
- Add v0-style Markets, News, Analytics, and Sync pages wired to existing SIGMA hooks and localized route labels.
- Add complete zh/en translations for the v0 dashboard, markets, news, analytics, sync, and settings flows.
- Add mobile bottom navigation for the v0 application shell so authenticated pages remain reachable below the desktop sidebar breakpoint.
- Add a custom design-system select dropdown that matches SIGMA's dark rounded menu styling.
- Add DeepSeek, MiniMax, Kimi, and Gemini as configurable LLM providers with OpenAI-compatible backend routing.

### Changed
- Switch market index charts to linear interpolation and tighten previous-close Y-axis windows to +/- 250.
- Increase English UI body weight and small-text sizing for better global readability.
- Show neutral `0.00%` Markets index changes during pre-market clear windows.
- Return market-index responses with their `updated_at` timestamp and show the Dashboard last-updated value as exact `HH:mm:ss` time.
- Shorten market-index polling and backend cache freshness to roughly 15 seconds while any configured market is trading, and slow closed-market polling to roughly 120 seconds.
- Replace runtime demo market summaries, sector performance, watchlist trend sparklines, settings trends, analytics sentiment trends, and empty LLM provider charts with live-data-derived values or N/A states.
- Rename portfolio detail links to describe full market details in English and Chinese.
- Refine the hero chart range controls and X-axis labels with a 5D option, day-only midnight labels, lunch-gap separators, and unclipped edge labels.
- Increase the sidebar menu label weight and size for better navigation legibility.
- Redesign Markets sectors from accordions into a responsive region grid.
- Dynamically load heavy dashboard chart modules and prefetch sidebar navigation links for smoother page transitions.
- Standardize interactive control motion around spring-based transitions.
- Improve Settings form spacing, animated segmented controls, and global toggle contrast.
- Preserve v0 reference pages as compile-excluded integration references while wiring production pages to tested SIGMA hooks and i18n.
- Consolidate watchlist and report-list workflows into the new Markets and Analytics pages while preserving item and report detail routes.
- Update login, register, item detail, report detail, and settings pages from legacy `sigma-*` classes to the new design tokens.
- Move legacy item sidebar, related item, locale, settings, admin, and LLM controls onto the v0 token system and shared custom select.
- Harden Docker Compose startup with service restart policies, Postgres and Redis healthchecks, and health-gated backend dependencies.
- Redesign LLM settings into a full-width form with provider-grouped API keys and per-key token limits.
- Replace native frontend select menus with the custom dropdown across feed, settings, locale, LLM, and admin filters.

### Removed
- Remove the standalone demo data seeding script and its demo-content tests.
- Remove the Layer 6 Alpha Vantage sentiment seed source while keeping Layer 5 collection sources active.
- Remove obsolete pre-v0 frontend components, legacy select primitives, the deprecated theme hook, and compile-excluded v0 reference pages after integration.
- Remove root Playwright verification screenshot PNG artifacts.

### Fixed
- Clear dashboard and Markets chart panels during the one-hour pre-open window and anchor their Y-axis domains to previous close +/- 500 points while expanding for out-of-range intraday moves.
- Add frontend and backend warnings whenever emergency generated chart or market-index fallback data is displayed.
- Fix intraday chart axis labels for all declared multi-session market breaks so one-hour lunch gaps merge into a single clean tick.
- Fix LLM settings cache staleness and empty API key defaults when no config is returned.
- Smooth shared segmented controls with a measured sliding indicator for admin and settings tabs.
- Fix dashboard news card bookmarks with a client-side visual toggle.
- Fix global market index refresh coverage by falling back to Stooq quotes when Finnhub and Alpha Vantage do not return a symbol.
- Fix hero chart X-axis labels across lunch breaks and longer ranges while increasing edge spacing.
- Redirect Settings to the selected locale path after a successful language save.
- Reset LLM settings to empty-key defaults when no config is returned and force LLM config queries to refetch fresh data.
- Smooth segmented-control pill movement by keeping one animated indicator mounted across option changes.
- Fix market index display loading and active range selector contrast on the dashboard and Markets page.
- Fix dashboard hero chart axes so Beijing-time 30-minute ticks skip market breaks and mark cross-day boundaries.
- Fix dark-mode pie chart slice borders in Analytics.
- Fix the SIGMA sidebar logo to follow foreground color in light and dark themes.
- Rename the watchlist creation button to match its actual watchlist behavior.
- Fix admin log filter alignment, design-token colors, and date range constraints.
- Fix Sync source card settings actions so they open the Settings admin sources panel.
- Fix the v0 sidebar frosted-glass background and light-mode sidebar tokens so theme toggles update the sidebar with the rest of the app.
- Fix duplicate top-level dashboard i18n namespaces so the v0 dashboard renders localized runtime strings without `next-intl` missing-message errors.
- Fix Layer 1 UI layout consistency by normalizing shared controls to 44px touch targets, aligning inputs to h-12, and replacing raw chart colors with SIGMA design tokens.
- Fix Layer 7 scheduled task and report coverage for report markdown attribution, Redis lock TTL behavior, scheduler timing assertions, and Finnhub index quote fallbacks.
- Fix Layer 6 LLM analysis coverage for provider routing, current OpenAI-compatible base URLs, JSON summary output, retry handling, budget guards, and live usage logging.
- Fix Layer 5 collection pipeline coverage for dead external sources, Yahoo Finance mapping, collector request headers, normalizer date formats, and source/title deduplication.
- Fix Layer 3 API endpoint coverage for aggregated user settings, market indices, admin dashboard usage stats, and admin source listing.
- Add Layer 4 authentication hardening for registration tokens, workflow-style registration payloads, invalid Bearer token rejection, admin dashboard route protection, and CSP headers.
- Align shared select floating labels and selected values within the control.
- Reduce 1-day market chart X-axis label density to avoid overlapping timestamps.
- Improve market chart range dropdown layout by showing four range options per row.
- Fix production frontend Docker builds by excluding host build artifacts and macOS `node_modules` from the Docker context.

## [1.1.0] - 2026-05-19

### Added
- Add named multi-key LLM settings so users can save, rename, edit, and delete multiple API keys.
- Add a standalone demo data seed script for users, sources, items, watchlists, reports, report configs, collector logs, system config, and LLM usage logs.
- Add user-accessible LLM configuration and usage controls on the Settings page backed by authenticated `/me/llm/*` APIs.
- Add Phase 6 ItemCard variants for default, compact, and featured feed layouts.
- Add Phase 5 settings polish with data freshness status, display-only theme state, and switch-based cost guard controls.
- Add Phase 4 item detail sidebar with sentiment, keywords, more-from-source links, and horizontal related stories.
- Add Phase 3 report page refinements with reading time, sentiment bars, persisted report sentiment scores, and active table-of-contents highlighting.
- Add Phase 2 watchlist dashboard stats with match counts, sentiment, keyword trend sparklines, and keyword highlighting.
- Add Phase 1 homepage redesign with an interactive market index chart, metrics row, featured story, two-column feed, sidebar summaries, sentiment stats, and trending keyword stats.
- Add Phase 0 UI redesign foundations with shared sparklines, Apple-style toggles, shimmer skeletons, navbar theme control, ticker strip, and cached market indices API.
- Add email-verified password reset endpoints and a three-step settings modal for password changes.

### Changed
- Dim the Settings profile name field until it receives focus.
- Standardize dropdown and select controls around one shared visual style.
- Replace homepage market chart inline range buttons with a dropdown supporting 10 time ranges.
- Move admin controls into the Settings page and remove standalone admin frontend routes.
- Increase home and admin dashboard chart heights while tightening Recharts margins to reduce dead whitespace around axes.
- Refine market chart tooltip placement, compact styling, break-aware intraday axes, and vertical ticker pagination dots.
- Stabilize market chart intraday axes around fixed Beijing-time trading sessions and move ticker carousel dots inline.
- Move the market ticker from the global layout to the homepage and convert it into a pausing vertical carousel below the stats row.
- Redesign the homepage market index chart into a Google Finance-style market summary with major-index sidebar selection and currency-aware quotes.
- Update GitHub repo references after rename to SIGMA-dev and SIGMA.
- Add sliding animated segment controls across feed, reports, watchlist, and settings views.
- Consolidate settings saves into one bottom action that submits only changed sections.
- Configure the dev-to-public sync pipeline with `.sync-filter`, SIGMA_PAT-based
  mirroring, and public-repo PR auto-close protection.

## [1.0.0] - 2026-05-16

### Added
- Add polished FastAPI OpenAPI tags, route metadata, and schema examples for interactive API docs.
- Add deployment, backup, and README documentation with a dry-run-capable PostgreSQL backup script.
- Add production Dockerfiles, production Compose wiring, performance EXPLAIN checks, gzip, and dynamic chart/markdown loading for smaller frontend bundles.
- Add security hardening with restricted CORS, security headers, gzip, rate limits, JWT secret validation, and source config sanitization.
- Add end-to-end integration coverage for the complete SIGMA intelligence flow.
- Add Phase 0 harness and project bootstrap scaffold.
- Add PostgreSQL ORM models for users, sources, collected items, watchlists, reports, collector logs, system config, and LLM usage.
- Add async database session wiring and an Alembic initial schema migration.
- Add JWT registration, login, refresh, and current-user authentication routes.
- Add collection engine with API, RSS, and scraper collectors, scheduler jobs, source management APIs, item query APIs, Redis locking, deduplication, and seed sources.
- Add LLM analysis pipeline with unified Anthropic/OpenAI client, item summarization, report generation, report schedules, LLM config APIs, and token usage tracking.
- Add frontend foundation with Apple-minimalist design tokens, reusable UI components, token-refreshing API client, auth state, zh/en i18n, login/register pages, and protected application shell.
- Add frontend query hooks for items, reports, watchlists, and user settings.
- Add core frontend pages for the home feed, item detail, watchlists, reports, and settings.
- Add watchlist CRUD APIs with filtered item feeds.
- Add user profile, retention, and password settings APIs.
- Add localized trend line chart and markdown report rendering with table of contents.
- Add admin panel with guarded sidebar layout, dashboard metrics, user management, source wizard, LLM configuration, and system logs.
- Add admin APIs for dashboard stats, collection trends, recent activity, source health, user management, source previews, source logs, and collector log filtering.

### Fixed
- Fix frontend Docker builds by removing build-time Google Fonts downloads.
- Fix market index chart margins so the rightmost x-axis timestamp is not clipped.
- Fix demo seed item bodies to include short, medium, and long content lengths across markets.
- Fix market index chart tooltip density by using per-minute data while preserving sparse axis labels.
- Fix passlib bcrypt compatibility by pinning bcrypt below 4.1 to remove noisy seed/auth hashing warnings.
- Fix backend Docker images to include standalone scripts such as the demo data seeder.
- Fix market chart dash-button popovers, default auto-rotation state, and line-chart tooltip positioning.
- Fix market chart popover isolation, outside/Escape close behavior, responsive z-index positioning, and the major-indices external link.
- Fix scheduler collection for user-owned sources by avoiding async lazy-loading during normalization.
- Fix Docker Compose config parsing without requiring a local `.env` secrets file.
- Fix the post-edit hook to use the verified `python3` backend toolchain.
