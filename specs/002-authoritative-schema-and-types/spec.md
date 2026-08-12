# Feature Specification: Authoritative Schema and Types

**Feature Branch**: `codex/android-2-1-r1-schema-types-20260811`

**Created**: 2026-08-12

**Status**: Complete for T167 evidence-only scope

**Input**: Select and hash-bind the authoritative schema/type generation path for R1A/T167, without starting T168/T169 or executing schema replay or type generation.

## Clarifications

### Session 2026-08-12

- No critical ambiguity requires an owner question: the request explicitly selects a disposable local replay, forbids replay and generation during T167, assigns migration admission to T168 and type regeneration to T169, and fixes the required evidence and handoff format.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Select one trustworthy schema source (Priority: P1)

As the ZenFlow data maintainer, I need one exact, reviewable source boundary so that future generated Supabase declarations cannot be based on a dirty umbrella, an unreviewed migration, a linked remote project, or a timestamp-only freshness signal.

**Why this priority**: A wrong source can make generated declarations look current while disagreeing with the schema shared by every client.

**Independent Test**: Recompute the clean-lane identity and canonical migration-set digest, then confirm every admitted and excluded source has the recorded path, Git state, byte count, SHA-256, and provenance classification.

**Acceptance Scenarios**:

1. **Given** the clean execution lane is at the authorized R0 identity, **When** source selection is reviewed, **Then** only the clean-lane configuration and exact tracked migration set are selected as the current authoritative baseline.
2. **Given** migration candidates exist only as dirty-umbrella files, **When** T167 is evaluated, **Then** each candidate is hash-bound as `NOT_ADMITTED` and cannot enter the authoritative set.
3. **Given** a timestamp guard reports the clean generated file as fresh, **When** evidence is classified, **Then** the result is retained only as a timestamp observation and does not prove semantic schema parity.

---

### User Story 2 - Preserve a local-only future execution contract (Priority: P2)

As the future authorized executor, I need an unambiguous local replay and generation contract so that a disposable schema can be rebuilt without selecting or mutating a hosted Supabase project and without seed data.

**Why this priority**: The contract prevents remote side effects and makes the future T169 generation source reproducible after T168 admits a reviewed migration.

**Independent Test**: Inspect the contract and confirm it defines exactly one disposable local replay followed by one local TypeScript generation step, prohibits seed execution and remote linkage, and records both steps as deferred in T167.

**Acceptance Scenarios**:

1. **Given** the exact reviewed set is tracked in the clean execution lane, **When** a later task receives execution authority, **Then** replay is constrained to a fresh disposable local Supabase instance with seed execution disabled.
2. **Given** local replay succeeds in a later task, **When** types are generated, **Then** generation is constrained to that local instance rather than a project identifier or linked remote target.
3. **Given** Docker or the Supabase CLI is absent during T167, **When** path selection is assessed, **Then** the future execution prerequisite remains `UNVERIFIED` without blocking the documentation-only source-selection decision.

---

### User Story 3 - Audit the bounded T167 result (Priority: P3)

As the task owner, I need a machine-readable receipt that separates what T167 proved from what it deferred so that a scoped `GO` cannot be mistaken for migration, runtime, security, privacy, production, or release approval.

**Why this priority**: T167 is allowed to choose a path, not to execute or widen it.

**Independent Test**: Validate the ignored receipt as JSON, verify its hashes and byte counts, review its five-platform static-impact matrix and rollback, and confirm no prohibited path or external action changed.

**Acceptance Scenarios**:

1. **Given** source bindings are complete, **When** the receipt is validated, **Then** source selection is `PASS` while replay and generation are separately `DEFERRED` and `UNVERIFIED`.
2. **Given** no runtime or native execution occurred, **When** platform impact is reported, **Then** Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView, and Desktop/Tauri are each marked as static shared-contract impact only and runtime remains `UNVERIFIED`.
3. **Given** T167 reaches scoped `GO`, **When** handoff is prepared, **Then** exactly one ready-to-use T168 prompt is produced; otherwise no next prompt is produced.

### Edge Cases

- Any mismatch in the R0 receipt hash/bytes/JSON or lane path, branch, HEAD, tree, base, `origin/main`, merge-base, divergence, upstream, lock, status, remote branch absence, package-lock, workspace descriptor, or edit doctor changes the outcome to `WAITING_FOR_OWNER` before source writes.
- A migration is not admitted merely because its filename sorts after the current set, its content is readable, or its hash is known; T168 must review the automation candidate before it can become an admitted tracked source.
- A dirty-umbrella configuration change unrelated to schema replay is excluded even when the file remains valid TOML.
- A newly tracked, staged, modified, symlinked, or untracked SQL file at future execution time invalidates a previously computed set digest until a new exact review binds its working-tree and index bytes.
- Missing local tooling prevents replay/generation evidence but does not invalidate a fully documented T167 path-selection decision.
- A replay or generation command executed during T167, any remote Supabase access, or any change to migration/type/runtime/dependency files is a scope failure rather than additional proof.

