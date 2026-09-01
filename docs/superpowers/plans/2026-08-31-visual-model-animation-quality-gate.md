# Visual Model And Animation Quality Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:executing-plans` inline. This task is explicitly SOLO. Do not create subagents, commits, pushes, pull requests, deployments, or asset publications.

**Goal:** Make the owner-approved `contact-v8-layered` master a durable, scope-exact quality baseline and require measurable proof packets for future ZenFlow visual/model/animation work without pretending software can judge artistic taste.

**Architecture:** Extend the existing `npm run check:visual` path with a focused proof-packet validator. Keep qualitative craft requirements in one agent-facing contract, keep machine-readable evidence in a schema and approved-baseline manifest, and keep the approved MP4/contact sheet portable in Git while retaining the 3,270,243-byte master by immutable identity only. Existing AGENTS/RAG/CI routing will point to the contract; no new lifecycle hook is introduced.

**Tech Stack:** TypeScript, Vitest, JSON Schema 2020-12 as a documented interchange contract, Node built-ins for parsing/hashing/Git inspection, existing GitHub Actions visual workflow.

**Spec:** `docs/ai/VISUAL_MODEL_ANIMATION_QUALITY_GATE.md`

## Global Constraints

- Human approval applies only to master TGS SHA-256 `1d9ec0fe08bbeea17e2a513e54e2abf10054e6ac861f1390ff9c712556508a9a` as seen through MP4 SHA-256 `53f357a59b6ae64018ba9ec02da889f366428caa7e6a788d5dbdecc7f32f0ee5`.
- Compact Telegram TGS artistic parity remains `UNVERIFIED` until separate human viewing and approval.
- Technical, Visual Runtime, Artistic-Craft, Motion, Model, and Plan statuses remain separate.
- Machine enforcement covers measurable structure/evidence only; it never computes or invents artistic approval.
- Web/Vite, PWA, Android/Capacitor, iOS/WKWebView, Desktop/Tauri, Telegram/export, Accessibility/reduced motion, Performance, Security/Privacy, Testing, and Operations must have explicit packet rows.
- Existing product/runtime behavior, dependencies, hooks, and coordinator state remain unchanged.

---

### Task 1: RED Proof-Contract Tests

**Files:**

- Modify: `test/check-visual-guards.test.ts`
- Create later in Task 2: `scripts/visual-quality-proof-gate.ts`
- Create later in Task 2: `scripts/visual-quality-proof-shared.ts`
- Create later in Task 2: `scripts/visual-quality-artifact-validator.ts`
- Create later in Task 2: `scripts/visual-quality-repository-gate.ts`
- Create later in Task 2: `scripts/visual-quality-tgs-validator.ts`

**Interfaces:**

- Consumes: controlled temporary packet/evidence fixtures.
- Produces: `validateVisualProofPacket(rootDir, packetPath)` and `validateApprovedVisualBaseline(rootDir)` expectations.

- [x] **Step 1: Add a missing-evidence RED test**

```ts
expect(validateVisualProofPacket(root, packetPath)).toContainEqual(
  expect.objectContaining({ rule: "visual-proof-missing-file" })
);
```

- [x] **Step 2: Add scope and false-approval RED tests**

```ts
expect(validateVisualProofPacket(root, falsePassPacket)).toContainEqual(
  expect.objectContaining({ rule: "visual-proof-human-approval" })
);
expect(validateVisualProofPacket(root, compactInheritancePacket)).toContainEqual(
  expect.objectContaining({ rule: "visual-proof-scope" })
);
```

- [x] **Step 3: Run the focused test and retain the expected module-missing failure**

Run: `npx vitest run test/check-visual-guards.test.ts`

Expected RED: import failure because `scripts/visual-quality-proof-gate.ts` does not exist.

### Task 2: Minimal Validator And Approved Baseline

**Files:**

- Create: `scripts/visual-quality-proof-gate.ts`
- Create: `scripts/visual-quality-proof-shared.ts`
- Create: `scripts/visual-quality-artifact-validator.ts`
- Create: `scripts/visual-quality-repository-gate.ts`
- Create: `scripts/visual-quality-tgs-validator.ts`
- Modify: `scripts/check-visual-guards.ts`
- Create: `docs/ai/visual-quality/visual-proof-packet.schema.json`
- Create: `docs/ai/visual-quality/approved-baselines/contact-v8-layered-critic.md`
- Create: `docs/ai/visual-quality/approved-baselines/contact-v8-layered.json`
- Create: `docs/ai/visual-quality/evidence/contact-v8-layered-preview.mp4`
- Create: `docs/ai/visual-quality/evidence/contact-v8-layered-contact-sheet.png`

**Interfaces:**

