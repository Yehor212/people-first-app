import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    // Exclude Playwright E2E tests (they run separately via npm run test:e2e)
    // Exclude `.claude/worktrees/**` — isolated agent branches, not part of main suite.
    exclude: ["node_modules", "e2e/**", ".claude/worktrees/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
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
        "**/*.config.*",
        "dist/",
        "android/",
        "ios/",
        "supabase/",
        "docs/",
        "dev-dist/",
        "scripts/",
        "*.ts",
        // Agent worktrees (isolated branches) — not part of main coverage scope.
        ".claude/worktrees/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
