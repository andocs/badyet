import { expect, test } from "@playwright/test";
import { AUTH_FILE, hasAuth } from "../playwright.config";

test.skip(!hasAuth, "No saved session (e2e/.auth/state.json). See docs/e2e.md.");
test.use({ storageState: hasAuth ? AUTH_FILE : undefined });

// Read-only on purpose: these run against your real data.
for (const path of ["/", "/budget", "/transfer", "/installments", "/subscriptions", "/settings", "/more"]) {
  test(`${path} loads, fits the screen, no error page`, async ({ page }, info) => {
    const res = await page.goto(path);
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("main")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `e2e/results/${path.replace(/\//g, "_") || "_home"}-${info.project.name}.png`, fullPage: true });
  });
}

test("settings: a CSV export downloads", async ({ page }) => {
  await page.goto("/settings");
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator('a[href="/export/plans"]').click()]);
  expect(download.suggestedFilename()).toBe("badyet-plans.csv");
});
