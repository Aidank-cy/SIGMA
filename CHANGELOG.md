# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project uses Semantic Versioning.

## [Unreleased]

### Added
- Add Phase 0 harness and project bootstrap scaffold.
- Add PostgreSQL ORM models for users, sources, collected items, watchlists, reports, collector logs, system config, and LLM usage.
- Add async database session wiring and an Alembic initial schema migration.
- Add JWT registration, login, refresh, and current-user authentication routes.

### Fixed
- Fix Docker Compose config parsing without requiring a local `.env` secrets file.
