---
description: Testing rules — applies to **/*.test.{ts,tsx}
---

# Testing Rules (Law 1: Zero Regression)

- Vitest + React Testing Library
- AAA pattern: Arrange → Act → Assert
- No `any` type in test assertions — use proper typing
- Test file mirrors source location (`src/hooks/useX.ts` → `src/hooks/useX.test.ts`)
- Zero regression: existing tests must never be deleted or weakened
- Selective TDD approach: write tests for complex logic, edge cases, regressions
- Mock conventions: mock external deps (Supabase, Firebase), not internal modules
- Run `vitest run` to verify before committing test changes
