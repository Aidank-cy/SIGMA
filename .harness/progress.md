## Session progress

_This file is read at the start of each agent session and updated after each sub-feature._

### [Phase 0] Sub-feature 0.1: Harness scaffold
- Status: COMPLETE
- Files created: AGENTS.md, CHANGELOG.md, .harness/progress.md, .harness/session-log.md, .harness/task-template.md, .harness/plan-template.md, .harness/anti-rationalization.md, .harness/impact-map.sh, hooks/post-file-edit.sh, hooks/pre-commit.sh, skills/versioning-and-changelog/SKILL.md
- Files modified: .github/workflows/sync-to-public.yml
- Tests: PASS
- Notes: Bootstrapping missing harness files because integrity check failed at session start.
- Timestamp: 2026-05-16T03:27:52Z

### [Phase 0] Sub-feature 0.2: Application scaffold
- Status: COMPLETE
- Files created: .gitignore, .env.example, README.md, docker-compose.yml, sigma-backend/*, sigma-frontend/*
- Files modified: .gitignore, sigma-frontend/next.config.mjs, sigma-frontend/middleware.ts
- Tests: PASS
- Notes: Minimal FastAPI and Next.js foundations added with API v1 route prefix, list pagination shape, LLM context_docs hook, scheduler no-op event hooks, stable Docker service names, and i18n-only frontend strings. Verified with backend ruff, backend pytest, and frontend build.
- Timestamp: 2026-05-16T03:39:06Z

### [Phase 0] Sub-feature 0.3: CI quality gate
- Status: COMPLETE
- Files created: .github/workflows/ai-quality-gate.yml
- Files modified: .github/workflows/sync-to-public.yml
- Tests: PASS
- Notes: CI runs backend install, ruff, pytest, frontend npm ci, and frontend build. Public sync strips private harness and CI files. Harness integrity check passed.
- Timestamp: 2026-05-16T03:39:06Z

### Completed
- Phase 0 sub-features 0.1 through 0.3.

### In progress
(none yet)

### Decisions made
- Treat initial user protocol paste as Phase 0 bootstrap because no harness files exist and git has no commits.

### Next session should
1. Start Phase 1: data models and JWT authentication.

### [Phase 1] Sub-feature 1.1: User model
- Status: COMPLETE
- Files created: sigma-backend/app/models/base.py, sigma-backend/app/models/enums.py, sigma-backend/app/models/user.py
- Files modified: sigma-backend/app/models/__init__.py
- Tests: PASS
- Notes: User model uses UUID primary keys, role/locale enums, retention and active fields, and timestamp mixins.
- Timestamp: 2026-05-16T03:59:14Z

### [Phase 1] Sub-feature 1.2: DataSource model
- Status: COMPLETE
- Files created: sigma-backend/app/models/data_source.py, sigma-backend/app/models/types.py
- Files modified: sigma-backend/app/models/__init__.py
- Tests: PASS
- Notes: Source model uses enum-backed source/category/market fields and portable JSONB helpers.
- Timestamp: 2026-05-16T03:59:14Z

### [Phase 1] Sub-feature 1.3: CollectedItem model
- Status: COMPLETE
- Files created: sigma-backend/app/models/collected_item.py
- Files modified: sigma-backend/app/models/__init__.py
- Tests: PASS
- Notes: Includes machine-consumable fields, retention index targets, nullable unique content_url, metadata column, and LargeBinary embedding placeholder with reserved integration comment.
- Timestamp: 2026-05-16T03:59:14Z

### [Phase 1] Sub-feature 1.4: Remaining 6 models
- Status: COMPLETE
- Files created: sigma-backend/app/models/watchlist.py, sigma-backend/app/models/report.py, sigma-backend/app/models/user_report_config.py, sigma-backend/app/models/collector_log.py, sigma-backend/app/models/system_config.py, sigma-backend/app/models/llm_usage_log.py
- Files modified: sigma-backend/app/models/__init__.py
- Tests: PASS
- Notes: SystemConfig model supports namespaced keys such as `sigma.llm.provider`; no trading or knowledge-base feature logic added.
- Timestamp: 2026-05-16T03:59:14Z

### [Phase 1] Sub-feature 1.5: Database connection and Alembic
- Status: COMPLETE
- Files created: sigma-backend/app/database.py, sigma-backend/alembic.ini, sigma-backend/alembic/env.py, sigma-backend/alembic/script.py.mako, sigma-backend/alembic/versions/20260516_0001_initial_schema.py
- Files modified: sigma-backend/app/core/config.py, sigma-backend/app/db/__init__.py, sigma-backend/pyproject.toml
- Tests: PASS
- Notes: Alembic offline SQL generation passes. Online Alembic commands require Docker/Postgres DNS for `sigma-postgres`.
- Timestamp: 2026-05-16T03:59:14Z

### [Phase 1] Sub-feature 1.6: Auth schemas
- Status: COMPLETE
- Files created: sigma-backend/app/schemas/auth.py
- Files modified: none
- Tests: PASS
- Notes: Pydantic v2 schemas validate email, password strength, public user output, and token responses.
- Timestamp: 2026-05-16T03:59:14Z

### [Phase 1] Sub-feature 1.7: Auth service
- Status: COMPLETE
- Files created: sigma-backend/app/services/auth_service.py, sigma-backend/tests/test_auth_service.py
- Files modified: sigma-backend/pyproject.toml
- Tests: PASS
- Notes: Uses passlib bcrypt with bcrypt pinned below 5 for compatibility, plus python-jose HS256 access and refresh tokens.
- Timestamp: 2026-05-16T03:59:14Z

### [Phase 1] Sub-feature 1.8: Auth middleware
- Status: COMPLETE
- Files created: sigma-backend/app/middleware/auth.py
- Files modified: none
- Tests: PASS
- Notes: Bearer token dependency loads active users and role guard returns 403 for insufficient roles.
- Timestamp: 2026-05-16T03:59:14Z

### [Phase 1] Sub-feature 1.9: Auth API routes
- Status: COMPLETE
- Files created: sigma-backend/app/api/v1/routes/auth.py, sigma-backend/tests/conftest.py, sigma-backend/tests/test_auth.py
- Files modified: sigma-backend/app/api/v1/router.py
- Tests: PASS
- Notes: Register promotes the first user to admin, login sets refresh token cookie, refresh issues access tokens, and /me requires bearer auth.
- Timestamp: 2026-05-16T03:59:14Z

### [Phase 1] Sub-feature 1.10: Phase 1 finalization
- Status: COMPLETE
- Files created: none
- Files modified: CHANGELOG.md, .harness/progress.md, .harness/session-log.md, docker-compose.yml
- Tests: PASS
- Notes: Verified with backend ruff, backend pytest, Alembic offline SQL generation, frontend build, and docker compose config. Docker Compose now uses `.env.example` so config parsing does not require committing a local `.env`.
- Timestamp: 2026-05-16T03:59:14Z

### Completed
- Phase 1 sub-features 1.1 through 1.10.

### In progress
(none yet)

### Next session should
1. Start Phase 2: collection engine with scheduler and source management.

### [Phase 2] Sub-feature 2.1: BaseCollector and CollectedItemCreate schema
- Status: COMPLETE
- Files created: sigma-backend/app/collectors/base.py, sigma-backend/app/schemas/item.py
- Files modified: sigma-backend/app/schemas/items.py
- Tests: PASS
- Notes: Added collector ABC, standardized raw item output, and normalized collected item create schema.
- Timestamp: 2026-05-16T04:20:30Z

### [Phase 2] Sub-feature 2.2: APICollector
- Status: COMPLETE
- Files created: sigma-backend/app/collectors/api_collector.py
- Files modified: none
- Tests: PASS
- Notes: Supports JSON response path drilling, field mapping, env resolution for headers and params, and page-param pagination.
- Timestamp: 2026-05-16T04:20:30Z

### [Phase 2] Sub-feature 2.3: RSSCollector
- Status: COMPLETE
- Files created: sigma-backend/app/collectors/rss_collector.py
- Files modified: none
- Tests: PASS
- Notes: Parses RSS/Atom responses with feedparser and maps title, summary, link, and published date.
- Timestamp: 2026-05-16T04:20:30Z

### [Phase 2] Sub-feature 2.4: ScraperCollector
- Status: COMPLETE
- Files created: sigma-backend/app/collectors/scraper_collector.py
- Files modified: none
- Tests: PASS
- Notes: Uses httpx and BeautifulSoup selectors only; Playwright remains out of scope.
- Timestamp: 2026-05-16T04:20:30Z

### [Phase 2] Sub-feature 2.5: Factory, normalizer, and dedup
- Status: COMPLETE
- Files created: sigma-backend/app/collectors/factory.py, sigma-backend/app/collectors/normalizer.py, sigma-backend/app/collectors/dedup.py
- Files modified: sigma-backend/app/core/config.py
- Tests: PASS
- Notes: Normalizer computes retention-based expires_at and dedup filters URL and source/title/published duplicates.
- Timestamp: 2026-05-16T04:20:30Z

### [Phase 2] Sub-feature 2.6: Redis lock manager
- Status: COMPLETE
- Files created: sigma-backend/app/utils/redis_lock.py
- Files modified: none
- Tests: PASS
- Notes: Lock TTL is passed by scheduler as source max_execution_seconds plus 60 seconds.
- Timestamp: 2026-05-16T04:20:30Z

### [Phase 2] Sub-feature 2.7: Scheduler engine and jobs
- Status: COMPLETE
- Files created: sigma-backend/app/scheduler/engine.py, sigma-backend/app/utils/event_hooks.py
- Files modified: sigma-backend/app/scheduler/jobs.py, sigma-backend/app/scheduler/hooks.py, sigma-backend/app/main.py
- Tests: PASS
- Notes: FastAPI lifespan seeds sources, starts APScheduler, registers active source jobs, wraps collection in asyncio.wait_for, logs timeout/failure/success, and calls no-op event hooks after inserts.
- Timestamp: 2026-05-16T04:20:30Z

### [Phase 2] Sub-feature 2.8: Source CRUD API and schemas
- Status: COMPLETE
- Files created: sigma-backend/app/schemas/source.py, sigma-backend/app/api/v1/routes/sources.py, sigma-backend/app/api/v1/admin/sources.py, sigma-backend/app/api/v1/admin/__init__.py
- Files modified: sigma-backend/app/api/v1/router.py
- Tests: PASS
- Notes: User routes enforce system/owner/admin visibility, validate collector configs, manage scheduler jobs, and provide preview/status endpoints.
- Timestamp: 2026-05-16T04:20:30Z

### [Phase 2] Sub-feature 2.9: Items query API
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/app/api/v1/routes/items.py, sigma-backend/app/schemas/item.py
- Tests: PASS
- Notes: Added pagination, filters, since polling, minimal format, Redis cache with graceful fallback, detail view, and related items.
- Timestamp: 2026-05-16T04:20:30Z

### [Phase 2] Sub-feature 2.10: Seed data sources
- Status: COMPLETE
- Files created: sigma-backend/app/collectors/seeds.py
- Files modified: sigma-backend/app/main.py
- Tests: PASS
- Notes: Empty databases receive 8 MVP system sources for Yahoo Finance, Alpha Vantage, FRED, NewsAPI, Finnhub, Reuters RSS, TechCrunch RSS, and Fed announcements.
- Timestamp: 2026-05-16T04:20:30Z

### [Phase 2] Sub-feature 2.11: Phase 2 finalization
- Status: COMPLETE
- Files created: sigma-backend/tests/test_collectors.py, sigma-backend/tests/test_redis_lock.py, sigma-backend/tests/test_scheduler.py, sigma-backend/tests/test_sources_api.py, sigma-backend/tests/test_items_api.py, sigma-backend/tests/test_seeds.py
- Files modified: CHANGELOG.md, .harness/progress.md, .harness/session-log.md, hooks/post-file-edit.sh, sigma-backend/tests/conftest.py
- Tests: PASS
- Notes: Verified with `python3 -m ruff check .`, `python3 -m pytest --tb=short -q`, `npm run build`, and `./hooks/post-file-edit.sh`.
- Timestamp: 2026-05-16T04:20:30Z

### Completed
- Phase 2 sub-features 2.1 through 2.11.

### In progress
(none yet)

### Next session should
1. Start Phase 3: LLM analysis pipeline with summarizer and reports.

### [Phase 3] Sub-feature 3.1: LLM unified client
- Status: COMPLETE
- Files created: sigma-backend/app/analyzers/__init__.py, sigma-backend/app/analyzers/llm_client.py, sigma-backend/tests/test_llm_client.py
- Files modified: sigma-backend/app/core/config.py, sigma-backend/app/services/llm.py
- Tests: PASS
- Notes: Uses httpx directly for Anthropic Messages and OpenAI Chat APIs, supports context_docs injection, retries 429/5xx responses, reads sigma.llm.* SystemConfig overrides, checks the daily token budget, and writes LLMUsageLog rows.
- Timestamp: 2026-05-16T04:44:59Z

### [Phase 3] Sub-feature 3.2: Prompt templates
- Status: COMPLETE
- Files created: sigma-backend/app/analyzers/prompts.py, sigma-backend/tests/test_prompts.py
- Files modified: none
- Tests: PASS
- Notes: Added summary and report prompt renderers with locale insertion, required report sections, and 3000-character source content truncation.
- Timestamp: 2026-05-16T04:44:59Z

### [Phase 3] Sub-feature 3.3: Summarizer
- Status: COMPLETE
- Files created: sigma-backend/app/analyzers/summarizer.py, sigma-backend/tests/test_summarizer.py
- Files modified: none
- Tests: PASS
- Notes: Batch summarizer skips existing summaries, uses a concurrency semaphore, logs individual failures, and caps summary_retry_count metadata at 3.
- Timestamp: 2026-05-16T04:44:59Z

### [Phase 3] Sub-feature 3.4: Collection summarizer integration
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/app/scheduler/jobs.py, sigma-backend/tests/test_scheduler.py
- Tests: PASS
- Notes: Successful collection jobs schedule non-blocking batch_summarize after the collection transaction commits.
- Timestamp: 2026-05-16T04:44:59Z

### [Phase 3] Sub-feature 3.5: Report generator
- Status: COMPLETE
- Files created: sigma-backend/app/analyzers/report_generator.py, sigma-backend/tests/test_report_generator.py
- Files modified: none
- Tests: PASS
- Notes: Reports use a single LLM call for up to 30 items and category map-reduce for larger sets, persist Report rows, and call notify_new_report after flush.
- Timestamp: 2026-05-16T04:44:59Z

### [Phase 3] Sub-feature 3.6: Report scheduling and APIs
- Status: COMPLETE
- Files created: sigma-backend/app/api/v1/routes/reports.py, sigma-backend/app/api/v1/routes/user_settings.py, sigma-backend/app/api/v1/admin/llm.py, sigma-backend/app/schemas/report.py, sigma-backend/app/schemas/user_settings.py, sigma-backend/app/schemas/llm.py, sigma-backend/tests/test_reports_api.py
- Files modified: sigma-backend/app/api/v1/router.py, sigma-backend/app/scheduler/engine.py, sigma-backend/app/scheduler/jobs.py
- Tests: PASS
- Notes: Added report list/detail/latest/manual generation endpoints, user report config GET/PUT, admin LLM config/usage endpoints, and daily/weekly/monthly UTC report scheduler jobs.
- Timestamp: 2026-05-16T04:44:59Z

### [Phase 3] Sub-feature 3.7: Token usage tracking integration
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/app/analyzers/llm_client.py, sigma-backend/app/api/v1/admin/llm.py
- Tests: PASS
- Notes: Existing Phase 1 migration already includes llm_usage_logs, so no new Alembic migration was needed.
- Timestamp: 2026-05-16T04:44:59Z

### [Phase 3] Sub-feature 3.8: Phase 3 finalization
- Status: COMPLETE
- Files created: none
- Files modified: CHANGELOG.md, .harness/progress.md, .harness/session-log.md
- Tests: PASS
- Notes: Verified with hooks/post-file-edit.sh, backend pytest, and frontend build. Ready for Phase 3 commit.
- Timestamp: 2026-05-16T04:44:59Z

### Completed
- Phase 3 sub-features 3.1 through 3.8.

### In progress
(none yet)

### Next session should
1. Start Phase 4: frontend foundation with design system and auth pages.

### [Phase 4] Sub-feature 4.1: Design tokens and globals
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/tailwind.config.ts, sigma-frontend/src/app/globals.css
- Tests: PASS
- Notes: Added sigma.* CSS variable tokens, dark/light color schemes, category colors, Inter/Noto Sans SC stack, scrollbar styling, selection styling, global transitions, and subtle grid animation support.
- Timestamp: 2026-05-16T05:30:48Z

### [Phase 4] Sub-feature 4.2: Base UI components batch 1
- Status: COMPLETE
- Files created: sigma-frontend/src/lib/cn.ts, sigma-frontend/src/components/ui/Button.tsx, sigma-frontend/src/components/ui/Input.tsx, sigma-frontend/src/components/ui/Card.tsx, sigma-frontend/src/components/ui/Badge.tsx
- Files modified: none
- Tests: PASS
- Notes: Added button variants/loading state, floating-label input with errors, hover-lift card, and category/market badge support.
- Timestamp: 2026-05-16T05:30:48Z

### [Phase 4] Sub-feature 4.3: Base UI components batch 2
- Status: COMPLETE
- Files created: sigma-frontend/src/components/ui/Skeleton.tsx, sigma-frontend/src/components/ui/Toast.tsx, sigma-frontend/src/components/ui/Modal.tsx, sigma-frontend/src/components/ui/Tabs.tsx, sigma-frontend/src/components/Navbar.tsx
- Files modified: sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json
- Tests: PASS
- Notes: Added skeleton, localized toast provider, modal with Escape close, animated tabs, and responsive navbar with desktop top bar and mobile controls.
- Timestamp: 2026-05-16T05:30:48Z

### [Phase 4] Sub-feature 4.4: API client and auth state
- Status: COMPLETE
- Files created: sigma-frontend/src/lib/api.ts, sigma-frontend/src/lib/auth.ts, sigma-frontend/src/components/AuthProvider.tsx, sigma-frontend/src/components/ProtectedRoute.tsx
- Files modified: sigma-frontend/src/app/[locale]/layout.tsx
- Tests: PASS
- Notes: API client attaches Bearer tokens, refreshes on 401 via /api/v1/auth/refresh, clears auth and redirects on refresh failure, and provides user/login/register/logout state through React context.
- Timestamp: 2026-05-16T05:30:48Z

### [Phase 4] Sub-feature 4.5: i18n setup
- Status: COMPLETE
- Files created: sigma-frontend/src/components/LocaleSwitcher.tsx, sigma-frontend/src/middleware.ts
- Files modified: sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, sigma-frontend/src/app/[locale]/layout.tsx, sigma-frontend/src/i18n/request.ts, sigma-frontend/middleware.ts
- Tests: PASS
- Notes: Expanded zh/en messages for auth, nav, common, and dashboard text; next-intl middleware now lives under src/ so the src/app routes receive locale context, and request config uses requestLocale.
- Timestamp: 2026-05-16T05:30:48Z

### [Phase 4] Sub-feature 4.6: Login page
- Status: COMPLETE
- Files created: sigma-frontend/src/app/[locale]/login/page.tsx
- Files modified: sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json
- Tests: PASS
- Notes: Added localized dark login screen with SIGMA branding, subtle animated grid background, floating-label validation, loading state, locale switcher, register link, and error toast.
- Timestamp: 2026-05-16T05:30:48Z

### [Phase 4] Sub-feature 4.7: Register page
- Status: COMPLETE
- Files created: sigma-frontend/src/app/[locale]/register/page.tsx
- Files modified: sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json
- Tests: PASS
- Notes: Added localized registration screen with display name, email, password strength, confirm password validation, success toast, and redirect to login.
- Timestamp: 2026-05-16T05:30:48Z

### [Phase 4] Sub-feature 4.8: Authenticated layout shell
- Status: COMPLETE
- Files created: sigma-frontend/src/app/[locale]/(main)/layout.tsx, sigma-frontend/src/app/[locale]/(main)/page.tsx, sigma-frontend/src/components/PageTransition.tsx, sigma-frontend/src/components/ClientProviders.tsx
- Files modified: sigma-frontend/src/app/[locale]/page.tsx, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json
- Tests: PASS
- Notes: Replaced the public locale dashboard with a protected route-group shell, Navbar, max-w-7xl content area, framer-motion page transition, and localized welcome placeholder.
- Timestamp: 2026-05-16T05:30:48Z

### [Phase 4] Sub-feature 4.9: Phase 4 finalization
- Status: COMPLETE
- Files created: none
- Files modified: CHANGELOG.md, .harness/progress.md, .harness/session-log.md
- Tests: PASS
- Notes: Verified with `./hooks/post-file-edit.sh`, `python3 -m pytest --tb=short -q`, and live local route checks for /zh/login, /en/register, and /zh.
- Timestamp: 2026-05-16T05:30:48Z

### Completed
- Phase 4 sub-features 4.1 through 4.9.

### In progress
(none yet)

### Next session should
1. Start Phase 5: core frontend pages for feed, detail, watchlist, and reports.

### [Phase 5] Sub-feature 5.1: TanStack Query hooks
- Status: COMPLETE
- Files created: sigma-frontend/src/lib/types.ts, sigma-frontend/src/hooks/useItems.ts, sigma-frontend/src/hooks/useReports.ts, sigma-frontend/src/hooks/useWatchlists.ts, sigma-frontend/src/hooks/useSettings.ts
- Files modified: sigma-frontend/package.json, sigma-frontend/package-lock.json, sigma-frontend/src/components/ui/Badge.tsx
- Tests: PASS
- Notes: TanStack Query provider already existed from Phase 4; added typed hooks returning data/error/isLoading/mutate shape, infinite item/report/watchlist item queries, and markdown/raw-content dependencies for upcoming pages.
- Timestamp: 2026-05-16T05:48:50Z

### [Phase 5] Sub-feature 5.2: ItemCard component
- Status: COMPLETE
- Files created: sigma-frontend/src/components/feed/ItemCard.tsx
- Files modified: sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json
- Tests: PASS
- Notes: Item cards show source, category, linked title, clamped summary, market badge, relative time, hover lift, and framer-motion entrance.
- Timestamp: 2026-05-16T05:58:35Z

### [Phase 5] Sub-feature 5.3: Home feed views
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/app/[locale]/(main)/page.tsx, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json
- Tests: PASS
- Notes: Replaced the placeholder dashboard with timeline, category, and market views; timeline supports search, filters, URL query sync, skeletons, empty state, and IntersectionObserver infinite loading.
- Timestamp: 2026-05-16T05:58:35Z

### [Phase 5] Sub-feature 5.4: Item detail page
- Status: COMPLETE
- Files created: sigma-frontend/src/app/[locale]/(main)/items/[id]/page.tsx, sigma-frontend/src/components/feed/RawContent.tsx
- Files modified: sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json
- Tests: PASS
- Notes: Added breadcrumb/meta header, AI summary card, original link, DOMPurify-sanitized raw content disclosure, and related items.
- Timestamp: 2026-05-16T05:58:35Z

### [Phase 5] Sub-feature 5.5: Watchlist page and API
- Status: COMPLETE
- Files created: sigma-backend/app/api/v1/routes/watchlists.py, sigma-backend/app/schemas/watchlist.py, sigma-backend/tests/test_watchlists_api.py, sigma-frontend/src/app/[locale]/(main)/watchlist/page.tsx, sigma-frontend/src/hooks/useSources.ts
- Files modified: sigma-backend/app/api/v1/router.py, sigma-frontend/src/components/Navbar.tsx, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json
- Tests: PASS
- Notes: Added authenticated watchlist CRUD, filtered watchlist item feeds, frontend tabbed list management, create/edit modal, keyword/market/source filters, and item pagination.
- Timestamp: 2026-05-16T05:58:35Z

### [Phase 5] Sub-feature 5.6: Reports pages
- Status: COMPLETE
- Files created: sigma-frontend/src/app/[locale]/(main)/reports/page.tsx, sigma-frontend/src/app/[locale]/(main)/reports/[id]/page.tsx
- Files modified: sigma-frontend/src/app/globals.css, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json
- Tests: PASS
- Notes: Added report list filters/cards, markdown report detail with rehype-raw, sticky desktop TOC, mobile collapsible TOC, and print styling.
- Timestamp: 2026-05-16T05:58:35Z

### [Phase 5] Sub-feature 5.7: TrendLine chart and settings page
- Status: COMPLETE
- Files created: sigma-frontend/src/components/charts/TrendLine.tsx, sigma-frontend/src/app/[locale]/(main)/settings/page.tsx
- Files modified: sigma-backend/app/api/v1/routes/user_settings.py, sigma-backend/app/schemas/user_settings.py, sigma-backend/tests/test_reports_api.py, sigma-frontend/src/components/ClientProviders.tsx, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json
- Tests: PASS
- Notes: Added profile, language, retention, report config, theme, and password settings sections; added backend profile/retention/password endpoints and tests.
- Timestamp: 2026-05-16T05:58:35Z

### [Phase 5] Sub-feature 5.8: Phase 5 finalization
- Status: COMPLETE
- Files created: none
- Files modified: CHANGELOG.md, .harness/progress.md, .harness/session-log.md
- Tests: PASS
- Notes: Verified with `python3 -m ruff check .`, `python3 -m pytest --tb=short -q`, `npm run build`, and `./hooks/post-file-edit.sh`.
- Timestamp: 2026-05-16T05:58:35Z

### Completed
- Phase 5 sub-features 5.1 through 5.8.

### In progress
(none yet)

### Next session should
1. Start Phase 6: admin panel dashboard, users, sources, and LLM config.

### [Phase 6] Sub-feature 6.1: Admin layout and route guard
- Status: COMPLETE
- Files created: sigma-frontend/src/app/[locale]/admin/layout.tsx
- Files modified: sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json
- Tests: PASS
- Notes: Added admin-only route guard with toast redirect, collapsible 240px/64px desktop sidebar, mobile drawer, admin avatar, and back-to-app link.
- Timestamp: 2026-05-16T06:17:10Z

### [Phase 6] Sub-feature 6.2: Dashboard API and page
- Status: COMPLETE
- Files created: sigma-backend/app/api/v1/admin/dashboard.py, sigma-backend/app/schemas/admin.py, sigma-backend/tests/test_admin_api.py, sigma-frontend/src/app/[locale]/admin/page.tsx, sigma-frontend/src/hooks/useAdmin.ts
- Files modified: sigma-backend/app/api/v1/router.py
- Tests: PASS
- Notes: Added cached admin dashboard stats, 7-day collection trend, recent activity, source health, and a 30-second auto-refresh dashboard.
- Timestamp: 2026-05-16T06:17:10Z

### [Phase 6] Sub-feature 6.3: User management API and page
- Status: COMPLETE
- Files created: sigma-backend/app/api/v1/admin/users.py, sigma-frontend/src/app/[locale]/admin/users/page.tsx
- Files modified: sigma-backend/app/api/v1/router.py, sigma-backend/app/schemas/admin.py, sigma-backend/tests/test_admin_api.py
- Tests: PASS
- Notes: Added searchable paginated admin user list, role/status updates, self-modification guard, last-admin protection, and email confirmation deletion.
- Timestamp: 2026-05-16T06:17:10Z

### [Phase 6] Sub-feature 6.4: Source management page
- Status: COMPLETE
- Files created: sigma-frontend/src/app/[locale]/admin/sources/page.tsx
- Files modified: sigma-backend/app/api/v1/admin/sources.py, sigma-backend/app/schemas/admin.py, sigma-backend/tests/test_admin_api.py
- Tests: PASS
- Notes: Added source table, multi-step add/edit wizard, source preview before save, admin source delete, and source log drawer.
- Timestamp: 2026-05-16T06:17:10Z

### [Phase 6] Sub-feature 6.5: LLM config page
- Status: COMPLETE
- Files created: sigma-frontend/src/app/[locale]/admin/llm/page.tsx
- Files modified: sigma-backend/app/api/v1/admin/llm.py, sigma-backend/app/schemas/llm.py, sigma-frontend/src/hooks/useAdmin.ts
- Tests: PASS
- Notes: Added provider/model switching, masked key status, today/week/month usage cards, token/cost estimates, trend charts, usage-by-function chart, and cost guard toggle.
- Timestamp: 2026-05-16T06:17:10Z

### [Phase 6] Sub-feature 6.6: System logs page
- Status: COMPLETE
- Files created: sigma-backend/app/api/v1/admin/logs.py, sigma-frontend/src/app/[locale]/admin/logs/page.tsx
- Files modified: sigma-backend/app/api/v1/router.py, sigma-backend/app/schemas/admin.py
- Tests: PASS
- Notes: Added filtered collector logs API, timeline-style admin logs page, default expansion for failed logs, pagination, and success-rate footer.
- Timestamp: 2026-05-16T06:17:10Z

### [Phase 6] Sub-feature 6.7: Phase 6 finalization
- Status: COMPLETE
- Files created: none
- Files modified: CHANGELOG.md, .harness/progress.md, .harness/session-log.md
- Tests: PASS
- Notes: Verified with backend ruff, backend pytest, and frontend build. Ready for Phase 6 commit.
- Timestamp: 2026-05-16T06:17:10Z

### Completed
- Phase 6 sub-features 6.1 through 6.7.

### In progress
(none yet)

### Next session should
1. Start Phase 7: integration tests, security, deployment, and release hardening.

### [Phase 7] Sub-feature 7.1: E2E integration test
- Status: COMPLETE
- Files created: sigma-backend/tests/e2e/test_full_flow.py
- Files modified: sigma-backend/app/collectors/normalizer.py
- Tests: PASS
- Notes: Added a full admin/user intelligence flow test using real API boundaries with mocked external collector and LLM I/O. The test exposed and fixed async lazy-loading of source creator during scheduler normalization.
- Timestamp: 2026-05-16T06:31:44Z

### [Phase 7] Sub-feature 7.2: Security hardening
- Status: COMPLETE
- Files created: sigma-backend/app/middleware/security.py, sigma-backend/tests/test_security.py
- Files modified: sigma-backend/app/core/config.py, sigma-backend/app/main.py, sigma-backend/app/schemas/source.py
- Tests: PASS
- Notes: Added frontend-origin CORS, gzip, security headers, startup JWT secret length enforcement, in-process login/general rate limiting, and recursive source config script-tag sanitization.
- Timestamp: 2026-05-16T06:33:51Z

### [Phase 7] Sub-feature 7.3: Performance and production Docker
- Status: COMPLETE
- Files created: sigma-backend/Dockerfile.prod, sigma-frontend/Dockerfile.prod, docker-compose.prod.yml, scripts/performance_check.sql, sigma-frontend/src/components/reports/ReportMarkdown.tsx, sigma-frontend/src/components/charts/LLMUsageCharts.tsx
- Files modified: sigma-backend/pyproject.toml, sigma-frontend/next.config.mjs, sigma-frontend/src/app/[locale]/admin/page.tsx, sigma-frontend/src/app/[locale]/admin/llm/page.tsx, sigma-frontend/src/app/[locale]/(main)/settings/page.tsx, sigma-frontend/src/app/[locale]/(main)/reports/[id]/page.tsx
- Tests: PASS
- Notes: Production Compose parses; frontend build shows all app routes at or below 170 kB first-load JS after dynamic chart and markdown loading. Items cache remains 5 minutes and admin dashboard cache remains 1 minute.
- Timestamp: 2026-05-16T06:38:22Z

### [Phase 7] Sub-feature 7.4: Deployment, backup, and README docs
- Status: COMPLETE
- Files created: docs/deployment.md, docs/backup.md, scripts/backup.sh
- Files modified: README.md
- Tests: PASS
- Notes: Backup dry-run verified with `./scripts/backup.sh --dry-run`; docs cover Mac local Docker, Cloudflare Tunnel, backup/restore, quick start, env vars, API docs, and cost estimates.
- Timestamp: 2026-05-16T06:40:28Z

### [Phase 7] Sub-feature 7.5: FastAPI docs polish
- Status: COMPLETE
- Files created: sigma-backend/app/api/docs.py
- Files modified: sigma-backend/app/main.py, sigma-backend/app/api/v1/router.py, sigma-backend/tests/test_health.py
- Tests: PASS
- Notes: OpenAPI docs now use stable tag groups, route summaries/descriptions, and schema component descriptions/examples. Verified `/docs` and `/openapi.json` with a focused backend test.
- Timestamp: 2026-05-16T06:42:49Z

### [Phase 7] Sub-feature 7.6: Harness finalization and v1.0.0 release
- Status: COMPLETE
- Files created: none
- Files modified: AGENTS.md, CHANGELOG.md, .harness/progress.md, sigma-backend/app/core/config.py, sigma-backend/pyproject.toml, sigma-frontend/package.json, sigma-frontend/package-lock.json
- Tests: PASS
- Notes: Final AGENTS.md is 40 lines with bootstrap tags removed. CHANGELOG.md has a dated [1.0.0] section and versions are aligned to 1.0.0. Full verification passed with backend ruff, backend pytest, frontend build, and production Compose config.
- Timestamp: 2026-05-16T06:44:34Z

### Completed
- Phase 7 sub-features 7.1 through 7.6.

### In progress
(none)

### Next session should
1. Treat SIGMA v1.0.0 as complete unless the user requests post-release fixes or remote publishing.

### [Maintenance] Sub-feature M.1: Dev-to-public sync pipeline
- Status: COMPLETE
- Files created: .sync-filter, .github/workflows/sync-public.yml, .github/workflows/auto-close-pr.yml
- Files modified: AGENTS.md, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Replaced the old sync-to-public workflow with the sync-filter credential-helper pattern, SIGMA_PAT authentication, Aidank-cy/SIGMA target, and public PR auto-close workflow. Classified source, docs, examples, Compose files, and app configs as public; agent governance, harness internals, private CI, sync implementation, env files, local data, and generated caches as private.
- Timestamp: 2026-05-16T09:54:31Z

### [Maintenance] Sub-feature M.2: Frontend UI polish and password reset
- Status: COMPLETE
- Files created: sigma-frontend/src/components/ui/SegmentControl.tsx
- Files modified: sigma-frontend/src/app/[locale]/(main)/page.tsx, sigma-frontend/src/app/[locale]/(main)/reports/page.tsx, sigma-frontend/src/app/[locale]/(main)/settings/page.tsx, sigma-frontend/src/app/[locale]/(main)/watchlist/page.tsx, sigma-frontend/src/hooks/useSettings.ts, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, sigma-backend/app/api/v1/routes/auth.py, sigma-backend/app/schemas/auth.py, sigma-backend/app/services/auth_service.py, sigma-backend/tests/test_auth.py, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Added one animated segment control, replaced settings section save buttons with a single dirty-state save action, and moved password changes to Redis-backed email verification code endpoints plus a three-step modal. Verified with backend ruff, backend pytest, frontend build, and local frontend route smoke check on port 3001.
- Timestamp: 2026-05-16T10:56:22Z

### [Maintenance] Sub-feature M.3: GitHub repository rename references
- Status: COMPLETE
- Files created: none
- Files modified: .github/workflows/sync-public.yml, .sync-filter, AGENTS.md, CHANGELOG.md, .harness/progress.md, .harness/session-log.md
- Tests: NOT RUN per user instruction; verified with targeted repository-reference searches only.
- Notes: Updated private/public GitHub repository references to Aidank-cy/SIGMA-dev and Aidank-cy/SIGMA without changing local paths, service names, code identifiers, database names, environment variables, or git remotes.
- Timestamp: 2026-05-17T01:42:55Z

### [UI Redesign] Sub-feature 0: Global foundation
- Status: COMPLETE
- Files created: sigma-frontend/src/components/ui/Sparkline.tsx, sigma-frontend/src/components/ui/ToggleSwitch.tsx, sigma-frontend/src/components/MarketTickerStrip.tsx, sigma-frontend/src/hooks/useTheme.ts, sigma-frontend/src/hooks/useMarketIndices.ts, sigma-backend/app/schemas/market.py, sigma-backend/app/services/market_indices.py, sigma-backend/app/api/v1/routes/market_indices.py, sigma-backend/tests/test_market_indices.py
- Files modified: sigma-frontend/src/components/Navbar.tsx, sigma-frontend/src/components/ui/Skeleton.tsx, sigma-frontend/src/app/globals.css, sigma-frontend/tailwind.config.ts, sigma-frontend/src/app/[locale]/layout.tsx, sigma-frontend/src/app/[locale]/(main)/layout.tsx, sigma-frontend/src/app/[locale]/(main)/settings/page.tsx, sigma-frontend/src/lib/types.ts, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, sigma-backend/app/api/v1/router.py, sigma-backend/app/scheduler/engine.py, sigma-backend/app/scheduler/jobs.py, sigma-backend/tests/test_scheduler.py, CHANGELOG.md
- Tests: PASS
- Notes: Added shared UI primitives, explicit Google font loading, warning/category token refinements, navbar theme control, market ticker strip, `/api/v1/market-indices` with Redis TTL, and a scheduler refresh job gated by exchange hours. Homepage/watchlist/report/item/settings redesign phases remain pending.
- Timestamp: 2026-05-17T00:00:00Z

### [UI Redesign] Sub-feature 1: Homepage redesign
- Status: COMPLETE
- Files created: sigma-frontend/src/components/charts/MarketIndexChart.tsx, sigma-frontend/src/components/feed/FeaturedStory.tsx, sigma-frontend/src/components/feed/SentimentBadge.tsx, sigma-frontend/src/components/sidebar/HomeSidebar.tsx, sigma-frontend/src/hooks/useStats.ts, sigma-backend/app/api/v1/routes/stats.py, sigma-backend/app/schemas/stats.py, sigma-backend/tests/test_stats_api.py
- Files modified: sigma-frontend/src/app/[locale]/(main)/page.tsx, sigma-frontend/src/components/feed/ItemCard.tsx, sigma-frontend/src/hooks/useItems.ts, sigma-frontend/src/hooks/useReports.ts, sigma-frontend/src/lib/types.ts, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, sigma-backend/app/api/v1/router.py, sigma-backend/app/api/v1/routes/watchlists.py, sigma-backend/app/schemas/watchlist.py, sigma-backend/tests/test_watchlists_api.py, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Reworked the homepage into chart, stats, featured story, timeline feed, and responsive sidebar zones. Added `/api/v1/stats/sentiment` and `/api/v1/stats/trending-keywords`, plus watchlist item counts for the sidebar. Browser visual smoke was blocked because the required in-app browser Node control tool is unavailable; production build passed and the stale local dev server was stopped.
- Timestamp: 2026-05-17T05:06:43Z

### [UI Redesign] Sub-feature 2: Watchlist dashboard
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/app/api/v1/routes/watchlists.py, sigma-backend/app/schemas/watchlist.py, sigma-backend/tests/test_watchlists_api.py, sigma-frontend/src/app/[locale]/(main)/watchlist/page.tsx, sigma-frontend/src/components/feed/ItemCard.tsx, sigma-frontend/src/hooks/useWatchlists.ts, sigma-frontend/src/lib/types.ts, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Added `/api/v1/watchlists/:id/stats` and `/api/v1/watchlists/:id/trend`, watchlist dashboard metric cards, keyword-hit sparkline, and title keyword highlighting in ItemCard. Verified with backend ruff, backend pytest, frontend build, and post-edit hook.
- Timestamp: 2026-05-17T05:11:27Z

### [UI Redesign] Sub-feature 3: Reports pages
- Status: COMPLETE
- Files created: sigma-backend/alembic/versions/20260517_0002_report_sentiment_score.py, sigma-frontend/src/hooks/useActiveToc.ts
- Files modified: sigma-backend/app/models/report.py, sigma-backend/app/schemas/report.py, sigma-backend/app/analyzers/report_generator.py, sigma-backend/tests/test_report_generator.py, sigma-frontend/src/app/[locale]/(main)/reports/page.tsx, sigma-frontend/src/app/[locale]/(main)/reports/[id]/page.tsx, sigma-frontend/src/lib/types.ts, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Added persisted report sentiment scores, exposed report content and sentiment in list summaries, rendered report-card reading time and sentiment mini-bars, and added active TOC highlighting for report detail headings.
- Timestamp: 2026-05-17T05:16:27Z

### [UI Redesign] Sub-feature 4: Item detail page
- Status: COMPLETE
- Files created: sigma-frontend/src/components/feed/ItemSidebar.tsx
- Files modified: sigma-backend/app/api/v1/routes/items.py, sigma-backend/app/schemas/item.py, sigma-backend/tests/test_items_api.py, sigma-frontend/src/app/[locale]/(main)/items/[id]/page.tsx, sigma-frontend/src/hooks/useItems.ts, sigma-frontend/src/lib/types.ts, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Added item detail sentiment and keyword serialization, source filtering support in the frontend item hook, a sticky item sidebar with sentiment/keywords/more-from-source cards, and horizontal related-story cards.
- Timestamp: 2026-05-17T05:21:09Z

### [UI Redesign] Sub-feature 5: Settings polish
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/app/api/v1/routes/stats.py, sigma-backend/app/schemas/stats.py, sigma-backend/tests/test_stats_api.py, sigma-frontend/src/app/[locale]/(main)/settings/page.tsx, sigma-frontend/src/app/[locale]/admin/llm/page.tsx, sigma-frontend/src/hooks/useStats.ts, sigma-frontend/src/lib/types.ts, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Added `/api/v1/stats/last-collection`, a settings sidebar data freshness card, display-only theme status in settings, and ToggleSwitch handling for the admin LLM cost guard.
- Timestamp: 2026-05-17T05:33:37Z

### [UI Redesign] Sub-feature 6: Polish and consistency
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/components/feed/ItemCard.tsx, sigma-frontend/src/components/feed/FeaturedStory.tsx, sigma-frontend/src/components/feed/ItemSidebar.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Added default, compact, and featured ItemCard variants; routed FeaturedStory through the featured variant; and reused compact cards in the item detail sidebar. Navbar transparency on scroll was already present from the foundation slice.
- Timestamp: 2026-05-17T05:41:00Z

### [UI Redesign] Sub-feature 7: Homepage market summary chart
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/app/[locale]/(main)/layout.tsx, sigma-frontend/src/components/MarketTickerStrip.tsx, sigma-frontend/src/components/charts/MarketIndexChart.tsx, sigma-frontend/src/lib/types.ts, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, sigma-backend/app/schemas/market.py, sigma-backend/app/services/market_indices.py, sigma-backend/tests/test_market_indices.py, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Widened the main/ticker containers, rebuilt MarketIndexChart as a two-panel Google Finance-style market summary, added localized market-status popovers and Beijing-time chart labels, and extended market-index API payloads with currency codes.
- Timestamp: 2026-05-17T07:33:19Z

### [UI Redesign] Sub-feature 8: Ticker relocation, LLM settings, and QA fixes
- Status: COMPLETE
- Files created: sigma-frontend/src/components/MarketTickerCarousel.tsx, sigma-frontend/src/components/settings/LLMSettingsPanel.tsx, sigma-frontend/src/hooks/useLLMSettings.ts, sigma-backend/app/services/llm_settings.py
- Files modified: sigma-frontend/src/app/[locale]/(main)/layout.tsx, sigma-frontend/src/app/[locale]/(main)/page.tsx, sigma-frontend/src/app/[locale]/(main)/settings/page.tsx, sigma-frontend/src/app/[locale]/admin/llm/page.tsx, sigma-frontend/src/components/MarketTickerStrip.tsx, sigma-frontend/src/components/Navbar.tsx, sigma-frontend/src/components/charts/MarketIndexChart.tsx, sigma-frontend/src/hooks/useAdmin.ts, sigma-frontend/src/lib/types.ts, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, sigma-backend/app/api/v1/admin/llm.py, sigma-backend/app/api/v1/routes/user_settings.py, sigma-backend/tests/test_reports_api.py, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Moved the ticker below homepage stats as a responsive vertical carousel, exposed shared LLM settings through authenticated `/me/llm/*` endpoints and the Settings page, kept the admin LLM page in sync through a shared panel, fixed market chart popover isolation/outside-close/link behavior, and restarted the dev server after stale cache errors to confirm homepage/settings/admin LLM routes return 200.
- Timestamp: 2026-05-17T08:03:59Z

### [UI Redesign] Sub-feature 9: Chart tooltip, popover, axis, and ticker layout fixes
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/components/charts/MarketIndexChart.tsx, sigma-frontend/src/components/MarketTickerCarousel.tsx, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Re-anchored dash-button popovers to their own controls with mousedown outside-close, set chart auto-rotate off by default, forced chart tooltips to prefer the left side of the cursor, moved ticker dots inline on the right, and generated fixed Beijing-time 30-minute intraday axes from exchange trading hours.
- Timestamp: 2026-05-17T08:27:37Z

### [UI Redesign] Sub-feature 10: Tooltip side, ticker dots, and market-break axes
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/components/charts/MarketIndexChart.tsx, sigma-frontend/src/components/MarketTickerCarousel.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Switched chart tooltips to right-side instant tracking with compact styling and right-edge fallback, stacked ticker pagination dots vertically, tightened X-axis bottom spacing, and skipped SSE/HSI/N225 midday break interiors in the fixed Beijing-time intraday axis.
- Timestamp: 2026-05-17T08:49:24Z

### [Maintenance] Chart height and demo seed data
- Status: COMPLETE
- Files created: sigma-backend/scripts/seed_demo_data.py
- Files modified: sigma-frontend/src/components/charts/TrendLine.tsx, sigma-frontend/src/components/charts/MarketIndexChart.tsx, sigma-frontend/src/app/[locale]/admin/page.tsx, CHANGELOG.md, .harness/progress.md
- Tests: NOT RUN
- Notes: Increased home and admin chart heights with tighter Recharts margins; added an idempotent async demo seeder with `--clear` support for users, items, watchlists, reports, configs, logs, LLM usage, and seed sources. Verification commands were intentionally skipped per user instruction.
- Timestamp: 2026-05-17T09:33:49Z

### [Maintenance] Backend scripts in Docker images
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/Dockerfile, sigma-backend/Dockerfile.prod, CHANGELOG.md, .harness/progress.md
- Tests: NOT RUN
- Notes: Added `scripts/` to both backend Docker images so `python3 scripts/seed_demo_data.py` exists inside the running backend container after rebuild.
- Timestamp: 2026-05-18T02:04:12Z

### [Maintenance] Bcrypt compatibility pin
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/pyproject.toml, CHANGELOG.md, .harness/progress.md
- Tests: NOT RUN
- Notes: Pinned bcrypt below 4.1 so passlib 1.7.4 no longer emits the trapped `__about__` warning during password hashing in seed/auth flows after rebuilding the backend image.
- Timestamp: 2026-05-18T02:15:26Z

### [Maintenance] Demo content variety and chart tooltip precision
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/scripts/seed_demo_data.py, sigma-backend/app/services/market_indices.py, sigma-backend/tests/test_market_indices.py, sigma-backend/tests/test_seeds.py, sigma-frontend/src/components/charts/MarketIndexChart.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Added explicit short/medium/long demo item body generation with per-market coverage, expanded market-index sparklines to 480 points, generated one-minute chart data while keeping sparse axis labels, and verified backend tests plus frontend build.
- Timestamp: 2026-05-18T04:26:11Z

### [Maintenance] Market chart axis label clipping
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/components/charts/MarketIndexChart.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Added top and right chart margin so the market index chart shifts down-left and the rightmost x-axis timestamp has enough room to render.
- Timestamp: 2026-05-18T09:41:25Z

### [Maintenance] Admin controls in settings
- Status: COMPLETE
- Files created: sigma-frontend/src/components/admin/AdminSettingsSection.tsx, sigma-frontend/src/components/admin/AdminDashboardPanel.tsx, sigma-frontend/src/components/admin/AdminUsersPanel.tsx, sigma-frontend/src/components/admin/AdminSourcesPanel.tsx, sigma-frontend/src/components/admin/AdminLLMPanel.tsx, sigma-frontend/src/components/admin/AdminLogsPanel.tsx
- Files modified: sigma-frontend/src/app/[locale]/(main)/settings/page.tsx, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, CHANGELOG.md, .harness/progress.md
- Files removed: sigma-frontend/src/app/[locale]/admin/layout.tsx, sigma-frontend/src/app/[locale]/admin/page.tsx, sigma-frontend/src/app/[locale]/admin/users/page.tsx, sigma-frontend/src/app/[locale]/admin/sources/page.tsx, sigma-frontend/src/app/[locale]/admin/llm/page.tsx, sigma-frontend/src/app/[locale]/admin/logs/page.tsx
- Tests: PASS
- Notes: Moved admin dashboard, user management, source management, LLM configuration, and collector logs into a role-gated section on the Settings page; production build no longer emits `/[locale]/admin` routes.
- Timestamp: 2026-05-18T09:47:58Z

### [Maintenance] Named LLM API keys
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/app/schemas/llm.py, sigma-backend/app/services/llm_settings.py, sigma-backend/app/api/v1/routes/user_settings.py, sigma-backend/tests/test_reports_api.py, sigma-frontend/src/components/settings/LLMSettingsPanel.tsx, sigma-frontend/src/lib/types.ts, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Added user-scoped named LLM API key lists persisted through `/me/llm/config`, retained global admin key storage through `/admin/llm/config`, and exposed add/edit/rename/delete controls in the shared LLM settings panel.
- Timestamp: 2026-05-18T09:54:04Z

### [Maintenance] Market chart range dropdown
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/components/charts/MarketIndexChart.tsx, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Replaced inline market chart range buttons with a single Range dropdown and added 1D, 3D, 7D, 15D, 30D, 90D, 180D, 1Y, 5Y, and 10Y chart ranges.
- Timestamp: 2026-05-18T10:22:55Z

### [Maintenance] Standardized select controls
- Status: COMPLETE
- Files created: sigma-frontend/src/components/ui/Select.tsx
- Files modified: sigma-frontend/src/components/LocaleSwitcher.tsx, sigma-frontend/src/app/[locale]/(main)/page.tsx, sigma-frontend/src/app/[locale]/(main)/settings/page.tsx, sigma-frontend/src/components/settings/LLMSettingsPanel.tsx, sigma-frontend/src/components/admin/AdminSourcesPanel.tsx, sigma-frontend/src/components/admin/AdminLogsPanel.tsx, sigma-frontend/src/components/charts/MarketIndexChart.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Replaced scattered native select styling and local Select helpers with one shared UI Select primitive, and aligned the market chart Range dropdown with the same border, radius, spacing, and focus treatment.
- Timestamp: 2026-05-18T10:27:12Z

### [Maintenance] Profile name focus visibility
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/app/[locale]/(main)/settings/page.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Muted the Settings profile display-name input by default and restored full text color and opacity while focused or clicked for editing.
- Timestamp: 2026-05-18T10:33:08Z

### [Maintenance] Settings locale, LLM cache, and segment animation fixes
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/app/[locale]/(main)/settings/page.tsx, sigma-frontend/src/components/settings/LLMSettingsPanel.tsx, sigma-frontend/src/hooks/useLLMSettings.ts, sigma-frontend/src/hooks/useAdmin.ts, sigma-frontend/src/components/ui/SegmentControl.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Redirected Settings after locale saves, reset missing LLM config to empty-key defaults with fresh config refetches, and replaced remounting segment indicators with a single animated pill.
- Timestamp: 2026-05-21T02:20:22Z

### [Maintenance] Offline frontend font build
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/app/[locale]/layout.tsx, sigma-frontend/src/app/globals.css, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Removed `next/font/google` usage so production Docker builds no longer fetch Inter or Noto Sans SC from Google Fonts, and supplied equivalent system font stacks through CSS variables.
- Timestamp: 2026-05-18T10:41:57Z

### [Release] v1.1.0
- Status: COMPLETE
- Files created: none
- Files modified: CHANGELOG.md, sigma-backend/pyproject.toml, sigma-frontend/package.json, sigma-frontend/package-lock.json, .harness/progress.md, .harness/session-log.md
- Tests: PASS
- Notes: Promoted accumulated Unreleased UI redesign, LLM settings, demo seed, Docker, bcrypt, chart, select-control, profile focus, and offline font-build changes into the v1.1.0 release.
- Timestamp: 2026-05-19T02:04:07Z

### [Maintenance] Frontend Docker context hygiene
- Status: COMPLETE
- Files created: sigma-frontend/.dockerignore
- Files modified: CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Excluded frontend host `node_modules`, `.next`, output folders, debug logs, macOS metadata, and local env files from production Docker build context so `COPY . .` no longer overwrites Linux container dependencies with macOS-only Next.js SWC binaries. Direct Docker rebuild verification was blocked by Docker Hub token timeouts before the application build stage.
- Timestamp: 2026-05-19T02:30:19Z

### [Maintenance] Market range dropdown columns
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/components/charts/MarketIndexChart.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Increased the market chart range dropdown width to `w-56` and changed its range button grid to four columns so the ten range options render as three compact rows.
- Timestamp: 2026-05-19T02:58:59Z

### [Maintenance] Market chart X-axis label density
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/components/charts/MarketIndexChart.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Changed the market chart X-axis to preserve start/end labels with a larger tick gap and reduced generated 1-day labels from 30-minute to 60-minute cadence to prevent overlapping timestamps.
- Timestamp: 2026-05-19T05:52:59Z

### [Maintenance] Select text alignment
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/components/ui/Select.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Adjusted the shared Select value padding and floating-label top offset so labels and selected values sit evenly within the existing h-12 control.
- Timestamp: 2026-05-19T05:55:27Z

### [Maintenance] Custom select dropdown
- Status: COMPLETE
- Files created: sigma-frontend/src/components/ui/CustomSelect.tsx
- Files modified: sigma-frontend/src/app/[locale]/(main)/page.tsx, sigma-frontend/src/app/[locale]/(main)/settings/page.tsx, sigma-frontend/src/components/LocaleSwitcher.tsx, sigma-frontend/src/components/admin/AdminLogsPanel.tsx, sigma-frontend/src/components/admin/AdminSourcesPanel.tsx, sigma-frontend/src/components/settings/LLMSettingsPanel.tsx, sigma-frontend/src/components/ui/Select.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Added a React/ref-based custom dropdown with outside-click and Escape close behavior, migrated native Select usages across feed, settings, locale, LLM, and admin filters, left the native Select as a deprecated fallback, and browser-smoked the login locale dropdown on localhost.
- Timestamp: 2026-05-19T06:04:48Z

### [Maintenance] LLM provider settings redesign
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/components/settings/LLMSettingsPanel.tsx, sigma-frontend/src/lib/types.ts, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, sigma-backend/app/schemas/llm.py, sigma-backend/app/analyzers/llm_client.py, sigma-backend/app/core/config.py, CHANGELOG.md, .harness/progress.md
- Tests: PARTIAL
- Notes: Redesigned the LLM settings panel into a single full-width form, added six provider options, moved API keys to provider-grouped entries with per-key token limits, and routed DeepSeek, MiniMax, Kimi, and Gemini through OpenAI-compatible backend endpoints. Frontend build, backend ruff, and post-edit hook passed; full backend pytest has two unchanged legacy assertions expecting the old API-key response shape without provider/token_limit.
- Timestamp: 2026-05-19T06:28:00Z

### [Maintenance] Docker Compose infrastructure hardening
- Status: COMPLETE
- Files created: none
- Files modified: docker-compose.yml, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Added restart policies, Postgres and Redis healthchecks, health-gated backend dependencies, verified Docker stack startup, Alembic upgrade/check, Redis ping, env hostnames/API key presence, and backend health endpoint.
- Timestamp: 2026-05-19T10:22:34Z

### [Maintenance] Layer 4 authentication and security audit
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/app/api/v1/admin/dashboard.py, sigma-backend/app/api/v1/routes/auth.py, sigma-backend/app/middleware/security.py, sigma-backend/app/schemas/auth.py, sigma-backend/tests/test_admin_api.py, sigma-backend/tests/test_auth.py, sigma-backend/tests/test_security.py, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Executed Layer 4 from the full-stack workflow, added registration token issuance, workflow-style username alias handling, invalid Bearer token rejection, CSP headers, rate-limit security headers, and `/api/v1/admin/dashboard` protection. Verified local auth/security/admin tests and live Docker JWT, rate-limit, isolation, admin, and security-header checks.
- Timestamp: 2026-05-19T10:46:21Z

### [Maintenance] Layer 3 API endpoint audit
- Status: COMPLETE
- Files created: sigma-backend/tests/test_user_settings_api.py
- Files modified: sigma-backend/app/api/v1/admin/dashboard.py, sigma-backend/app/api/v1/admin/sources.py, sigma-backend/app/api/v1/routes/market_indices.py, sigma-backend/app/api/v1/routes/user_settings.py, sigma-backend/app/schemas/user_settings.py, sigma-backend/tests/test_llm.py, sigma-backend/tests/test_market_indices.py, sigma-backend/tests/test_reports_api.py, sigma-frontend/src/hooks/useMarketIndices.ts, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Executed Layer 3 from the full-stack workflow, expanded weak LLM coverage, added `/api/v1/me/settings` tests, fixed live endpoint failures for market indices, admin dashboard token stats, and admin source listing, then verified the full backend suite, E2E flow, Ruff, frontend build, and live Docker endpoint matrix.
- Timestamp: 2026-05-19T11:02:37Z

### [Maintenance] Layer 5 data collection pipeline audit
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/app/collectors/api_collector.py, sigma-backend/app/collectors/base.py, sigma-backend/app/collectors/dedup.py, sigma-backend/app/collectors/normalizer.py, sigma-backend/app/collectors/rss_collector.py, sigma-backend/app/collectors/seeds.py, sigma-backend/tests/test_collectors.py, sigma-backend/tests/test_seeds.py, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Executed Layer 5 from the full-stack workflow. Replaced dead Reuters and Docker-unreachable NewsAPI seed sources with working business/markets RSS feeds, reconciled the running Docker database, fixed Yahoo Finance mapping and request headers, added default API/RSS collector User-Agent headers, added normalizer coverage for ISO, Unix, human-readable, and Alpha Vantage timestamps, and changed dedup fallback to source/title identity. Live Docker collection inserted 25 new items, then the rebuilt backend image passed a final 8/8 source success smoke with no new duplicates.
- Timestamp: 2026-05-19T11:21:42Z

### [Maintenance] Layer 6 LLM analysis engine audit
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/app/analyzers/llm_client.py, sigma-backend/app/analyzers/prompts.py, sigma-backend/app/analyzers/summarizer.py, sigma-backend/app/api/v1/routes/items.py, sigma-backend/tests/e2e/test_full_flow.py, sigma-backend/tests/test_items_api.py, sigma-backend/tests/test_llm.py, sigma-backend/tests/test_prompts.py, sigma-backend/tests/test_summarizer.py, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Executed Layer 6 from the full-stack workflow. Expanded LLM tests from the 8-test baseline to 40 focused Layer 6 tests, updated MiniMax and DeepSeek base URLs against official docs, changed summarization to validate and store JSON with sentiment/summary/keywords, kept item API summaries readable for the frontend, added fenced JSON extraction, and verified retry exhaustion plus budget guard behavior. Full backend suite passed with 107 tests, post-edit hook and frontend build passed, and the rebuilt Docker backend completed a live DeepSeek summarizer smoke with valid JSON and positive token usage logged.
- Timestamp: 2026-05-19T11:37:41Z

### [Maintenance] Layer 7 scheduled tasks and reports
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/app/analyzers/prompts.py, sigma-backend/app/services/market_indices.py, sigma-backend/tests/test_scheduler.py, sigma-backend/tests/test_market_indices.py, sigma-backend/tests/test_prompts.py, sigma-backend/tests/test_redis_lock.py, CHANGELOG.md, .harness/progress.md, .harness/session-log.md
- Tests: PASS
- Notes: Executed Layer 7 from `Sigma full stack workflow en.md`; tightened report markdown prompts for sentiment analysis and source attribution, added scheduler timing and report period assertions, expanded Redis lock TTL/parallel-key checks, and fixed Finnhub SPX quote verification by scaling an ETF proxy when direct index data requires a paid subscription. Rebuilt `sigma-backend` and verified `/api/v1/health`, live Redis locks, and FINNHUB SPX quote types.
- Timestamp: 2026-05-19T11:47:28Z

### [Maintenance] Layer 1 UI layout and visual consistency audit
- Status: PARTIAL
- Files created: none
- Files modified: sigma-frontend/src/components/ui/Button.tsx, sigma-frontend/src/components/ui/Input.tsx, sigma-frontend/src/components/ui/CustomSelect.tsx, sigma-frontend/src/components/ui/SegmentControl.tsx, sigma-frontend/src/components/ui/ToggleSwitch.tsx, sigma-frontend/src/components/ui/Modal.tsx, sigma-frontend/src/components/ui/Toast.tsx, sigma-frontend/src/components/LocaleSwitcher.tsx, sigma-frontend/src/components/Navbar.tsx, sigma-frontend/src/components/MarketTickerCarousel.tsx, sigma-frontend/src/components/charts/MarketIndexChart.tsx, sigma-frontend/src/components/admin/AdminLogsPanel.tsx, sigma-frontend/src/components/admin/AdminUsersPanel.tsx, sigma-frontend/src/components/admin/AdminSourcesPanel.tsx, sigma-frontend/src/components/sidebar/HomeSidebar.tsx, sigma-frontend/src/components/feed/ItemCard.tsx, sigma-frontend/src/app/[locale]/login/page.tsx, sigma-frontend/src/app/[locale]/register/page.tsx, sigma-frontend/src/app/[locale]/(main)/settings/page.tsx, sigma-frontend/src/app/[locale]/(main)/watchlist/page.tsx, sigma-frontend/src/app/[locale]/(main)/reports/[id]/page.tsx, sigma-frontend/src/app/[locale]/(main)/items/[id]/page.tsx, CHANGELOG.md, .harness/progress.md, .harness/session-log.md
- Tests: PARTIAL
- Notes: Executed Layer 1 static fallback from `Sigma full stack workflow en.md` because Playwright MCP and Docker status checks were blocked by the environment approval limit, and the requested `frontend-design-audit` plugin is not installed in this session. Normalized shared controls and visible interactive page elements to 44px minimum targets, aligned form inputs to h-12/rounded-2xl, enlarged dropdown/menu/status/toast/admin controls, and replaced raw market chart colors with SIGMA design tokens. Verified with `./hooks/post-file-edit.sh`, frontend build, and static scans; screenshot capture remains blocked.
- Timestamp: 2026-05-19T11:56:38Z

### [UI Integration] v0 redesign phases 0-2
- Status: COMPLETE
- Files created: sigma-frontend/src/components/dashboard/*, sigma-frontend/src/components/markets/*, sigma-frontend/src/components/ui-shadcn/*, sigma-frontend/src/components/theme-provider.tsx, sigma-frontend/src/lib/cn-utils.ts, sigma-frontend/src/lib/utils.ts, sigma-frontend/src/v0-pages/*
- Files modified: sigma-frontend/package.json, sigma-frontend/package-lock.json, sigma-frontend/tailwind.config.ts, sigma-frontend/tsconfig.json, sigma-frontend/src/app/globals.css, sigma-frontend/src/app/[locale]/layout.tsx, sigma-frontend/src/app/[locale]/(main)/layout.tsx, sigma-frontend/src/app/[locale]/(main)/page.tsx, sigma-frontend/src/components/dashboard/hero-chart.tsx, sigma-frontend/src/components/dashboard/news-feed.tsx, sigma-frontend/src/components/dashboard/right-sidebar.tsx, sigma-frontend/src/components/dashboard/search-bar.tsx, sigma-frontend/src/components/dashboard/sidebar.tsx, sigma-frontend/src/components/dashboard/stats-row.tsx, sigma-frontend/src/components/dashboard/ticker-carousel.tsx, sigma-frontend/src/lib/cn.ts, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, CHANGELOG.md, .harness/progress.md
- Files deleted: sigma-frontend/src/components/Navbar.tsx
- Tests: PASS
- Notes: Executed SIGMA integration prompt phases 0, 1, and 2. Installed v0/shadcn dependencies, kept Tailwind CSS v3 with v0 CSS variables, preserved report markdown styles, copied reference pages as compile-excluded references, replaced the main shell navbar with the locale-aware v0 sidebar, wrapped locale layout with next-themes, and rebuilt the dashboard page on live SIGMA hooks with market indices, stats, search filters, infinite items, watchlists, trending keywords, and market overview data.
- Timestamp: 2026-05-20T03:41:08Z

### [UI Integration] v0 redesign phases 3-4
- Status: COMPLETE
- Files created: sigma-frontend/src/app/[locale]/(main)/markets/page.tsx, sigma-frontend/src/app/[locale]/(main)/news/page.tsx, sigma-frontend/src/app/[locale]/(main)/analytics/page.tsx, sigma-frontend/src/app/[locale]/(main)/sync/page.tsx
- Files modified: sigma-frontend/src/components/markets/indices-tab.tsx, sigma-frontend/src/components/markets/watchlist-tab.tsx, sigma-frontend/src/components/markets/sectors-tab.tsx, sigma-frontend/src/components/markets/market-summary.tsx, sigma-frontend/src/app/[locale]/(main)/settings/page.tsx, sigma-frontend/src/app/[locale]/(main)/items/[id]/page.tsx, sigma-frontend/src/app/[locale]/(main)/reports/[id]/page.tsx, sigma-frontend/src/app/[locale]/login/page.tsx, sigma-frontend/src/app/[locale]/register/page.tsx, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, CHANGELOG.md, .harness/progress.md
- Files deleted: sigma-frontend/src/app/[locale]/(main)/watchlist/page.tsx, sigma-frontend/src/app/[locale]/(main)/reports/page.tsx
- Tests: PASS
- Notes: Executed SIGMA integration prompt phases 3 and 4. Added Markets, News, Analytics, and Sync pages on real hooks and localized copy; kept Settings, item detail, report detail, login, and register flows intact while moving them to the new design tokens; consolidated watchlist and report-list routes into Markets and Analytics. Ran `npm run build` after Markets, News, Analytics, Sync, Settings/token migration, and final route consolidation.
- Timestamp: 2026-05-20T04:00:19Z

### [UI Integration] v0 redesign phases 5-7
- Status: COMPLETE
- Files created: sigma-frontend/src/components/dashboard/custom-select.tsx
- Files modified: sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, sigma-frontend/src/components/dashboard/sidebar.tsx, sigma-frontend/src/components/feed/ItemSidebar.tsx, sigma-frontend/src/app/[locale]/(main)/items/[id]/page.tsx, sigma-frontend/src/app/[locale]/(main)/settings/page.tsx, sigma-frontend/src/components/LocaleSwitcher.tsx, sigma-frontend/src/components/admin/AdminLogsPanel.tsx, sigma-frontend/src/components/admin/AdminSourcesPanel.tsx, sigma-frontend/src/components/settings/LLMSettingsPanel.tsx, CHANGELOG.md, .harness/progress.md
- Files deleted: sigma-frontend/src/components/PageTransition.tsx, sigma-frontend/src/components/MarketTickerCarousel.tsx, sigma-frontend/src/components/charts/MarketIndexChart.tsx, sigma-frontend/src/components/feed/FeaturedStory.tsx, sigma-frontend/src/components/feed/ItemCard.tsx, sigma-frontend/src/components/sidebar/HomeSidebar.tsx, sigma-frontend/src/components/ui/Select.tsx, sigma-frontend/src/components/ui/CustomSelect.tsx, sigma-frontend/src/hooks/useTheme.ts, sigma-frontend/src/v0-pages/*
- Tests: PARTIAL
- Notes: Executed SIGMA integration prompt phases 5, 6, and 7. Completed zh/en message coverage, added mobile bottom navigation below the desktop sidebar breakpoint, migrated remaining legacy select/theme/detail/sidebar usages onto v0-compatible tokens, removed obsolete pre-v0 files, and fixed duplicate dashboard message namespaces. `npm run build` passed. Playwright verified clean desktop rendering for /zh/login, /zh/register, /zh, /zh/markets, and /zh/news before the tool usage limit blocked the remaining screenshots.
- Timestamp: 2026-05-20T04:20:18Z

### [Maintenance] Root Playwright screenshot cleanup
- Status: COMPLETE
- Files created: none
- Files modified: CHANGELOG.md, .harness/progress.md
- Files deleted: sigma-zh-analytics-desktop.png, sigma-zh-dashboard-desktop-current.png, sigma-zh-dashboard-desktop-current2.png, sigma-zh-dashboard-desktop.png, sigma-zh-login-desktop-current.png, sigma-zh-login-desktop.png, sigma-zh-markets-desktop-current.png, sigma-zh-markets-desktop.png, sigma-zh-news-desktop-current.png, sigma-zh-news-desktop.png, sigma-zh-register-desktop-current.png, sigma-zh-register-desktop.png, sigma-zh-settings-desktop.png, sigma-zh-sync-desktop.png
- Tests: NOT RUN
- Notes: Removed only root-level Playwright verification screenshots with `git rm sigma-zh-*.png`; no files under v0-reference/public/ or sigma-frontend/public/ were deleted.
- Timestamp: 2026-05-20T07:45:25Z

### [Maintenance] Theme-aware sidebar glass
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/app/globals.css, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Made the v0 sidebar frosted glass and light-mode sidebar CSS variables theme-aware while preserving the existing dark-mode sidebar variables. Confirmed `sidebar.tsx` already keeps the desktop `frosted-glass` class and mobile `bg-card/95 backdrop-blur-xl` classes. Verified with the post-edit hook/frontend build and browser-computed style checks across light and dark sidebar theme toggles.
- Timestamp: 2026-05-20T07:47:26Z

### [UI Integration] Hero chart index badges and currency labels
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/components/dashboard/hero-chart.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Added symbol-based circular index badges beside hero chart index names and displayed the market currency code beside each price while preserving backend-driven market data.
- Timestamp: 2026-05-20T07:58:30Z

### [UI Integration] Hero chart time labels and timed greetings
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/components/dashboard/hero-chart.tsx, sigma-frontend/src/app/[locale]/(main)/page.tsx, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Added market-open-based X-axis time labels, a themed price tooltip with timestamp, tighter chart-to-selector spacing, hidden Y-axis lines, and browser-local time-based dashboard greeting messages.
- Timestamp: 2026-05-20T08:42:10Z

### [UI Integration] Markets range controls and regional indices
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/app/services/market_indices.py, sigma-backend/tests/test_market_indices.py, sigma-frontend/src/components/markets/indices-tab.tsx, sigma-frontend/src/components/markets/watchlist-tab.tsx, sigma-frontend/src/components/markets/sectors-tab.tsx, sigma-frontend/src/components/dashboard/hero-chart.tsx, sigma-frontend/src/components/dashboard/search-bar.tsx, sigma-frontend/src/app/[locale]/(main)/news/page.tsx, sigma-frontend/src/components/ui/Badge.tsx, sigma-frontend/src/lib/types.ts, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Added the Markets index time-range selector, KOSPI and TAIEX backend/frontend coverage, Korea and Taiwan filters/translations/icons, a functional watchlist creation dialog, and collapsible region-grouped sector mock data. Verified frontend build, market-index backend tests, Ruff checks, Docker backend rebuild, `/api/v1/health`, and live `/api/v1/market-indices` output including KOSPI and TAIEX.
- Timestamp: 2026-05-20T08:53:53Z

### [UI Integration] Sync settings routing and Settings controls
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/app/[locale]/(main)/sync/page.tsx, sigma-frontend/src/components/admin/AdminSettingsSection.tsx, sigma-frontend/src/app/[locale]/(main)/settings/page.tsx, sigma-frontend/src/components/settings/LLMSettingsPanel.tsx, sigma-frontend/src/components/dashboard/custom-select.tsx, sigma-frontend/src/components/ui/Input.tsx, sigma-frontend/src/components/ui/SegmentControl.tsx, sigma-frontend/src/components/ui/ToggleSwitch.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Routed Sync source card configure actions to the Settings admin sources panel, added stacked label spacing for Settings forms, restyled segmented controls with animated primary pill indicators, and improved global toggle contrast. Verified with frontend build and the post-edit hook.
- Timestamp: 2026-05-20T08:59:42Z

### [Maintenance] Admin LLM visualizations and log filters
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/components/settings/LLMSettingsPanel.tsx, sigma-frontend/src/components/charts/LLMUsageCharts.tsx, sigma-frontend/src/components/admin/AdminLogsPanel.tsx, sigma-frontend/src/lib/types.ts, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, sigma-backend/app/schemas/llm.py, sigma-backend/app/services/llm_settings.py, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Removed API key management from the admin LLM workspace, added provider distribution and daily token budget visualization cards, exposed provider/model in LLM usage rollups, aligned admin log filters, added date constraints, and migrated the logs panel off old sigma color classes. Verified with `./hooks/post-file-edit.sh` and `cd sigma-frontend && npm run build`.
- Timestamp: 2026-05-20T09:10:56Z

### [Maintenance] Market chart, navigation, cleanup, and sectors fixes
- Status: COMPLETE
- Files created: sigma-backend/scripts/clean_database.py, sigma-frontend/src/app/[locale]/(main)/loading.tsx, sigma-frontend/src/app/[locale]/(main)/analytics/loading.tsx, sigma-frontend/src/app/[locale]/(main)/markets/loading.tsx, sigma-frontend/src/app/[locale]/(main)/news/loading.tsx, sigma-frontend/src/app/[locale]/(main)/settings/loading.tsx, sigma-frontend/src/app/[locale]/(main)/sync/loading.tsx
- Files modified: sigma-backend/app/collectors/seeds.py, sigma-backend/app/schemas/market.py, sigma-backend/app/services/market_indices.py, sigma-backend/tests/test_market_indices.py, sigma-backend/tests/test_seeds.py, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, sigma-frontend/src/app/[locale]/(main)/analytics/page.tsx, sigma-frontend/src/app/[locale]/(main)/markets/page.tsx, sigma-frontend/src/app/[locale]/(main)/news/page.tsx, sigma-frontend/src/app/[locale]/(main)/page.tsx, sigma-frontend/src/components/dashboard/custom-select.tsx, sigma-frontend/src/components/dashboard/hero-chart.tsx, sigma-frontend/src/components/dashboard/sidebar.tsx, sigma-frontend/src/components/markets/indices-tab.tsx, sigma-frontend/src/components/markets/sectors-tab.tsx, sigma-frontend/src/components/markets/watchlist-tab.tsx, sigma-frontend/src/components/ui/SegmentControl.tsx, sigma-frontend/src/components/ui/ToggleSwitch.tsx, sigma-frontend/src/lib/types.ts, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Implemented Beijing-time timestamped per-minute market index series with real Finnhub/Alpha intraday fetches and fallback data, fixed lunch-break and cross-day hero chart axes, renamed watchlist creation, removed dark pie strokes, added dynamic dashboard chart loading and route skeletons, rebuilt sectors as a persisted drag-and-drop grid, added database cleanup, and removed the Alpha Vantage NEWS_SENTIMENT Layer 6 seed source. Verified with backend Ruff, full backend pytest, frontend build, focused market/seeds tests, and cleanup script compilation.
- Timestamp: 2026-05-21T01:32:04Z

### [Maintenance] Hero chart axis and sidebar menu polish
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/components/dashboard/hero-chart.tsx, sigma-frontend/src/components/dashboard/sidebar.tsx, sigma-frontend/src/components/markets/indices-tab.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Enlarged and bolded the sidebar MENU label, switched chart ranges from 1W to 5D in hero and indices controls, changed midnight/day-boundary ticks to day numbers, added lunch-gap axis labels, widened chart edge margins, and removed the swipe hint copy. Verified with `cd sigma-frontend && npm run build`.
- Timestamp: 2026-05-21T02:12:22Z

### [Maintenance] Market index display and selector contrast
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/hooks/useMarketIndices.ts, sigma-frontend/src/lib/types.ts, sigma-frontend/src/components/dashboard/hero-chart.tsx, sigma-frontend/src/components/markets/indices-tab.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Confirmed `/api/v1/market-indices` returns index data and backend logs show 200 responses, normalized the frontend hook for both bare-array and wrapped response shapes, replaced the hero chart's loading-time SIGMA placeholder with a skeleton, and made the hero/indices range selector active pills visible with separate layout IDs.
- Timestamp: 2026-05-21T02:16:05Z

### [Maintenance] Hero chart range-axis label fixes
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/components/dashboard/hero-chart.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Suppressed the tick immediately before same-day lunch gaps, added range-aware 5D/1M/3M/1Y X-axis ticks with intraday fallback for single-day data, and widened hero chart edge margins to reduce clipped labels. Verified with `cd sigma-frontend && npm run build`.
- Timestamp: 2026-05-21T02:58:47Z

### [Maintenance] News bookmarks, market labels, and index quote fallback
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/components/dashboard/news-feed.tsx, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, sigma-backend/app/services/market_indices.py, sigma-backend/tests/test_market_indices.py, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Added client-side visual bookmark toggles for dashboard news cards, renamed full-portfolio labels to full-details wording, confirmed market API keys are configured and the frontend route is correct, and added a Stooq quote fallback for symbols that Finnhub/Alpha Vantage do not cover. The currently running Docker backend image does not bind-mount source files, so it needs a rebuild before the new backend fallback is visible there.
- Timestamp: 2026-05-21T03:13:27Z

### [Maintenance] LLM config cache and segment control smoothness
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/hooks/useLLMSettings.ts, sigma-frontend/src/components/settings/LLMSettingsPanel.tsx, sigma-frontend/src/components/ui/SegmentControl.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Disabled stale LLM config and usage query caching, made LLM API key defaults null-safe when config is missing or empty, and replaced segmented-control indicator positioning with an offset-measured sliding indicator. Verified with `cd sigma-frontend && npm run build`.
- Timestamp: 2026-05-21T03:16:20Z

### [Maintenance] Multi-session chart axis labels
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/components/dashboard/hero-chart.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Replaced duration-only lunch-gap detection with session-boundary detection so declared multi-session markets merge break labels such as HSI 12:00/13:00 and N225 11:30/12:30 without retaining the adjacent close tick. Frontend build and post-edit hook passed; browser loaded the local app but stopped at the protected login screen without a backend session.
- Timestamp: 2026-05-21T05:24:16Z

### [Maintenance] Real-data-only runtime cleanup
- Status: COMPLETE
- Files created: none
- Files removed: sigma-backend/scripts/seed_demo_data.py
- Files modified: sigma-backend/app/services/market_indices.py, sigma-backend/tests/test_seeds.py, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, sigma-frontend/src/app/[locale]/(main)/analytics/page.tsx, sigma-frontend/src/app/[locale]/(main)/settings/page.tsx, sigma-frontend/src/components/dashboard/hero-chart.tsx, sigma-frontend/src/components/dashboard/ticker-carousel.tsx, sigma-frontend/src/components/markets/market-summary.tsx, sigma-frontend/src/components/markets/sectors-tab.tsx, sigma-frontend/src/components/markets/watchlist-tab.tsx, sigma-frontend/src/components/settings/LLMSettingsPanel.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Removed runtime demo values from market summaries, sector cards, watchlist trend sparklines, settings trend charts, analytics sentiment trends, and empty LLM provider charts; kept emergency chart/index fallbacks with console/backend warnings. API keys are present in `.env`, but live smoke tests show Finnhub returns 401 and Alpha Vantage returns informational responses instead of quote payloads. Verified backend Ruff, full backend pytest, frontend build, post-edit hook, and an escalated market-index refresh that returned quotes while warning about generated intraday fallbacks.
- Timestamp: 2026-05-21T05:41:25Z

### [Maintenance] Real-time market chart freshness
- Status: COMPLETE
- Files created: sigma-frontend/src/hooks/useMarketClock.ts, sigma-frontend/src/lib/marketSessions.ts
- Files modified: sigma-backend/app/scheduler/engine.py, sigma-backend/app/schemas/market.py, sigma-backend/app/services/market_indices.py, sigma-backend/tests/test_market_indices.py, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, sigma-frontend/src/components/dashboard/hero-chart.tsx, sigma-frontend/src/components/markets/indices-tab.tsx, sigma-frontend/src/hooks/useMarketIndices.ts, sigma-frontend/src/lib/types.ts, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Added previous-close market index payloads, active-session-aware 15-second market polling/cache freshness, 120-second closed-market polling, elapsed-only intraday fallback generation during live sessions, one-hour pre-open empty states, and previous close +/- 500 chart domains that expand for out-of-range intraday data. Confirmed LLM usage cards and charts use backend data with zero/empty states and no demo distribution fallback.
- Timestamp: 2026-05-21T05:53:26Z

### [Maintenance] Dashboard market updated timestamp
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/app/api/v1/routes/market_indices.py, sigma-backend/app/services/market_indices.py, sigma-backend/tests/test_market_indices.py, sigma-frontend/src/app/[locale]/(main)/page.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Changed `/api/v1/market-indices` to return the full market index response object including `updated_at`, made the Dashboard header render that timestamp as exact 24-hour `HH:mm:ss` time, and kept the hook compatible with legacy bare-array responses.
- Timestamp: 2026-05-21T06:04:38Z

### [Maintenance] Dashboard closed-market status indicator
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/components/dashboard/hero-chart.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Added a static 8px black dot immediately after the closed-market badge text while preserving the existing green pulsing Live indicator without an extra dot. Verified with `./hooks/post-file-edit.sh`, including the frontend production build.
- Timestamp: 2026-05-21T06:41:20Z

### [Maintenance] Markets index currency and pre-market change display
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/components/markets/indices-tab.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Added backend-provided currency labels before each Markets index card value and changed the one-hour pre-open clear window to show a neutral `0.00%` change without green/red trend styling. Verified with `./hooks/post-file-edit.sh`, including the frontend production build.
- Timestamp: 2026-05-21T06:44:09Z

### [Maintenance] Dashboard multi-range historical index labels
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/app/schemas/market.py, sigma-backend/app/services/market_indices.py, sigma-backend/tests/test_market_indices.py, sigma-frontend/src/components/dashboard/hero-chart.tsx, sigma-frontend/src/lib/types.ts, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Extended market index responses with timestamped historical sparkline ranges from Yahoo daily chart data, sliced 1Y data for 5D/1M/3M/1Y, added generated date-spanning fallbacks with warnings, and switched the Dashboard hero chart to use the selected range data so date/month X-axis labels render outside 1D. Verified with backend Ruff, focused market-index tests, and frontend production build.
- Timestamp: 2026-05-21T06:52:05Z

### [Maintenance] Markets index chart range axes
- Status: COMPLETE
- Files created: sigma-frontend/src/lib/marketChart.ts
- Files modified: sigma-frontend/src/components/dashboard/hero-chart.tsx, sigma-frontend/src/components/markets/indices-tab.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Shared Dashboard market chart range-data and axis formatting helpers with Markets, made the Markets index range selector switch chart data, and added compact X-axis labels with 3-5 ticks on each small index chart. Verified with `cd sigma-frontend && npm run build`.
- Timestamp: 2026-05-21T06:58:52Z

### [Maintenance] Markets index region grouping
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/components/markets/indices-tab.tsx, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Grouped Markets index cards into North America, Asia, Hong Kong, and Europe sections from the backend market field and added an all/region filter bar with localized labels.
- Timestamp: 2026-05-21T07:04:31Z

### [Maintenance] English global font legibility
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/app/globals.css, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Scoped English locale typography to a heavier 475 body weight, inherited form-control font weight, and raised English `.text-sm` from 14px to 15px via the CSS utility layer while leaving Chinese locale sizing unchanged. Verified with `./hooks/post-file-edit.sh`, including the frontend production build.
- Timestamp: 2026-05-21T07:08:41Z

### [Maintenance] Market chart interpolation and Y-axis range
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/components/dashboard/hero-chart.tsx, sigma-frontend/src/components/markets/indices-tab.tsx, sigma-frontend/src/lib/marketSessions.ts, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Changed Dashboard and Markets index Area charts from monotone spline smoothing to linear point-to-point rendering and tightened the default previous-close Y-axis window from +/- 500 to +/- 250. Ticker carousel sparklines already use raw SVG polylines. Verified with `./hooks/post-file-edit.sh`, including the frontend production build.
- Timestamp: 2026-05-21T07:37:12Z

### [Maintenance] Chart X-axis label legibility
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/components/dashboard/hero-chart.tsx, sigma-frontend/src/components/markets/indices-tab.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Increased Dashboard and Markets chart X-axis tick labels to 13px/600 and added bottom chart margin, tick margin, and small-card axis height so larger labels have room to render.
- Timestamp: 2026-05-21T07:39:50Z

### [Maintenance] Dashboard closed-market badge dot placement
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/components/dashboard/hero-chart.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Moved the closed-market black status dot to the left side of the Market closed label and removed the trailing dot while keeping the Live badge layout unchanged. Verified with `./hooks/post-file-edit.sh`, including the frontend production build.
- Timestamp: 2026-05-21T07:43:37Z

### [Maintenance] Market chart fixed time regions
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/lib/marketChart.ts, sigma-frontend/src/components/dashboard/hero-chart.tsx, sigma-frontend/src/components/markets/indices-tab.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Reworked shared market chart data to use fixed 1D session-minute X-axis regions, one-hour pre-open 1D clearing with labels preserved, five sliding 5D day slots, and rolling calendar windows for 1M/3M/1Y. Verified with `cd sigma-frontend && npm run build` and `./hooks/post-file-edit.sh`, including the frontend production build.
- Timestamp: 2026-05-21T07:53:42Z

### [Maintenance] Sidebar account menu and small text legibility
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/app/globals.css, sigma-frontend/src/components/dashboard/sidebar.tsx, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Raised English body text to 500 weight, enlarged English `.text-xs` captions to 13px while preserving explicit bold weights, and replaced the desktop sidebar logout/theme buttons with an animated avatar menu for Settings, theme mode, and logout. Verified with `cd sigma-frontend && npm run build` and `./hooks/post-file-edit.sh`; local dev-server browser smoke was unavailable because the stale server returned an empty response.
- Timestamp: 2026-05-21T08:04:52Z

### [Maintenance] Cross-locale auth and market/sidebar polish
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/app/api/v1/routes/auth.py, sigma-backend/app/schemas/auth.py, sigma-backend/tests/test_auth.py, sigma-frontend/src/lib/auth.ts, sigma-frontend/src/components/AuthProvider.tsx, sigma-frontend/src/app/[locale]/login/page.tsx, sigma-frontend/src/app/[locale]/register/page.tsx, sigma-frontend/src/components/markets/indices-tab.tsx, sigma-frontend/src/components/dashboard/sidebar.tsx, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Added site-wide auth refresh cookies, persisted registration locale, redirected login to the authenticated user's profile locale, confirmed next-intl middleware already respects explicit locale paths and token storage remains locale-independent, moved HSI into Asia, and made the sidebar account popup opaque with icon-aligned hover tooltips. Verified with focused backend auth tests, Ruff, frontend production build, and `./hooks/post-file-edit.sh`.
- Timestamp: 2026-05-21T08:39:02Z

### [Maintenance] Chart axis, locale sync, and English text weight
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/app/services/market_indices.py, sigma-backend/tests/test_market_indices.py, sigma-frontend/src/lib/marketSessions.ts, sigma-frontend/src/components/dashboard/hero-chart.tsx, sigma-frontend/src/components/markets/indices-tab.tsx, sigma-frontend/src/components/ProtectedRoute.tsx, sigma-frontend/src/app/globals.css, sigma-frontend/src/app/[locale]/(main)/analytics/page.tsx, sigma-frontend/src/components/charts/LLMUsageCharts.tsx, sigma-frontend/src/components/charts/TrendLine.tsx, sigma-frontend/src/components/ui/Sparkline.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Expanded Dashboard and Markets chart side margins/padding so X-axis edge labels are not clipped, kept market Area charts on linear interpolation, switched remaining shared line/area charts to linear interpolation, switched Y-axis domains to visible chart data min/max with proportional padding, logged sparse intraday series under 30 points, redirected protected routes to the user's stored locale before rendering, and raised English font-normal/font-medium utility weights. Verified with focused backend market-index tests, Ruff, frontend production build, `git diff --check`, and `./hooks/post-file-edit.sh`.
- Timestamp: 2026-05-21T08:47:15Z

### [Maintenance] Market chart Y-axis density
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/lib/marketSessions.ts, sigma-frontend/src/components/dashboard/hero-chart.tsx, sigma-frontend/src/components/markets/indices-tab.tsx, sigma-backend/app/services/market_indices.py, sigma-backend/tests/test_market_indices.py, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Replaced the legacy previous-close Y-axis helper with sparkline-data-based domain scaling that uses a 0.5% minimum range for flat sessions and 15% padding for normal movement, confirmed Dashboard and Markets Area charts render linearly, and added backend warnings when more than 30% of aligned intraday points are forward-filled. Verified with focused market-index tests, Ruff, frontend production build, `git diff --check`, and `./hooks/post-file-edit.sh`.
- Timestamp: 2026-05-21T08:59:28Z

### [Maintenance] Market chart previous-close domain fallback
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/lib/marketSessions.ts, sigma-frontend/src/components/dashboard/hero-chart.tsx, sigma-frontend/src/components/markets/indices-tab.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Renamed the chart Y-axis helper to `computeChartYDomain`, passed previous-close values from Dashboard and Markets call sites, and anchored empty/pre-market chart domains around previous close while centering one-tick charts around the first valid price. Verified with focused backend market-index tests, Ruff, frontend production build, `git diff --check`, and `./hooks/post-file-edit.sh`.
- Timestamp: 2026-05-21T09:24:46Z

### [Maintenance] Dashboard loading status and sidebar nav polish
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/app/[locale]/(main)/page.tsx, sigma-frontend/src/app/[locale]/login/page.tsx, sigma-frontend/src/components/dashboard/sidebar.tsx, sigma-frontend/src/hooks/useMarketIndices.ts, sigma-frontend/messages/en.json, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Hid Dashboard last-updated and Live indicators behind a loading skeleton until market index data exists, shared the market-indices query fetcher so login can prefetch data during successful navigation, removed the redundant Settings item from desktop/mobile sidebar navigation, changed mobile nav to five columns, and updated the English logout label to Log out while leaving Chinese and registration copy unchanged. Verified with frontend production build, `git diff --check`, `./hooks/post-file-edit.sh`, and a local in-app browser smoke check for `/en/login`.
- Timestamp: 2026-05-21T09:59:48Z

### [Maintenance] Market index real-data pipeline
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/app/services/market_indices.py, sigma-backend/app/schemas/market.py, sigma-backend/tests/test_market_indices.py, sigma-frontend/src/lib/types.ts, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Moved Yahoo Finance to the front of the intraday provider chain, added browser-like Yahoo User-Agent headers with query1/query2 retry, logged provider request failures with status/body context, replaced smooth generated sine-wave intraday fallbacks with deterministic random-walk data, and exposed `is_fallback_data` in backend and frontend market index types. Verified with focused market-index tests, backend Ruff, frontend production build, `git diff --check`, and `./hooks/post-file-edit.sh`. A live Yahoo probe from this environment reached Yahoo but returned `Too Many Requests`, so live response validation was rate-limited here.
- Timestamp: 2026-05-21T10:54:42Z

### [Maintenance] Yahoo historical cache and rate-limit control
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/app/services/market_indices.py, sigma-backend/tests/test_market_indices.py, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Added a long-lived Redis cache for historical market-index daily candles, changed 5D/1M/3M/1Y range building to read cached data and append recent completed daily candles instead of refetching full 1Y Yahoo data each refresh, capped cached history at 260 points, reused a bounded Yahoo HTTP client with existing browser headers, and spaced per-index refresh work by 600ms to reduce request bursts. Verified with focused market-index tests, backend Ruff, full backend tests, frontend production build, `git diff --check`, and `./hooks/post-file-edit.sh`.
- Timestamp: 2026-05-21T11:12:29Z

### [Maintenance] Market data pipeline and midday break chart fixes
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/app/services/market_indices.py, sigma-backend/app/scheduler/engine.py, sigma-backend/tests/test_market_indices.py, sigma-backend/tests/test_scheduler.py, sigma-frontend/src/lib/marketSessions.ts, sigma-frontend/src/lib/marketChart.ts, sigma-frontend/src/components/dashboard/hero-chart.tsx, sigma-frontend/src/components/dashboard/sidebar.tsx, sigma-frontend/src/components/markets/indices-tab.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Trimmed cached historical candles to 252 trading days, kept active market polling/scheduler cadence at 15 seconds, skipped intraday provider calls for closed markets, filtered raw intraday candles inside lunch breaks, compressed 1D chart axes across declared session breaks with merged boundary labels, bolded the Dashboard closed-market badge text, and shifted sidebar hover tooltips upward. Verified with backend Ruff, focused market-index tests, full backend tests, and frontend production build.
- Timestamp: 2026-05-21T11:48:00Z

### [Maintenance] Beijing-time charts and dashboard navigation polish
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/app/schemas/market.py, sigma-backend/app/services/market_indices.py, sigma-backend/app/scheduler/engine.py, sigma-backend/app/scheduler/jobs.py, sigma-backend/tests/test_market_indices.py, sigma-backend/tests/test_scheduler.py, sigma-frontend/src/lib/types.ts, sigma-frontend/src/lib/marketChart.ts, sigma-frontend/src/lib/marketSessions.ts, sigma-frontend/src/app/globals.css, sigma-frontend/src/app/[locale]/(main)/page.tsx, sigma-frontend/src/app/[locale]/(main)/news/page.tsx, sigma-frontend/src/app/[locale]/(main)/analytics/page.tsx, sigma-frontend/src/app/[locale]/(main)/markets/page.tsx, sigma-frontend/src/app/[locale]/(main)/settings/page.tsx, sigma-frontend/src/app/[locale]/(main)/sync/page.tsx, sigma-frontend/src/components/dashboard/hero-chart.tsx, sigma-frontend/src/components/dashboard/news-feed.tsx, sigma-frontend/src/components/dashboard/right-sidebar.tsx, sigma-frontend/src/components/dashboard/stats-row.tsx, sigma-frontend/src/components/dashboard/ticker-carousel.tsx, sigma-frontend/src/components/markets/indices-tab.tsx, sigma-frontend/src/components/markets/market-summary.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Added Beijing-session API fields, rendered market chart axes in Asia/Shanghai, moved historical Yahoo range fetching into an independent per-market scheduler job, kept live market refresh cadence at 15 seconds, improved dark-mode secondary text contrast across dashboard and top-level page captions, redesigned Market Movers as a vertical dashboard column, removed the sidebar market overview, and wired trending topics/stat cards to filtered destinations. Verified with frontend production build, backend Ruff via python3, focused backend market/scheduler tests, `git diff --check`, and `./hooks/post-file-edit.sh`.
- Timestamp: 2026-05-21T13:02:43Z

### [Maintenance] Beijing-time candles and dense chart ranges
- Status: COMPLETE
- Files created: sigma-backend/app/models/market_candle.py, sigma-backend/app/services/market_candles.py, sigma-backend/alembic/versions/20260522_0003_market_candles.py
- Files modified: sigma-backend/app/models/__init__.py, sigma-backend/app/scheduler/engine.py, sigma-backend/app/scheduler/jobs.py, sigma-backend/app/services/market_indices.py, sigma-backend/tests/test_market_indices.py, sigma-backend/tests/test_scheduler.py, sigma-frontend/src/lib/marketChart.ts, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Replaced Redis-only historical daily cache code with Redis 1D/5D one-minute candles plus PostgreSQL 30m/1d candles, registered the new candle refresh scheduler job, kept market-index historical range reads storage-only, and updated frontend range chart math for dense Beijing-time 5D/1M data.
- Timestamp: 2026-05-22T01:51:15Z

### [Maintenance] Yahoo-free market-index refresh
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/app/services/market_indices.py, sigma-backend/tests/test_market_indices.py, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Removed Yahoo quote and intraday calls from `_build_index`, added Redis candle quote/intraday fallbacks, kept Yahoo access behind the candle manager, added global Yahoo one-at-a-time rate limiting with 429 exponential backoff, and covered the Yahoo-free refresh path with focused tests.
- Timestamp: 2026-05-22T02:19:14Z

### [Maintenance] Market candle interval migration
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/app/services/market_candles.py, sigma-backend/app/services/market_indices.py, sigma-backend/tests/test_market_indices.py, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Migrated PostgreSQL market candle cold-start, completion detection, end-of-day downsampling, and range reads from legacy 1d/30m intervals to 60m/15m. Also fixed the closed-market cold-start batch path, which still referenced the old intervals locally despite the prompt noting it was already migrated.
- Follow-ups: Run the production Alembic migration before deployment and truncate old `market_candles` rows if stale 1d/30m data should be discarded.
- Timestamp: 2026-05-22T02:54:21Z

### [Maintenance] Dashboard major market indices panel
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, sigma-frontend/src/app/[locale]/(main)/page.tsx, sigma-frontend/src/components/dashboard/ticker-carousel.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Renamed the dashboard ticker panel to Major Market Indices / 主要市场指数 and removed the panel's fixed max-height so the right column stretches with the hero chart on desktop.
- Timestamp: 2026-05-22T02:58:26Z

### [Maintenance] Dashboard hero chart X-axis labels
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/lib/marketChart.ts, sigma-frontend/src/components/dashboard/hero-chart.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Reduced multi-day hero chart X-axis label density and label length by simplifying 5D ticks to daily date numbers, changing 3M labels to compact month-day text, showing monthly 1Y ticks, and letting Recharts skip labels with a 40px minimum gap.
- Timestamp: 2026-05-22T03:06:53Z

### [Maintenance] Dashboard indices panel height alignment
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/app/[locale]/(main)/page.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Changed the desktop HeroChart and major market indices container from flex to a 3fr/1fr CSS grid, removed child width classes, and added `min-h-0` to the right grid cell so the ticker panel stays constrained to the chart row height with internal scrolling.
- Timestamp: 2026-05-22T05:23:07Z

### [Maintenance] Dashboard ticker column scroll boundary
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/app/[locale]/(main)/page.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Rechecked the Dashboard HeroChart/TickerCarousel layout and found the ticker content could still contribute to the desktop grid row height. Wrapped the ticker in a desktop absolute-fill layer inside a `min-h-0` grid cell so the left HeroChart determines the row height and excess ticker rows scroll inside the panel.
- Timestamp: 2026-05-22T05:43:29Z

### [Maintenance] Trading-day market chart axes and ticker selection
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/lib/marketChart.ts, sigma-frontend/src/components/dashboard/hero-chart.tsx, sigma-frontend/src/components/dashboard/ticker-carousel.tsx, sigma-frontend/src/app/[locale]/(main)/page.tsx, sigma-frontend/src/components/markets/indices-tab.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Refactored multi-day Dashboard and Markets chart axes to use continuous Asia/Shanghai trading-day indexes from actual data dates, lifted active HeroChart market selection into the dashboard page, made ticker rows clickable with selected styling, switched ticker sparklines to intraday chart data with flat pre-open lines, displayed ISO currency codes, and removed HeroChart arrow, drag, and keyboard market switching.
- Timestamp: 2026-05-22T06:20:00Z

### [Maintenance] Markets tab layout and trending keyword cleanup
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/app/[locale]/(main)/markets/page.tsx, sigma-frontend/src/lib/marketChart.ts, sigma-frontend/src/components/dashboard/hero-chart.tsx, sigma-frontend/src/components/markets/indices-tab.tsx, sigma-frontend/src/components/dashboard/ticker-carousel.tsx, sigma-backend/app/api/v1/routes/stats.py, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Changed Markets tab transitions to `AnimatePresence` wait mode, expanded fallback trending keyword stop words, merged consecutive capitalized terms into phrase keywords, hardened overnight Beijing-session intraday point mapping for US-market sparklines, and fixed ticker row sparkline grid alignment.
- Timestamp: 2026-05-22T06:45:00Z

### [Maintenance] Cross-midnight US market chart bucketing
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/lib/marketChart.ts, sigma-frontend/src/components/dashboard/hero-chart.tsx, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Added session-date bucketing for cross-midnight Beijing sessions so US-market post-midnight timestamps remain on the trading day that opened the prior evening for 5D, 1M, 3M, and 1Y chart ranges while preserving tooltip timestamps and intraday point positioning.
- Timestamp: 2026-05-22T07:05:00Z

### [Maintenance] Ticker sparkline states and report subtitle times
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/components/dashboard/ticker-carousel.tsx, sigma-frontend/src/components/ui/Sparkline.tsx, sigma-frontend/src/app/[locale]/(main)/reports/[id]/page.tsx, sigma-backend/app/analyzers/prompts.py, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Split ticker sparkline rendering into trading, closed, and unopened states, padded constant sparkline domains so flat neutral lines render, moved ticker currency below larger price text, enlarged report detail type/date metadata, added report subtitle fallback times, and instructed generated reports to include item-derived period times.
- Timestamp: 2026-05-22T07:25:00Z

### [Maintenance] Analytics range filtering and real sync collection
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/app/[locale]/(main)/analytics/page.tsx, sigma-frontend/src/app/[locale]/(main)/sync/page.tsx, sigma-frontend/src/app/[locale]/(main)/news/page.tsx, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, sigma-backend/app/api/v1/routes/sources.py, sigma-backend/tests/test_sources_api.py, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Wired Analytics range controls into date-filtered item queries and dynamic trend buckets, changed Sync Now/All to queue real `/sources/{source_id}/collect` jobs with delayed refreshes, defaulted News to list view, and covered the new source collection route with a focused API test.
- Timestamp: 2026-05-22T10:52:35Z

### [Phase 0] Backend baseline market-index test alignment
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/tests/test_market_indices.py, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Updated outdated market-index tests to match the current urllib Yahoo chart fetch path and Redis-first candle cold-start sequence. Verified the focused failing tests and the full existing backend suite with `python3 -m pytest --tb=short -q` (`134 passed, 1 warning`). The exact `python -m pytest --tb=short -q` command remains blocked by the local Homebrew `pyexpat` linkage issue documented in earlier sessions.
- Timestamp: 2026-05-22T11:38:21Z

### [Phase 1] Dashboard news pagination
- Status: COMPLETE
- Files created: none
- Files modified: sigma-frontend/src/hooks/useItems.ts, sigma-frontend/src/components/dashboard/news-feed.tsx, sigma-frontend/src/app/[locale]/(main)/page.tsx, sigma-frontend/messages/en.json, sigma-frontend/messages/zh.json, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Added a paginated item query hook, made Dashboard NewsFeed use numbered Previous/Next/page controls, reset pagination on filter changes, and kept News page infinite scroll unchanged. Verified `npm run build`, rebuilt Docker Compose, checked Dashboard pagination/filter/last-page behavior in Playwright, checked News still infinite-loads without pagination, and ran `python3 -m pytest tests/test_items_api.py::test_items_list_with_pagination_and_category_filter --tb=short -q`.
- Timestamp: 2026-05-22T11:49:12Z

### [Phase 2.1] Auth API coverage
- Status: COMPLETE
- Files created: none
- Files modified: sigma-backend/tests/test_auth.py, CHANGELOG.md, .harness/progress.md
- Tests: PASS
- Notes: Covered duplicate and invalid registration, nonexistent and inactive login, refresh cookie success/error paths, expired bearer token rejection, and invalid reset-token handling with real TestClient HTTP calls. Verified `python3 -m pytest tests/test_auth.py --tb=short -q` and full backend suite `python3 -m pytest --tb=short -q` (`144 passed, 1 warning`).
- Timestamp: 2026-05-22T11:52:47Z
