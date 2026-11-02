import { test, expect } from "@playwright/test";

// Smoke test against the public web app running on the seed-data fallback
// (no DATABASE_URL — see playwright.config.ts webServer). The home page lists
// the seeded example items from @repo/db/seed-data.

test("home page lists a seeded example item", async ({ page }) => {
  await page.goto("/");

  // "Welcome to your internal tool" is the first seeded item (status: active).
  await expect(page.getByText("Welcome to your internal tool").first()).toBeVisible();
});

test("home page renders the catalog heading", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Browse the catalog" })).toBeVisible();
});

test("only active items are public", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Welcome to your internal tool").first()).toBeVisible();
  await expect(page.getByText("Draft record")).toHaveCount(0);
  await expect(page.getByText("Archived record")).toHaveCount(0);

  // A non-active item's detail page renders not-found instead of its content.
  // (With cacheComponents the 404 UI streams in after a 200 status, so assert
  // on what the visitor sees, not the status code.)
  await page.goto("/items/example-2");
  await expect(page.getByText("Draft record")).toHaveCount(0);
  await expect(page.getByText("404 · not found")).toBeVisible();
});

test("malformed filter params fall back to defaults instead of erroring", async ({ page }) => {
  const response = await page.goto("/?status=bogus&sort=nope&search=a&search=b");

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Browse the catalog" })).toBeVisible();
});

test("changing sort submits the filter form", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Sort").selectOption("title");
  await page.getByRole("button", { name: "Apply" }).click();

  await expect(page).toHaveURL(/sort=title/);
});

test("robots.txt and sitemap.xml are served", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBeTruthy();
  expect(await robots.text()).toContain("Sitemap:");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBeTruthy();
  const xml = await sitemap.text();
  expect(xml).toContain("/items/example-1"); // the active seed item
  expect(xml).not.toContain("/items/example-2"); // the draft
});
