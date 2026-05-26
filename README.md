# SIGMA

SIGMA (Stock Intelligence Gathering & Multi-source Analyzer) collects market intelligence
from APIs, RSS feeds, and lightweight scrapers, summarizes it with LLMs, and presents
machine-consumable APIs plus a minimalist bilingual web interface.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | FastAPI, SQLAlchemy async, Alembic, APScheduler |
| Data | PostgreSQL 16, Redis 7 |
| Analysis | Anthropic/OpenAI adapter with token usage logging |
| Frontend | Next.js 14 App Router, TypeScript, next-intl, Tailwind CSS |
| UI | TanStack Query, framer-motion, recharts, react-markdown |
| Deployment | Mac local Docker Compose, Cloudflare Tunnel |

## Quick Start

```bash
cp .env.example .env
cd sigma-backend && python -m pip install -e ".[dev]"
cd ../sigma-frontend && npm install
cd ..
docker compose up --build
```

Frontend: `http://localhost:3000`
Backend docs: `http://localhost:8000/docs`
Health: `http://localhost:8000/api/v1/health`

## Development

Backend:

```bash
cd sigma-backend
python -m pytest --tb=short -q
python -m ruff check .
```

Frontend:

```bash
cd sigma-frontend
npm run dev
npm run build
```

Production parse check:

```bash
docker compose -f docker-compose.prod.yml config
```

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Async SQLAlchemy PostgreSQL URL |
| `REDIS_URL` | Redis cache and lock URL |
| `JWT_SECRET_KEY` | JWT signing secret, at least 32 characters |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token lifetime |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `QWEN_API_KEY` | Qwen API key |
| `DEFAULT_LLM_PROVIDER` | `anthropic`, `openai`, `deepseek`, or `qwen` |
| `DEFAULT_LLM_MODEL` | Runtime default LLM model |
| `RESEND_API_KEY` | Resend API key for verification emails |
| `EMAIL_FROM` | Sender identity for verification emails |
| `NEWSAPI_KEY` | NewsAPI source key |
| `ALPHAVANTAGE_KEY` | Alpha Vantage source key |
| `FINNHUB_KEY` | Finnhub source key |
| `FRED_API_KEY` | FRED source key |
| `BACKEND_URL` | Backend URL for server-side frontend calls |
| `FRONTEND_URL` | Allowed browser origin for CORS |
| `NEXT_PUBLIC_BACKEND_URL` | Browser-visible backend URL |
| `DEFAULT_LOCALE` | Default UI locale |
| `DEFAULT_RETENTION_DAYS` | Default item retention window |
| `DAILY_TOKEN_LIMIT` | LLM token guardrail |

## Structure

```text
sigma-backend/app/        FastAPI app, models, schemas, collectors, analyzers, scheduler
sigma-backend/alembic/    Database migrations
sigma-backend/tests/      Backend unit and integration tests
sigma-frontend/src/app/   Next.js App Router routes
sigma-frontend/src/       Components, hooks, API client, i18n wiring
docs/                     Deployment and backup operations
scripts/                  Operational scripts
```

## Deployment

Use the production stack:

```bash
cp .env.example .env.prod
docker compose -f docker-compose.prod.yml up -d --build
```

Data is stored under `~/sigma-data/`.

See [docs/deployment.md](docs/deployment.md) for Cloudflare Tunnel and Mac setup.
See [docs/backup.md](docs/backup.md) for backup and restore.

## Cost Estimate

| Item | Estimate |
| --- | ---: |
| Cloudflare Tunnel | $0/month |
| Local Mac + Docker | $0 incremental |
| Domain | about $1/month if annualized |
| News/data APIs | $0-10/month depending on free-tier usage |
| LLM API usage | $5-15/month for moderate personal usage |

Expected personal deployment cost: about `$6-16/month`, primarily API usage.
