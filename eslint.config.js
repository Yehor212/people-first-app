import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "android",
      "coverage",
      "src-tauri/target/**",
      "scripts",
      "supabase/functions/**",
      "*.js",
      "*.mjs",
      "knip.config.ts",
      ".size-limit.json",
      // Agent worktrees (isolated branches) — not part of main lint/type scope.
      ".claude/worktrees/**",
      // Build-time Vite plugins (Node CLI tooling, console.log allowed for build feedback).
      "vite-plugin-*.ts",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...Object.fromEntries(
        Object.entries(jsxA11y.configs.recommended.rules).map(([key, val]) => [
          key,
          Array.isArray(val) ? ["warn", ...val.slice(1)] : val === "error" ? "warn" : val,
        ])
      ),
      // Capacitor mobile-first: touch is primary input, divs with onClick are standard mobile pattern.
      // role="button" + tabIndex + onKeyDown add keyboard support where beneficial,
      // but eslint-disable is appropriate for touch-only overlay/gesture elements.
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/no-static-element-interactions": "off",
      "jsx-a11y/no-noninteractive-element-interactions": "off",
      "jsx-a11y/no-autofocus": "off",
      "react-refresh/only-export-components": "off",
      // P0 Premium Upgrade: Enable stricter rules
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Catch unhandled promises (common source of silent failures)
      "@typescript-eslint/no-floating-promises": "warn",
      // ROOT CAUSE FIX: Prevent silent .catch(() => {}) — OWASP A09 audit 2026-04-01
      // Empty arrow functions in .catch() chains hide errors (Law 5: Loud Failure)
      // Legitimate silence: use comment inside catch or _error prefix
      "no-empty": ["warn", { allowEmptyCatch: false }],
      // Ensure React hooks dependencies are correct
      "react-hooks/exhaustive-deps": "warn",
      // Relax some strict type-checked rules for existing codebase
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-misused-promises": [
        "warn",
        {
          checksVoidReturn: false,
        },
      ],
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
      "@typescript-eslint/unbound-method": "off",
      // TD-07: Ban direct localStorage access — use SK keys + safeJson accessors
      "no-restricted-globals": [
        "error",
        {
          name: "localStorage",
          message:
            "Use SK keys from @/lib/storageKeys + accessors from @/lib/safeJson (storageGetRaw, safeLocalStorageGet, etc.)",
        },
      ],
      // Tech-debt audit 2026-04-18 §10 / Stage 3: prevent console.log regression.
      // All production logging MUST go through `@/lib/logger` (Sentry-aware, PII-filtered).
      // warn-level (not error) so new contributors can still fix before commit fails.
      // logger.ts + crashReporting.ts are the legitimate sinks and get an override below.
      "no-console": "warn",
    },
  },
  // Enforce feature module public API boundaries outside feature folders
  {
    files: ["src/components/**/*.{ts,tsx}", "src/hooks/**/*.{ts,tsx}", "src/pages/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*/*"],
              message: "Import from feature barrels only (e.g. '@/features/journal').",
            },
          ],
        },
      ],
    },
  },
  // Allow direct localStorage in wrapper implementations, diagnostics, and tests
  {
    files: [
      "src/lib/safeJson.ts",
      "src/hooks/useLocalStorage.ts",
      "src/hooks/useIndexedDB.ts",
      "src/components/StorageErrorBanner.tsx",
      "src/components/ErrorBoundary.tsx",
      "src/main.tsx",
      "**/__tests__/**",
      "test/**",
      "e2e/**",
    ],
    rules: {
      "no-restricted-globals": "off",
    },
  },
  // The two legitimate console sinks: the logger abstraction and crashReporting
  // route to console by design. Also tests may console-log diagnostics.
  {
    files: [
      "src/lib/logger.ts",
      "src/lib/crashReporting.ts",
      "**/__tests__/**",
      "test/**",
      "e2e/**",
      "tools/telegram-control/scripts/**",
    ],
    rules: {
      "no-console": "off",
    },
  }
);
