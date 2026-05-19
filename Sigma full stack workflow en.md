# SIGMA — Full-Stack Testing & Update Workflow

> 15,757 lines of code, 8 functional layers, 22 test files (2,098 lines),
> 8 data sources, 15 API route groups, 6 LLM providers.
> This document defines the testing strategy, toolchain, and executable prompts for each layer.
> All prompts are agent-agnostic — usable with any AI coding agent (Codex, Claude Code, Cursor, Windsurf, Copilot, Gemini CLI, etc.)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  Layer 1: UI Layout & Visual Consistency            │  Next.js 14 + Tailwind
├─────────────────────────────────────────────────────┤
│  Layer 2: Frontend Logic & Interactions             │  React Query + Auth + i18n
├─────────────────────────────────────────────────────┤
│  Layer 3: API Endpoints                             │  FastAPI, 15 route groups
├─────────────────────────────────────────────────────┤
│  Layer 4: Authentication & Security                 │  JWT + Rate Limit + CORS
├─────────────────────────────────────────────────────┤
│  Layer 5: Data Collection Pipeline                  │  RSS / API / Scraper + Dedup
├─────────────────────────────────────────────────────┤
│  Layer 6: LLM Analysis Engine                       │  6 providers + Budget Guard
├─────────────────────────────────────────────────────┤
│  Layer 7: Scheduled Tasks & Reports                 │  APScheduler + Report Gen
├─────────────────────────────────────────────────────┤
│  Layer 8: Infrastructure                            │  PostgreSQL + Redis + Docker
└─────────────────────────────────────────────────────┘
```

---

## Execution Order (Bottom-Up)

| Phase | Layer                         | Est. Time | Prerequisite        |
| ----- | ----------------------------- | --------- | ------------------- |
| 1     | Layer 8 — Infrastructure      | 30 min    | Docker installed    |
| 2     | Layer 4 — Auth & Security     | 1 hr      | Backend running     |
| 3     | Layer 3 — API Endpoints       | 1-2 hr    | Auth working        |
| 4     | Layer 5 — Data Collection     | 1-2 hr    | APIs OK + API keys  |
| 5     | Layer 6 — LLM Engine          | 1 hr      | LLM API key         |
| 6     | Layer 7 — Scheduler & Reports | 30 min    | Collection + LLM OK |
| 7     | Layer 1 — UI Layout           | 2-3 hr    | Full stack running  |
| 8     | Layer 2 — Frontend Logic      | 1-2 hr    | UI fixed            |

**Total: ~8-12 hours.** Split across 2-3 days recommended.

---

## Layer 8 — Infrastructure

### Prompt

```
You are working on the SIGMA project (Stock Intelligence Gathering & Multi-source Analyzer).
The project root is at the current directory. It uses Docker Compose with 4 services:
sigma-postgres (PostgreSQL 16), sigma-redis (Redis 7), sigma-backend (FastAPI), sigma-frontend (Next.js 14).

Perform the following infrastructure checks:

1. START THE STACK:
   Run: docker compose up -d --build
   Run: docker compose ps
   Verify all 4 services show status "running" or "Up". If any service fails, read its logs
   with "docker compose logs <service> --tail 100" and fix the issue.

2. DATABASE MIGRATION:
   Run: docker compose exec sigma-backend alembic upgrade head
   Run: docker compose exec sigma-backend alembic check
   The second command should output "No new upgrade operations detected."
   If migration fails, read the error and fix the migration file.

3. REDIS CONNECTIVITY:
   Run: docker compose exec sigma-redis redis-cli ping
   Expected: PONG

4. ENVIRONMENT VARIABLES:
   Read .env.example and compare with .env (or the actual env_file used in docker-compose.yml).
   KNOWN BUG: docker-compose.yml currently references ".env.example" instead of ".env" as
   the env_file for sigma-backend. Fix this to use ".env" instead.
   Check that:
   - JWT_SECRET_KEY has been changed from the default "change-me-to-random-32-chars-minimum"
   - DATABASE_URL and REDIS_URL point to the correct docker container hostnames
   - List which API keys (NEWSAPI_KEY, ALPHAVANTAGE_KEY, FINNHUB_KEY, FRED_API_KEY,
     ANTHROPIC_API_KEY) are missing vs configured

