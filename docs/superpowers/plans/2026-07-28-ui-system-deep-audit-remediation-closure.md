# ZenFlow UI System Deep Audit And Remediation Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` or `superpowers:executing-plans`
> to implement this plan task-by-task. Use
> `superpowers:test-driven-development` for every behavior or guard change and
> `superpowers:verification-before-completion` before any completion claim.

**Goal:** Complete the UI-system-specific audit and remediation contract from
the user-supplied 2026-07-28 brief without repeating the bounded Settings work,
changing protected product semantics, fabricating production data, or claiming
native/human proof that was not collected.

**Architecture:** Preserve Style Dictionary as the token source, the existing
React/Capacitor/Tauri shell, IndexedDB/Zustand ownership, and current auth/sync
handlers. Build one canonical UI-system conformance contract, a test-only
component-state preview, report-only static detectors, and an evidence manifest
before migrating the lowest common foundation or primitive responsible for each
confirmed defect.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, shadcn/ui, Style
Dictionary, Vitest/Testing Library, Playwright, Capacitor 8, Tauri, custom i18n,
Dexie/IndexedDB, Zustand.

## Planning Verdict

`PARTIAL`, not complete.

The prior audit and remediation verified a bounded Settings/shared-runtime
slice and several adjacent safety defects. It did not complete the
product-wide UI-system inventory, full component/state registry, test-only
preview, eight new detector families, stable visual-regression matrix, manual
assistive-technology walkthrough, installed-PWA lifecycle, physical-device
matrix, or whole-product migration required by the new brief.

Source identities at plan time:

- user brief:
  `/Users/yehor/Downloads/zenflow_ui_system_deep_audit_and_remediation_prompt_ru.md`
- user brief SHA-256:
  `48d71d583237e787e983b85689ad892be67bfd6a191f60912e0127c392182fa1`
- bounded audit:
  `docs/audits/experience-quality/zenflow-experience-quality-audit-2026-07-28.md`
- bounded audit SHA-256 at comparison time:
  `3148f592d4eeffa7b0082c945857032c0ba2add0b89341b7b2bafd90e1e6ec38`
- Settings contract:
  `docs/superpowers/specs/2026-07-12-settings-simplification-live-apply-design.md`
- Settings contract SHA-256 at comparison time:
  `968ded129274e3c64b91aea71294f2ddc7b016171977bd17c31b7888ade06833`

## Global Constraints

- Do not execute this plan in the current mixed `main` checkout. At planning
  time it is at `00fdb2ea0e5205f4bee76bbec3109bf98865627f`, 18 commits behind
  `origin/main`, with 860 changed or untracked paths including this plan.
- Before implementation, establish a clean, locked, attributable worktree at
  an exact integration commit. Never pull, reset, rebase, overwrite, or
  auto-transfer the current dirty tree.
- Do not commit, push, merge, deploy, migrate production data, alter remote
  configuration, or publish store artifacts without separate authorization.
- Preserve auth, owner boundaries, sync, backup, offline queues, import/export,
  deletion safeguards, consent, storage, route, and recovery semantics.
- Never introduce production mock/demo/sample/fallback records. Synthetic data
  is permitted only in isolated component/E2E fixtures and must be absent from
  production bundles.
- Do not copy Finch or another product's assets, colors, copy, composition, or
  monetization patterns.
- Keep `ValenceOrb`, `MiniValenceOrb`, canonical leaf assets, and the current
  Style Dictionary pipeline unless a separate protected-change decision
  proves replacement necessary.
- Use semantic tokens; do not spread raw colors, radii, shadows, typography, or
  spacing while migrating.
- Maintain the project touch baseline of at least 44 CSS px; separately verify
  Android 48dp and iOS 44pt where native controls are involved.
