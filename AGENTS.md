# AGENTS.md

## Project overview
SIGMA is a full-stack stock intelligence app. Backend uses FastAPI, SQLAlchemy async,
PostgreSQL, Redis, and APScheduler. Frontend uses Next.js 14 App Router, TypeScript,
next-intl, Tailwind CSS, TanStack Query, framer-motion, and recharts.

## Commands
- Backend install: `cd sigma-backend && python -m pip install -e ".[dev]"`
- Backend test: `cd sigma-backend && python -m pytest --tb=short -q`
- Backend lint: `cd sigma-backend && python -m ruff check .`
- Frontend install: `cd sigma-frontend && npm install`
- Frontend dev: `cd sigma-frontend && npm run dev`
- Frontend build: `cd sigma-frontend && npm run build`
- Full stack: `docker compose up --build`

## Always
- Read `.harness/progress.md`, `.harness/session-log.md`, this file, and `CHANGELOG.md`
  before choosing a resume point.
- Update `CHANGELOG.md` under `[Unreleased]` and `.harness/progress.md` after each
  completed sub-feature.
- Use `/api/v1/` for backend routes and keep list endpoints machine-consumable.
- Namespace system config keys as `sigma.*`.
- Preserve explicit Docker service names and the `sigma-network` network.

## Never
- Commit secrets, `.env`, local data, generated caches, or credential-bearing logs.
- Implement trading or knowledge-base product features inside SIGMA.
- Hardcode user-facing frontend strings outside the i18n message files.
- Add print statements, `console.log`, commented-out code, or TODO/FIXME comments.

## Architecture
- `sigma-backend/app/` contains FastAPI application code, split by API, core, models,
  schemas, services, scheduler, and tests.
- `sigma-frontend/src/app/` contains Next.js routes and locale segments.
- `docker-compose.yml` owns local Postgres, Redis, backend, and frontend service wiring.
- `skills/`, `hooks/`, and `.harness/` are private agent governance files.

---
_This is a living document. Remove [INITIAL] tags once validated. Add new rules only when a real failure occurs._
