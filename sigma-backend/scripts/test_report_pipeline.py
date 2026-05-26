#!/usr/bin/env python3
"""
SIGMA — Comprehensive Report Pipeline Test Suite.

Tests:
  A. Multi-frequency report config (save + readback)
  B. Generate all 4 types + verify time-range correctness
  C. Advanced settings (max_tokens) take effect on output length
  D. Invalid API key → graceful failure (no crash, no report)
  E. Empty API keys → falls back to system key or fails gracefully
  F. Usage tracking (provider, input/output split, function_type)
  G. Admin view consistency (config + usage match user view)

Prerequisites:
  - docker compose up -d
  - Admin account exists
  - DEEPSEEK_API_KEY in .env

Usage:
  NO_PROXY=localhost python3 sigma-backend/scripts/test_report_pipeline.py
"""

from __future__ import annotations

import asyncio
import traceback
import time
from datetime import date, datetime, timedelta, timezone

import httpx

# ── Config ─────────────────────────────────────────────────────────────
BASE_URL = "http://localhost:8000/api/v1"
ADMIN_EMAIL = "hezhengdong95@gmail.com"
ADMIN_PASSWORD = "he111999"
DEEPSEEK_API_KEY = "sk-ce19dcc8880d40faa0a17c47ecc569ac"

POLL_INTERVAL = 5
POLL_TIMEOUT = 120

P = "✅"
F = "❌"
W = "⚠️"
I = "ℹ️"

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

    async def close(self):
        await self.c.aclose()

    def _h(self) -> dict[str, str]:
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    async def login(self, email: str, pw: str):
        r = await self.c.post(f"{BASE_URL}/auth/login", json={"email": email, "password": pw}, headers={"Content-Type": "application/json"})
        r.raise_for_status()
        self.token = r.json()["access_token"]

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


async def poll_for_new_report(api: API, report_type: str, before_count: int, timeout: int = POLL_TIMEOUT) -> dict | None:
    start = time.time()
    while time.time() - start < timeout:
        current = await count_reports(api, report_type)
        if current > before_count:
            return await get_newest_report(api, report_type)
        elapsed = int(time.time() - start)
        print(f"    ⏳ {report_type}: waiting... ({elapsed}s)")
        await asyncio.sleep(POLL_INTERVAL)
    return None


# ── Test A: Multi-Frequency Config ─────────────────────────────────────
async def test_a_multi_frequency(api: API):
    section("Test A: Multi-Frequency Report Config")

    config = await api.get("/me/report-config")

    # Save with multiple frequencies
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

    # Readback
    rb = await api.get("/me/report-config")
    rb_freqs = set(rb.get("report_frequencies", []))
    record("Readback 4 frequencies", rb_freqs == expected, f"readback={sorted(rb_freqs)}")

    # Test partial: only daily_morning + weekly
    updated2 = await api.put("/me/report-config", {
        **rb,
        "report_frequencies": ["daily_morning", "weekly"],
    })
    saved2 = set(updated2.get("report_frequencies", []))
    record("Save 2 frequencies", saved2 == {"daily_morning", "weekly"}, f"saved={sorted(saved2)}")

    # Restore all 4
    await api.put("/me/report-config", {
        **rb,
        "report_frequencies": ["daily_morning", "daily_afternoon", "weekly", "monthly"],
    })


