# Clean Baseline Determinism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the exact `ae3411ac` baseline pass its Cloudlight source-contract tests from a pristine locked checkout without a pre-existing ignored `output/private` directory or repository-local test artifacts.

**Architecture:** Keep production source-pack behavior unchanged. Reuse the existing `sourceFixtureRoot(source)` test helper, which creates a complete canonical source fixture under the OS temporary directory, and run both failing private-write tests entirely inside that disposable root. Verify the focused contract first, then the full repository baseline and build/PDI blast radius.

**Tech Stack:** TypeScript, Vitest 4, Node.js `fs`/`os` test fixtures, npm, Vite

**Spec:** `docs/superpowers/specs/2026-08-31-global-convergence-release-parity-design.md`

## Global Constraints

- Base remains `ae3411acbad605dad9f2966b3500546866b44b43`; do not import any legacy branch or worktree in this subproject.
- Modify test infrastructure only; production runtime code and generated/private output remain unchanged.
- Preserve the RED evidence: full Vitest failed only two Cloudlight tests with `ENOENT .../output/private/...-XXXXXX`.
- Do not create, commit, or require `output/`, `output/private`, audio renders, MIDI packs, caches, secrets, private receipts, or production-derived data.
- Keep the existing private-output path boundary assertions and symlink/hardlink safety coverage.
- No subagents are used for execution; run inline in the current locked Codex lane.
- Do not push, open a PR, merge, release, or clean legacy state in this subproject until all local gates are reviewed.

---

### Task 1: Isolate the two Cloudlight private-write tests

**Files:**
- Modify: `scripts/__tests__/cloudlight-evening-r3-source.test.ts:547`
- Modify: `scripts/__tests__/cloudlight-evening-r3-source.test.ts:820`
- Test: `scripts/__tests__/cloudlight-evening-r3-source.test.ts`

**Interfaces:**
- Consumes: existing `sourceFixtureRoot(source: unknown): string`, `loadCloudlightR3Source(rootDir: string)`, and `writeCloudlightR3SourcePack({ rootDir, outputDir })`.
- Produces: two hermetic tests whose source and output roots live below a disposable OS temp directory and whose cleanup removes the entire fixture root.

- [x] **Step 1: Re-run the focused test file and preserve RED**

Run:

```bash
npx vitest run --configLoader runner scripts/__tests__/cloudlight-evening-r3-source.test.ts
```

Expected: exactly two failures, both `ENOENT` from `mkdtempSync` because repository-local `output/private` does not exist; the remaining ten tests pass.

- [x] **Step 2: Replace the first repository-local temp root with the existing source fixture**

Replace the opening of `writes the same private MIDI and automation source pack twice` with:

```ts
const fixtureRoot = sourceFixtureRoot(loadCloudlightR3Source(rootDir));
const outsideRoot = mkdtempSync(join(tmpdir(), "cloudlight-evening-r3-outside-"));
```

Within only this test:

```ts
const first = writeCloudlightR3SourcePack({
  rootDir: fixtureRoot,
  outputDir: join(fixtureRoot, "output/private/r3-a"),
});
const second = writeCloudlightR3SourcePack({
  rootDir: fixtureRoot,
  outputDir: join(fixtureRoot, "output/private/r3-b"),
});
```

Keep the negative boundary checks but bind them to the fixture:

```ts
expect(() =>
  writeCloudlightR3SourcePack({
    rootDir: fixtureRoot,
    outputDir: join(fixtureRoot, "public/sounds/r3"),
  })
).toThrow("must stay under <root>/output/private");
expect(() =>
  writeCloudlightR3SourcePack({
    rootDir: fixtureRoot,
    outputDir: join(fixtureRoot, "output/private-collision/r3"),
  })
).toThrow("must stay under <root>/output/private");
const symlinkEscape = join(fixtureRoot, "symlink-escape");
```

Replace the cleanup target:

```ts
rmSync(fixtureRoot, { recursive: true, force: true });
rmSync(outsideRoot, { recursive: true, force: true });
```

