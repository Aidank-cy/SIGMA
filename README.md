# SIGMA

**Stock Intelligence Gathering & Multi-source Analyzer**

SIGMA is a full-stack market intelligence platform that automatically collects global financial news through APIs, RSS feeds, and web scrapers, generates AI-powered summaries and analytical reports via LLM, and presents real-time market data and news through a bilingual web interface.

---

## Key Features

- **Multi-source Data Collection** — Three collector types (API / RSS / Scraper) built on a template-method base class, with built-in system sources including Yahoo Finance, Finnhub, FRED, BBC Business, Dow Jones, TechCrunch, and Federal Reserve announcements. Users can add custom sources.
- **Real-time Global Market Data** — Covers 10 major indices (S&P 500, Nasdaq, Dow Jones, SSE Composite, Hang Seng, Nikkei 225, FTSE 100, DAX, KOSPI, TAIEX) with 15-second refresh, intraday candlestick charts, and sparklines.
- **LLM-powered Analysis** — Supports hot-swapping between Anthropic (Claude), OpenAI, DeepSeek, and Qwen. Auto-generates daily morning/afternoon briefs, weekly and monthly reports. Map-Reduce pipeline for large-scale intelligence processing.
- **Per-user API Key Management** — Each user can configure their own LLM API keys, provider, model, and independent daily token budget.
- **Report System** — Five report types (Daily / Daily Morning / Daily Afternoon / Weekly / Monthly) with automatic cron-based scheduling, category filtering, and market scope control.
- **Bilingual UI** — Seamless Chinese / English switching via next-intl.
- **Security** — JWT dual-token auth (Access + Refresh), tiered rate limiting (login / general), CSP headers, CORS whitelist, minimum 32-char JWT secret enforcement.
- **Admin Dashboard** — User management, LLM usage analytics, system logs, data source monitoring.

## Tech Stack

| Layer             | Technology                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| **Backend**       | FastAPI · SQLAlchemy 2.0 (async) · Alembic · APScheduler · Pydantic v2 · Pydantic Settings         |
| **Data**          | PostgreSQL 16 (asyncpg) · Redis 7 (cache + distributed locks)                                      |
| **LLM**           | Anthropic / OpenAI / DeepSeek / Qwen unified adapter · Token usage tracking · Daily budget control |
| **Frontend**      | Next.js 14 App Router · TypeScript (strict) · React 18 · Tailwind CSS                              |
| **UI Components** | Radix UI · shadcn/ui · TanStack Query · Framer Motion · Recharts · react-markdown                  |
| **i18n**          | next-intl (Chinese / English)                                                                      |
| **Testing**       | pytest + pytest-asyncio (258 tests, 89% coverage) · Playwright E2E                                 |
| **Linting**       | Ruff (E, F, W, I, UP, B, SIM, TCH, RUF) · ESLint (next/core-web-vitals)                            |
| **Deployment**    | Docker Compose · Cloudflare Tunnel · Mac local hosting                                             |

## Project Structure

