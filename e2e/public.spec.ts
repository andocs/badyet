import { expect, test } from "@playwright/test";

test("login page fits the screen and has the sign-in form", async ({ page }, info) => {
  await page.goto("/login");
  await expect(page.locator("input[type=email]")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `e2e/results/login-${info.project.name}.png`, fullPage: true });
});

for (const path of ["/", "/budget", "/installments", "/settings", "/export/plans"]) {
  test(`signed out: ${path} goes to login`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  });
}