- Shipped locales are `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, and `he`.
  Russian is not shipped and is `N/A` for visual baselines unless the product
  owner separately authorizes a ninth locale.
- No Storybook or paid visual service is added. The current repository has no
  Storybook dependency; use a local development/test-only preview.
- A build, screenshot, automated accessibility scan, emulator, or same-model
  review proves only its bounded result.
- Treat MCP/connectors as bounded evidence tools, not authority by themselves.
  Inventory only callable servers needed for the task, never read raw
  `.mcp.json` or credentials, never perform production writes, and corroborate
  MCP output against the exact local source, artifact, browser, emulator, or
  device. If a required MCP is unavailable, use the documented local fallback
  and record the missing MCP path as `UNVERIFIED`.
- Every task ends with a review checkpoint, not a Git commit. Commit behavior
  remains outside this plan until separately authorized.

## Explicit Requirements

- Audit Foundations, Components, Patterns, Screens, and Platform Adaptation.
- Cover Web/PWA, Android, iOS, Desktop, accessibility, localization/RTL,
  performance, states, visual regression, and manual QA.
- Confirm or reject the six starting ZenFlow hypotheses in the supplied brief.
- Fix the lowest common layer rather than applying screen-local CSS patches.
- Create the mandatory artifact content using the existing canonical docs
  hierarchy.
- Preserve data/auth/sync/privacy and production-data integrity.
- Add component-state preview and visual/static regression gates.
- Finish only with current command, runtime, screenshot, platform, and risk
  evidence.

## Implied Requirements

- Reconcile the current report's command ledger with its authoritative receipts
  before reusing any test count. The report says 31 files and 475 passing tests,
  while the linked receipt currently records 29 files and 467 passing tests.
- Bind every screenshot and receipt to a relative path, hash, subject commit,
  viewport/state metadata, and finding; four early screenshot hashes currently
  lack a located canonical artifact path.
- Keep the prior Settings remediation as a characterization baseline. Do not
  reintroduce card-in-card, forced Diary navigation, causal insight wording,
  Android-first-run push cleanup, iOS Android-only auth routing, or selected
  states that rely only on color.
- Make new detectors report-only first and promote only reviewed rules with
  positive/negative fixtures and an explicit ratchet.
- Split product-wide migration into independently reviewable vertical slices;
  do not mix the whole application into one unreviewable diff.
- Record human, native-speaker, accessibility-user, privacy-owner, legal/store,
  and physical-device evidence separately from agent or automated evidence.

## Current Requirement Coverage

| Brief area | Status | Current evidence | Missing closure |
| --- | --- | --- | --- |
| Repository snapshot and evidence boundaries | `PARTIAL` | Current root, remote, branch, SHA, dirty state, runtime versions, RAG, and bounded report exist | Clean attributable execution subject and hash-bound manifest |
| UI surface inventory | `PARTIAL` | Bounded audit lists major routes and handoffs | Per-surface compact/medium/expanded, input, state, owner, test, and platform fields |
| Component inventory | `PARTIAL` | Settings pattern matrix and bounded asset ledger exist | All shared/local components, usages, variants, duplicates, states, and disposition |
| Baseline capture | `PARTIAL` | Several Settings, Android, iOS, Desktop, and public artifacts exist | Stable environment manifest, full path mapping, DPR/font/network/fixture metadata, full route/state matrix |
| Foundations contract | `PARTIAL` | Style Dictionary reachability and Settings roles are documented | Product-wide spacing/type/elevation/material/icon/z-index/safe-area contracts |
| Settings grouped-list remediation | `VERIFIED_FOR_BOUNDED_SCOPE` | Shared primitives, Account flattening, selection markers, E2E, LTR/RTL captures | Full Account state matrix and native/package parity |
| Product-wide components/patterns | `UNVERIFIED` | Selected shared defects were fixed | Complete migration of forms, lists, dialogs, feedback, empty/error/offline, charts, and shell |
| Component-state preview | `UNVERIFIED` | No Storybook or equivalent preview route/build target found | Test-only preview, state registry, production exclusion proof |
| Structural/material/token/icon/state/z-index detectors | `UNVERIFIED` | `check-visual-guards.ts` covers four narrower rules | All eight detector families, fixtures, ratchet, false-positive policy |
| Visual regression | `PARTIAL` | Existing overview light/dark/RTL and bounded Settings E2E | Component matrix, Account states, all widths/themes/inputs, stable baseline approval |
| Accessibility | `PARTIAL` | Semantic tests, focus tests, reflow tests, bounded keyboard evidence | VoiceOver/TalkBack/NVDA, complete 200% zoom, forced colors, touch and focus walkthrough |
| Localization/RTL | `PARTIAL` | Eight-locale parity and bounded Arabic browser evidence | Visual/content stress for all shipped locales and native-speaker review |
| Web runtime | `PARTIAL` | Build, bounded Settings E2E, public route smoke | Whole-product states and manual accessibility |
| Installed PWA | `UNVERIFIED` | Service worker is built | Install/update/offline/reconnect/stale-cache lifecycle |
| Android | `PARTIAL` | Debug build/install/first screen/resume | Final Settings, Back, permissions, deep links, TalkBack, process death, signed artifact |
| iOS | `PARTIAL` | Current-source simulator launch, UIScene, privacy shield | Final Settings, VoiceOver, permissions, deep-link destination, physical device, signed archive |
| Desktop/Tauri | `PARTIAL` | Bounded macOS compile/package receipt | Packaged GUI, resizing/keyboard matrix, Windows build, signing/update |
| Performance | `PARTIAL` | Browser performance smoke and size warning exist | Route/device baselines, SW-enabled PWA, memory, low-end Android, native startup/resize |
| Final completion | `STOP` | Existing report explicitly says whole-product/release `STOP` | Tasks below and independent hash-bound closure |

## Canonical Artifact Map

Use the existing `docs/audits/experience-quality/` hierarchy instead of
creating a competing documentation tree.

**Create:**

- `docs/audits/experience-quality/ui-audit-subject-manifest-2026-07-28.json`
- `docs/audits/experience-quality/ui-requirement-coverage-2026-07-28.md`
- `docs/audits/experience-quality/ui-system-inventory-2026-07-28.md`
- `docs/audits/experience-quality/ui-component-inventory-2026-07-28.md`
- `docs/audits/experience-quality/ui-source-applicability-2026-07-28.md`
- `docs/audits/experience-quality/ui-baseline-manifest-2026-07-28.json`
- `docs/audits/experience-quality/ui-findings-2026-07-28.md`
- `docs/audits/experience-quality/ui-state-coverage-2026-07-28.md`
- `docs/audits/experience-quality/ui-visual-regression-matrix-2026-07-28.md`
- `docs/audits/experience-quality/ui-visual-craft-review-2026-07-28.md`
- `docs/audits/experience-quality/ui-mcp-tool-verification-2026-07-28.md`
- `docs/audits/experience-quality/ui-security-privacy-verification-2026-07-28.md`
- `docs/audits/experience-quality/ui-migration-manifest-2026-07-28.md`
- `docs/audits/experience-quality/ui-final-verification-2026-07-28.md`
- `docs/superpowers/specs/2026-07-28-ui-system-conformance-contract.md`

**Update rather than duplicate:**

- `docs/audits/experience-quality/zenflow-experience-quality-audit-2026-07-28.md`
- `docs/superpowers/specs/2026-07-12-settings-simplification-live-apply-design.md`
- `ARCHITECTURE.md` only through `npm run doc-counts:update`

## Phase 0 — Attributable Subject And Evidence

### Task 1: Establish a clean immutable execution subject

**Files:**

- Create:
  `docs/audits/experience-quality/ui-audit-subject-manifest-2026-07-28.json`
- Read: `AGENTS.md`
- Read:
  `docs/ai/PREFLIGHT_OPERATOR_TEMPLATE.md`
- Read:
  `docs/ai/AGENT_CHANGE_GOVERNANCE.md`
- Read:
  `docs/ai/TEST_FIRST_AGENT_POLICY.md`
- Read:
  `docs/ai/PRODUCTION_DATA_INTEGRITY_POLICY.md`

**Interfaces:**

```ts
interface UiAuditSubjectManifest {
  promptSha256: string;
  repositoryRoot: string;
  remote: string;
  branch: string;
  headSha: string;
  treeStatus: "clean";
  runtimeVersions: Record<string, string>;
  packageManager: string;
  lockfilePath: string;
  lockfileSha256: string;
  stylingStack: string[];
  tokenSource: string;
  tokenGenerationCommand: string;
  generatedTokenOutputs: string[];
  supportedPlatforms: string[];
  availableRuntimes: Array<{
    id: string;
    kind: "browser" | "emulator" | "simulator" | "device" | "desktop";
    version: string;
    status: "AVAILABLE" | "UNAVAILABLE" | "UNVERIFIED";
  }>;
  relevantUiScripts: string[];
  publicUrl: string;
  productionBuildHash: string | null;
  roleRoutingReceipt: string;
  createdAtUtc: string;
}
```

- [ ] Obtain an owner-reviewed integration commit containing the intended prior
      remediation without unrelated paths.
- [ ] Create a clean worktree using `superpowers:using-git-worktrees`.
- [ ] Run `git status --porcelain=v1`; stop unless output is empty.
- [ ] Record `git rev-parse HEAD`, `git remote get-url origin`,
      `git branch --show-current`, Node/npm versions, lockfile hash, prompt hash,
      and UTC timestamp.
- [ ] Record the styling stack, token source/generation/outputs, supported
      platforms, available browsers/emulators/simulators/devices, public URL,
      production-build hash, and every current UI/native/CI script resolved
      from `package.json`.
- [ ] Generate a bounded changed-path/ownership manifest.
- [ ] Run
      `npm run rag:preflight -- "Закрыть zenflow_ui_system_deep_audit_and_remediation_prompt_ru.md полным evidence-backed аудитом и безопасной кроссплатформенной remediation"`.
- [ ] Emit `AGENT_CHANGE_NOTICE` before token, script, CI, native, or shared
      primitive changes.
- [ ] Because the execution subject is an explicit `DEEP_AUDIT`, create a
      ten-role disposition ledger with all ten canonical roles `SELECTED`,
      invoke exactly those roles in registry order with no more than three
      specialists active concurrently, and bind every receipt to `headSha`.
- [ ] Give Role 10 Pass A only the raw user brief, its hash, and neutral trusted
      policy/context before sharing this plan or any proposed findings. Record
      effective read-only/isolation evidence; if enforcement cannot be proven,
      keep the pass `UNVERIFIED`.

**Acceptance criteria:**

- Subject manifest validates against the actual clean worktree.
- No evidence from the current mixed checkout is promoted to release proof.
- Every later screenshot, command receipt, and finding includes `headSha`.

**Rejection criterion:** Any dirty path, ambiguous owner, moving HEAD, or
unreviewed transfer returns the plan to `STOP`.

## Phase 1 — Complete Inventory And Contract

### Task 2: Build the requirement-to-proof and source registries

**Files:**

- Create:
  `docs/audits/experience-quality/ui-requirement-coverage-2026-07-28.md`
- Create:
  `docs/audits/experience-quality/ui-source-applicability-2026-07-28.md`
- Create: `scripts/ui-audit/validate-ui-audit-artifacts.mjs`
- Create: `scripts/__tests__/ui-audit-artifacts.test.ts`
- Modify:
  `docs/audits/experience-quality/zenflow-experience-quality-audit-2026-07-28.md`

**Interfaces:**

```ts
type UiReportStatus =
  | "VERIFIED"
  | "INFERENCE"
  | "ASSUMPTION"
  | "UNVERIFIED"
  | "N/A";