```
sigma/
├── sigma-backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── docs.py                 # OpenAPI schema & tag definitions
│   │   │   └── v1/
│   │   │       ├── router.py           # Central route registry
│   │   │       ├── routes/             # Public endpoints
│   │   │       │   ├── auth.py         # Register, login, token refresh
│   │   │       │   ├── items.py        # Collected item queries
│   │   │       │   ├── market_indices.py
│   │   │       │   ├── reports.py      # Report listing & generation
│   │   │       │   ├── sources.py      # Data source CRUD & triggers
│   │   │       │   ├── stats.py        # Collection & LLM usage stats
│   │   │       │   ├── user_settings.py # Per-user settings & LLM keys
│   │   │       │   ├── watchlists.py   # Watchlist management
│   │   │       │   └── health.py       # Service health check
│   │   │       └── admin/              # Admin-only endpoints
│   │   │           ├── dashboard.py    # Admin dashboard stats
│   │   │           ├── llm.py          # LLM config management
│   │   │           ├── logs.py         # System log viewer
│   │   │           └── users.py        # User management (thin handlers)
│   │   ├── collectors/                 # Data collection pipeline
│   │   │   ├── base.py                 # BaseCollector ABC (template method)
│   │   │   ├── api_collector.py        # JSON API sources
│   │   │   ├── rss_collector.py        # RSS/Atom feed sources
│   │   │   ├── scraper_collector.py    # HTML scraping sources
│   │   │   ├── dedup.py               # Duplicate detection
│   │   │   ├── normalizer.py          # Raw → CollectedItem normalization
│   │   │   ├── factory.py             # Collector type → class resolver
│   │   │   ├── seeds.py               # Built-in source definitions
│   │   │   └── utils.py               # Shared collector helpers
│   │   ├── analyzers/                  # LLM analysis layer
│   │   │   ├── llm_client.py          # Multi-provider LLM client
│   │   │   ├── summarizer.py          # Single-item summarization
│   │   │   ├── report_generator.py    # Report generation (Map-Reduce)
│   │   │   └── prompts.py            # Prompt templates
│   │   ├── models/                     # SQLAlchemy ORM models
│   │   │   ├── base.py                # Declarative base + mixins
│   │   │   ├── enums.py              # StrEnum definitions
│   │   │   ├── types.py              # Custom column types
│   │   │   ├── user.py               # User model
│   │   │   ├── collected_item.py     # Collected intelligence items
│   │   │   ├── data_source.py        # Data source configurations
│   │   │   ├── report.py             # Generated reports
│   │   │   ├── market_candle.py      # Candlestick market data
│   │   │   ├── llm_usage_log.py      # LLM token usage tracking
│   │   │   ├── collector_log.py      # Collection run logs
│   │   │   ├── user_report_config.py # Per-user report preferences
│   │   │   ├── watchlist.py          # User watchlists
│   │   │   └── system_config.py      # System-level key-value config
│   │   ├── schemas/                    # Pydantic v2 request/response schemas
│   │   ├── services/                   # Business logic layer
│   │   │   ├── pagination.py          # Generic Page[T] paginator
│   │   │   ├── auth_service.py        # Password hashing, JWT utils
│   │   │   ├── auth_flow_service.py   # Registration & login flows
│   │   │   ├── item_service.py        # Item query & filtering
│   │   │   ├── source_service.py      # Source lifecycle management
│   │   │   ├── report_service.py      # Report CRUD
│   │   │   ├── report_settings.py     # Report config management
│   │   │   ├── watchlist_service.py   # Watchlist CRUD
│   │   │   ├── stats_service.py       # Collection & usage statistics
│   │   │   ├── user_settings_service.py # User preferences & LLM keys
│   │   │   ├── llm.py                 # LLM client protocol
│   │   │   ├── llm_settings.py        # LLM config resolution
│   │   │   ├── email_service.py       # Resend / SMTP email dispatch
│   │   │   ├── admin_service.py       # Admin user management logic
│   │   │   ├── admin_dashboard_service.py # Admin dashboard aggregation
│   │   │   ├── admin_log_service.py   # Admin log queries
│   │   │   ├── admin_source_service.py # Admin source management
│   │   │   └── market/               # Real-time market data package
│   │   │       ├── __init__.py        # Public API re-exports
│   │   │       ├── config.py          # IndexConfig + INDEX_CONFIGS (10 indices)
│   │   │       ├── types.py           # Market data types
│   │   │       ├── yahoo_client.py    # Yahoo Finance HTTP + crumb/cookie
│   │   │       ├── indices.py         # Index refresh orchestration
│   │   │       ├── index_quotes.py    # Per-index quote fetching
│   │   │       ├── index_series.py    # Intraday series construction
│   │   │       ├── index_cache.py     # Redis index cache R/W
│   │   │       ├── clock.py           # Trading session helpers
│   │   │       ├── candles.py         # Candle refresh orchestration
│   │   │       ├── candle_fetch.py    # Candle data fetching
│   │   │       ├── candle_cache.py    # Redis candle cache R/W
│   │   │       ├── candle_store.py    # DB candle persistence
│   │   │       └── candle_bootstrap.py # Historical candle backfill
│   │   ├── scheduler/                  # APScheduler integration
│   │   │   ├── engine.py              # Job registration & lifecycle
│   │   │   ├── jobs.py               # Job implementations
│   │   │   └── hooks.py              # Post-collection event hooks
│   │   ├── middleware/                 # HTTP middleware
│   │   │   ├── security.py           # CSP headers + rate limiting
│   │   │   └── auth.py               # JWT token validation dependencies
│   │   ├── core/
│   │   │   └── config.py             # Pydantic Settings (env vars)
│   │   └── utils/
│   │       ├── redis_lock.py          # Distributed lock via Redis
│   │       └── event_hooks.py         # Collection lifecycle events
│   ├── alembic/                        # Database migrations
│   ├── tests/                          # 258 tests · 89% coverage
│   │   ├── conftest.py                # Shared fixtures
│   │   ├── test_*.py                  # Unit & integration tests
│   │   └── e2e/                       # End-to-end flow tests
│   └── pyproject.toml                 # Dependencies, Ruff, pytest config
├── sigma-frontend/
│   ├── src/
│   │   ├── app/[locale]/               # i18n routing (zh / en)
│   │   │   ├── (main)/                # Authenticated pages
│   │   │   │   ├── page.tsx           # Dashboard
│   │   │   │   ├── news/             # News feed
│   │   │   │   ├── markets/          # Market indices view
│   │   │   │   ├── analytics/        # Analytics dashboard
│   │   │   │   ├── reports/[id]/     # Report detail
│   │   │   │   ├── settings/        # User settings
│   │   │   │   ├── sync/            # Data sync status
│   │   │   │   └── items/[id]/      # Item detail
│   │   │   ├── login/               # Login page
│   │   │   └── register/            # Registration page
│   │   ├── components/
│   │   │   ├── dashboard/            # Hero chart, ticker carousel, stats, sidebar, news feed
│   │   │   ├── markets/              # Index quotes, sector view
│   │   │   ├── feed/                 # Item detail, sentiment badges
│   │   │   ├── reports/              # Report markdown renderer
│   │   │   ├── settings/             # LLM settings, report config editor
│   │   │   ├── admin/                # Admin dashboard panels
│   │   │   ├── charts/               # TrendLine charts
│   │   │   ├── ui/                   # Generic UI components
│   │   │   └── ui-shadcn/            # shadcn/ui primitives
│   │   ├── hooks/                     # Custom React hooks (12 hooks)
│   │   ├── lib/                       # API client, auth, types, utilities
│   │   └── i18n/                      # i18n configuration
│   ├── messages/                      # zh.json · en.json translation files
│   ├── e2e/                           # Playwright E2E tests
│   └── package.json                   # v2.0.0
├── docs/
│   ├── deployment.md                  # Cloudflare Tunnel + Mac setup
│   └── backup.md                      # Backup & restore procedures
├── scripts/
│   ├── backup.sh                      # Database backup script
│   └── performance_check.sql          # Performance diagnostic queries
├── docker-compose.yml                 # Development environment
└── docker-compose.prod.yml            # Production environment
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (frontend development)
- Python 3.12+ (backend development)

### One-command Launch

```bash
# 1. Clone the repository
git clone https://github.com/Aidank-cy/sigma.git
cd sigma

