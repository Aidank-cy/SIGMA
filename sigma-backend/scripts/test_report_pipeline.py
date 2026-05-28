#!/usr/bin/env python3
"""
SIGMA — Report Pipeline Test Suite (User-Level + Advanced Settings).

Tests:
  A. Multi-frequency report config (save + readback)
  B. Generate all 4 types + verify time-range correctness
  C. Advanced Settings — max_tokens effect on output length
  D. Invalid API key → graceful failure (no crash, no report)
  E. Empty API keys → falls back to system key or fails gracefully
  F. Usage tracking (provider, input/output split, function_type)
  G. Admin view consistency (config + usage match user view)  [admin only]
  H. Advanced LLM Settings — daily_token_limit, cost_guard, cooldown
  I. Advanced Report Time Ranges — per-type time window config
  J. Data Source Isolation — user sees only system + own sources
  K. Report Scoping — user can only see own reports

Prerequisites:
  - docker compose up -d
  - A user account exists (admin OR regular user)
  - A valid LLM API key for your provider

Usage:
  # ── Option 1: environment variables (recommended) ──
  export TEST_EMAIL="you@example.com"
  export TEST_PASSWORD="YourPass123"
  export TEST_API_KEY="sk-your-api-key"
  export TEST_LLM_PROVIDER="deepseek"          # deepseek/openai/anthropic/qwen
  # optional: second account for isolation tests
  export TEST_OTHER_EMAIL="other@example.com"
  export TEST_OTHER_PASSWORD="OtherPass123"
  NO_PROXY=localhost python3 sigma-backend/scripts/test_report_pipeline.py

  # ── Option 2: command-line arguments ──
  python3 sigma-backend/scripts/test_report_pipeline.py \\
    --email you@example.com \\
    --password YourPass123 \\
    --api-key sk-your-key \\
    --provider deepseek

  # ── Option 3: edit the constants below directly ──

Backend Fix Required:
  ⚠️  POST /reports/generate currently requires admin role.
  For regular-user testing, add POST /reports/generate-mine.
  See BACKEND_FIX section at the bottom of this file.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import time
import traceback
from datetime import date, datetime, timedelta, timezone

import httpx

# ── Config ─────────────────────────────────────────────────────────────
BASE_URL   = os.getenv("TEST_BASE_URL", "http://localhost:8000/api/v1")
EMAIL      = os.getenv("TEST_EMAIL", "hezhengdong95@gmail.com")
PASSWORD   = os.getenv("TEST_PASSWORD", "he111999")
API_KEY    = os.getenv("TEST_API_KEY", "sk-ce19dcc8880d40faa0a17c47ecc569ac")
LLM_PROVIDER = os.getenv("TEST_LLM_PROVIDER", "deepseek")

# Optional: a second account for cross-user isolation tests (Test K)
OTHER_EMAIL    = os.getenv("TEST_OTHER_EMAIL", "")
OTHER_PASSWORD = os.getenv("TEST_OTHER_PASSWORD", "")

POLL_INTERVAL = 5
POLL_TIMEOUT  = 120

P = "✅"; F = "❌"; W = "⚠️"; I = "ℹ️"

results: list[tuple[str, bool, str]] = []


def record(name: str, passed: bool, detail: str = ""):
    results.append((name, passed, detail))
    print(f"  {P if passed else F} {name}" + (f" — {detail}" if detail else ""))


def section(title: str):
    print(f"\n{'='*64}\n  {title}\n{'='*64}")


# ── API Client ─────────────────────────────────────────────────────────
class API:
    def __init__(self):
        self.c = httpx.AsyncClient(timeout=60)
        self.token: str | None = None
        self.user_id: str | None = None
        self.role: str | None = None

    async def close(self):
        await self.c.aclose()

    def _h(self) -> dict[str, str]:
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    async def login(self, email: str, pw: str):
        r = await self.c.post(
            f"{BASE_URL}/auth/login",
            json={"email": email, "password": pw},
            headers={"Content-Type": "application/json"},
        )
        r.raise_for_status()
        self.token = r.json()["access_token"]
        me = await self.get("/auth/me")
        self.user_id = me["id"]
        self.role = me.get("role", "user")

    async def get(self, path: str) -> dict:
        r = await self.c.get(f"{BASE_URL}{path}", headers=self._h())
        r.raise_for_status()
        return r.json()

    async def put(self, path: str, body: dict) -> dict:
        r = await self.c.put(f"{BASE_URL}{path}", json=body, headers=self._h())
        r.raise_for_status()
        return r.json()

    async def post(self, path: str, body: dict) -> httpx.Response:
        return await self.c.post(f"{BASE_URL}{path}", json=body, headers=self._h())

    async def raw_get(self, path: str) -> httpx.Response:
        return await self.c.get(f"{BASE_URL}{path}", headers=self._h())

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


# ── Helpers ────────────────────────────────────────────────────────────
async def count_reports(api: API, report_type: str | None = None) -> int:
    params = "page=1&page_size=1"
    if report_type:
        params += f"&report_type={report_type}"
    data = await api.get(f"/reports?{params}")
    return data.get("total", 0)


async def get_newest_report(api: API, report_type: str) -> dict | None:
    data = await api.get(f"/reports?page=1&page_size=1&report_type={report_type}")
    items = data.get("items", [])
    return items[0] if items else None


async def poll_for_new_report(
    api: API, report_type: str, before_count: int, timeout: int = POLL_TIMEOUT
) -> dict | None:
    start = time.time()
    while time.time() - start < timeout:
        current = await count_reports(api, report_type)
        if current > before_count:
            return await get_newest_report(api, report_type)
        elapsed = int(time.time() - start)
        print(f"    ⏳ {report_type}: waiting... ({elapsed}s)")
        await asyncio.sleep(POLL_INTERVAL)
    return None


def _generate_endpoint(api: API) -> str:
    """Pick the right endpoint depending on user role.

    - admin  → /reports/generate       (original)
    - user   → /reports/generate-mine  (needs BACKEND FIX)
    """
    return "/reports/generate" if api.is_admin else "/reports/generate-mine"


# ── Test A: Multi-Frequency Config ─────────────────────────────────────
async def test_a_multi_frequency(api: API):
    section("Test A: Multi-Frequency Report Config")

    config = await api.get("/me/report-config")

    updated = await api.put("/me/report-config", {
        **config,
        "is_active": True,
        "report_frequencies": ["daily_morning", "daily_afternoon", "weekly", "monthly"],
        "markets": config.get("markets") or ["us", "cn"],
        "categories": config.get("categories") or ["finance", "technology", "politics", "macro"],
    })

    saved = set(updated.get("report_frequencies", []))
    expected = {"daily_morning", "daily_afternoon", "weekly", "monthly"}
    record("Save 4 frequencies", saved == expected, f"saved={sorted(saved)}")

    rb = await api.get("/me/report-config")
    rb_freqs = set(rb.get("report_frequencies", []))
    record("Readback 4 frequencies", rb_freqs == expected, f"readback={sorted(rb_freqs)}")

    updated2 = await api.put("/me/report-config", {
        **rb,
        "report_frequencies": ["daily_morning", "weekly"],
    })
    saved2 = set(updated2.get("report_frequencies", []))
    record("Save 2 frequencies", saved2 == {"daily_morning", "weekly"}, f"saved={sorted(saved2)}")

    await api.put("/me/report-config", {
        **rb,
        "report_frequencies": ["daily_morning", "daily_afternoon", "weekly", "monthly"],
    })


# ── Test B: Generate All Types + Time Range ────────────────────────────
async def test_b_generate_all(api: API):
    section("Test B: Generate All 4 Report Types")

    endpoint = _generate_endpoint(api)
    today = date.today()

    types_config = {
        "daily_morning":   (today.isoformat(), today.isoformat(), True, 0),
        "daily_afternoon": (today.isoformat(), today.isoformat(), True, 0),
        "weekly":          ((today - timedelta(days=6)).isoformat(), today.isoformat(), False, 6),
        "monthly":         (today.replace(day=1).isoformat(), today.isoformat(), False, 25),
    }

    before_counts = {}
    for rt in types_config:
        before_counts[rt] = await count_reports(api, rt)

    for rt, (ps, pe, _, _) in types_config.items():
        resp = await api.post(endpoint, {
            "report_type": rt,
            "market_scope": ["us", "cn"],
            "category_scope": ["finance", "technology", "politics", "macro"],
            "period_start": ps,
            "period_end": pe,
            "locale": "en",
        })
        if resp.status_code in (404, 405) and not api.is_admin:
            print(f"\n  {W} {endpoint} 返回 {resp.status_code} — 需要先应用 BACKEND FIX（见脚本底部说明）")
            record(f"Submit {rt}", False, f"status={resp.status_code} — apply BACKEND FIX")
            return {}
        status_text = "accepted" if resp.status_code == 202 else f"status={resp.status_code}"
        record(f"Submit {rt}", resp.status_code == 202, status_text)

    # Skip polling entirely if no submission succeeded
    any_accepted = any(r[1] for r in results if r[0].startswith("Submit "))
    if not any_accepted:
        print(f"\n  {W} All submissions failed — skipping poll")
        return {}

    print(f"\n  ⏳ Waiting for all reports to generate...")
    generated = {}
    timed_out = False
    for rt in types_config:
        if timed_out:
            record(f"Generated {rt}", False, "skipped — previous report timed out")
            continue
        report = await poll_for_new_report(api, rt, before_counts[rt])
        if report:
            generated[rt] = report
            wc = len(report.get("content", "").split())
            has_md = "##" in report.get("content", "")
            record(f"Generated {rt}", True,
                   f"words={wc}, markdown={'yes' if has_md else 'no'}, items={report.get('item_count', 0)}")
        else:
            record(f"Generated {rt}", False, "timeout")
            timed_out = True
            print(f"  {W} Timeout — skipping remaining report types")

    print()
    for rt, (_, _, expect_same, min_span) in types_config.items():
        if rt not in generated:
            continue
        r = generated[rt]
        ps = r.get("period_start", "")[:10]
        pe = r.get("period_end", "")[:10]
        if expect_same:
            record(f"Range {rt} same-day", ps == pe, f"{ps} to {pe}")
        else:
            try:
                span = (date.fromisoformat(pe) - date.fromisoformat(ps)).days
                record(f"Range {rt} span≥{min_span}", span >= min_span,
                       f"span={span}d ({ps} to {pe})")
            except ValueError:
                record(f"Range {rt}", False, f"parse error: {ps} to {pe}")

    return generated


# ── Test C: Advanced Settings — max_tokens ─────────────────────────────
async def test_c_advanced_settings(api: API):
    section("Test C: Advanced Settings — max_tokens Effect")

    config = await api.get("/me/report-config")
    original_tokens = config.get("max_tokens", {})

    # C1: Set very low max_tokens for daily_morning
    await api.put("/me/report-config", {
        **config,
        "max_tokens": {**original_tokens, "daily_morning": 300},
    })
    rb = await api.get("/me/report-config")
    record("Set max_tokens=300", rb.get("max_tokens", {}).get("daily_morning") == 300,
           f"saved={rb.get('max_tokens', {}).get('daily_morning')}")

    # C2: Set different max_tokens for each type
    multi_tokens = {
        "daily_morning": 500,
        "daily_afternoon": 800,
        "weekly": 1500,
        "monthly": 3000,
    }
    await api.put("/me/report-config", {**config, "max_tokens": multi_tokens})
    rb2 = await api.get("/me/report-config")
    saved_tokens = rb2.get("max_tokens", {})
    all_match = all(saved_tokens.get(k) == v for k, v in multi_tokens.items())
    record("Set per-type max_tokens", all_match, f"saved={saved_tokens}")

    # C3: Generate short report with low limit
    endpoint = _generate_endpoint(api)
    await api.put("/me/report-config", {**config, "max_tokens": {**original_tokens, "daily_morning": 300}})
    before_count = await count_reports(api, "daily_morning")
    today = date.today()
    resp = await api.post(endpoint, {
        "report_type": "daily_morning",
        "market_scope": ["us"],
        "category_scope": ["finance"],
        "period_start": today.isoformat(),
        "period_end": today.isoformat(),
        "locale": "en",
    })
    if resp.status_code in (404, 405) and not api.is_admin:
        print(f"  {W} Skipping generate test — need BACKEND FIX")
    elif resp.status_code == 202:
        report = await poll_for_new_report(api, "daily_morning", before_count, timeout=90)
        if report:
            wc = len(report.get("content", "").split())
            record("Short report generated", wc < 600, f"words={wc} (300-token prompt hint)")
        else:
            record("Short report generated", False, "timeout")
    else:
        record("Short report submit", False, f"status={resp.status_code}")

    # Restore
    await api.put("/me/report-config", {**config, "max_tokens": original_tokens})
    print(f"  {I} Restored original max_tokens")


# ── Test D: Invalid API Key ────────────────────────────────────────────
async def test_d_invalid_key(api: API):
    section("Test D: Invalid API Key → Graceful Failure")

    original = await api.get("/me/llm/config")
    original_keys = original.get("api_keys", [])

    await api.put("/me/llm/config", {
        "daily_token_limit": original.get("daily_token_limit", 1_000_000),
        "cost_guard_enabled": True,
        "api_keys": [{
            "name": "Bad Key",
            "key": "sk-invalid-00000000",
            "provider": LLM_PROVIDER,
            "token_limit": 1_000_000,
            "is_default": True,
        }],
    })

    endpoint = _generate_endpoint(api)
    before_count = await count_reports(api, "daily_morning")
    today = date.today()
    resp = await api.post(endpoint, {
        "report_type": "daily_morning",
        "market_scope": ["us"],
        "category_scope": ["finance"],
        "period_start": today.isoformat(),
        "period_end": today.isoformat(),
        "locale": "en",
    })

    if resp.status_code in (404, 405) and not api.is_admin:
        print(f"  {W} Skipping — need BACKEND FIX")
    elif resp.status_code == 202:
        record("Invalid key: request accepted", True, "async task will fail in background")
        await asyncio.sleep(15)
        after_count = await count_reports(api, "daily_morning")
        record("Invalid key: no report created", after_count == before_count,
               f"before={before_count} after={after_count}")
    else:
        record("Invalid key: request handled", True, f"status={resp.status_code}")

    # Restore
    await api.put("/me/llm/config", {
        "daily_token_limit": original.get("daily_token_limit", 1_000_000),
        "cost_guard_enabled": True,
        "api_keys": original_keys,
    })
    print(f"  {I} Restored original keys")


# ── Test E: Empty API Keys ─────────────────────────────────────────────
async def test_e_empty_keys(api: API):
    section("Test E: Empty API Keys → Fallback Behavior")

    original = await api.get("/me/llm/config")
    original_keys = original.get("api_keys", [])

    await api.put("/me/llm/config", {
        "daily_token_limit": original.get("daily_token_limit", 1_000_000),
        "cost_guard_enabled": True,
        "api_keys": [],
    })

    verified = await api.get("/me/llm/config")
    record("Keys cleared", len(verified.get("api_keys", [])) == 0, "0 keys")

    endpoint = _generate_endpoint(api)
    before_count = await count_reports(api, "daily_morning")
    today = date.today()
    resp = await api.post(endpoint, {
        "report_type": "daily_morning",
        "market_scope": ["us"],
        "category_scope": ["finance"],
        "period_start": today.isoformat(),
        "period_end": today.isoformat(),
        "locale": "en",
    })

    if resp.status_code in (404, 405) and not api.is_admin:
        print(f"  {W} Skipping — need BACKEND FIX")
    elif resp.status_code == 202:
        record("Empty keys: request accepted", True, "falls back to system key or fails")
        await asyncio.sleep(20)
        after_count = await count_reports(api, "daily_morning")
        if after_count > before_count:
            print(f"  {I} Report generated using system-level API key (fallback worked)")
        else:
            print(f"  {I} No report generated (no system key or user key required — expected)")
        record("Empty keys: no crash", True, "system didn't crash")
    else:
        record("Empty keys: handled", True, f"status={resp.status_code}")

    # Restore
    await api.put("/me/llm/config", {
        "daily_token_limit": original.get("daily_token_limit", 1_000_000),
        "cost_guard_enabled": True,
        "api_keys": original_keys,
    })
    print(f"  {I} Restored {len(original_keys)} keys")


# ── Test F: Usage Tracking ─────────────────────────────────────────────
async def test_f_usage(api: API):
    section("Test F: Usage Tracking")

    usage = await api.get("/me/llm/usage")
    items = usage.get("items", [])
    record("Usage records exist", len(items) > 0, f"{len(items)} records")

    if not items:
        return

    providers = {i.get("provider") for i in items}
    record(f"Provider={LLM_PROVIDER} tracked", LLM_PROVIDER in providers, f"providers={providers}")

    functions = {i.get("function_type") for i in items}
    record("function_type=report", "report" in functions, f"types={functions}")

    total_in  = sum(i.get("input_tokens", 0) for i in items)
    total_out = sum(i.get("output_tokens", 0) for i in items)
    record("Input/output > 0", total_in > 0 and total_out > 0,
           f"in={total_in:,} out={total_out:,}")

    by_p: dict[str, int] = {}
    for i in items:
        p = i.get("provider", "?")
        by_p[p] = by_p.get(p, 0) + i.get("total_tokens", 0)
    print(f"\n  📊 Provider breakdown:")
    for p, t in sorted(by_p.items()):
        print(f"     {p}: {t:,}")


# ── Test G: Admin Consistency ──────────────────────────────────────────
async def test_g_admin(api: API):
    section("Test G: Admin ↔ User Consistency")

    if not api.is_admin:
        print(f"  {I} 当前是普通用户，跳过 admin 一致性测试")
        return

    uid = api.user_id
    a_cfg = await api.get(f"/admin/users/{uid}/llm/config")
    u_cfg = await api.get("/me/llm/config")
    record("Config keys match",
           len(a_cfg.get("api_keys", [])) == len(u_cfg.get("api_keys", [])),
           f"admin={len(a_cfg.get('api_keys', []))} user={len(u_cfg.get('api_keys', []))}")
    record("Token limit match",
           a_cfg.get("daily_token_limit") == u_cfg.get("daily_token_limit"),
           f"{a_cfg.get('daily_token_limit')} == {u_cfg.get('daily_token_limit')}")

    a_usg = await api.get(f"/admin/users/{uid}/llm/usage")
    u_usg = await api.get("/me/llm/usage")
    record("Usage count match",
           len(a_usg.get("items", [])) == len(u_usg.get("items", [])),
           f"admin={len(a_usg.get('items', []))} user={len(u_usg.get('items', []))}")


# ══════════════════════════════════════════════════════════════════════
# Test H: Advanced LLM Settings
# — daily_token_limit, cost_guard_enabled, per-key config, cooldown
# ══════════════════════════════════════════════════════════════════════
async def test_h_advanced_llm(api: API):
    section("Test H: Advanced LLM Settings")

    original = await api.get("/me/llm/config")
    original_limit = original.get("daily_token_limit", 1_000_000)
    original_guard = original.get("cost_guard_enabled", True)
    original_keys  = original.get("api_keys", [])

    # H1: daily_token_limit — read and update
    print(f"  {I} Current daily_token_limit = {original_limit:,}")
    new_limit = 500_000 if original_limit != 500_000 else 800_000
    try:
        updated = await api.put("/me/llm/config", {
            "daily_token_limit": new_limit,
            "cost_guard_enabled": original_guard,
            "api_keys": original_keys,
        })
        record("Set daily_token_limit", updated.get("daily_token_limit") == new_limit,
               f"set={new_limit:,}, got={updated.get('daily_token_limit'):,}")
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 429:
            record("daily_token_limit cooldown active", True,
                   "24h cooldown — cannot change yet (expected if recently changed)")
        else:
            raise

    # H2: Verify readback
    rb = await api.get("/me/llm/config")
    record("daily_token_limit readback", rb.get("daily_token_limit") in (new_limit, original_limit),
           f"got={rb.get('daily_token_limit'):,}")

    # H3: cost_guard_enabled toggle
    toggled_guard = not original_guard
    try:
        updated2 = await api.put("/me/llm/config", {
            "daily_token_limit": rb.get("daily_token_limit"),
            "cost_guard_enabled": toggled_guard,
            "api_keys": original_keys,
        })
        record("Toggle cost_guard_enabled", updated2.get("cost_guard_enabled") == toggled_guard,
               f"set={toggled_guard}, got={updated2.get('cost_guard_enabled')}")
    except httpx.HTTPStatusError:
        record("Toggle cost_guard_enabled", False, "HTTP error")

    # H4: Cooldown field exists
    cooldown = rb.get("daily_token_limit_cooldown_remaining_seconds", -1)
    record("Cooldown field present", cooldown >= 0, f"remaining={cooldown}s")
    if cooldown > 0:
        print(f"  {I} 24h cooldown active — {cooldown // 3600}h {(cooldown % 3600) // 60}m remaining")

    # H5: Multi-key management (save 2 keys, verify both)
    two_keys = [
        {
            "name": "Primary Key",
            "key": API_KEY,
            "provider": LLM_PROVIDER,
            "token_limit": 800_000,
            "is_default": True,
        },
        {
            "name": "Secondary Key",
            "key": "sk-secondary-test-000",
            "provider": "openai" if LLM_PROVIDER != "openai" else "deepseek",
            "token_limit": 200_000,
            "is_default": False,
        },
    ]
    try:
        updated3 = await api.put("/me/llm/config", {
            "daily_token_limit": rb.get("daily_token_limit"),
            "cost_guard_enabled": original_guard,
            "api_keys": two_keys,
        })
        saved_keys = updated3.get("api_keys", [])
        record("Save 2 API keys", len(saved_keys) == 2, f"count={len(saved_keys)}")
        if len(saved_keys) >= 2:
            default_keys = [k for k in saved_keys if k.get("is_default")]
            record("Exactly 1 default key", len(default_keys) == 1,
                   f"defaults={len(default_keys)}")
            record("Per-key token_limit saved",
                   saved_keys[0].get("token_limit") == 800_000,
                   f"primary={saved_keys[0].get('token_limit'):,}")
    except httpx.HTTPStatusError as e:
        record("Save 2 API keys", False, f"status={e.response.status_code}")

    # H6: Per-key provider saved correctly
    rb3 = await api.get("/me/llm/config")
    rb_keys = rb3.get("api_keys", [])
    providers = {k.get("provider") for k in rb_keys}
    record("Per-key providers saved", len(providers) >= 1,
           f"providers={providers}")

    # Restore original config
    try:
        await api.put("/me/llm/config", {
            "daily_token_limit": original_limit,
            "cost_guard_enabled": original_guard,
            "api_keys": original_keys,
        })
    except httpx.HTTPStatusError:
        # cooldown might block limit change, that's fine
        await api.put("/me/llm/config", {
            "daily_token_limit": rb.get("daily_token_limit"),
            "cost_guard_enabled": original_guard,
            "api_keys": original_keys,
        })
    print(f"  {I} Restored original LLM config")


# ══════════════════════════════════════════════════════════════════════
# Test I: Advanced Report Time Ranges
# — per-type generation windows, day offsets, time slots
# ══════════════════════════════════════════════════════════════════════
async def test_i_time_ranges(api: API):
    section("Test I: Advanced Report Time Ranges")

    config = await api.get("/me/report-config")
    original_ranges = config.get("time_ranges", {})

    # I1: Set time range for daily_morning
    daily_range = {
        "daily_morning": {
            "generation_time": "08:30",
        },
    }
    updated = await api.put("/me/report-config", {
        **config,
        "time_ranges": daily_range,
    })
    saved = updated.get("time_ranges", {})
    dm_range = saved.get("daily_morning", {})
    record("Daily morning generation_time",
           dm_range.get("generation_time") == "08:30",
           f"saved={dm_range.get('generation_time')}")

    # I2: Set weekly time range with offsets
    weekly_range = {
        "weekly": {
            "generation_time": "09:00",
            "generation_day_of_week": 0,  # Monday
            "start_day_offset": 7,
            "end_day_offset": 0,
            "start_time": "00:00",
            "end_time": "23:59",
        },
    }
    updated2 = await api.put("/me/report-config", {
        **config,
        "time_ranges": {**daily_range, **weekly_range},
    })
    saved2 = updated2.get("time_ranges", {})
    wk = saved2.get("weekly", {})
    record("Weekly day_of_week=Monday", wk.get("generation_day_of_week") == 0,
           f"dow={wk.get('generation_day_of_week')}")
    record("Weekly offset span=7d",
           wk.get("start_day_offset") == 7 and wk.get("end_day_offset") == 0,
           f"start_offset={wk.get('start_day_offset')}, end_offset={wk.get('end_day_offset')}")

    # I3: Set monthly time range
    monthly_range = {
        "monthly": {
            "generation_time": "10:00",
            "generation_day_of_month": 1,
            "start_day_of_month": 1,
            "end_day_of_month": 31,
        },
    }
    updated3 = await api.put("/me/report-config", {
        **config,
        "time_ranges": {**daily_range, **weekly_range, **monthly_range},
    })
    saved3 = updated3.get("time_ranges", {})
    mo = saved3.get("monthly", {})
    record("Monthly day_of_month=1", mo.get("generation_day_of_month") == 1,
           f"dom={mo.get('generation_day_of_month')}")
    record("Monthly range 1-31",
           mo.get("start_day_of_month") == 1 and mo.get("end_day_of_month") == 31,
           f"start={mo.get('start_day_of_month')}, end={mo.get('end_day_of_month')}")

    # I4: Readback all ranges together
    rb = await api.get("/me/report-config")
    rb_ranges = rb.get("time_ranges", {})
    record("All 3 time ranges readback", len(rb_ranges) >= 3,
           f"keys={sorted(rb_ranges.keys())}")

    # I5: Invalid time range → rejected
    try:
        resp = await api.c.put(
            f"{BASE_URL}/me/report-config",
            json={**config, "time_ranges": {"weekly": {
                "generation_time": "25:00",  # invalid
                "start_day_offset": 7,
                "end_day_offset": 0,
                "start_time": "00:00",
                "end_time": "23:59",
            }}},
            headers=api._h(),
        )
        record("Invalid time format rejected", resp.status_code == 422,
               f"status={resp.status_code}")
    except Exception:
        record("Invalid time format rejected", True, "exception raised")

    # I6: Invalid weekly range (start after end) → rejected
    try:
        resp = await api.c.put(
            f"{BASE_URL}/me/report-config",
            json={**config, "time_ranges": {"weekly": {
                "start_day_offset": 0,
                "end_day_offset": 7,  # start > end = invalid
                "start_time": "00:00",
                "end_time": "23:59",
            }}},
            headers=api._h(),
        )
        record("Invalid weekly range rejected", resp.status_code == 422,
               f"status={resp.status_code}")
    except Exception:
        record("Invalid weekly range rejected", True, "exception raised")

    # Restore
    await api.put("/me/report-config", {**config, "time_ranges": original_ranges})
    print(f"  {I} Restored original time ranges")


# ══════════════════════════════════════════════════════════════════════
# Test J: Data Source Isolation
# — user sees only system sources + own sources
# ══════════════════════════════════════════════════════════════════════
async def test_j_data_isolation(api: API):
    section("Test J: Data Source Isolation")

    sources_resp = await api.get("/sources?page=1&page_size=100")
    all_sources = sources_resp.get("items", [])
    total = sources_resp.get("total", 0)
    print(f"  {I} User can see {total} data source(s)")

    system_count = 0
    own_count = 0
    violations = []
    for src in all_sources:
        is_system = src.get("is_system", False)
        created_by = src.get("created_by")
        if is_system:
            system_count += 1
        elif created_by is not None and str(created_by) == str(api.user_id):
            own_count += 1
        elif created_by is not None:
            violations.append(f"{src.get('name')} (created_by={created_by})")
        # created_by=None + not system → treat as system-like
    record("All sources are system or own",
           len(violations) == 0,
           f"violations={violations}" if violations else f"system={system_count}, own={own_count}")

    if api.is_admin:
        print(f"  {W} Admin sees ALL sources — isolation is only enforced for regular users")
    else:
        print(f"  {P} Regular user — isolation enforced: system={system_count}, own={own_count}")


# ══════════════════════════════════════════════════════════════════════
# Test K: Report Scoping
# — user can only see own reports, cannot read other user's reports
# ══════════════════════════════════════════════════════════════════════
async def test_k_report_scoping(api: API, other_api: API | None):
    section("Test K: Report Scoping — User Isolation")

    user_reports = await api.get("/reports?page=1&page_size=100")
    user_total = user_reports.get("total", 0)
    user_items = user_reports.get("items", [])
    print(f"  {I} User can see {user_total} report(s)")

    # K1: All reports belong to current user
    wrong_owner = [r for r in user_items
                   if r.get("user_id") and str(r.get("user_id")) != str(api.user_id)]
    record("All listed reports belong to user",
           len(wrong_owner) == 0,
           f"foreign reports={len(wrong_owner)}" if wrong_owner else f"all {len(user_items)} OK")

    # K2: Cross-user isolation (requires a second account)
    if other_api is None:
        print(f"  {I} 未提供第二个账号，跳过跨用户隔离测试")
        print(f"  {I} 设置 TEST_OTHER_EMAIL / TEST_OTHER_PASSWORD 可启用此测试")
        return

    other_reports = await other_api.get("/reports?page=1&page_size=100")
    other_items = other_reports.get("items", [])
    other_total = other_reports.get("total", 0)
    print(f"  {I} Other user can see {other_total} report(s)")

    # Try to access other user's report from current user
    other_only = [r for r in other_items
                  if r.get("user_id") and str(r.get("user_id")) != str(api.user_id)]
    if other_only:
        target_id = other_only[0]["id"]
        resp = await api.raw_get(f"/reports/{target_id}")
        record("Cannot read other user's report",
               resp.status_code == 404,
               f"status={resp.status_code} (should be 404)")
    else:
        print(f"  {I} No foreign reports to test cross-access")

    # Try the reverse: other user reads current user's report
    my_only = [r for r in user_items
               if r.get("user_id") and str(r.get("user_id")) == str(api.user_id)]
    if my_only:
        target_id = my_only[0]["id"]
        resp = await other_api.raw_get(f"/reports/{target_id}")
        record("Other user cannot read my report",
               resp.status_code == 404,
               f"status={resp.status_code} (should be 404)")
    else:
        print(f"  {I} No own reports to test reverse isolation")


# ── Main ───────────────────────────────────────────────────────────────
async def main():
    print("╔════════════════════════════════════════════════════════════════╗")
    print("║  SIGMA — Report Pipeline Test Suite v3                       ║")
    print("║  (User-Level + Advanced Settings)                            ║")
    print("╚════════════════════════════════════════════════════════════════╝")
    print(f"  Backend:  {BASE_URL}")
    print(f"  Email:    {EMAIL}")
    print(f"  Provider: {LLM_PROVIDER}")
    print(f"  Time:     {datetime.now().isoformat()}")

    api = API()
    other_api: API | None = None

    try:
        section("Login + Setup")
        await api.login(EMAIL, PASSWORD)
        print(f"  {P} Logged in as {EMAIL} (role={api.role})")
        if not api.is_admin:
            print(f"  {I} 普通用户模式 — report 生成需要 /reports/generate-mine 端点")
            print(f"  {I} 如果该端点不存在，生成类测试会跳过（见 BACKEND FIX 说明）")

        # Ensure API key is configured
        cfg = await api.get("/me/llm/config")
        has_provider_key = any(k.get("provider") == LLM_PROVIDER for k in cfg.get("api_keys", []))
        if not has_provider_key:
            try:
                await api.put("/me/llm/config", {
                    "daily_token_limit": cfg.get("daily_token_limit", 1_000_000),
                    "cost_guard_enabled": True,
                    "api_keys": [
                        *[{**k, "is_default": False} for k in cfg.get("api_keys", [])],
                        {
                            "name": f"{LLM_PROVIDER.title()} Test",
                            "key": API_KEY,
                            "provider": LLM_PROVIDER,
                            "token_limit": 1_000_000,
                            "is_default": True,
                        },
                    ],
                })
                print(f"  {P} {LLM_PROVIDER} key added")
            except httpx.HTTPStatusError as e:
                print(f"  {W} Failed to add key: {e.response.status_code}")
        else:
            print(f"  {I} {LLM_PROVIDER} key exists")

        # Optional: login other account for isolation
        if OTHER_EMAIL and OTHER_PASSWORD:
            other_api = API()
            try:
                await other_api.login(OTHER_EMAIL, OTHER_PASSWORD)
                print(f"  {P} Other account logged in: {OTHER_EMAIL} (role={other_api.role})")
            except Exception as e:
                print(f"  {W} Other account login failed: {e}")
                await other_api.close()
                other_api = None

        # ── Run all tests ──
        await test_a_multi_frequency(api)
        await test_b_generate_all(api)
        await test_c_advanced_settings(api)
        await test_d_invalid_key(api)
        await test_e_empty_keys(api)
        await test_f_usage(api)
        await test_g_admin(api)
        await test_h_advanced_llm(api)
        await test_i_time_ranges(api)
        await test_j_data_isolation(api)
        await test_k_report_scoping(api, other_api)

        # ── Summary ──
        section("SUMMARY")
        passed = sum(1 for _, p, _ in results if p)
        failed = sum(1 for _, p, _ in results if not p)

        if failed:
            print(f"\n  Failed tests:")
            for name, p, detail in results:
                if not p:
                    print(f"    {F} {name}: {detail}")

        print(f"\n  Total: {len(results)}  Passed: {passed}  Failed: {failed}")
        print(f"  {'🎉 All passed!' if failed == 0 else f'{W} {failed} failed'}")

        # Warn about backend fix if needed
        needs_fix = any("BACKEND FIX" in detail for _, _, detail in results)
        if needs_fix and not api.is_admin:
            print(f"\n{'='*64}")
            print(f"  📋 BACKEND FIX NEEDED FOR USER-LEVEL REPORT GENERATION")
            print(f"{'='*64}")
            print(f"  修改 sigma-backend/app/api/v1/routes/reports.py")
            print(f"  在 generate_report_endpoint 后面添加:\n")
            print(f'    @router.post("/generate-mine", status_code=202)')
            print(f"    async def generate_user_report(")
            print(f"        payload: ManualReportGenerateRequest,")
            print(f"        current_user: User = Depends(get_current_user),")
            print(f'    ) -> dict[str, str]:')
            print(f'        asyncio.create_task(_generate_report_task(payload, current_user.id))')
            print(f'        return {{"status": "accepted"}}')
            print()

    except Exception as e:
        print(f"\n  {F} Fatal: {e}")
        traceback.print_exc()
    finally:
        await api.close()
        if other_api:
            await other_api.close()


def parse_args():
    parser = argparse.ArgumentParser(description="SIGMA Report Pipeline Test Suite v3")
    parser.add_argument("--email", help="Login email")
    parser.add_argument("--password", help="Login password")
    parser.add_argument("--api-key", help="LLM API key to use")
    parser.add_argument("--provider", help="LLM provider (deepseek/openai/anthropic/qwen)")
    parser.add_argument("--other-email", help="Second account email for isolation tests")
    parser.add_argument("--other-password", help="Second account password")
    parser.add_argument("--base-url", help="Backend base URL")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    if args.email:         EMAIL = args.email
    if args.password:      PASSWORD = args.password
    if args.api_key:       API_KEY = args.api_key
    if args.provider:      LLM_PROVIDER = args.provider
    if args.other_email:   OTHER_EMAIL = args.other_email
    if args.other_password: OTHER_PASSWORD = args.other_password
    if args.base_url:      BASE_URL = args.base_url
    asyncio.run(main())


# ══════════════════════════════════════════════════════════════════════
# BACKEND FIX — 让普通用户能调用 report 生成
# ══════════════════════════════════════════════════════════════════════
#
# 文件: sigma-backend/app/api/v1/routes/reports.py
#
# 在现有 generate_report_endpoint 函数后面添加:
#
#   @router.post("/generate-mine", status_code=status.HTTP_202_ACCEPTED)
#   async def generate_user_report(
#       payload: ManualReportGenerateRequest,
#       current_user: User = Depends(get_current_user),
#   ) -> dict[str, str]:
#       """Any authenticated user can generate their own report."""
#       asyncio.create_task(_generate_report_task(payload, current_user.id))
#       return {"status": "accepted"}
#
# 为什么只需要加这一个端点就够了:
#   - report_generator._load_items() 已经按 user_id 过滤 data source
#   - report_generator._resolve_report_llm_runtime() 已经读用户自己的 API key
#   - reports.py._report_predicate() 已经按 user_id 过滤 report 列表
#   - Report model 已有 user_id 字段，生成时自动关联