type UiEvidenceClass =
  | "DIRECT_LOCAL"
  | "DIRECT_RUNTIME"
  | "AUTHORITATIVE_EXTERNAL"
  | "HUMAN_RESEARCH"
  | "INFERENCE"
  | "ASSUMPTION"
  | "UNKNOWN";

interface UiRequirementCoverage {
  id: string;
  sourceSection: string;
  requirement: string;
  status: UiReportStatus;
  evidenceClasses: UiEvidenceClass[];
  evidenceLocators: string[];
  affectedPlatforms: string[];
  acceptanceCriterion: string;
  blocker?: string;
}
```

- [ ] Write a failing validator test requiring every numbered brief section and
      completion criterion to have one unique coverage row.
- [ ] Add rows for the six starting hypotheses, sixteen mandatory artifact
      categories, commands, platform matrix, and final completion criteria.
- [ ] Expand every audit subsection 5.1 through 5.23 into its individual
      verifiable checks; a single section-level row cannot stand in for its
      contained brand, hierarchy, layout, typography, color, containment,
      component, interaction, form, navigation, feedback, overlay, responsive,
      platform, accessibility, localization, content, state, icon, motion,
      chart, or performance criteria.
- [ ] Reject any report row that collapses `INFERENCE`, `ASSUMPTION`, or
      `UNVERIFIED` into `VERIFIED`, or lacks an evidence-class locator.
- [ ] Validate the two required prioritization views independently:
      `BLOCKER/HIGH/MEDIUM/LOW` for the downloaded UI-system brief and
      `P0/P1/P2/P3` for the overarching product-quality mandate. Reject a
      finding without a rationale for both fields.
- [ ] Recheck all official sources in the brief and record canonical URL,
      checked date, document date, applicability, non-proof boundary, and
      recheck trigger.
- [ ] Resolve the Russian-locale conflict as `N/A` with the local eight-locale
      source citation; do not silently add a locale.
- [ ] Reconcile the 31/475 report claim with the 29/467 authoritative receipt.
      Keep the larger count `UNVERIFIED` unless a matching command receipt is
      found or freshly rerun on the immutable subject.
- [ ] Require every artifact hash to resolve to one canonical relative path.

**Verification:**

```sh
npx vitest run --configLoader runner \
  scripts/__tests__/ui-audit-artifacts.test.ts
node scripts/ui-audit/validate-ui-audit-artifacts.mjs
```

**Acceptance criteria:**

- No unmapped brief requirement.
- No evidence count without a matching receipt.
- No source is described as normative beyond its actual authority.

### Task 3: Generate the complete surface, component, token, asset, and state inventories

**Files:**

- Create: `scripts/ui-audit/collect-ui-inventory.mjs`
- Create: `scripts/__tests__/collect-ui-inventory.test.ts`
- Create:
  `docs/audits/experience-quality/ui-system-inventory-2026-07-28.md`
- Create:
  `docs/audits/experience-quality/ui-component-inventory-2026-07-28.md`
- Create:
  `docs/audits/experience-quality/ui-state-coverage-2026-07-28.md`
- Read: `src/pages/Index.tsx`
- Read: `src/components/navigation-v2/NavV2Orchestrator.tsx`
- Read: `src/hooks/useNavigationV2.ts`
- Read: `src/pages/nav-v2/settings/settingsNavigation.ts`
- Read: `src/design-tokens/tokens.json`
- Inventory production UI scan roots: `src/components/`, `src/pages/`,
  `src/features/`, `src/styles/`, `src/design-tokens/`, and `public/`
- Inventory native/desktop UI scan roots: `android/app/src/main/`,
  `ios/App/`, and `src-tauri/`
- Inventory test/spec reachability roots: `e2e/`, every directory named
  `__tests__` under `src/`, `docs/superpowers/specs/`, and
  `docs/audits/experience-quality/`

**Interfaces:**

```ts
interface UiSurfaceRow {
  routeOrEntry: string;
  sourceEntry: string;
  userJob: string;
  sharedPrimitives: string[];
  platforms: string[];
  presentations: Array<"compact" | "medium" | "expanded">;
  themes: string[];
  locales: string[];
  inputs: string[];
  states: Array<"loading" | "empty" | "error" | "offline" | string>;
  destructiveActions: string[];
  permissionDependencies: string[];
  systemDependencies: string[];
  behaviorTests: string[];
  accessibilityTests: string[];
  knownSpecs: string[];
  visualEvidence: string[];
  status: UiReportStatus;
}

interface UiComponentRow {
  symbol: string;
  path: string;
  semanticRole: string;
  variants: string[];
  states: string[];
  tokenDependencies: string[];
  duplicateCandidates: string[];
  owners: string[];
  usageLocators: string[];
  platformAssumptions: string[];
  testLocators: string[];
  disposition: "keep" | "consolidate" | "replace" | "retire";
}

interface UiTokenRow {
  id: string;
  sourcePath: string;
  generatedOutputs: string[];
  semanticRole: string;
  themeMappings: string[];
  runtimeUsages: string[];
  rawValueExceptions: string[];
  status: UiReportStatus;
}