# 2. Configure environment variables
cp .env.example .env
# Edit .env and fill in your API keys

# 3. Start all services
docker compose up --build
```

Once running:

| Service                    | URL                                 |
| -------------------------- | ----------------------------------- |
| Frontend                   | http://localhost:3000               |
| Backend API Docs (Swagger) | http://localhost:8000/docs          |
| Health Check               | http://localhost:8000/api/v1/health |

### Local Development

**Backend:**

```bash
cd sigma-backend
python -m pip install -e ".[dev]"
python -m pytest --tb=short -q           # Run 258 tests
python -m pytest --cov=app --cov-report=term-missing  # Coverage report
python -m ruff check .                    # Lint
python -m ruff format .                   # Format
```

**Frontend:**

```bash
cd sigma-frontend
npm install
npm run dev       # Dev server (http://localhost:3000)
npm run build     # Production build
npm run lint      # ESLint
npm run test:e2e  # Playwright E2E tests
```

## Environment Variables

### Core

| Variable                          | Description                                         | Default                                                      |
| --------------------------------- | --------------------------------------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`                    | Async PostgreSQL connection URL                     | `postgresql+asyncpg://sigma:sigma@sigma-postgres:5432/sigma` |
| `REDIS_URL`                       | Redis cache and lock URL                            | `redis://sigma-redis:6379/0`                                 |
| `JWT_SECRET_KEY`                  | JWT signing secret (≥32 chars, enforced at startup) | —                                                            |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime                               | `15`                                                         |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS`   | Refresh token lifetime                              | `7`                                                          |
| `FRONTEND_URL`                    | Allowed CORS origin                                 | `http://localhost:3000`                                      |
| `BACKEND_URL`                     | Backend URL for SSR calls                           | —                                                            |
| `NEXT_PUBLIC_BACKEND_URL`         | Browser-visible backend URL                         | —                                                            |
| `DEFAULT_LOCALE`                  | Default UI locale (`zh` / `en`)                     | `zh`                                                         |
| `DEFAULT_RETENTION_DAYS`          | Data retention window in days                       | `30`                                                         |
| `LOGIN_RATE_LIMIT_PER_MINUTE`     | Login endpoint rate limit                           | `10`                                                         |
| `GENERAL_RATE_LIMIT_PER_MINUTE`   | General endpoint rate limit                         | `120`                                                        |