- Consumes: proof-packet JSON, repo-relative evidence, Git changed paths, canonical baseline hashes.
- Produces: deterministic violations added to the existing visual guard and a portable approved baseline.

- [x] **Step 1: Implement strict packet parsing and required-field validation**

The validator must reject malformed JSON, path escape/symlink evidence, missing files, hash/size mismatches, missing platform/status rows, missing technical receipts, missing critic report fields, and unsupported status values.

- [x] **Step 2: Enforce approval semantics**

`Artistic-Craft`, `Motion`, or `Model` may be `PASS` only when the packet contains direct human approval bound to an inspected evidence hash. A delivery/compact artifact cannot inherit approval from a master packet.

- [x] **Step 3: Bind the canonical baseline and evidence**

The guard must pin the manifest identity and exact master/MP4/contact-sheet hashes. It must verify the two portable evidence files but must not copy the 3.27 MB master into Git.

- [x] **Step 4: Integrate with the existing guard**

`scripts/check-visual-guards.ts` imports the focused module, reports proof violations with the existing severity model, and leaves current CSS/motion/theme/focus checks unchanged.

- [x] **Step 5: Run the same focused test GREEN**

Run: `npx vitest run test/check-visual-guards.test.ts`

Expected GREEN: all visual guard tests pass, including the new negative controls.

### Task 3: Durable Agent Contract And Routing

**Files:**

- Create: `docs/ai/VISUAL_MODEL_ANIMATION_QUALITY_GATE.md`
- Modify: `docs/ai/VISUAL_INTEGRITY_CRITIC_PROTOCOL.md`
- Modify: `AGENTS.md`
- Modify: `scripts/rag/corpus-manifest.json`
- Modify: `.github/workflows/visual-regression.yml`

**Interfaces:**

- Consumes: approved baseline manifest and proof schema from Task 2.
- Produces: mandatory routing, explicit quality rubric, CI execution, and Free RAG discoverability.

- [x] **Step 1: Define the qualitative contract and proof lifecycle**

The contract names model integrity, silhouette, edges/materials, detail density, object contact, light/shadow, coherent event motion, weight/overlap/contact timing, rejection of cheap simplification, target-specific delivery constraints, rollback, and all platform/quality rows.

- [x] **Step 2: Route future visual tasks through the contract and critic**

AGENTS and the critic protocol must require reading the contract, comparing against the approved master baseline, creating a proof packet, and preserving `UNVERIFIED` where human/runtime evidence is absent.

- [x] **Step 3: Make the contract discoverable and enforced in CI**

Add the contract to the curated `agent_rules` RAG group. Update the existing visual workflow path filters and run `npm run check:visual` with an exact event base SHA before Playwright.

### Task 4: Closure Verification

**Files:**

- Review: every changed/untracked path in this lane.

**Interfaces:**

- Consumes: final implementation and evidence package.
- Produces: command-backed PASS/FAIL/UNVERIFIED report with no publication.

- [x] **Step 1: Run focused and required guards sequentially**

Run the focused Vitest, `npm run check:visual`, `npm run check:no-ai-templates`, `npm run check:agent-context`, `npm run enforcement:check`, `npm run check:best-practices`, `npm run check:rag`, workspace/governance tests, `npm run doc-counts`, `npm run constitution:check`, and `git diff --check`.

- [x] **Step 2: Run scoped security review**

Use the available Snyk Code scanner or local fallback for changed TypeScript/YAML governance code; missing auth/tooling stays `UNVERIFIED`.

- [x] **Step 3: Run the visual-integrity critic read-only**

Audit the approved portable evidence and contract boundaries. Preserve the direct human PASS for the viewed master preview and `UNVERIFIED` for compact Telegram parity.

- [x] **Step 4: Inspect final status and diff**

Confirm no coordinator files, dependency manifests, runtime assets, hooks, secrets, production data, generated caches, or unrelated changes entered the write set. Remove temporary ignored authorization tokens. Do not commit or publish.

## Acceptance Criteria

- Missing proof files/fields fail a fresh negative-control test and pass after implementation.
- The exact master approval and MP4 evidence are immutable and machine-verified.
- Compact Telegram TGS remains explicitly `UNVERIFIED` and cannot inherit master approval.
- Future governed visual assets require a packet; UI intent remains a mandatory human/critic routing rule rather than a fake algorithmic taste score.
- All requested checks report exact `PASS`, `FAIL`, `UNVERIFIED`, or `SKIP` with evidence.

## Rollback

Remove only the new contract/schema/evidence/validator/adapter/format-validator/plan files and revert only the bounded edits listed above. The dirty coordinator, existing worktrees, product runtime, and remote state are outside this rollback and remain untouched.
