# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project uses Semantic Versioning.

## [Unreleased]

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
