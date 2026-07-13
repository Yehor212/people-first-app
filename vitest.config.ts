import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isCi = process.env.CI === "true";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    // Exclude Playwright E2E tests (they run separately via npm run test:e2e).
    // Exclude `.codex/worktrees/**` — isolated agent branches, not part of main suite.
    // Exclude `tools/telegram-control/**` — separate Node test-runner package covered by check:telegram-control.
    exclude: ["node_modules", "e2e/**", ".codex/worktrees/**", "tools/telegram-control/test/**"],
    coverage: {
      provider: "v8",
      reporter: isCi ? ["text", "json-summary"] : ["text", "html", "json-summary"],
      thresholds: {
        lines: 18,
        functions: 41,
        branches: 70,
        statements: 18,
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
        "*.ts",
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
