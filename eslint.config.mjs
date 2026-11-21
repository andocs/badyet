import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Tooling and reference files, not app code:
    ".claude/**",
    ".impeccable/**",
    "docs/**",
    // The Android app has its own tooling (mobile/package.json), not part of the web build:
    "mobile/**",
  ]),
]);

export default eslintConfig;