5. DOCKER COMPOSE HARDENING:
   The current docker-compose.yml has several issues. Fix them:
   - Add healthcheck to sigma-postgres:
     test: ["CMD-SHELL", "pg_isready -U sigma"]
     interval: 10s, timeout: 5s, retries: 5
   - Add healthcheck to sigma-redis:
     test: ["CMD", "redis-cli", "ping"]
   - Add "depends_on: sigma-postgres: condition: service_healthy" to sigma-backend
   - Add "restart: unless-stopped" to all services

6. HEALTH ENDPOINT:
   Run: curl -s http://localhost:8000/api/v1/health
   Verify it returns a 200 response with JSON body.

Output a status report: which checks passed (✅) and which failed (❌), with details.
```

---

## Layer 4 — Authentication & Security

### Prompt

```
You are working on the SIGMA project. The backend is running at http://localhost:8000.

Test the authentication and security layer:

1. RUN EXISTING TESTS:
   cd sigma-backend
   python -m pytest tests/test_auth.py tests/test_auth_service.py tests/test_security.py -v
   Record which tests pass and which fail. Fix ALL failing tests before proceeding.

2. JWT FLOW VERIFICATION (using curl or httpx in a test script):
   a. Register a user:
      POST /api/v1/auth/register with {"username":"sectest","email":"sec@test.com","password":"Str0ngP@ss!"}
      Verify: 201 response with access_token
   b. Login:
      POST /api/v1/auth/login with form data username=sectest, password=Str0ngP@ss!
      Verify: 200 response with access_token + refresh_token cookie (httpOnly)
   c. Access protected route:
      GET /api/v1/items with Authorization: Bearer <token>
      Verify: 200
   d. Expired/invalid token:
      GET /api/v1/items with Authorization: Bearer invalid-garbage-token
      Verify: 401
   e. Token refresh:
      POST /api/v1/auth/refresh (with refresh_token cookie)
      Verify: new access_token returned

3. RATE LIMITING:
   Send 15 rapid sequential POST requests to /api/v1/auth/login (with wrong password).
   Verify that request #11 or later returns HTTP 429.
   The setting is login_rate_limit_per_minute=10 in config.py.

4. AUTHORIZATION ISOLATION:
   a. Register two users (userA, userB)
   b. Create a watchlist with userA's token
   c. Try to access/modify that watchlist with userB's token
   d. Verify: 403 or 404 (not 200)

5. ADMIN ROUTE PROTECTION:
   a. Login as a non-admin user
   b. GET /api/v1/admin/dashboard
   c. Verify: 403 Forbidden

6. SECURITY HEADERS:
   Send any GET request and inspect response headers for:
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY
   - Content-Security-Policy (present)
   Read sigma-backend/app/middleware/security.py to verify these are set correctly.

Fix all issues found. Re-run all auth/security tests to confirm green.
Output: ✅/❌ status per check.
```

---

## Layer 3 — API Endpoints

### Prompt

```
You are working on the SIGMA project backend (sigma-backend/).

Test ALL 15 API route groups for correctness:

1. RUN ALL EXISTING BACKEND TESTS:
   cd sigma-backend && python -m pytest --tb=short -q
   Record total passed/failed/errors. Fix every failure before proceeding.

2. CHECK TEST COVERAGE GAPS:
   The following test files are weak or missing:
   - tests/test_llm.py — only 10 lines, nearly empty. Needs substantial tests (see Layer 6).
   - No test file for user_settings API (/me/settings). Create tests/test_user_settings_api.py:
     - GET /api/v1/me/settings returns user preferences
     - PUT /api/v1/me/settings updates preferences and persists
     - Unauthenticated request returns 401
   Write and run these new tests.

