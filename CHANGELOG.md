# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project uses Semantic Versioning.

## [Unreleased]

### Added
- Add shared collector text/datetime utilities and a published-time item sort index.
- Add a four-column dashboard news snapshot grouped by politics, economy, finance, and macro categories.
- Add region-grouped Admin Sources columns with per-source toggles, sync actions, and market-prefilled source creation.
- Add Playwright E2E coverage with deterministic backend seeding for auth, dashboard pagination, news infinite scroll, markets, analytics, reports, settings, admin, sync, item detail, i18n, and auth guards.
- Add a source collection endpoint that queues real persisted collector runs from the Sync page.
- Add PostgreSQL-backed market candle storage for 30-minute and daily chart ranges with Redis-backed 1D and 5D one-minute candles.
- Add Beijing-time trading sessions to market-index API responses so chart axes can render in UTC+8 consistently.
- Add an independent per-market historical data refresh job with Redis cache reads decoupled from live quote refreshes.
- Add a market-index `is_fallback_data` flag so clients can distinguish generated chart data from provider data.
- Add a sidebar avatar popup for Settings, theme switching, and logout.
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
- Use source publication time for item, stats, watchlist, and admin trend time windows.
- Sort item list results by source publication time instead of collection time.
- Change the News page to list-only paginated results with multi-select category and market filters.
- Centralize collector text cleaning and datetime parsing across API, RSS, scraper, and normalization flows.
- Harden API, RSS, and normalization collectors for nested API payloads, Atom content, HTML cleanup, and broader timestamp formats.
- Complete the final clean-state validation loop and Phase 6 sign-off across backend tests, Ruff, frontend build, Playwright E2E, browser smoke checks, Docker services, Swagger docs, and health checks.
- Stabilize dashboard E2E live-indicator assertions when multiple live labels are visible.
- Expand database infrastructure tests for app-startup source seeding and clean Alembic migration verification.
- Expand middleware tests for allowed and rejected CORS preflights, quota behavior, rate limiting, and security headers.
- Expand scheduler infrastructure tests for startup registration, source execution logs, and source job add/remove behavior.
- Expand analyzer infrastructure tests for report persistence, summarization failure logging, and LLM retry exhaustion logging.
- Expand collector infrastructure tests for RSS normalization, persistence shape, deduplication, and source metadata.
- Align the health endpoint test with the shared backend TestClient fixture.
- Expand admin logs tests for source, status, date-range, combined filters, pagination, and non-admin guards.
- Expand admin LLM tests for config reads, updates, usage rollups, and non-admin guards.
- Expand admin users tests for pagination, search, role updates, deactivation, deletion, self-protection, and non-admin guards.
- Expand admin sources tests for list, create, update, preview, logs, stats, cascade delete, and non-admin guards.
- Expand admin dashboard tests with seeded stats, trend, activity, source health, and non-admin guard coverage.
- Expand user settings API tests for report/profile/retention/password sections and user-level LLM config usage.
- Add HTTP-level stats API coverage for sentiment, trending keywords, and collection freshness.
- Expand sources API tests for list shape, updates, status responses, and unauthenticated access.
- Add HTTP-level market-indices API coverage for index quote response shape and sparkline data.
- Expand reports API tests for pagination, filters, latest reports, detail responses, and admin-only generation.
- Expand watchlist API tests for CRUD, ownership, filtered items, stats, trend, and unauthenticated access.
- Add HTTP-level items API coverage for pagination, filters, formats, detail responses, and validation errors.
- Expand auth API tests across registration, login, refresh, bearer-token, and password-reset error paths.
- Replace Dashboard feed infinite scroll with numbered pagination while preserving infinite scroll on the News page.
- Update market-index tests to cover the current urllib Yahoo fetch path and Redis-first candle warmup.
- Change News to open in list view by default.
- Change Dashboard ticker sparklines to choose trading, closed, and unopened rendering states, with larger price text and currency on a second line.
- Change Dashboard and Markets multi-day market chart X-axes to continuous Beijing-time trading-day indexes so weekends and no-data days do not create visual gaps.
- Change Dashboard major market index rows into clickable controls that drive the HeroChart selection.
- Change Markets tab transitions to wait for exiting content so the summary section is not pushed down by ghost tab layouts.
- Make market-index refresh Yahoo-free by reading intraday candles from Redis and limiting Yahoo access to the candle manager.
- Read market-index 5D, 1M, 3M, and 1Y chart ranges from Redis and PostgreSQL candle storage instead of fetching Yahoo historical data during quote refreshes.
- Decouple market-index historical Redis updates into a rate-limited background scheduler and trim cached daily candles to one trading year.
- Keep live market-index polling at the 15-second active cadence while running historical refreshes independently.
- Render Dashboard and Markets chart X-axes in Beijing time across all markets.
- Redesign Dashboard Market Movers into a vertical list beside the hero chart and remove the duplicate sidebar market overview.
- Cache historical market-index daily ranges in Redis and update them incrementally instead of refetching full 1Y Yahoo data every refresh.
- Space market-index refresh requests between configured indices and reuse a bounded Yahoo HTTP client to reduce rate-limit bursts.
- Prefer Yahoo Finance with browser headers and query2 retry for market-index intraday charts, using Finnhub and Alpha Vantage as backups.
- Replace generated intraday sine-wave fallbacks with deterministic random-walk fallback data.
- Remove the redundant Settings item from the sidebar and mobile nav while keeping Settings in the avatar menu.
- Rename the English logout action from "Sign out" to "Log out".
- Switch remaining shared line/area charts to linear interpolation instead of spline smoothing.
- Increase English normal and medium utility weights so secondary labels, captions, badges, and metadata render more legibly.
- Move Hang Seng into the Asia Markets index region and remove the standalone Hong Kong group.
- Increase English body and caption-level text weight and size for better small-label readability.
- Rework Dashboard and Markets index chart X-axes around fixed intraday sessions, sliding 5D day regions, and rolling date windows.
- Increase Dashboard and Markets chart X-axis label size and weight.
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
- Remove the Markets Watchlist tab and dashboard sidebar watchlist card from the frontend.
- Remove Dashboard HeroChart previous/next arrow controls, drag-to-switch gestures, and keyboard market switching.
- Remove the standalone demo data seeding script and its demo-content tests.
- Remove the Layer 6 Alpha Vantage sentiment seed source while keeping Layer 5 collection sources active.
- Remove obsolete pre-v0 frontend components, legacy select primitives, the deprecated theme hook, and compile-excluded v0 reference pages after integration.
- Remove root Playwright verification screenshot PNG artifacts.