## Scope Boundaries

### Current evidence anchors

| Evidence | Current observation | T167 meaning |
| --- | --- | --- |
| R0/T162 closure receipt | 11,573 bytes; SHA-256 `6b63cb7b880c2be1086c878c26ff09b812ebc339092ac9588d565114a4baa0f4`; JSON object; result `GO_R0_T162_GIT_VISIBLE_SCOPE` | Workspace-recovery authority only |
| Clean lane identity | branch `codex/android-2-1-r1-schema-types-20260811`; HEAD/base/`origin/main`/merge-base `13ca51a80d23220574deba762851fe5a32372e46`; tree `36fe8707f1ffded6ef1ccfd04898b0e1be5bba7e`; divergence `0/0`; no upstream; locked; normal/ignored status `0/0` | Required source-selection boundary |
| Clean `supabase/config.toml` | tracked and clean; 19,088 bytes; SHA-256 `5e36eafc7f63960a80c8c304c246a076d9153973cfde3476c3150e03ed49b8d5` | Admitted current local configuration |
| Clean migration baseline | 80 tracked SQL files; Git tree `685b1d2803cf41d0c270ed8b1eca9a45ff781476`; canonical set SHA-256 `5d5d7013b7d41efa5b27fb5e317e8e5cb50325ef7cc192ec3120dc3ba1682c1f` | Admitted current schema baseline |
| Generated type target | `src/types/supabase.ts`; tracked and clean; 53,988 bytes; SHA-256 `eb6139d9a5786e25b4898ad05f167479cac19dbeabb6ab2af3149138b323168e` | Read-only target in T167 |
| Dirty umbrella RED | `check:types-fresh` exit 1; automation migration selected by the heuristic; generated file 2,455 minutes older | Reproduced failure signal, not an admitted source |
| Clean lane observation | freshness snapshot reports zero-minute drift from `20260714120403_journal_cloud_write_integrity.sql` using Git log times | Timestamp observation only; semantic parity `UNVERIFIED` |

### Explicit non-goals

- Do not review or repair automation migration semantics, RLS, RPC, rollback, or privacy behavior; that is T168.
- Do not replay migrations, generate or hand-edit types, or change `src/types/supabase.ts`; committed type regeneration is T169.
- Do not change `supabase/config.toml`, any migration, runtime code, package manifest/lock, source storage/sync/auth/privacy files, or the dirty umbrella.
- Do not install dependencies, link or access a remote Supabase project, apply a migration, read production data, commit, push, open a PR, merge, deploy, message externally, or start T168+.
- Do not introduce mock, demo, sample, fallback, or synthetic business records into any production-reachable surface.
- Do not use subagents for this bounded task.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: T167 MUST stop before implementation if any R0 receipt or clean-lane identity field drifts from the authorized values.
- **FR-002**: The source selection MUST bind the clean execution lane by absolute path, branch, HEAD/base/remote/merge-base, tree, divergence, upstream, lock, status, package-lock, and workspace descriptor evidence.
- **FR-003**: The current authoritative configuration MUST be the tracked-clean clean-lane `supabase/config.toml` bound by exact byte count and SHA-256.
- **FR-004**: The current authoritative migration baseline MUST be the exact 80-file tracked set bound by Git tree and a canonical digest over sorted `path<TAB>bytes<TAB>sha256<LF>` entries.
- **FR-005**: The dirty automation migration MUST remain `NOT_ADMITTED` in T167 and be bound only by path, source status, 101,304 bytes, and SHA-256 `87fbf947ef82b995b044d84ab73a1763cfeb2df6646d1afcf177f86a927b8939`.
- **FR-006**: The dirty journal privacy migration MUST remain `NOT_ADMITTED` and be bound only by path, source status, 2,321 bytes, and SHA-256 `7b590d541de83b04d903083cd29f9940bb547a712c61436575e8ea39132168f2`.
- **FR-007**: The dirty umbrella task and recovery-manifest files MUST remain read-only provenance inputs, and their expected hashes and byte counts MUST be revalidated without copying their containing diff.
- **FR-008**: The dirty umbrella `supabase/config.toml` MUST be excluded because it is modified for an unrelated Edge Function entry and is not the selected base configuration.
- **FR-009**: The selected future execution path MUST use a fresh disposable local Supabase replay of only an exact reviewed set tracked in the clean execution lane.
- **FR-010**: The future replay contract MUST disable seed execution even though the base local configuration enables seed behavior by default.
- **FR-011**: The selected future generation path MUST generate TypeScript declarations from the local replay and MUST NOT use a linked project or remote project identifier.
- **FR-012**: T167 MUST record both replay and generation as deferred and MUST NOT execute either command.
- **FR-013**: T168 MUST own admission and contract review of the automation migration; T169 MUST own the type-file regeneration and semantic/freshness verification.
- **FR-014**: A timestamp-only freshness result MUST NOT be reported as semantic schema parity.
- **FR-015**: Missing Docker or Supabase CLI availability MUST be recorded as an `UNVERIFIED` future execution prerequisite, not as an independent blocker to T167 path selection.
- **FR-016**: The receipt MUST separately classify source selection, replay, generation, five-platform static impact, runtime evidence, remaining owner/external gates, prohibited actions, and rollback.
- **FR-017**: The receipt MUST preserve `UNVERIFIED` for runtime, live Supabase state, production data, native behavior, public deployment, release, and human acceptance because none is exercised.
- **FR-018**: T167 MUST make zero changes to migrations, `src/types/supabase.ts`, runtime, package manifests/lock, the dirty umbrella, or production data.
- **FR-019**: T167 MUST perform zero dependency installs, remote Supabase operations, migration applications, Git publication actions, deploys, T168+ actions, or other external writes.
- **FR-020**: Rollback MUST be limited to restoring the previous feature pointer and removing only the new T167 sub-spec, ignored receipt, and temporary ignored evidence.
- **FR-021**: A scoped `GO` MUST produce exactly one T168 prompt; any `WAITING_FOR_OWNER` outcome MUST produce `NEXT_PROMPT: NONE`.
- **FR-022**: All durable documentation MUST use current local evidence, exact statuses, and explicit unknowns rather than generic templates or fabricated proof.
- **FR-023**: The task-specific Free RAG preflight MUST run in no-write mode without automatically installing dependencies, and retrieved excerpts MUST remain non-authoritative context.

