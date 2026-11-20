import { expect, test } from "@playwright/test";

test("login page fits the screen and has the Google sign-in button", async ({ page }, info) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `e2e/results/login-${info.project.name}.png`, fullPage: true });
});

for (const path of ["/", "/budget", "/forecast", "/settings", "/export/accounts"]) {
  test(`signed out: ${path} goes to login`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  });
}
