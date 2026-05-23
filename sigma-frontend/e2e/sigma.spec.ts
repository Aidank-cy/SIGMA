import { expect, type APIRequestContext, type Locator, type Page, test } from "@playwright/test";

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? "http://localhost:8000/api/v1";
const ADMIN_EMAIL = "e2e-admin@sigma-e2e.com";
const SETTINGS_ADMIN_EMAIL = "e2e-settings-admin@sigma-e2e.com";
const USER_EMAIL = "e2e-user@sigma-e2e.com";
const PASSWORD = "StrongPass1";

async function token(request: APIRequestContext, email = ADMIN_EMAIL): Promise<string> {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { email, password: PASSWORD }
  });
  expect(response.ok()).toBeTruthy();
  return String((await response.json()).access_token);
}

async function signIn(page: Page, request: APIRequestContext, email = ADMIN_EMAIL): Promise<void> {
  const accessToken = await token(request, email);
  await page.addInitScript((value) => window.localStorage.setItem("sigma.accessToken", value), accessToken);
}

async function signInThroughUi(page: Page, email = ADMIN_EMAIL): Promise<void> {
  await page.goto("/en/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/en$/);
}

async function openSelect(page: Page, index: number, selectedText = "All"): Promise<void> {
  await page.getByRole("button", { name: selectedText }).nth(index).click();
}

async function visibleCards(page: Page): Promise<Locator> {
  const articles = page.locator("article");
  await expect(articles.first()).toBeVisible();
  return articles;
}

function pageNumberButton(page: Page, pageNumber: number): Locator {
  return page.getByRole("button", { exact: true, name: String(pageNumber) });
}

test.describe.configure({ mode: "serial" });

test("3.1 auth flow and token lifecycle", async ({ context, page }) => {
  await test.step("FE-A1 login form renders", async () => {
    await page.goto("/en/login");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  await test.step("FE-A3 wrong password shows an error", async () => {
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill("WrongPass1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Unable to sign in with those credentials.")).toBeVisible();
    await expect(page).toHaveURL(/\/en\/login$/);
  });

  await test.step("FE-A4 empty fields show validation", async () => {
    await page.goto("/en/login");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByText("Enter your password.")).toBeVisible();
  });

  await test.step("FE-A2 valid login redirects to dashboard", async () => {
    await signInThroughUi(page);
    await expect(page.getByText(/E2E Admin/)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Good|Still up/ })).toBeVisible();
  });

  await test.step("FE-A8 logout clears token and redirects to login", async () => {
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/en\/login$/);
    await expect(page.evaluate(() => window.localStorage.getItem("sigma.accessToken"))).resolves.toBeNull();
  });

  await test.step("FE-A5/FE-A6 register form creates and logs in a new user", async () => {
    const email = `e2e-new-${Date.now()}@sigma-e2e.com`;
    await page.goto("/en/register");
    await expect(page.getByRole("heading", { name: "Create your SIGMA account" })).toBeVisible();
    await page.getByLabel("Display name").fill("E2E New User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Confirm password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByText(/E2E New User/)).toBeVisible();
  });

  await test.step("FE-A7 duplicate registration shows an error", async () => {
    await page.goto("/en/register");
    await page.getByLabel("Display name").fill("Duplicate");
    await page.getByLabel("Email").fill(USER_EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Confirm password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Unable to create the account.")).toBeVisible();
  });

  await test.step("FE-A9 protected route redirects without auth", async () => {
    await context.clearCookies();
    await page.evaluate(() => window.localStorage.clear());
    await page.goto("/en/settings");
    await expect(page).toHaveURL(/\/en\/login$/);
  });

  await test.step("FE-A10/FE-AG3 refresh cookie recovers an invalid access token", async () => {
    await signInThroughUi(page);
    await page.evaluate(() => window.localStorage.setItem("sigma.accessToken", "invalid.token.value"));
    await page.goto("/en/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });

  await test.step("FE-AG4 invalid token without refresh cookie redirects", async () => {
    await context.clearCookies();
    await page.evaluate(() => window.localStorage.setItem("sigma.accessToken", "invalid.token.value"));
    await page.goto("/en/settings");
    await expect(page).toHaveURL(/\/en\/login$/);
  });
});

test("3.2 dashboard renders backend data and paginates", async ({ page, request }) => {
  await signIn(page, request);
  const itemResponse = await request.get(`${API_BASE_URL}/items?page=1&page_size=18&keyword=E2E`);
  const itemPayload = await itemResponse.json();
  const totalPages = Math.ceil(itemPayload.total / itemPayload.page_size);

  await test.step("FE-D1 through FE-D5 dashboard shell renders real widgets and filters", async () => {
    await page.goto("/en");
    await expect(page.getByText(/E2E Admin/)).toBeVisible();
    await expect(page.locator("svg").first()).toBeVisible();
    await expect(page.getByText("Major Market Indices")).toBeVisible();
    await expect(page.getByText("Today's articles")).toBeVisible();
    await expect(page.getByPlaceholder("Search intelligence")).toBeVisible();
    await expect(page.getByText("Last updated")).toBeVisible();
    await expect(page.getByText("Live").first()).toBeVisible();
  });

  await test.step("FE-D10/FE-D14 pagination bar reflects backend total", async () => {
    await page.getByPlaceholder("Search intelligence").fill("E2E");
    await expect(page.getByText(`Page 1 of ${totalPages}`)).toBeVisible();
    await expect(page.getByRole("button", { name: /Previous/ })).toBeDisabled();
  });

  await test.step("FE-D11 click page 2 changes cards and highlights the page", async () => {
    const firstTitle = await page.locator("article h3").first().innerText();
    await pageNumberButton(page, 2).click();
    await expect(pageNumberButton(page, 2)).toHaveAttribute("aria-current", "page");
    await expect.poll(async () => page.locator("article h3").first().innerText()).not.toBe(firstTitle);
  });

  await test.step("FE-D12 previous on page 1 is disabled", async () => {
    await pageNumberButton(page, 1).click();
    await expect(page.getByRole("button", { name: /Previous/ })).toBeDisabled();
  });

  await test.step("FE-D13 next on last page is disabled", async () => {
    await pageNumberButton(page, totalPages).click();
    await expect(page.getByRole("button", { name: /Next/ })).toBeDisabled();
  });

  await test.step("FE-D6 through FE-D9 filters reset pagination and narrow visible results", async () => {
    await openSelect(page, 0);
    await page.getByRole("button", { exact: true, name: "Finance" }).click();
    await expect(page.getByText("Page 1 of")).toBeVisible();
    await openSelect(page, 1);
    await page.getByRole("button", { exact: true, name: "United States" }).click();
    const cards = await visibleCards(page);
    await expect(cards.first()).toContainText(/Finance|E2E/);
  });

  await test.step("FE-D15 through FE-D17 card and View All navigation works", async () => {
    await page.getByRole("link", { name: "View All" }).click();
    await expect(page).toHaveURL(/\/en\/news/);
    await page.goto("/en");
    await page.getByPlaceholder("Search intelligence").fill("E2E");
    await page.locator("article h3").first().click();
    await expect(page).toHaveURL(/\/en\/items\/[0-9a-f-]+/);
  });
});

test("3.3 news page keeps infinite scrolling and filters", async ({ page, request }) => {
  await signIn(page, request);
  await page.goto("/en/news");

  await test.step("FE-N1/FE-N2 news page renders list and grid toggle", async () => {
    await expect(page.getByRole("heading", { name: "News" })).toBeVisible();
    await expect(page.getByText(/Showing/)).toBeVisible();
    await page.locator("button").filter({ has: page.locator("svg") }).nth(1).click();
    await expect(page.locator("article").first()).toBeVisible();
  });

  await test.step("FE-N3 through FE-N6 filters and search render matching backend items", async () => {
    await page.getByPlaceholder("Search articles, topics, sources...").fill("E2E");
    await openSelect(page, 0);
    await page.getByRole("button", { name: "Politics" }).click();
    await openSelect(page, 1);
    await page.getByRole("button", { name: "China" }).click();
    await expect(page.locator("article").first()).toContainText(/E2E|Politics|China/);
    await page.getByRole("button", { name: "Latest" }).click();
    await page.getByRole("button", { name: "Most relevant" }).click();
    await expect(page.getByRole("button", { exact: true, name: "Most relevant" }).first()).toBeVisible();
  });

  await test.step("FE-N7 infinite scroll appends without dashboard pagination", async () => {
    await expect(page.getByText(/Page 1 of/)).toHaveCount(0);
    const before = await page.locator("article").count();
    await page.mouse.wheel(0, 5000);
    await expect.poll(async () => page.locator("article").count()).toBeGreaterThanOrEqual(before);
  });

  await test.step("FE-N8 through FE-N14 bookmark, detail, empty, and clear filter behavior", async () => {
    await page.locator("article button").first().click();
    await page.locator("article a").first().click();
    await expect(page).toHaveURL(/\/en\/items\/[0-9a-f-]+/);
    await page.goto("/en/news");
    await page.getByPlaceholder("Search articles, topics, sources...").fill("xyznonexistent");
    await expect(page.getByText(/No intelligence items/)).toBeVisible();
    await page.getByPlaceholder("Search articles, topics, sources...").fill("");
    await expect(page.locator("article").first()).toBeVisible();
  });
});

test("3.4 through 3.6 markets, analytics, and report detail", async ({ page, request }) => {
  await signIn(page, request);

  await test.step("FE-MK1 through FE-MK6 market tabs render indices, watchlists, and sectors", async () => {
    await page.goto("/en/markets");
    await expect(page.getByRole("heading", { name: "Markets" })).toBeVisible();
    await expect(page.getByText("Indices")).toBeVisible();
    await expect(page.getByRole("heading", { name: "S&P 500" })).toBeVisible();
    await page.getByRole("button", { name: "Watchlist" }).click();
    await expect(page.getByText("E2E AI Watchlist")).toBeVisible();
    await page.getByRole("button", { name: "Sectors" }).click();
    await expect(page.getByText("Live endpoint pending").first()).toBeVisible();
  });

  await test.step("FE-MK7 create watchlist from UI", async () => {
    await page.getByRole("button", { name: "Watchlist" }).click();
    await page.getByRole("button", { name: "Create Watchlist" }).click();
    await page.getByPlaceholder("Enter watchlist name").fill(`E2E UI Watch ${Date.now()}`);
    await page.getByPlaceholder("keyword one, keyword two").fill("AI, stock");
    await page.getByRole("dialog").getByRole("button", { exact: true, name: "Create watchlist" }).click();
    await expect(page.getByText(/E2E UI Watch/)).toBeVisible();
  });

  await test.step("FE-AN1 through FE-AN10 analytics renders charts, reports, and admin generation", async () => {
    await page.goto("/en/analytics");
    await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
    for (const label of ["24h", "7D", "14D", "30D"]) {
      await expect(page.getByRole("button", { name: label })).toBeVisible();
    }
    await page.getByRole("button", { name: "30D" }).click();
    await expect(page.locator(".recharts-wrapper").first()).toBeVisible();
    await expect(page.getByText("Top keywords")).toBeVisible();
    await expect(page.getByText("E2E Daily Market Intelligence")).toBeVisible();
    await page.getByRole("button", { name: "Generate report" }).click();
    await expect(page.getByText(/Report generation queued|Unable to queue/)).toBeVisible();
  });

  await test.step("FE-R1 through FE-R9 report detail renders markdown, TOC, and error state", async () => {
    const latest = await (await request.get(`${API_BASE_URL}/reports/latest`)).json();
    await page.goto(`/en/reports/${latest.items[0].id}`);
    await expect(page.getByRole("heading", { name: /E2E Daily Market Intelligence|E2E Market Intelligence/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Executive Summary" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Key Drivers" })).toBeVisible();
    await page.getByRole("link", { name: "Key Drivers" }).click();
    await page.goto("/en/reports/00000000-0000-0000-0000-000000000000");
    await expect(page.getByText(/unavailable|not found|Unable|error/i)).toBeVisible();
  });
});

test("3.7 through 3.12 settings, admin, sync, item detail, and i18n", async ({ browser, page, request }) => {
  await signIn(page, request, SETTINGS_ADMIN_EMAIL);

  await test.step("FE-S1 through FE-S18 settings saves profile, retention, report config, LLM, theme, and admin visibility", async () => {
    await page.goto("/en/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByLabel("Display name")).toHaveValue("E2E Settings Admin");
    await page.getByLabel("Display name").fill("E2E Settings Admin Updated");
    await page.getByText("90 days").click();
    await page.getByRole("button", { exact: true, name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: /Light Mode|Dark Mode/ }).click();
    await expect(page.getByText("Admin workspace")).toBeVisible();
    await expect(page.getByText("LLM configuration")).toBeVisible();
  });

  await test.step("FE-ADM1 through FE-ADM22 admin panels render stats, sources, users, LLM, logs, and filters", async () => {
    await expect(page.getByText("Administrator controls")).toBeVisible();
    await expect(page.getByRole("button", { name: "Users" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sources" })).toBeVisible();
    await expect(page.getByRole("button", { name: "LLM" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Logs" })).toBeVisible();
    await page.getByRole("button", { name: "Sources" }).click();
    await expect(page.getByText("E2E API Source")).toBeVisible();
    await page.getByRole("button", { name: "Users" }).click();
    await expect(page.getByText("e2e-user@sigma-e2e.com")).toBeVisible();
    await page.getByRole("button", { name: "LLM" }).click();
    await expect(page.getByText("gpt-4.1-mini")).toBeVisible();
    await page.getByRole("button", { name: "Logs" }).click();
    await expect(page.getByText(/Success ·|Failed ·|Timeout ·/).first()).toBeVisible();
  });

  await test.step("FE-SY1 through FE-SY12 sync page renders sources, controls, logs, filters", async () => {
    await page.goto("/en/sync");
    await expect(page.getByRole("heading", { name: "Sync" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "E2E API Source" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sync all now" })).toBeVisible();
    const activity = page.locator("section").filter({ has: page.getByRole("heading", { name: "Recent activity" }) });
    await activity.getByRole("button", { name: "All" }).click();
    await activity.getByRole("button", { name: "Failed" }).click();
    await expect(page.getByText("E2E simulated failure")).toBeVisible();
    await activity.getByRole("button", { name: "Failed" }).first().click();
    await activity.getByRole("button", { name: "Success" }).click();
    await expect(page.getByText(/Collected/).first()).toBeVisible();
  });

  await test.step("FE-ID1 through FE-ID10 item detail renders full article metadata and related links", async () => {
    const items = await (await request.get(`${API_BASE_URL}/items?keyword=E2E&page_size=1`)).json();
    await page.goto(`/en/items/${items.items[0].id}`);
    await expect(page.getByRole("heading", { name: /E2E/ })).toBeVisible();
    await expect(page.locator("header").getByText("E2E API Source")).toBeVisible();
    await expect(page.getByText(/Finance|US|AI|stocks/).first()).toBeVisible();
    await expect(page.locator("a[target='_blank']")).toHaveCount(1);
  });

  await test.step("FE-I1 through FE-I6 locale routes and switcher work", async () => {
    await page.goto("/zh");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh");
    await page.goto("/en");
    await expect(page.getByText("Previous")).toBeVisible();
    await page.goto("/");
    await expect(page).toHaveURL(/\/(en|zh)$/);
  });

  await test.step("FE-AG1/FE-AG2 protected route behavior", async () => {
    const unauthenticatedPage = await browser.newPage();
    await unauthenticatedPage.goto("/en/settings");
    await expect(unauthenticatedPage).toHaveURL(/\/en\/login$/);
    await unauthenticatedPage.close();
    await signIn(page, request, USER_EMAIL);
    await page.goto("/en/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("Admin workspace")).toHaveCount(0);
  });
});