interface UiAssetRow {
  id: string;
  path: string;
  sourceAuthorLicense: string;
  semanticPurpose: string;
  platformSurfaces: string[];
  sizeOrViewBox: string;
  strokeFillLanguage: string;
  opticalAdjustment: string;
  rtlRule: string;
  accessibilityTreatment: string;
  themeVariants: string[];
  testEvidence: string[];
  disposition: "KEEP" | "NORMALIZE" | "REDRAW_ORIGINAL" | "REPLACE_WITH_SYSTEM" | "REMOVE";
}
```

- [ ] RED-test exclusion of `node_modules`, `dist`, `output`,
      `.codex-recovery`, generated bundles, and test-only fixtures from
      production component counts.
- [ ] Traverse routes, deep links, dialogs, sheets, menus, banners, native
      handoffs, PWA prompts, and Desktop-only entry points.
- [ ] Inventory all shared and local UI components and record usages before
      proposing consolidation.
- [ ] Build a production import/reachability graph from `src/main.tsx`,
      `src/App.tsx`, route entries, overlay layers, and native/desktop entry
      points. Fail the inventory validator when a production `.tsx` component
      is unclassified; record unreachable/orphaned components with an explicit
      retire/retain decision rather than dropping them.
- [ ] Inventory source tokens, generated outputs, CSS aliases, raw-value
      exceptions, assets, licenses/provenance, icon libraries, motion assets,
      and z-index values.
- [ ] Record overlap candidates and owners explicitly; do not infer ownership,
      provenance, or license from appearance.
- [ ] Mark a state `VERIFIED` only when the code path and matching evidence are
      both present.
- [ ] Produce a dependency graph from foundations to primitives to patterns to
      screens.

**Acceptance criteria:**

- Every user-visible route/handoff is present or has a named blocker.
- Every component has semantics, usages, tests, platform assumptions, and
  disposition.
- Similar appearance alone never triggers consolidation.

### Task 4: Capture the immutable runtime baseline, adjudicate hypotheses, and populate findings

**Files:**

- Create:
  `docs/audits/experience-quality/ui-baseline-manifest-2026-07-28.json`
- Create:
  `docs/audits/experience-quality/ui-findings-2026-07-28.md`
- Create:
  `docs/audits/experience-quality/ui-migration-manifest-2026-07-28.md`
- Create: `e2e/ui-system-baseline.spec.ts`
- Read:
  `src/pages/nav-v2/settings/components/V2SettingsControlPrimitives.tsx`
- Read:
  `src/pages/nav-v2/settings/components/SettingsModuleCard.tsx`
- Read: `src/pages/nav-v2/settings/V2SettingsAccountPanel.tsx`
- Read:
  `docs/superpowers/specs/2026-07-12-settings-simplification-live-apply-design.md`
- Read: `e2e/visual-regression.spec.ts`
- Read: `e2e/design-system.spec.ts`
- Read: `scripts/check-visual-guards.ts`

**Finding contract:**

```ts
interface UiFinding {
  id: `UI-${number}`;
  title: string;
  status: Exclude<UiReportStatus, "N/A">;
  closureStatus: "OPEN" | "FIXED" | "ACCEPTED_RISK" | "BLOCKED" | "UNVERIFIED";
  priority: "P0" | "P1" | "P2" | "P3";
  severity: "BLOCKER" | "HIGH" | "MEDIUM" | "LOW";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  layer: Array<"foundation" | "component" | "pattern" | "screen" | "platform">;
  surface: string;
  routeOrEntry: string;
  filesAndSymbols: string[];
  platforms: string[];
  themes: string[];
  locales: string[];
  states: string[];
  routesOrComponents: string[];
  evidence: Array<{
    class: UiEvidenceClass;
    locator: string;
    subjectSha: string;
  }>;
  expectedContract: string;
  actualBehavior: string;
  userImpact: string;
  accessibilityImpact: string;
  privacySecurityImpact: string;
  performanceReliabilityImpact: string;
  rootCause: string;
  inferenceAndAlternatives: string[];
  recommendedRemediation: string;
  rejectedAlternatives: string[];
  rejectionCriterion: string;
  writeSet: string[];
  migrationOrDataEffect: string;
  regressionRisks: string[];
  testsRequired: string[];
  testFirstProof: string;
  acceptanceCriteria: string[];
  rollback: string;
  verification: string[];
  residualRisk: string;
}
```

- [ ] Install from the locked dependency graph, build the exact subject in
      production mode, hash the build, and write the build hash back to the
      subject manifest.
- [ ] Capture baseline screenshots under
      `output/ui-system-audit/{headSha}/baseline/` only after fonts, locale,
      timezone, clock, network, animation policy, theme, viewport, DPR, input,
      and deterministic test-only fixture provenance are fixed.
- [ ] Cover every representative surface/state identified by Task 3 at compact,
      medium, and expanded widths; preserve real overlays and errors that belong
      to the scenario.
- [ ] Keep local production-equivalent and cache-busted public evidence in
      separate manifest rows. Public output proves the deployed revision only
      when its artifact/commit identity matches the subject.
- [ ] Recheck and explicitly accept, reject, split, or leave `UNVERIFIED` all
      six brief hypotheses: primitive over-boxing, overview card weight,
      Account containment, spec/runtime divergence, incomplete visual state
      coverage, and incomplete static visual guards.
- [ ] Before target-contract or remediation work, execute the requirement rows
      for every subsection 5.1–5.23 across the inventoried surfaces. Each row
      needs an observation, status, evidence locator or exact blocker,
      alternative explanation, affected platform/state, and closure criterion;
      uninspected rows remain `UNVERIFIED` and block a full-audit claim.
- [ ] Populate the findings register before writing the target contract. A
      rejected hypothesis still receives a row with counterevidence.
- [ ] Populate the initial migration manifest with finding, exact write set,
      owner, dependency, data/auth/sync impact, rollback, and proof required.
- [ ] Use only isolated synthetic fixtures and scrub all personal,
      journal/mood, account, token, and production-derived content.

**Verification:**

```sh
npm ci
npm run build
ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER=true \
  npx playwright test e2e/ui-system-baseline.spec.ts \
  --project=chromium --workers=1 --retries=0
npm run check:production-data-integrity:bundle
```

**Acceptance criteria:**

- Every screenshot resolves to route, state, viewport, DPR, browser/runtime,
  theme, locale, input, fixture provenance, subject commit, and SHA-256.
- Every finding conforms to the full schema and uses explicit
  `VERIFIED`/`INFERENCE`/`ASSUMPTION`/`UNVERIFIED` status.
- No foundation, primitive, pattern, or screen remediation begins before this
  baseline and findings checkpoint is independently reviewed.

**Rejection criterion:** A stale/missing screenshot, unresolved artifact hash,
personal data, or an inferred hypothesis presented as fact returns the plan to
`STOP`.

### Task 5: Write one canonical UI-system conformance contract

**Files:**

- Create:
  `docs/superpowers/specs/2026-07-28-ui-system-conformance-contract.md`
- Modify:
  `docs/superpowers/specs/2026-07-12-settings-simplification-live-apply-design.md`
- Create: `scripts/__tests__/ui-system-contract.test.ts`

**Required contract chapters:**

- semantic color pairs and theme recipes;
- type roles and localization fallback;
- spacing scale plus named optical exceptions;
- size, radius, border, separator, elevation, opacity, material;
- focus, target, safe-area, breakpoints, containers, layers/z-index;
- effective motion source and reduced-motion/reduced-transparency behavior;
- utility icon boxes and expressive-asset provenance;
- component anatomy, allowed variants, impossible combinations, state matrix;
- grouped lists, forms, navigation, overlays, feedback, recovery, charts;
- Web/PWA, Android, iOS, Desktop adaptations;
- governance, generation, deprecation, exception, ownership, and drift policy.

- [ ] Write a failing contract test for all required chapters and cross-links.
- [ ] Import the bounded Settings contract by reference rather than duplicating
      it.
- [ ] Define a containment budget of background, one group surface, semantic
      nested control only when required, and transient overlay.
- [ ] Define rejection criteria for flattening that weakens focus, status,
      destructive safety, or high-contrast separation.
- [ ] Record a migration owner and proof type for every canonical component.

**Acceptance criteria:**

- One source of truth; no parallel token or component doctrine.
- Every rule names applicability, local evidence, tradeoff, rejection
  criterion, and verification path.

## Phase 2 — Test Infrastructure Before Broad Remediation

### Task 6: Create the development/test-only component-state preview

**Files:**

- Create: `ui-preview.html`
- Create: `src/dev/ui-system-preview/main.tsx`
- Create: `src/dev/ui-system-preview/UiSystemPreview.tsx`
- Create: `src/dev/ui-system-preview/registry.ts`
- Create: `src/dev/ui-system-preview/fixtures.ts`
- Create: `e2e/ui-system-components.spec.ts`
- Create: `scripts/__tests__/ui-preview-production-exclusion.test.ts`
- Modify: `playwright.config.ts`

**Interfaces:**

```ts
interface UiPreviewCase {
  id: string;
  component: string;
  state: string;
  theme: "paper" | "ink" | "oled" | "high-contrast";
  locale: "en" | "uk" | "es" | "de" | "fr" | "ja" | "ar" | "he";
  width: number;
  input: "keyboard" | "pointer" | "touch";
  reducedMotion: boolean;
}
```

- [ ] RED-test that preview files and fixture sentinels are absent from `dist`
      after `npm run build`.
- [ ] Render foundations and registered shared components with applicable
      default, hover, focus-visible, pressed, selected, checked, disabled,
      loading, success, warning, error, destructive, offline,
      permission-blocked, pending-sync, long-content, RTL, and contrast states.
- [ ] Keep fixture records physically under `src/dev/ui-system-preview/` and
      require `import.meta.env.DEV` or the dedicated preview entry.
- [ ] Use the existing Lucide/canonical assets; do not draw substitute SVGs.
- [ ] Add Playwright checks for semantic roles, dimensions, focus visibility,
      overflow, and screenshot output.

**Verification:**

```sh
npx vitest run --configLoader runner \
  scripts/__tests__/ui-preview-production-exclusion.test.ts
ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER=true \
  npx playwright test e2e/ui-system-components.spec.ts \
  --project=chromium --workers=1 --retries=0
