---
description: Testing rules — applies to **/*.test.{ts,tsx}
---

# Testing Rules (Law 1: Zero Regression)

- Vitest + React Testing Library
- AAA pattern: Arrange → Act → Assert
- Use proper TypeScript types in test assertions — keep all assertions strongly typed
- Test file mirrors source location (`src/hooks/useX.ts` → `src/hooks/useX.test.ts`)
- Zero regression: preserve all existing tests — maintain or strengthen coverage
- Selective TDD approach: write tests for complex logic, edge cases, regressions
- Mock conventions: mock external deps (Supabase, Firebase), keep internal modules real
- Run `vitest run` to verify before committing test changes