### Key Entities

- **Schema Source Selection**: The exact clean-lane identity, admitted configuration, admitted tracked migration set, generation target, local-only path decision, and selection verdict.
- **Source Artifact Binding**: An absolute or repository-relative path plus provenance, Git state, byte count, SHA-256, admission status, and owning task.
- **Deferred Execution Gate**: A replay or generation step with exact future command contract, prerequisites, current `DEFERRED/UNVERIFIED` status, owner task, and prohibited side effects.
- **T167 Evidence Receipt**: The ignored JSON artifact that binds the selection decision, deferred evidence, platform matrix, rollback, and remaining gates without becoming release proof.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the R0 identity fields named in FR-001/FR-002 match the authorized receipt before any feature artifact is written.
- **SC-002**: The admitted current migration baseline contains exactly 80 tracked files and recomputes to Git tree `685b1d2803cf41d0c270ed8b1eca9a45ff781476` and canonical SHA-256 `5d5d7013b7d41efa5b27fb5e317e8e5cb50325ef7cc192ec3120dc3ba1682c1f`.
- **SC-003**: Exactly two dirty migration candidates are recorded as `NOT_ADMITTED`, and neither appears in the clean-lane migration set.
- **SC-004**: The future contract contains exactly one local reset step with seed disabled and one local TypeScript generation step, while T167 executes zero replay/generation commands.
- **SC-005**: The receipt validates as JSON and reports source selection `PASS`, replay `DEFERRED/UNVERIFIED`, generation `DEFERRED/UNVERIFIED`, five of five platform rows, runtime `UNVERIFIED`, remaining gates, and rollback as distinct fields.
- **SC-006**: Final Git inspection shows no changed path outside `.specify/feature.json` and `specs/002-authoritative-schema-and-types/**`; ignored inspection shows only authorized T167 evidence paths.
- **SC-007**: Final evidence shows zero changes to configuration, migrations, generated types, runtime, package manifests/lock, or umbrella bytes and zero prohibited Git, remote, production, replay, generation, dependency, or external actions.
- **SC-008**: Cross-artifact analysis finds no critical contradiction, every functional requirement maps to at least one task, and convergence finds no unimplemented T167 work.
- **SC-009**: The final report never equates timestamp freshness with semantic parity and issues exactly one T168 prompt only if all T167 source-selection criteria pass.

## Assumptions

- The T162 closure receipt is authoritative only for the workspace-recovery identity it explicitly records; it grants no security, privacy, production, release, remote, or publication waiver.
- The user has already made the product-defining choice between remote generation and disposable local replay: T167 selects the local-only path.
- Reviewing migration semantics would begin T168 and is intentionally excluded even though source hashes are known.
- The clean-lane tracked migration set is the current baseline, not the final T169 set; a future admitted migration requires a new exact digest before replay.
- Supabase CLI and Docker are absent from the current clean lane and PATH; their future installation or availability requires separate authority and evidence.
- No user-facing copy, UI, accessibility behavior, localization key, performance path, or native shell behavior changes in T167.