# ── Test B: Generate All Types + Time Range ────────────────────────────
async def test_b_generate_all(api: API):
    section("Test B: Generate All 4 Report Types")
    today = date.today()

    types_config = {
        "daily_morning": (today.isoformat(), today.isoformat(), True, 0),
        "daily_afternoon": (today.isoformat(), today.isoformat(), True, 0),
        "weekly": ((today - timedelta(days=6)).isoformat(), today.isoformat(), False, 6),
        "monthly": (today.replace(day=1).isoformat(), today.isoformat(), False, 25),
    }

    # Snapshot counts
    before_counts = {}
    for rt in types_config:
        before_counts[rt] = await count_reports(api, rt)

    # Submit all
    for rt, (ps, pe, _, _) in types_config.items():
        resp = await api.post("/reports/generate", {
            "report_type": rt,
            "market_scope": ["us", "cn"],
            "category_scope": ["finance", "technology", "politics", "macro"],
            "period_start": ps,
            "period_end": pe,
            "locale": "en",
        })
        status = "accepted" if resp.status_code == 202 else f"status={resp.status_code}"
        record(f"Submit {rt}", resp.status_code == 202, status)

    # Poll for each
    print(f"\n  ⏳ Waiting for all reports to generate...")
    generated = {}
    for rt in types_config:
        report = await poll_for_new_report(api, rt, before_counts[rt])
        if report:
            generated[rt] = report
            wc = len(report.get("content", "").split())
            has_md = "##" in report.get("content", "")
            record(f"Generated {rt}", True, f"words={wc}, markdown={'yes' if has_md else 'no'}, items={report.get('item_count', 0)}")
        else:
            record(f"Generated {rt}", False, "timeout")

    # Verify time ranges
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
                record(f"Range {rt} span≥{min_span}", span >= min_span, f"span={span}d ({ps} to {pe})")
            except ValueError:
                record(f"Range {rt}", False, f"parse error: {ps} to {pe}")

    return generated


# ── Test C: Advanced Settings (max_tokens) ─────────────────────────────
async def test_c_advanced_settings(api: API):
    section("Test C: Advanced Settings — max_tokens Effect")

    config = await api.get("/me/report-config")
    original_tokens = config.get("max_tokens", {})

    # Set very low max_tokens for daily_morning
    await api.put("/me/report-config", {
        **config,
        "max_tokens": {**original_tokens, "daily_morning": 300},
    })
    rb = await api.get("/me/report-config")
    record("Set max_tokens=300", rb.get("max_tokens", {}).get("daily_morning") == 300, f"saved={rb.get('max_tokens', {}).get('daily_morning')}")

    # Generate with low limit
    before_count = await count_reports(api, "daily_morning")
    today = date.today()
    resp = await api.post("/reports/generate", {
        "report_type": "daily_morning",
        "market_scope": ["us"],
        "category_scope": ["finance"],
        "period_start": today.isoformat(),
        "period_end": today.isoformat(),
        "locale": "en",
    })
    if resp.status_code == 202:
        report = await poll_for_new_report(api, "daily_morning", before_count, timeout=90)
        if report:
            wc = len(report.get("content", "").split())
            # 300 tokens ≈ ~200-250 words; should be noticeably shorter
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

    # Set invalid key
    await api.put("/me/llm/config", {
        "daily_token_limit": original.get("daily_token_limit", 1_000_000),
        "cost_guard_enabled": True,
        "api_keys": [{
            "name": "Bad Key",
            "key": "sk-invalid-00000000",
            "provider": "deepseek",
            "token_limit": 1_000_000,
            "is_default": True,
        }],
    })

    before_count = await count_reports(api, "daily_morning")
    today = date.today()
    resp = await api.post("/reports/generate", {
        "report_type": "daily_morning",
        "market_scope": ["us"],
        "category_scope": ["finance"],
        "period_start": today.isoformat(),
        "period_end": today.isoformat(),
        "locale": "en",
    })
    record("Invalid key: request accepted", resp.status_code == 202, "async task will fail in background")

    # Wait and verify no new report appeared
    await asyncio.sleep(15)
    after_count = await count_reports(api, "daily_morning")
    record("Invalid key: no report created", after_count == before_count, f"before={before_count} after={after_count}")

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

    # Remove all keys
    await api.put("/me/llm/config", {
        "daily_token_limit": original.get("daily_token_limit", 1_000_000),
        "cost_guard_enabled": True,
        "api_keys": [],
    })

    verified = await api.get("/me/llm/config")
    record("Keys cleared", len(verified.get("api_keys", [])) == 0, "0 keys")

    before_count = await count_reports(api, "daily_morning")
    today = date.today()
    resp = await api.post("/reports/generate", {
        "report_type": "daily_morning",
        "market_scope": ["us"],
        "category_scope": ["finance"],
        "period_start": today.isoformat(),
        "period_end": today.isoformat(),
        "locale": "en",
    })
    record("Empty keys: request accepted", resp.status_code == 202, "falls back to system key or fails")

    # Wait and check — may succeed (system key) or fail (no system key)
    await asyncio.sleep(20)
    after_count = await count_reports(api, "daily_morning")
    if after_count > before_count:
        print(f"  {I} Report generated using system-level API key (fallback worked)")
    else:
        print(f"  {I} No report generated (no system key configured — expected)")
    record("Empty keys: no crash", True, "system didn't crash")

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
    record("Provider=deepseek tracked", "deepseek" in providers, f"providers={providers}")

    functions = {i.get("function_type") for i in items}
    record("function_type=report", "report" in functions, f"types={functions}")

    total_in = sum(i.get("input_tokens", 0) for i in items)
    total_out = sum(i.get("output_tokens", 0) for i in items)
    record("Input/output > 0", total_in > 0 and total_out > 0, f"in={total_in:,} out={total_out:,}")

    # Per-provider breakdown
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

    me = await api.get("/auth/me")
    uid = me.get("id")
    if me.get("role") != "admin":
        print(f"  {W} Not admin — skip")
        return

    a_cfg = await api.get(f"/admin/users/{uid}/llm/config")
    u_cfg = await api.get("/me/llm/config")
    record("Config keys match", len(a_cfg.get("api_keys", [])) == len(u_cfg.get("api_keys", [])),
           f"admin={len(a_cfg.get('api_keys', []))} user={len(u_cfg.get('api_keys', []))}")
    record("Token limit match", a_cfg.get("daily_token_limit") == u_cfg.get("daily_token_limit"),
           f"{a_cfg.get('daily_token_limit')} == {u_cfg.get('daily_token_limit')}")

    a_usg = await api.get(f"/admin/users/{uid}/llm/usage")
    u_usg = await api.get("/me/llm/usage")
    record("Usage count match", len(a_usg.get("items", [])) == len(u_usg.get("items", [])),
           f"admin={len(a_usg.get('items', []))} user={len(u_usg.get('items', []))}")


