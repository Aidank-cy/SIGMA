## Current state
- Latest release: v2.0.0 (2026-05-30)
- Completed: Phase 0-8, releases v1.0.0, v1.1.0, v2.0.0
- In progress: (none)
- Next session should: Continue with user-requested maintenance or harness follow-up from the compact progress state.

## Recent (last 3 sub-features)
### [Phase 6] Sub-feature 6.3: Remaining frontend page extraction
- Status: COMPLETE
- Files created: co-located `*PageContent.tsx` components for analytics, news, settings, sync, item detail, and report detail routes
- Files modified: frontend route page wrappers, CHANGELOG.md, .harness/progress.md
- Tests: PASS with frontend production build, frontend lint, backend Ruff check, and full backend pytest.
- Notes: Reduced every `src/app/[locale]/(main)/**/page.tsx` file below 150 lines by keeping route files as thin wrappers around co-located client content components.
- Timestamp: 2026-05-30T06:13:57Z

### [Phase 8] Sub-feature 8.3: Final market service size and coverage audit
- Status: COMPLETE
- Files created: market clock/cache/quote/series and candle cache/store/fetch/bootstrap helper modules, plus focused market helper tests
- Files modified: market index/candle service facades, final public helper docstrings, CHANGELOG.md, .harness/progress.md
- Tests: PASS with focused market/scheduler/collector tests, backend Ruff check, and backend coverage run.
- Notes: Preserved the existing market service facade imports while reducing every `app/services/` file below 300 lines and lifting all service coverage above 60%.
- Timestamp: 2026-05-30T06:35:53Z

### [Maintenance] Sub-feature: Harness sync exposure and dev artifact cleanup
- Status: COMPLETE
- Files created: none
- Files modified: .gitignore, .sync-filter, CHANGELOG.md, .harness/progress.md
- Files removed: committed .playwright-mcp debug logs and report .bak files
- Tests: PASS with backend pytest, frontend production build, artifact checks, and sync-filter grep verification.
- Notes: Temporarily reclassified harness engineering artifacts as public in `.sync-filter` for cross-session workflow review while retaining sync workflow and dev artifact exclusions.
- Timestamp: 2026-05-30T08:15:48Z

## Archive
Full history: `.harness/archive/completed-phases.md`