### LLM

| Variable               | Description            | Default                    |
| ---------------------- | ---------------------- | -------------------------- |
| `ANTHROPIC_API_KEY`    | Anthropic API key      | —                          |
| `OPENAI_API_KEY`       | OpenAI API key         | —                          |
| `DEEPSEEK_API_KEY`     | DeepSeek API key       | —                          |
| `QWEN_API_KEY`         | Qwen API key           | —                          |
| `DEFAULT_LLM_PROVIDER` | Default provider       | `anthropic`                |
| `DEFAULT_LLM_MODEL`    | Default model          | `claude-sonnet-4-20250514` |
| `DAILY_TOKEN_LIMIT`    | Daily token budget cap | `1000000`                  |

### Data Source API Keys

| Variable       | Description                   |
| -------------- | ----------------------------- |
| `FINNHUB_KEY`  | Finnhub market data           |
| `FRED_API_KEY` | Federal Reserve economic data |

### Email (Optional)

| Variable                                                                   | Description                                          |
| -------------------------------------------------------------------------- | ---------------------------------------------------- |
| `EMAIL_FROM`                                                               | Sender identity                                      |
| `RESEND_API_KEY`                                                           | Resend email API key                                 |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_USE_TLS` | SMTP config (fallback when Resend is not configured) |

## API Overview

All endpoints are prefixed with `/api/v1`. Full interactive documentation is available at `/docs` (Swagger UI).

| Module          | Endpoints                                        | Description                                      |
| --------------- | ------------------------------------------------ | ------------------------------------------------ |
| Auth            | `/auth/register`, `/auth/login`, `/auth/refresh` | Registration, login, token refresh               |
| Items           | `/items`                                         | Collected items query, filtering, pagination     |
| Sources         | `/sources`                                       | Data source CRUD, enable/disable, manual trigger |
| Reports         | `/reports`                                       | Report listing, generation, detail view          |
| Market Indices  | `/market-indices`                                | Real-time index quotes, trading status           |
| Watchlists      | `/watchlists`                                    | Watchlist management                             |
| Stats           | `/stats`                                         | Collection statistics, LLM usage                 |
| User Settings   | `/me`                                            | Personal settings, LLM configuration, API keys   |
| Admin Dashboard | `/admin/dashboard`                               | System-wide statistics                           |
| Admin Users     | `/admin/users`                                   | User management                                  |
| Admin LLM       | `/admin/llm`                                     | LLM configuration management                     |
| Admin Logs      | `/admin/logs`                                    | System log viewer                                |
| Health          | `/health`                                        | Service health check                             |

## Scheduled Jobs

| Job                   | Schedule                       | ID                        | Description                              |
| --------------------- | ------------------------------ | ------------------------- | ---------------------------------------- |
| Source collection     | Per-source cron (configurable) | `collector:{source_id}`   | Auto-collect + dedup + LLM summarization |
| Market index refresh  | Every 15 seconds               | `market-indices:refresh`  | Yahoo Finance multi-index quote cache    |
| Candle data refresh   | Every 10 seconds               | `market-candles:refresh`  | Intraday / 5-day candlestick updates     |
| Daily morning brief   | Weekdays UTC 01:21             | `reports:daily_morning`   | Asia-Pacific morning report              |
| Daily afternoon brief | Weekdays UTC 09:31             | `reports:daily_afternoon` | US/EU afternoon report                   |
| Weekly report         | Fridays UTC 09:45              | `reports:weekly`          | Weekly comprehensive analysis            |
| Monthly report        | 1st of month UTC 04:00         | `reports:monthly`         | Monthly deep-dive report                 |
| Expired data cleanup  | Daily UTC 03:00                | `cleanup_expired_items`   | Purge items past retention window        |

## Architecture Highlights

### Backend Layered Design

Route handlers are thin controllers (≤15 lines). All business logic lives in the service layer (`app/services/`), keeping the API surface testable and swappable.

```
Request → Route Handler → Service Layer → ORM / Redis / External API
                ↓
         Pydantic Schema (validation)