npm run build
npm run check:production-data-integrity:bundle
```

**Acceptance criteria:**

- Preview is available only in development/test.
- Production bundle contains no fixtures, preview route, or fixture sentinel.
- Every registered shared component has all applicable states or an explicit
  `N/A` reason.

### Task 7: Add report-only UI-system detectors with tested false-positive handling

**Files:**

- Create: `scripts/check-ui-system-guards.ts`
- Create: `scripts/ui-system-rules/containment.ts`
- Create: `scripts/ui-system-rules/material-overload.ts`
- Create: `scripts/ui-system-rules/token-drift.ts`
- Create: `scripts/ui-system-rules/icon-governance.ts`
- Create: `scripts/ui-system-rules/state-coverage.ts`
- Create: `scripts/ui-system-rules/interaction-semantics.ts`
- Create: `scripts/ui-system-rules/copy-localization.ts`
- Create: `scripts/ui-system-rules/layering.ts`
- Create: `scripts/__tests__/check-ui-system-guards.test.ts`
- Create: `config/ui-system-guard-baseline.json`
- Modify: `package.json`
- Read/retain: `scripts/check-visual-guards.ts`

**Output contract:**

```ts
interface UiGuardFinding {
  rule: string;
  path: string;
  line: number;
  fingerprint: string;
  severity: "high" | "medium" | "low";
  rationale: string;
  mode: "report-only" | "blocking";
}
```

- [ ] Write one positive and one negative fixture for each of the eight rule
      families before implementing the detector.
- [ ] Exclude generated outputs, dependencies, test fixtures, recovery copies,
      data-visualization palettes, and approved canonical asset sources.
- [ ] Require any allowlist row to contain fingerprint, path, rationale, owner,
      review date, and removal condition.
- [ ] Emit JSON and human-readable reports deterministically.
- [ ] Run the full repository scan in report-only mode and review every high
      result before changing product code.
- [ ] Keep existing visual guard behavior unchanged until the new suite has
      local proof.

**Acceptance criteria:**

- Fixtures prove true positives and false positives.
- No silent waiver and no broad directory exclusion.
- Initial report is evidence, not a CI failure.

## Phase 3 — Foundations And Shared Components

### Task 8: Ratchet the canonical foundations

**Files:**

- Modify only when Task 3 confirms a finding:
  `src/design-tokens/tokens.json`
- Modify only when generation needs it:
  `src/design-tokens/sd.config.mjs`
- Regenerate:
  `src/generated/tokens.css`
- Regenerate:
  `src/generated/tokens.ts`
- Modify: `src/styles/themes.css`
- Modify: `src/index.css`
- Create: `src/styles/__tests__/ui-foundations-contract.test.ts`
- Update:
  `docs/audits/experience-quality/ui-baseline-manifest-2026-07-28.json`

- [ ] RED-test semantic aliases, no cycles, paired on-colors, mode mappings,
      focus roles, target sizes, containers, z-index levels, and safe-area
      values.
- [ ] Generate the current raw spacing/radius/shadow/type/color exception
      baseline and prevent count growth.
- [ ] Consolidate only equivalent semantics; retain named optical corrections.
- [ ] Generate contrast evidence for shipped foreground/background/state
      combinations and manually inspect composited blur/opacity cases.
- [ ] Validate Paper, Ink, OLED, System-source, forced/high contrast, and
      reduced transparency separately.
- [ ] Rebuild generated outputs and fail if a second hand-edited token source
      appears.

**Verification:**

```sh
npm run tokens:build
npm run check:colors
npx vitest run --configLoader runner \
  src/styles/__tests__/ui-foundations-contract.test.ts \
  src/styles/__tests__/themes.test.ts \
  src/styles/themes.bridge.test.ts
git diff --check -- \
  src/design-tokens src/generated src/styles src/index.css