3. MANUAL ENDPOINT VERIFICATION (curl or httpx):
   After registering and getting a token, hit each route group:

   | Route                   | Method      | Expected               |
   | ----------------------- | ----------- | ---------------------- |
   | /health                 | GET         | 200, JSON with status  |
   | /auth/register          | POST        | 201 with token         |
   | /auth/login             | POST        | 200 with token         |
   | /items                  | GET         | 200, paginated list    |
   | /items?category=finance | GET         | 200, filtered results  |
   | /items?keyword=test     | GET         | 200, search results    |
   | /reports                | GET         | 200, paginated list    |
   | /market-indices         | GET         | 200, indices array     |
   | /sources                | GET         | 200, source list       |
   | /stats/sentiment        | GET         | 200, sentiment data    |
   | /watchlists             | GET         | 200, watchlist array   |
   | /watchlists             | POST        | 201, created watchlist |
   | /me/settings            | GET         | 200, user settings     |
   | /admin/dashboard        | GET (admin) | 200, stats object      |
   | /admin/sources          | GET (admin) | 200, source list       |
   | /admin/users            | GET (admin) | 200, user list         |
   | /admin/llm/config       | GET (admin) | 200, LLM config        |
   | /admin/logs             | GET (admin) | 200, log entries       |

   For any route returning 500, read the traceback from docker logs, identify the bug, and fix it.

4. EDGE CASES:
   - GET /items?page=99999 → should return empty list, not error
   - GET /items/{nonexistent-uuid} → should return 404, not 500
   - POST /watchlists with empty body → should return 422 validation error
   - PUT /admin/llm/config with invalid provider → should return 422

5. Run the E2E test:
   python -m pytest tests/e2e/test_full_flow.py -v
   Fix if failing.

Output: full pass/fail matrix for all route groups.
```

---

## Layer 5 — Data Collection Pipeline

### Prompt

```
You are working on the SIGMA project data collection system.
Relevant files:
- sigma-backend/app/collectors/ (base.py, api_collector.py, rss_collector.py, scraper_collector.py, factory.py, seeds.py, dedup.py, normalizer.py)
- sigma-backend/app/scheduler/jobs.py (collect_from_source)
- sigma-backend/tests/test_collectors.py, tests/test_seeds.py, tests/test_scheduler.py

Test the entire data collection pipeline:

1. RUN EXISTING TESTS:
   cd sigma-backend
   python -m pytest tests/test_collectors.py tests/test_seeds.py tests/test_scheduler.py -v
   Fix all failures.

2. SEED SOURCES VALIDATION:
   Read sigma-backend/app/collectors/seeds.py.
   There are 8 seed sources. For each one, verify:
   - The API endpoint URL is still valid (not deprecated or moved)
   - The field_mapping keys match the actual API response structure
   - The cron schedule is reasonable (not too frequent for free-tier API keys)
   KNOWN ISSUES to investigate:
   - "https://feeds.reuters.com/reuters/businessNews" — Reuters RSS feeds have been
     restructured multiple times. Verify this URL still works.
     If not, find the current Reuters business RSS feed URL and update seeds.py.
   - Yahoo Finance API endpoint "query1.finance.yahoo.com/v1/finance/search" — verify
     this is still the correct endpoint and doesn't require auth headers.

3. RSS COLLECTOR LIVE TEST (no API key needed):
   Write a small script or test that:
   - Creates a DataSource with source_type=RSS pointing to "https://techcrunch.com/feed/"
   - Instantiates RSSCollector and calls collector.collect()
   - Verifies it returns a list of items with title, content, url, published_at
   - If it fails, read the error and fix the RSS parser

4. NORMALIZER VALIDATION:
   Read normalizer.py. Check that the date parser handles:
   - ISO 8601 strings ("2026-05-19T10:30:00Z")
   - Unix timestamps (integer seconds)
   - Human-readable dates ("May 19, 2026")
   - The Alpha Vantage format ("20260519T103000")
   Write tests for any uncovered format.

5. DEDUPLICATION:
   Read dedup.py. Verify that:
   - Items with the same content_url are deduplicated
   - Items with the same title + source_id are deduplicated
   - New items pass through correctly

6. COLLECTOR INTEGRATION:
   If API keys are configured in .env, run a real collection cycle:
   docker compose exec sigma-backend python -c "
   import asyncio
   from app.scheduler.jobs import collect_from_source
   from app.database import AsyncSessionLocal
   from sqlalchemy import select
   from app.models.data_source import DataSource
   async def test():
       async with AsyncSessionLocal() as db:
           sources = (await db.scalars(select(DataSource).where(DataSource.is_active.is_(True)))).all()
           for s in sources:
               print(f'Collecting from {s.name}...')
               await collect_from_source(s.id)
               print(f'  Done')
   asyncio.run(test())
   "
   Then check:
   - SELECT count(*) FROM collector_log WHERE status='success';
   - SELECT count(*) FROM collected_item;
   If API keys are NOT configured, note this in your report and skip.

