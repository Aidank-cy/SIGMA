import { execFileSync } from "node:child_process";
import * as path from "node:path";
import type { FullConfig } from "@playwright/test";

const FRONTEND_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const BACKEND_URL = process.env.E2E_API_BASE_URL ?? "http://localhost:8000/api/v1";

async function waitFor(url: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`);
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  await waitFor(`${BACKEND_URL}/health`);
  await waitFor(FRONTEND_URL);

  const repoRoot = path.resolve(__dirname, "../..");
  execFileSync("python3", [path.join(repoRoot, "sigma-backend/scripts/seed_e2e_data.py")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgresql+asyncpg://sigma:sigma@localhost:5432/sigma",
      REDIS_URL: process.env.E2E_REDIS_URL ?? "redis://localhost:6379/0"
    },
    stdio: "inherit"
  });
}