### Fixed
- Fix Analytics sentiment trend to use one-minute buckets with carried-forward sentiment while loading the full selected item window.
- Fix DAX quote selection so Alpha Vantage ETF prices are skipped and suspiciously tiny index quotes are discarded.
- Fix FRED release content enrichment to use readable metadata sentences and hide metadata-only raw content behind a source link.
- Fix News filters and pagination so category, market, keyword, and page state survive item-detail back navigation through URL parameters.
- Fix Analytics range queries to use precise sliding ISO timestamps for every selected time window.
- Fix the Nikkei 225 hidden 1-day chart tick so the 10:00 label is removed instead of 09:00.
- Fix FRED release collection so sparse metadata records produce summary-ready content instead of repeating the title.
- Fix Dashboard and Markets index change labels to show absolute point moves alongside percentage changes.
- Fix cluttered 1-day Asia market chart ticks for SSE Composite, Hang Seng Index, and Nikkei 225.
- Fix Analytics 24h sentiment and article-volume charts by using hourly buckets and a precise 24-hour item query window.
- Invalidate cached item list responses after successful collection and lower item cache TTL to reduce stale News results.
- Fix News multi-select filters so selecting from All starts a selection and auto-reverts only when every option is selected.
- Fix News filter resets so category and market changes scroll to the top and avoid stale paginated data.
- Scope Analytics sentiment, keyword, report, and article-volume data to the selected time range.
- Filter source sync normalization so articles older than 30 days are skipped before storage.
- Fix market-index responsiveness by returning stale cached data during refresh windows and avoiding forced scheduler refreshes when cache data is still fresh.
- Fix API rate limiting so CORS preflight requests do not consume the browser-facing request quota.
- Fix frontend login failures so invalid credentials show the localized error without triggering token refresh redirects.
- Fix frontend registration so newly created users keep the returned access token and land on their locale dashboard.
- Fix Analytics time ranges so metrics, trend buckets, and article volume respect 24h, 7D, 14D, and 30D filters.
- Fix Sync Now and Sync All so they queue persisted collection runs instead of source preview tests.
- Fix flat mini sparklines by padding constant-value Sparkline domains and include item-derived times in generated report prompts and report detail subtitles.
- Fix US-market multi-day chart bucketing so post-midnight Beijing timestamps stay on the trading session date that opened the prior evening.
- Fix fallback trending topic extraction by filtering more English function words and merging capitalized multi-word names such as `Elon Musk`.
- Fix overnight Beijing-session intraday point mapping and ticker sparkline column alignment for dashboard market rows.
- Fix Dashboard market index row sparklines to use intraday chart data, align mini charts consistently, show flat pre-open lines, and display raw ISO currency codes.
- Constrain the Dashboard major market indices column to the hero chart grid row so long ticker lists scroll inside the panel.
- Fix dashboard hero chart and major market indices panel height alignment.
- Fix dashboard hero chart X-axis labels for multi-day ranges to reduce overlap.
- Fix the dashboard market index sidebar title and stretch its panel to match the hero chart height.
- Fix market candle cold-start, end-of-day downsampling, and range reads to use the upgraded 15-minute and 60-minute intervals.
- Improve dark-mode secondary text contrast across Dashboard, Markets, and News surfaces.
- Link dashboard trending topics and stat cards to their filtered News, Analytics, and Sync destinations.
- Filter intraday candles and chart points that fall inside declared midday market breaks.
- Compress 1-day market chart axes across midday breaks and preserve merged break labels such as `11:30/13:00`.
- Make the Dashboard hero chart closed-market badge text semibold.
- Shift sidebar hover tooltips and their carets upward to align with icon centers.
- Log detailed market-index provider failures instead of silently swallowing Yahoo, Finnhub, Alpha Vantage, and Stooq request errors.
- Hide Dashboard last-updated and Live indicators until market index data has loaded and prefetch market indices during login routing.
- Anchor empty and first-tick market chart Y-axis domains to previous close or the first valid price before live data fills in.
- Fix market chart Y-axis scaling with sparkline-based domains, proportional flat-day protection, and sparse forward-fill warnings.
- Fix Dashboard and Markets chart edge-label spacing and scale Y-axis domains from visible chart data with proportional padding.
- Redirect authenticated pages to the user's stored locale before rendering locale-scoped content.
- Warn when intraday market index sparkline data is too sparse for detailed charts.
- Fix cross-locale authentication by issuing site-wide refresh cookies and redirecting login to the user's stored locale.
- Make the sidebar avatar popup opaque and align nav hover tooltips with their icons.
- Place the dashboard closed-market status dot before the badge text.
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
