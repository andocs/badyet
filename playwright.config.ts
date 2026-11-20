import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Signed-in tests run only when you save a browser session: see docs/e2e.md.
export const AUTH_FILE = "e2e/.auth/state.json";
export const hasAuth = existsSync(AUTH_FILE);

const sizes = { phone: devices["Pixel 7"].viewport, desktop: { width: 1280, height: 800 } };
export default defineConfig({
  testDir: "e2e",
  outputDir: "e2e/results",
  reporter: "list",
  use: { baseURL: "http://localhost:3100" },
  webServer: { command: "npm run dev -- -p 3100", url: "http://localhost:3100/login", reuseExistingServer: true, timeout: 120_000 },
  projects: (["phone", "desktop"] as const).flatMap((size) =>
    (["light", "dark"] as const).map((scheme) => ({
      name: `${size}-${scheme}`,
      use: { browserName: "chromium" as const, viewport: sizes[size], colorScheme: scheme, isMobile: size === "phone" },
    })),
  ),
});
