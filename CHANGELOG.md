# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project uses Semantic Versioning.

## [Unreleased]

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
- Fix scheduler collection for user-owned sources by avoiding async lazy-loading during normalization.
- Fix Docker Compose config parsing without requiring a local `.env` secrets file.
- Fix the post-edit hook to use the verified `python3` backend toolchain.