Output: per-source status (tested/skipped/fixed), total items collected.
```

---

## Layer 6 — LLM Analysis Engine

### Prompt

```
You are working on the SIGMA project LLM integration.
Relevant files:
- sigma-backend/app/analyzers/llm_client.py (LLMClient, 6 providers)
- sigma-backend/app/analyzers/summarizer.py (batch_summarize)
- sigma-backend/app/analyzers/report_generator.py (generate_report)
- sigma-backend/app/analyzers/prompts.py (system prompts)
- sigma-backend/app/core/config.py (API key settings)
- sigma-backend/tests/test_llm.py (NEARLY EMPTY — only 10 lines)
- sigma-backend/tests/test_llm_client.py
- sigma-backend/tests/test_summarizer.py
- sigma-backend/tests/test_report_generator.py

1. RUN EXISTING TESTS:
   cd sigma-backend
   python -m pytest tests/test_llm_client.py tests/test_summarizer.py tests/test_report_generator.py tests/test_prompts.py -v
   Fix all failures.

2. EXPAND test_llm.py (currently only 10 lines):
   This file needs comprehensive tests. Add the following test cases:

   a. Provider routing tests (unit, mocked):
      - _headers("anthropic") returns x-api-key header
      - _headers("openai") returns Bearer authorization header
      - _headers("deepseek") returns Bearer authorization header
      - _url("anthropic") returns "https://api.anthropic.com/v1/messages"
      - _url("openai") returns "https://api.openai.com/v1/chat/completions"
      - _url("deepseek") returns "https://api.deepseek.com/v1/chat/completions"
      - _url("kimi") returns "https://api.moonshot.cn/v1/chat/completions"

   b. Payload format tests (unit):
      - _payload("anthropic",...) uses "system" key at top level
      - _payload("openai",...) uses system role in messages array
      - Both include model, max_tokens, temperature

   c. Response parsing tests (unit):
      - _parse_response("anthropic", {...}) extracts text from content[].text
      - _parse_response("openai", {...}) extracts text from choices[0].message.content
      - Both return (text, input_tokens, output_tokens) tuple

   d. Budget guard test (needs db mock):
      - When daily usage + max_tokens > daily_token_limit, raises BudgetExceededError
      - When under budget, does not raise

   e. Retry logic test (needs httpx mock):
      - Mock first 2 requests returning 429, third returning 200
      - Verify complete() succeeds after retries
      - Mock all 3 requests returning 500
      - Verify complete() raises after exhausting retries

3. VERIFY PROVIDER BASE URLs:
   Open llm_client.py and confirm OPENAI_COMPATIBLE_BASE_URLS values are correct:
   - deepseek: "https://api.deepseek.com/v1"  — search the web for the current DeepSeek API endpoint
   - minimax: "https://api.minimax.chat/v1"  — search for current MiniMax API endpoint
   - kimi: "https://api.moonshot.cn/v1"  — search for current Moonshot/Kimi API endpoint
   - gemini: "https://generativelanguage.googleapis.com/v1beta/openai" — search for current Gemini OpenAI-compatible endpoint
   Update any that have changed.

4. LIVE LLM TEST (only if ANTHROPIC_API_KEY or any LLM key is set):
   Write a one-off script to call the summarizer on a sample news item:
   - Create a fake CollectedItem with title="Fed Raises Rates" and content_raw="The Federal Reserve..."
   - Call batch_summarize([item_id])
   - Verify the item's summary field is populated with valid JSON containing sentiment, summary, keywords
   - Check llm_usage_log table has a new entry with input_tokens > 0
   If no API key is configured, skip and note in report.

5. PROMPT QUALITY:
   Read prompts.py. Check:
   - System prompts are clear and well-structured
   - JSON output format is explicitly specified
   - Language instruction matches user's locale setting