- [x] **Step 3: Replace the second repository-local temp root with the same fixture contract**

Replace the opening of `independently parses the exact SMF chunks, events, hashes, and source-pack inventory` with:

```ts
const fixtureRoot = sourceFixtureRoot(loadCloudlightR3Source(rootDir));
```

Use the fixture for the source pack:

```ts
const receipt = writeCloudlightR3SourcePack({
  rootDir: fixtureRoot,
  outputDir: join(fixtureRoot, "output/private/pack"),
});
```

Update the inventory and source-config assertions:

```ts
const inventory = readdirSync(join(fixtureRoot, "output/private/pack"), {
  withFileTypes: true,
});
const sourceConfigPath = join(
  fixtureRoot,
  "config/audio/cloudlight-evening-r3-source.json"
);
```

Replace the cleanup target:

```ts
rmSync(fixtureRoot, { recursive: true, force: true });
```

- [x] **Step 4: Run the focused file GREEN**

Run:

```bash
npx vitest run --configLoader runner scripts/__tests__/cloudlight-evening-r3-source.test.ts
```

Expected: one test file passed; all 12 tests passed; zero failures.

- [x] **Step 5: Prove the tests left no repository-local output artifact**

Run:

```bash
git status --short --untracked-files=all
if git ls-files --others --ignored --exclude-standard --directory | rg -q '^output/'; then
  echo "FAIL: repository-local output artifact remains"
  exit 1
else
  echo "PASS: no repository-local output artifact"
fi
```

Expected: only the intended tracked test/plan changes appear in status; the second command returns no `output/` entry.

### Task 2: Re-establish the full canonical baseline

**Files:**
- Verify: `scripts/__tests__/cloudlight-evening-r3-source.test.ts`
- Verify: `package.json`
- Verify: `dist/` as ignored build output only

**Interfaces:**
- Consumes: the hermetic test changes from Task 1.
- Produces: a fresh baseline receipt with lint, typecheck, full Vitest, production build, bundle PDI, and repository guards bound to the current lane commit.

- [x] **Step 1: Run static checks**

Run:

```bash
npm run lint
npm run typecheck
```

Expected: both commands exit 0 with no lint or TypeScript errors.

- [x] **Step 2: Run the complete Vitest suite**

Run:

```bash
npx vitest run --configLoader runner
```

Expected: 749 test files accounted for, zero failed files, and zero failed tests. Expected jsdom negative-test diagnostics do not change the Vitest verdict.

- [x] **Step 3: Build and verify production-data integrity**

Run:

```bash
npm run build
npm run check:production-data-integrity:bundle
```

Expected: production build exits 0 and bundle PDI reports no blocking findings.

- [x] **Step 4: Run protected documentation and process gates**

Run:

```bash
npm run check:no-ai-templates
npm run check:best-practices
npm run check:task-completion
npm run check:agent-context
```

Expected: no-AI-template PASS, best-practices 66 invariants, task-completion 131 invariants, and agent-context OK.

- [x] **Step 5: Run scoped security and final diff review**

Run:

```bash
/Users/yehor/.codex/bin/codex-security-suite.sh \
  --path "$PWD/scripts/__tests__/cloudlight-evening-r3-source.test.ts" \
  --profile secrets
git diff --check
git diff -- scripts/__tests__/cloudlight-evening-r3-source.test.ts
git status --short --branch --untracked-files=all
```

Expected: Gitleaks and TruffleHog exit 0 for the changed test; diff check is clean; no unrelated tracked/untracked file appears.

- [x] **Step 6: Commit the baseline fix and evidence plan**

Run:

```bash
git add \
  scripts/__tests__/cloudlight-evening-r3-source.test.ts \
  docs/superpowers/plans/2026-08-31-clean-baseline-determinism.md
git commit -m "test: make Cloudlight source contract hermetic"
```

Expected: commit succeeds on `codex/global-convergence-20260831`; hooks pass; lane is clean and ahead of `ae3411ac` only by the reviewed design/plan/test commits.