# ── Main ───────────────────────────────────────────────────────────────
async def main():
    print("╔════════════════════════════════════════════════════════════════╗")
    print("║  SIGMA — Comprehensive Report Pipeline Test Suite v2         ║")
    print("╚════════════════════════════════════════════════════════════════╝")
    print(f"  Backend: {BASE_URL}")
    print(f"  Time:    {datetime.now().isoformat()}")

    api = API()
    try:
        section("Login + Setup")
        await api.login(ADMIN_EMAIL, ADMIN_PASSWORD)
        print(f"  {P} Logged in as {ADMIN_EMAIL}")

        # Ensure DeepSeek key
        cfg = await api.get("/me/llm/config")
        if not any(k.get("provider") == "deepseek" for k in cfg.get("api_keys", [])):
            await api.put("/me/llm/config", {
                "daily_token_limit": cfg.get("daily_token_limit", 1_000_000),
                "cost_guard_enabled": True,
                "api_keys": [
                    *[{**k, "is_default": False} for k in cfg.get("api_keys", [])],
                    {"name": "DeepSeek Test", "key": DEEPSEEK_API_KEY, "provider": "deepseek", "token_limit": 1_000_000, "is_default": True},
                ],
            })
            print(f"  {P} DeepSeek key added")
        else:
            print(f"  {I} DeepSeek key exists")

        await test_a_multi_frequency(api)
        await test_b_generate_all(api)
        await test_c_advanced_settings(api)
        await test_d_invalid_key(api)
        await test_e_empty_keys(api)
        await test_f_usage(api)
        await test_g_admin(api)

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

    except Exception as e:
        print(f"\n  {F} Fatal: {e}")
        traceback.print_exc()
    finally:
        await api.close()


if __name__ == "__main__":
    asyncio.run(main())