```

### Market Data Package

The `app/services/market/` package was extracted from a monolithic 1,500-line file into 14 focused modules, each under 275 lines. The public API is exposed through `__init__.py`:

```python
from app.services.market import get_market_indices, refresh_market_indices, candle_refresh_job
```

Internally it follows a clean separation: `config` (index definitions) → `yahoo_client` (HTTP transport) → `index_quotes` / `index_series` (data shaping) → `index_cache` (Redis persistence) → `indices` (orchestration). The candle subsystem mirrors this with `candle_fetch` → `candle_cache` / `candle_store` → `candles`.

### Collector Template Method

All collectors extend `BaseCollector`, which handles HTTP client lifecycle via a template method:

```python
class BaseCollector(ABC):
    async def collect(self) -> list[RawCollectedItem]:
        if not await self.validate_config():
            return []
        # Client reuse or ephemeral creation handled here
        ...

    @abstractmethod
    async def _do_collect(self, client: httpx.AsyncClient) -> list[RawCollectedItem]: ...
```

Subclasses (`APICollector`, `RSSCollector`, `ScraperCollector`) implement only `validate_config()` and `_do_collect()`.

### Generic Pagination

A reusable `Page[T]` utility (`app/services/pagination.py`) provides consistent pagination across all list endpoints, eliminating duplicated offset/limit/count logic.

## Testing

```bash
cd sigma-backend

# Run all tests
python -m pytest --tb=short -q           # 258 tests

# Coverage report
python -m pytest --cov=app --cov-report=term-missing

# Run specific test file
python -m pytest tests/test_market_indices.py -v

# Frontend E2E
cd ../sigma-frontend
npm run test:e2e
```

Test suite includes unit tests, integration tests with async SQLite, and end-to-end flow tests. 89% backend code coverage with all service files above 60%.

## Production Deployment

```bash
cp .env.example .env.prod
# Edit .env.prod with production settings (strong JWT secret, real DB, etc.)
docker compose -f docker-compose.prod.yml up -d --build
```

Data is persisted under `~/sigma-data/`.

See [docs/deployment.md](docs/deployment.md) for Cloudflare Tunnel and Mac setup.
See [docs/backup.md](docs/backup.md) for backup and restore procedures.

## Cost Estimate

| Item               |                   Estimate |
| ------------------ | -------------------------: |
| Cloudflare Tunnel  |                   $0/month |
| Local Mac + Docker |             $0 incremental |
| Domain             |       ~$1/month annualized |
| News/data APIs     |    $0–10/month (free tier) |
| LLM API usage      | $5–15/month (personal use) |

> Expected personal deployment cost: **~$6–16/month**, primarily API usage.

## License

Private repository. All rights reserved.