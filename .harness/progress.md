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