```

**Rejection criterion:** Reject a token migration that creates widespread
unreviewed visual diffs, weakens a theme, or changes auth/data behavior.

### Task 9: Consolidate shared primitives by semantics

**Files:**

- Audit/modify: `src/components/ui/button.tsx`
- Audit/modify: `src/components/ui/dialog.tsx`
- Audit/modify: `src/components/ui/alert-dialog.tsx`
- Audit/modify: `src/components/ui/switch.tsx`
- Audit/modify: `src/components/ui/tabs.tsx`
- Audit/modify:
  `src/pages/nav-v2/settings/components/SettingsModuleCard.tsx`
- Audit/modify:
  `src/pages/nav-v2/settings/components/V2SettingsControlPrimitives.tsx`
- Audit/modify:
  `src/pages/nav-v2/settings/components/V2SettingsFormPrimitives.tsx`
- Create canonical `src/components/ui/page-shell.tsx`,
  `src/components/ui/section.tsx`, `src/components/ui/grouped-list.tsx`,
  `src/components/ui/status-row.tsx`, or
  `src/components/ui/danger-section.tsx` only when Task 3 identifies at least
  two semantically equivalent production usages.
- Create/modify focused tests under `src/components/ui/__tests__/`.

- [ ] RED-test anatomy, roles, keyboard behavior, focus, target, RTL,
      long-content, loading/error/disabled/destructive, and reduced-motion
      behavior.
- [ ] Prevent impossible variants with discriminated unions where state
      combinations are genuinely invalid.
- [ ] Keep exceptional warning/recovery/destructive containment.
- [ ] Migrate one usage at a time and keep characterization tests green.
- [ ] Mark legacy APIs in the migration manifest only after a replacement is
      exercised by production code.

**Acceptance criteria:**

- No ordinary content row gains nested border, shadow, radius, and tint.
- No generic primitive is created for a single cosmetic coincidence.
- Every changed primitive has component-preview and interaction coverage.

## Phase 4 — Vertical Slices

### Task 10: Complete the Account and Backup vertical-slice state matrix

**Files:**

- Modify:
  `src/pages/nav-v2/settings/V2SettingsAccountPanel.tsx`
- Modify:
  `src/pages/nav-v2/settings/V2SettingsProfilePanel.tsx`
- Modify:
  `src/pages/nav-v2/settings/V2SettingsAccountDeletion.tsx`
- Modify:
  `src/pages/nav-v2/settings/V2SettingsDataPanels.tsx`
- Modify only for presentation integration:
  `src/components/settings/account-section/useAccountAuth.ts`
- Modify only for presentation integration:
  `src/components/settings/account-section/useDeleteAccount.ts`
- Create:
  `src/pages/nav-v2/settings/__tests__/V2SettingsAccountStateMatrix.test.tsx`
- Create: `e2e/ui-system-settings-account.spec.ts`

- [ ] Preserve current owner-boundary, save, sign-out, export, recovery, and
      deletion behavior with characterization tests.
- [ ] Add test-only component states for signed out, checking, unavailable,
      error, signed in, linked provider, unchanged name, dirty name, saving,
      save failure, sign-out pending/failure, pending-change recovery, export
      recovery, discard confirmation, delete trigger/confirmation/error, long
      identifier, mixed-direction identifier, and offline.
- [ ] Capture compact and wide states in Paper, Ink, OLED, high contrast,
      English, Ukrainian, German, Arabic, and Hebrew.
- [ ] Verify focus return, Escape, Android Back contract, duplicate activation,
      and pending-action close prevention.
- [ ] Never invoke a real destructive deletion during visual fixtures.

**Acceptance criteria:**

- Normal identity/provider facts are flat rows.
- Recovery and destructive states retain sufficient containment.
- Remote success is never shown before confirmation.
- Every unexercised live-provider or destructive state remains `UNVERIFIED`.

### Task 11: Complete the Settings system and required visual matrix

**Files:**

- Modify as findings require: `src/pages/nav-v2/SettingsPage.tsx`
- Modify as findings require:
  `src/pages/nav-v2/settings/V2SettingsAppearancePanel.tsx`
- Modify as findings require:
  `src/pages/nav-v2/settings/V2SettingsSoundPanel.tsx`
- Modify as findings require:
  `src/pages/nav-v2/settings/V2SettingsNotificationsPanel.tsx`
- Modify as findings require:
  `src/pages/nav-v2/settings/V2SettingsPrivacyPanel.tsx`
- Modify as findings require:
  `src/pages/nav-v2/settings/V2SettingsAboutPanel.tsx`
- Modify: `e2e/nav-v2-settings.spec.ts`
- Create: `e2e/ui-system-settings-visual.spec.ts`
- Create:
  `docs/audits/experience-quality/ui-visual-regression-matrix-2026-07-28.md`

- [ ] RED-test the required matrix before accepting new screenshot baselines.
- [ ] Cover widths 320, 360, 390/393, 430, 600, 768, 1024, 1280, and 1440+,
      plus short landscape and 200% zoom.
- [ ] Cover Paper, Ink, OLED, and actually shipped high-contrast combinations.
- [ ] Cover every shipped locale; require Arabic and Hebrew RTL plus long German
      and Ukrainian content. Record Russian `N/A`.
- [ ] Cover keyboard focus, pointer hover, touch dimensions, reduced motion,
      forced colors, loading, error, disabled, offline, destructive
      confirmation, and detail focus restoration.
- [ ] Record OS/browser build, DPR, fonts, timezone, locale, clock policy,
      network, fixture provenance, and commit for every baseline.
- [ ] Characterize the current OS-agnostic `snapshotPathTemplate` in
      `playwright.config.ts`; then either pin one canonical runner for approval
      baselines or introduce explicit runner-keyed baselines. Do not reuse a
      Windows-approved image as Linux/macOS visual proof.
- [ ] Reject automatic baseline updates and classify every diff as intended,
      regression, environment noise, stale baseline, missing state, or
      nondeterminism.

**Acceptance criteria:**

- Compact uses overview-to-detail and wide uses bounded list-detail.
- One grouped surface contains related rows.
- Focus rings and errors are not clipped.
- Screenshot thresholds do not hide layout changes.

### Task 12: Migrate shell, navigation, auth, onboarding, overlays, and feedback

**Files:**

- Audit/modify by confirmed finding: `src/components/AuthGate.tsx`
- Audit/modify by confirmed finding:
  `src/components/auth-screen/AuthScreen.tsx`
- Audit/modify by confirmed finding:
  `src/components/navigation-v2/NavV2Orchestrator.tsx`
- Audit/modify by confirmed finding:
  `src/components/navigation-v2/MobileNavV2.tsx`
- Audit/modify by confirmed finding:
  `src/components/navigation-v2/SidebarV2.tsx`
- Audit/modify by confirmed finding:
  `src/components/OnboardingFlow.tsx`
- Audit/modify by confirmed finding:
  `src/components/NotificationPermission.tsx`
- Audit/modify by confirmed finding:
  `src/components/OfflineBanner.tsx`
- Audit/modify by confirmed finding:
  `src/components/UpdateRequiredDialog.tsx`
- Audit/modify by confirmed finding:
  `src/components/navigation-v2/V2ProgressionModalLayer.tsx`
- Add focused tests next to each changed component.

- [ ] Characterize route, history, Back/Escape, focus restoration, safe-area,
      keyboard, pointer, touch, loading, error, offline, permission, and update
      states.
- [ ] Apply foundation/primitive changes only where the inventory identifies a
      confirmed shared cause.
- [ ] Verify one primary action, truthful status, no nested overlay, and no
      unreachable controls.
- [ ] Preserve the fixed progression renderer, supported deep-link contract,
      iOS/Android auth routing, and update icon semantics.

**Acceptance criteria:** No shell/content material competition, false success,
focus trap, dead control, or duplicated status in the inspected states.

### Task 13: Migrate Orb, Journal, Habits, and Focus patterns

**Files:**

- Audit/modify by confirmed finding: `src/pages/nav-v2/OrbPage.tsx`
- Audit/modify by confirmed finding: `src/pages/nav-v2/OrbPageSteps.tsx`
- Audit/modify by confirmed finding: `src/features/journal/JournalModule.tsx`
- Audit/modify by confirmed finding:
  `src/features/journal/JournalHubShell.tsx`
- Audit/modify by confirmed finding:
  `src/features/journal/JournalEntryEditor.tsx`
- Audit/modify by confirmed finding:
  `src/features/journal/JournalEntryList.tsx`
- Audit/modify by confirmed finding:
  `src/features/journal/JournalEntryViewer.tsx`
- Audit/modify by confirmed finding:
  `src/features/journal/JournalSettingsContent.tsx`
- Audit/modify by confirmed finding:
  `src/pages/nav-v2/habits/HabitsPage.tsx`
- Audit/modify by confirmed finding:
  `src/pages/nav-v2/habits/hero/HeroInsightStrip.tsx`
- Audit/modify by confirmed finding:
  `src/components/focus-timer/FocusTimer.tsx`
- Audit/modify by confirmed finding:
  `src/components/hyperfocus/HyperfocusMode.tsx`
- Audit/modify by confirmed finding:
  `src/components/hyperfocus/HyperfocusSoundSelector.tsx`
- Preserve: canonical `ValenceOrb` and `MiniValenceOrb` sources.

- [ ] Before touching any additional file discovered by the inventory, add its
      exact path, owner, reason, and rollback boundary to the Task 4 migration
      manifest.
- [ ] Characterize forms, grouped content, overlays, empty/loading/error,
      offline, destructive/recovery, audio/haptic, motion, and long-content
      behavior.
- [ ] Preserve mood-only save and voluntary Diary continuation.
- [ ] Preserve observational insight language and sample disclosure.
- [ ] Verify journal content never enters screenshots, logs, fixtures, or
      telemetry.
- [ ] Verify audio/haptic failure does not break the task.
- [ ] Run canonical-orb and production-data gates after every shared visual
      change.

**Acceptance criteria:** Shared foundation consistency improves without
flattening expressive orb/journal/habit identity or weakening sensitive-data
boundaries.

### Task 14: Migrate statistics, charts, planning, lists, and data display

**Files:**

- Audit/modify by confirmed finding: `src/components/stats/ZenScoreHub.tsx`
- Audit/modify by confirmed finding: `src/components/stats/OverviewTab.tsx`
- Audit/modify by confirmed finding: `src/components/stats/TrendsTab.tsx`
- Audit/modify by confirmed finding: `src/components/stats/CalendarTab.tsx`
- Audit/modify by confirmed finding:
  `src/pages/nav-v2/planning/PlanningPage.tsx`
- Audit/modify by confirmed finding:
  `src/components/schedule/ScheduleTimeline.tsx`
- Audit/modify by confirmed finding:
  `src/components/schedule/TimelineDayColumn.tsx`
- Audit/modify by confirmed finding:
  `src/components/animated-stats/AnimatedCalendar.tsx`
- Create focused chart/list accessibility and data-integrity tests beside the
  changed components.

- [ ] Before touching any additional file discovered by the inventory, add its
      exact path, owner, reason, and rollback boundary to the Task 4 migration
      manifest.
- [ ] Characterize scale, range, units, aggregation, missing/zero/partial/stale
      data, locale formatting, and source provenance before visual changes.
- [ ] Add redundant non-color encoding and text/table summaries.
- [ ] Verify keyboard/touch exploration, RTL, high contrast, small screens, and
      reduced motion.
- [ ] Reject decorative precision, synthetic metrics, 3D distortion, or
      misleading area/zero-baseline choices.

**Acceptance criteria:** Visual cleanup does not alter data meaning,
aggregation, or precision and every chart retains an accessible summary.

## Phase 5 — Platform, Accessibility, Performance, And Operations

### Task 15: Execute the manual accessibility and localization matrix

**Files:**

- Create:
  `docs/audits/experience-quality/ui-accessibility-manual-2026-07-28.md`
- Create:
  `docs/audits/experience-quality/ui-visual-craft-review-2026-07-28.md`
- Update:
  `docs/audits/experience-quality/ui-state-coverage-2026-07-28.md`
- Read: `docs/ai/VISUAL_INTEGRITY_CRITIC_PROTOCOL.md`
- Modify tests only where a reproduced failure requires a regression.

- [ ] Run automated accessibility scans on every representative route/state.
- [ ] Walk keyboard-only navigation, focus visibility/order/restoration,
      dialogs, menus, error recovery, and 200% zoom.
- [ ] Walk VoiceOver on iOS/macOS, TalkBack on Android, and NVDA or Narrator on
      Windows where the runtime is actually available.
- [ ] Test target size, pointer cancellation, text spacing, forced colors,
      reduced motion, reduced transparency, and software keyboard.
- [ ] Review Arabic/Hebrew mixed-direction user content and all eight locale
      stress states.
- [ ] Compare baseline and after captures side-by-side at identical
      route/state/viewport/theme/locale/scroll conditions; review first-glance
      hierarchy, reading order, optical alignment, perceived weight, row
      rhythm, whitespace, contrast, density, platform feel, brand recognition,
      destructive prominence, and edge cases.
- [ ] Store after captures and reviewed diffs under
      `output/ui-system-audit/{headSha}/after/` and
      `output/ui-system-audit/{headSha}/diff/`; add SHA-256, reviewer,
      classification, contract reference, and linked finding to the visual
      regression matrix.
- [ ] Run the local `visual-integrity-critic` protocol after implementation and
      obtain an independent read-only craft review over hash-bound artifacts.
      If the skill or independent isolation is unavailable, mark
      `Artistic/Craft` `UNVERIFIED`.
- [ ] Keep reviewer observations separate from user preference, calmness,
      trust, fatigue, premium quality, or acceptance claims; those require
      recorded `HUMAN_RESEARCH`.
- [ ] Record missing devices or qualified reviewers as `UNVERIFIED`.

**Acceptance criteria:** Automated results are never presented as complete
WCAG proof; every manual result names assistive technology, version, platform,
route, state, and observed outcome. The craft packet reports `Technical`,
`Visual Runtime`, `Artistic/Craft`, `Motion`, `Model`, and `Plan` separately as
`PASS`, `FAIL`, `N/A`, or `UNVERIFIED`.

### Task 16: Execute platform runtime and performance matrices

**Files:**

- Create:
  `docs/audits/experience-quality/ui-platform-runtime-2026-07-28.md`
- Create:
  `docs/audits/experience-quality/ui-performance-2026-07-28.md`
- Create:
  `docs/audits/experience-quality/ui-mcp-tool-verification-2026-07-28.md`
- Modify performance/runtime tests only after a reproducible baseline.

**Web/PWA:**

- [ ] Run production build and cache-busted public route checks.
- [ ] At the current planning snapshot, the exact local command family is
      `npm run build`, `npm run test:e2e:v2:critical`, and
      `npm run smoke:chrome-performance`; Task 1 must re-resolve it from the
      immutable subject before execution.
- [ ] Install the PWA and exercise cold start, update, offline, reconnect,
      stale-cache recovery, and theme/native chrome.
- [ ] Measure LCP, INP, CLS, route transitions, long tasks, font loading,
      list scrolling, theme switch, memory, and service-worker lifecycle.

**Android:**

- [ ] Build/sync/install the exact subject artifact.
- [ ] At the current planning snapshot, run `npm run cap:sync:android`, then
      from `android/` run
      `./gradlew testDebugUnitTest lintDebug assembleDebug`; record any
      task-name/toolchain divergence instead of silently substituting a check.
- [ ] Exercise first start, final Settings, Back, safe areas, keyboard,
      permissions, deep links, notification handoffs, background/resume,
      process death, TalkBack, rotation, and low-end resource behavior.

**iOS:**

- [ ] Build/install the exact subject in a current simulator.
- [ ] At the current planning snapshot, run `npm run cap:sync:ios`, then
      `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator -derivedDataPath output/xcode/ui-system CODE_SIGNING_ALLOWED=NO build`;
      re-resolve scheme/destination on the immutable subject and retain the full
      receipt.
- [ ] Exercise final Settings, UIScene cold/warm links, privacy shield,
      Dynamic Type, VoiceOver, permissions, safe areas, background/resume, and
      iPad split view where available.
- [ ] Keep archive/signing/store status `UNVERIFIED` unless separately
      authorized and actually validated.

**Desktop/Tauri:**

- [ ] Run packaged GUI on available macOS/Windows targets.
- [ ] At the current planning snapshot, run `npm run desktop:check` followed by
      `npm run desktop:build`; a macOS build cannot close Windows/WebView2.
- [ ] Exercise narrow/standard/wide resize, keyboard, mouse, menus, sleep/wake,
      update, filesystem import/export, high contrast, and signing status.

**MCP and controlled-tool verification:**

- [ ] Record the callable MCP/tool name, exposed version/server identity,
      permission boundary, intended evidence class, exact target, timestamp,
      result path, and fallback for each selected tool.
- [ ] Use Browser/Chrome tooling for rendered Web/PWA evidence, the repository
      Android runtime path for emulator/device evidence, Snyk MCP for modified
      supported first-party code when callable, and Supabase MCP only for a
      separately justified read-only contract check.
- [ ] Independently corroborate each MCP result against the same exact-SHA
      local source or runtime artifact; a connector summary alone is not
      `PASS`.
- [ ] Keep unavailable, unauthenticated, write-requiring, or insufficiently
      isolated MCP paths `UNVERIFIED`; never expose credentials or broaden
      authority merely to close a matrix cell.

**Acceptance criteria:**

- Every platform/cell is `PASS`, `FAIL`, `N/A` with reason, or `UNVERIFIED`
  with blocker.
- Shared browser source is never used as native proof.
- MCP availability is never used as proof that a platform flow passed.
- No performance threshold is met by downgrading canonical visual quality.

### Task 17: Promote proven guards, remove dead paths, and close the evidence packet

**Files:**

- Modify after report-only proof: `package.json`
- Modify after report-only proof:
  `.github/workflows/visual-regression.yml`
- Modify after report-only proof: `.github/workflows/drift-checks.yml`
- Modify:
  `docs/audits/experience-quality/ui-migration-manifest-2026-07-28.md`
- Create:
  `docs/audits/experience-quality/ui-final-verification-2026-07-28.md`
- Create:
  `docs/audits/experience-quality/ui-security-privacy-verification-2026-07-28.md`
- Update:
  `docs/audits/experience-quality/zenflow-experience-quality-audit-2026-07-28.md`

- [ ] Promote only reviewed high-confidence detector rules to blocking mode.
- [ ] Require exact baseline fingerprints and fail on unowned drift.
- [ ] Remove deprecated primitives/CSS/tests only after zero production usages,
      green replacement coverage, and a documented rollback.
- [ ] Run `npm run doc-counts:update` only in the clean owned lane and inspect
      the generated block.
- [ ] Resolve generated Supabase types only against an authorized target; do
      not make a production migration as part of visual closure.
- [ ] Scan every new or modified supported first-party source file with Snyk
      MCP when callable. Fix scoped findings and rescan; if MCP is unavailable,
      run the current local fallback `npm run security:scan` and keep
      authentication/network failures `UNVERIFIED`, never `PASS`.
- [ ] Run
      `/Users/yehor/.codex/bin/codex-security-suite.sh --path . --profile quick`
      in the clean exact-SHA worktree. Do not run DAST, external targets, or
      production writes without separate explicit authorization.
- [ ] Build a hash-bound manifest for source, prompt, requirements, findings,
      commands, screenshots, native receipts, platform matrix, and final docs.
- [ ] Perform independent QA and Role-10 Pass B against that immutable packet.
      Pass B must recompute separate hashes for the subject, prompt,
      requirement map, source registry, findings register, command receipts,
      screenshot manifest, platform matrix, security packet, and final report;
      summary prose is not integrity proof.

**Final command family:**

```sh
npm run tokens:build
npm run typecheck
npm run lint
npm run oxlint
npm run i18n:check
npm run i18n:deep
npm run check:translation-quality
npm run check:colors
npm run check:visual
npm run check:production-data-integrity
npm run test:coverage
npm run test:e2e:v2:critical
npm run build
npm run check:production-data-integrity:bundle
npm run check:size
npm run check:release-artifacts
npm run security:scan
npm run check:no-ai-templates
npm run check:best-practices
npm run check:task-completion
npm run doc-counts
npm run check:types-fresh
npm run ci:preflight
```

Run applicable native and Desktop commands from the current `package.json`;
record exact command, working directory, UTC timestamps, duration, exit code,
summary, artifact path, and skipped reason. Artifact-sensitive build/integrity
checks run sequentially.

**Acceptance criteria:**

- Every brief requirement maps to fresh evidence or explicit `UNVERIFIED`.
- Every fixed finding has red/baseline, green, blast-radius proof, rollback,
      and platform impact.
- Every screenshot and command count resolves to one hash-bound artifact.
- No `OPEN` `BLOCKER`/`HIGH` or `P0`/`P1` remains. Any `BLOCKED` or
      `ACCEPTED_RISK` row requires exact containment, owner, expiry/recheck
      trigger, and residual-risk evidence.
- `COMPLETE` is allowed only when all completion criteria actually pass;
      otherwise final status remains `PARTIAL` or `BLOCKED`.

## Risks And Mitigations

| Risk | Mitigation | Rejection criterion |
| --- | --- | --- |
| Mixed dirty checkout makes proof unattributable | Clean exact-SHA worktree before implementation | Any unexplained path or moving subject |
| Product-wide rewrite expands blast radius | Inventory and vertical slices; lowest-common-layer fixes | Broad screen edits before contract/characterization |
| New preview leaks fixtures to production | Separate dev entry plus bundle negative-control test | Preview HTML/module/fixture sentinel in `dist` |
| Detector false positives weaken trust | Report-only launch, fixtures, exact ratchet, reviewed allowlist | Broad exclusions or silent waivers |
| Visual simplification weakens state/safety | Preserve exceptional containment and behavior tests | Focus/status/destructive/recovery regression |
| Cross-platform claim rests on browser source | Platform-specific runtime matrix | Shared-source screenshot used as native proof |
| Snapshot noise hides defects | Fixed environment metadata and reviewed diffs | Large threshold or automatic baseline acceptance |
| Token migration creates parallel system | Extend Style Dictionary only | Second token source or hand-edited generated output |
| Sensitive content enters QA artifacts | Test-only synthetic fixtures and PDI/bundle checks | Real journal/mood/auth content in artifact |
| Agent consensus is treated as user proof | Separate human and expert-review ledgers | Human acceptance claim without recorded research |

## Best Practices Packet

| Surface | Current status | Execution proof required |
| --- | --- | --- |
| Web/Vite | `PARTIAL` | Full route/state browser and accessibility matrix |
| Installed PWA | `UNVERIFIED` | Install/update/offline/reconnect/stale-cache run |
| Android | `PARTIAL` | Exact-artifact Settings, lifecycle, Back, permissions, TalkBack, process death |
| iOS | `PARTIAL` | Exact-artifact Settings, VoiceOver, Dynamic Type, lifecycle, deep-link destination |
| Desktop/Tauri | `PARTIAL` | Packaged GUI, resize, keyboard, Windows, update/signing status |
| Store/Release | `UNVERIFIED` | Separate authorized signing/store/deploy evidence |
| Accessibility | `PARTIAL` | Manual AT, keyboard, 200% zoom, forced colors, touch |
| Performance | `PARTIAL` | PWA/native/resource baselines and rejection thresholds |
| Security/Privacy | `PARTIAL` | Scanner/PDI, telemetry boundary, auth/storage invariants |
| Testing | `PARTIAL` | Requirement-linked red/green, preview, E2E, native receipts |
| Operations | `UNVERIFIED` | Owner, alert, rollout, rollback, recovery drill |

## Done Criteria

- [ ] Clean, immutable, hash-bound subject exists.
- [ ] Every requirement in the supplied brief is mapped.
- [ ] Every individual check under audit subsections 5.1–5.23 has evidence or
      an exact `UNVERIFIED` blocker and closure criterion.
- [ ] Complete surface/component/token/asset/state inventories exist.
- [ ] One canonical UI-system contract is active.
- [ ] Test-only preview is production-inaccessible.
- [ ] Eight detector families have positive/negative fixtures and reviewed
      ratchets.
- [ ] Foundations and shared primitives are remediated before screen waves.
- [ ] Account and all Settings states meet the contract.
- [ ] Product-wide shell, Journal/Orb, Habits/Focus, planning/stats patterns
      have completed vertical-slice verification.
- [ ] All eight shipped locales, RTL, long text, 200% zoom, high contrast, and
      reduced motion have evidence.
- [ ] Web/PWA, Android, iOS, and Desktop have honest per-cell statuses.
- [ ] Selected MCP/tool checks have a least-privilege receipt, independent
      source/runtime corroboration, and explicit unavailable fallbacks.
- [ ] Manual accessibility and native/device limits are explicit.
- [ ] Performance, privacy, data integrity, dependencies, and recovery remain
      within accepted bounds.
- [ ] No evidence receipt/count/path divergence remains.
- [ ] No `OPEN` `BLOCKER`/`HIGH` or `P0`/`P1` finding remains.
- [ ] Final diff, generated outputs, docs, screenshots, and commands refer to
      the same subject hash.
- [ ] Human acceptance remains `UNVERIFIED` unless recorded research exists.

## Current UNVERIFIED Ledger

- Clean attributable integration subject containing the prior bounded fixes.
- Full requirement-to-proof mapping.
- Whole-product component and state inventory.
- Component-state preview and production exclusion.
- Structural/material/token/icon/state/interaction/copy/layer detector suite.
- Full Account visual/state matrix.
- Installed PWA lifecycle.
- Native final Settings parity.
- Physical Android/iOS devices and assistive technologies.
- Windows packaged Tauri runtime and signed artifacts.
- Full UI performance/resource baselines.
- Human, native-speaker, accessibility-user, legal/store, and privacy-owner
  acceptance.

## Execution Handoff

Implementation must begin with Task 1 in a new clean, locked worktree. No
product code should be changed in the current mixed `main` checkout. After the
subject is established, execute one task at a time with an independent review
checkpoint between tasks and preserve `PARTIAL`/`BLOCKED` whenever required
runtime or authority is unavailable.
