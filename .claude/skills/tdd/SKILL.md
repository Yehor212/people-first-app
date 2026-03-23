---
name: tdd
description: Test-Driven Development workflow — Red → Green → Refactor cycle
user-invocable: true
---

# TDD Workflow Skill

When the user invokes /tdd, execute this strict Red-Green-Refactor cycle:

## Phase 1: RED (Write Failing Test)
1. Ask: "What behavior should we implement?"
2. Write a test that FAILS (describes the expected behavior)
3. Run `npx vitest run --reporter=verbose [test-file]` — MUST see RED (failure)
4. If test passes → test is wrong (it should fail for unimplemented code)

## Phase 2: GREEN (Minimal Implementation)
1. Write the MINIMUM code to make the test pass
2. No extra features, no optimization, no cleanup
3. Run `npx vitest run --reporter=verbose [test-file]` — MUST see GREEN
4. If test fails → fix implementation (not the test)

## Phase 3: REFACTOR (Clean Up)
1. Improve code quality WITHOUT changing behavior
2. Run tests after EACH refactoring step → MUST stay GREEN
3. Apply: extract functions, remove duplication, improve naming
4. Final run: `npx vitest run` — ALL tests must pass

## Rules
- NEVER skip the RED phase — test must fail first
- NEVER write implementation before test
- NEVER refactor while RED
- Each cycle: one behavior, one test, one implementation
- Show test output at each phase transition
