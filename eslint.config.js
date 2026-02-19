import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "android", "coverage", "scripts", "supabase/functions/**", "*.js", "*.mjs"] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
    ],
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
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "off",
      // P0 Premium Upgrade: Enable stricter rules
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      // Catch unhandled promises (common source of silent failures)
      "@typescript-eslint/no-floating-promises": "warn",
      // Ensure React hooks dependencies are correct
      "react-hooks/exhaustive-deps": "warn",
      // Relax some strict type-checked rules for existing codebase
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-misused-promises": ["warn", {
        checksVoidReturn: false,
      }],
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
      "@typescript-eslint/unbound-method": "off",
      // TD-07: Ban direct localStorage access — use SK keys + safeJson accessors
      "no-restricted-globals": ["error", {
        "name": "localStorage",
        "message": "Use SK keys from @/lib/storageKeys + accessors from @/lib/safeJson (storageGetRaw, safeLocalStorageGet, etc.)",
      }],
    },
  },
  // Enforce feature module public API boundaries outside feature folders
  {
    files: ["src/components/**/*.{ts,tsx}", "src/hooks/**/*.{ts,tsx}", "src/pages/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["@/features/*/*"],
            message: "Import from feature barrels only (e.g. '@/features/journal').",
          },
        ],
      }],
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
      "**/__tests__/**",
      "test/**",
      "e2e/**",
    ],
    rules: {
      "no-restricted-globals": "off",
    },
  },
);
