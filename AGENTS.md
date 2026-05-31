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
- Frontend lint: `cd sigma-frontend && npm run lint`
- Full stack: `docker compose up --build`

## Always
- Read `.harness/progress.md` "Current state" section before choosing a resume point.
- Update `CHANGELOG.md` under `[Unreleased]` and `.harness/progress.md` after each
  completed sub-feature.
- Run `./hooks/post-file-edit.sh` after code changes to verify lint, build, and file size limits.
- Use `/api/v1/` for backend routes and keep list endpoints machine-consumable.
- Namespace system config keys as `sigma.*`.
- Preserve explicit Docker service names and the `sigma-network` network.
- Keep private dev-to-public sync exclusions in `.sync-filter` and strip the sync
  workflow itself before mirroring to `Aidank-cy/SIGMA`.

## Ask first
- Adding a new third-party dependency.
- Creating a new top-level directory or module.
- Changing database models or creating new migrations.
- Modifying authentication or authorization logic.

## Never
- Commit secrets, `.env`, local data, generated caches, or credential-bearing logs.
- Implement trading or knowledge-base product features inside SIGMA.
- Hardcode user-facing frontend strings outside the i18n message files.
- Add print statements, `console.log`, commented-out code, or TODO/FIXME comments.
- Use eslint-disable or ruff noqa to suppress lint violations instead of fixing them.
- Let `.harness/`, `hooks/`, `skills/`, `AGENTS.md`, `CHANGELOG.md`, private CI,
  or local/generated artifacts reach the public mirror.

## Architecture
- `sigma-backend/app/` contains FastAPI application code, split by API, core, models,
  schemas, services, scheduler, and tests.
- `sigma-frontend/src/app/` contains Next.js routes and locale segments.
- `docker-compose.yml` owns local Postgres, Redis, backend, and frontend service wiring.
- `skills/`, `hooks/`, and `.harness/` are private agent governance files.

---
_This is a living document. Add new rules only when a real failure occurs. Remove or
demote rules to "Ask first" when they have not been relevant for 3+ phases. Last
audit: 2026-05-31._
