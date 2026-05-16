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