Run all tests again after fixes: python -m pytest tests/test_llm*.py tests/test_summarizer.py tests/test_report_generator.py tests/test_prompts.py -v
Output: test count before/after, all green.
```

---

## Layer 7 — Scheduled Tasks & Reports

### Prompt

```
You are working on the SIGMA project scheduler and report system.
Relevant files:
- sigma-backend/app/scheduler/engine.py (APScheduler setup)
- sigma-backend/app/scheduler/jobs.py (job functions)
- sigma-backend/app/services/market_indices.py (index refresh)
- sigma-backend/tests/test_scheduler.py
- sigma-backend/tests/test_market_indices.py

1. RUN EXISTING TESTS:
   cd sigma-backend
   python -m pytest tests/test_scheduler.py tests/test_market_indices.py tests/test_report_generator.py -v
   Fix all failures.

2. SCHEDULER CONFIGURATION REVIEW:
   Read engine.py and verify:
   - All source jobs use CronTrigger with max_instances=1 and coalesce=True
   - Cleanup runs at 03:00 UTC daily
   - Daily reports at 22:00 UTC (= 06:00 Beijing time — reasonable?)
   - Weekly reports on Sunday 22:00 UTC
   - Monthly reports on last day of month 22:00 UTC
   - Market indices refresh every 60 seconds (IntervalTrigger)
   Flag any scheduling conflicts or concerns.

3. MARKET INDICES SERVICE:
   Read market_indices.py and verify:
   a. _is_trading() returns False on weekends (Saturday=5, Sunday=6)
   b. _is_trading() returns False outside open/close times for each exchange
   c. Fallback values are used when no API key is present
   d. _sparkline() generates exactly 480 data points
   e. Cache TTL is 60 seconds (CACHE_TTL_SECONDS)
   f. If FINNHUB_KEY is set, test a real quote fetch:
      Run the _fetch_finnhub_quote function for SPX config and verify it returns (float, float)

4. REPORT GENERATION:
   Read jobs.py, specifically generate_scheduled_reports and _period_for:
   a. Verify _period_for(DAILY) returns (today, today)
   b. Verify _period_for(WEEKLY) returns (today-6, today)
   c. Verify _period_for(MONTHLY) returns (first_of_month, today)
   d. Read report_generator.py and verify the generated markdown format:
      - Has proper headings
      - Includes sentiment analysis summary
      - Includes source attribution

5. REDIS LOCK:
   python -m pytest tests/test_redis_lock.py -v
   Verify:
   - Lock prevents concurrent collection of the same source
   - Lock auto-releases after TTL expires
   - Different sources can be collected in parallel (different lock keys)

Output: scheduler health report with any timing concerns flagged.
```

---

## Layer 1 — UI Layout & Visual Consistency

### Prompt (for agents with browser/screenshot capability)

```
You are working on the SIGMA project frontend.
The app is running at http://localhost:3000.

If you have browser automation capability (Playwright MCP, computer use, browser tool, etc.),
use it. If not, read the source code in sigma-frontend/src/ and perform static analysis only.

VISUAL AUDIT — navigate to each page and capture screenshots:

