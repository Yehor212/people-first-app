import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";
import { changelogPlugin } from "./vite-plugin-changelog";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isCi = process.env.CI === "true";

export default defineConfig({
  plugins: [changelogPlugin()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    // Exclude Playwright E2E tests (they run separately via npm run test:e2e).
    // Exclude `.codex/worktrees/**` and `.superpowers/worktrees/**` — isolated agent branches, not part of main suite.
    // Exclude `tools/telegram-control/**` — separate Node test-runner package covered by check:telegram-control.
    exclude: ["node_modules", "e2e/**", ".codex/worktrees/**", ".superpowers/worktrees/**", "tools/telegram-control/test/**", "scripts/audio-review/__tests__/*.test.mjs"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      reporter: isCi ? ["text", "json-summary"] : ["text", "html", "json-summary"],
      // First honest TS/TSX baseline (2026-07-16). The former branch=70 gate measured
      // assets only because "*.ts" excluded every source file with Picomatch contains=true.
      // Floors intentionally round down so future source regressions fail closed.
      thresholds: {
        lines: 60,
        functions: 56,
        branches: 47,
        statements: 59,
      },
      exclude: [
        "node_modules/",
        "test/",
        "e2e/",
        "**/*.d.ts",
        "**/*.test.*",
        "**/*.spec.*",
        "src/**/__tests__/**",
        "src/test/**",
        "**/*.config.*",
        "dist/",
        "android/",
        "ios/",
        "supabase/",
        "docs/",
        "dev-dist/",
        "scripts/",
        "tools/telegram-control/**",
        // Agent worktrees (isolated branches) — not part of main coverage scope.
        ".codex/worktrees/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