1. Homepage (http://localhost:3000/zh):
   - Market index chart: check x-axis labels for overlapping text
   - Stats row: verify all 4 cards have identical height, padding, and font sizes
   - MarketTickerCarousel: verify smooth scrolling, no text clipping
   - Search/filter bar: verify the two dropdown buttons have properly aligned labels
   - Item cards: verify consistent spacing between cards

2. Reports page (/zh/reports):
   - Card grid: verify equal spacing and consistent card dimensions
   - Empty state: verify friendly message when no reports exist

3. Watchlist page (/zh/watchlist):
   - CRUD buttons: verify consistent button sizes and icon alignment
   - Empty state handling

4. Settings page (/zh/settings):
   - Form inputs: verify all inputs have same height (h-12), same border radius (rounded-2xl)
   - LLM config section: check layout balance
   - Toggle switches: verify alignment with labels

5. Admin panels (if accessible):
   - Data tables: verify column widths are consistent
   - Action buttons: verify aligned and properly spaced

FOR EACH PAGE, CHECK:
- All spacing follows 4px grid (4/8/12/16/24/32/48)
- All interactive elements have minimum 44px touch targets
- Color usage follows sigma-text / sigma-muted / sigma-accent / sigma-success / sigma-danger
- Font size hierarchy: headings > body > captions (no two levels using same size)
- Loading states show skeleton placeholders (not blank)
- Empty states have descriptive messages
- No horizontal overflow on any viewport width

Fix every issue found. After each fix, re-verify with a screenshot or re-read the code.
```

### Prompt (static code analysis — no browser needed)

```
You are working on the SIGMA project frontend (sigma-frontend/src/).
Perform a comprehensive static UI audit on ALL component files:

1. SPACING CONSISTENCY:
   Search for hardcoded pixel values in className strings.
   Flag any spacing that doesn't follow the Tailwind scale (p-1, p-2, p-3, p-4, p-5, p-6, etc.).
   Flag any raw inline styles with pixel values.

2. COMPONENT HEIGHT CONSISTENCY:
   All interactive elements should be h-12 (48px):
   - Check Button.tsx, Input.tsx, Select.tsx, CustomSelect.tsx
   - Flag any component using h-10, h-11, h-14 or other non-standard heights

3. BORDER RADIUS CONSISTENCY:
   The project uses rounded-2xl for cards/inputs and rounded-xl for smaller elements.
   Search for rounded-lg, rounded-md, or rounded-full on elements that should match.

4. COLOR VARIABLE USAGE:
   Search for hardcoded colors (text-gray-*, bg-gray-*, text-white, bg-black, etc.).
   These should use CSS variables: text-sigma-text, bg-sigma-bg, text-sigma-muted, etc.
   Exceptions: icon backgrounds (bg-red-600, bg-blue-600, etc.) are intentional.

5. FONT WEIGHT HIERARCHY:
   - Headings: font-bold or font-semibold
   - Body: font-medium
   - Captions: font-medium text-sigma-muted
   Flag any body text using font-bold (visual hierarchy violation).

6. RESPONSIVE BREAKPOINTS:
   Check that all grid layouts have mobile-first responsive classes:
   - grid-cols-1 → sm:grid-cols-2 → md:grid-cols-3 or similar
   - No layout that only works on desktop (pure grid-cols-4 without mobile fallback)

7. i18n COMPLETENESS:
   Read messages/zh.json and messages/en.json.
   Find any key present in one but missing in the other.
   Find any component using hardcoded Chinese or English strings instead of t("key").

Fix all issues found. Run: cd sigma-frontend && npm run build
Verify zero TypeScript errors and zero build warnings.
```

---

## Layer 2 — Frontend Logic & Interactions

### Prompt (for agents with browser capability)

```
You are working on the SIGMA project frontend at http://localhost:3000.
Use browser automation to test all interactive features end-to-end.

1. REGISTRATION FLOW:
   - Navigate to /zh/register
   - Fill: username "e2etest", email "e2e@test.com", password "Test1234!"
   - Submit the form
   - Verify: redirected to homepage with authenticated state
   - If registration fails, capture the error and fix the issue

2. LOGIN FLOW:
   - Logout first (if logged in)
   - Navigate to /zh/login
   - Login with the credentials from step 1
   - Verify: redirected to homepage, navbar shows username

3. HOMEPAGE INTERACTIONS:
   - Verify market chart renders (SVG/canvas element present with data)
   - Type "stock" in search box → verify item list filters
   - Select "金融" from category dropdown → verify list updates
   - Select "美国" from market dropdown → verify list updates
   - Clear all filters → verify full list returns
   - Scroll to bottom → verify infinite scroll triggers (new items load)

4. WATCHLIST CRUD:
   - Navigate to /zh/watchlist
   - Click "create watchlist" button
   - Enter name "E2E Test List"
   - Add keywords: "Apple", "Tesla"
   - Save → verify list appears
   - Edit the list → change name
   - Delete the list → verify removed

5. REPORTS:
   - Navigate to /zh/reports
   - If reports exist: click one, verify detail page renders markdown correctly
   - If no reports: verify empty state message is shown

6. SETTINGS:
   - Navigate to /zh/settings
   - Change a setting (e.g., locale preference)
   - Save → verify toast notification appears
   - Refresh page → verify setting persisted

7. LANGUAGE SWITCHING:
   - Switch to English (/en)
   - Navigate through: homepage, reports, watchlist, settings
   - Verify ALL visible text is in English (no Chinese characters except user content)
   - Switch back to Chinese (/zh)
   - Verify ALL UI text is in Chinese

8. TOKEN REFRESH:
   - Login normally
   - Wait for access token to expire (or manually clear it from localStorage)
   - Try to load /zh/items → verify the app silently refreshes the token
   - If refresh fails, verify redirect to login page

For each step: capture a screenshot on success, capture error state on failure.
Fix all issues found. Re-run the failed steps after each fix.
```

### Prompt (no browser — code review only)

```
You are working on sigma-frontend/src/. Audit all frontend logic without running the app.

1. API CLIENT (lib/api.ts):
   - Verify apiFetch handles 401 → refresh → retry flow correctly
   - Verify redirect to login when refresh fails
   - Check for race condition: multiple simultaneous 401s should not trigger multiple refreshes
     (there's a refreshPromise dedup — verify it works)

2. REACT QUERY HOOKS (hooks/):
   For each hook file (useItems, useReports, useWatchlists, useStats, useAdmin, etc.):
   - Verify queryKey uniqueness (no two different queries sharing the same key)
   - Verify error handling (are errors surfaced to UI or silently swallowed?)
   - Verify pagination: getNextPageParam returns undefined when no more pages

3. AUTH CONTEXT (components/AuthProvider.tsx, lib/auth.ts):
   - Verify login/logout update React state correctly
   - Verify ProtectedRoute redirects unauthenticated users
   - Check for localStorage SSR issues (window check before access)

4. FORM VALIDATION:
   - Login form: verify it validates email format and password length before submit
   - Register form: same checks
   - Watchlist form: verify name is required
   - Settings form: verify it doesn't submit unchanged data

5. ERROR BOUNDARIES:
   - Check if any page has error boundary wrapping
   - If not, add a top-level error boundary in layout.tsx

Fix all issues found. Run: npm run build && npm run lint (if lint is configured).
```

---

## Layer-0 Prompt — Run Everything

If your agent supports long autonomous sessions, use this single prompt to execute all layers:

```
You are working on the SIGMA project (full-stack financial intelligence platform).
Read the file SIGMA-FULL-STACK-WORKFLOW.md in the project root.

Execute all 8 layers in order (Layer 8 first, Layer 2 last).
For each layer:
1. Run existing tests first. Fix all failures before adding new checks.
2. Perform the additional verifications described in the workflow doc.
3. Fix every issue you find. After each fix, re-verify.
4. Output a brief status line: "Layer N: ✅ all checks passed" or "Layer N: ❌ X issues remaining"

Rules:
- When an API key is required but not configured, skip that specific test and note it.
- Never modify test files to make failing tests pass by weakening assertions.
- After ALL layers are complete, run the full test suite one final time:
    cd sigma-backend && python -m pytest --tb=short -q
    cd ../sigma-frontend && npm run build
- Generate a file called AUDIT-REPORT.md with:
    - Summary table (layer / checks passed / checks failed / skipped)
    - List of all code changes made (file + description)
    - List of remaining known issues (things that need API keys, manual testing, etc.)
    - Recommendations for next steps
```

---

## Tool Recommendations by Agent

| Agent                        | Browser Testing           | Code Editing       | Best For                         |
| ---------------------------- | ------------------------- | ------------------ | -------------------------------- |
| Claude Code + Playwright MCP | ✅ Full (screenshot + DOM) | ✅ Direct file edit | Layers 1-2 (UI) + all others     |
| Claude Code (no MCP)         | ❌ Code analysis only      | ✅ Direct file edit | Layers 3-8 (backend)             |
| Codex (OpenAI)               | ❌ Code analysis only      | ✅ Via PR           | Layers 3-8, one prompt at a time |
| Cursor                       | ✅ With browser extension  | ✅ Direct file edit | All layers if configured         |
| Windsurf                     | ✅ With Playwright plugin  | ✅ Direct file edit | All layers if configured         |
| Gemini CLI + Playwright MCP  | ✅ Full                    | ✅ Direct file edit | Same as Claude Code              |

For agents without browser capability, use the "(no browser — code review only)" variant
of Layers 1 and 2. The backend layers (3-8) work identically across all agents.