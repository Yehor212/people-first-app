# Implementation Plan: Authoritative Schema and Types

**Work Lane Branch**: `codex/android-2-1-r1-schema-types-20260811` | **Feature ID**: `002-authoritative-schema-and-types` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

**Input**: T167 selects and hash-binds the authoritative schema/type-generation path. It must not execute T168 migration admission or T169 replay/type generation.

## Summary

Bind the clean execution lane, its tracked-clean `supabase/config.toml`, and its exact 80-file tracked migration set as the current authoritative baseline. Document a future local-only contract that rebuilds a fresh disposable Supabase instance with seed execution disabled and then generates TypeScript declarations from that local instance. T167 implements only Spec Kit documentation and an ignored JSON receipt; both future commands remain deferred and unexecuted.

The baseline selected here is intentionally not represented as the final T169 set. If T168 admits the automation migration, the executor must recompute and re-review the exact tracked set, working-tree bytes, index bytes, Git tree, and canonical digest before any replay.

## Technical Context

**Language/Version**: Markdown and JSON evidence; existing Bash/Node/Git validation only; no first-party runtime code

**Primary Dependencies**: Existing repository Spec Kit scripts, Git, `shasum`, `stat`, `jq`, and existing npm checks; no installation or dependency change

**Storage**: Tracked feature documentation plus ignored `output/android21/data/schema-source.json`; Supabase/PostgreSQL is future local replay context only

**Testing**: Static path/hash/count/JSON checks, Spec Kit prerequisite/analyze/converge checks, dirty-lane freshness RED reproduction, clean-lane timestamp observation, and final Git boundary inspection

**Target Platform**: Shared schema contract for Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView, and Desktop/Tauri; no platform runtime is exercised in T167

**Project Type**: Cross-platform React/Capacitor/Tauri repository with local-first IndexedDB clients and Supabase synchronization

**Performance Goals**: No runtime performance change; validation must remain bounded to the exact 80-file migration inventory and named provenance inputs

**Constraints**: No replay, generation, remote Supabase, seed, dependency install, migration/config/type/runtime/package change, dirty-umbrella mutation, Git publication, production-data access, external write, or subagent

**Scale/Scope**: One current configuration, 80 admitted tracked SQL files, two dirty-umbrella migration candidates recorded as `NOT_ADMITTED`, one generated type target held read-only, one ignored receipt

## Constitution Check

*GATE: Checked before Phase 0 and rechecked after Phase 1.*

The repository status command reports constitution version `1.0.1` as `PROPOSED`, `PROPOSAL_CRITERIA_ONLY`, non-binding, non-blocking, and without critical-remediation authority. The proposal is therefore evaluated as a quality rubric rather than cited as ratified authority.

| Criterion | Pre-research result | Post-design result | Evidence or limit |
| --- | --- | --- | --- |
| People-first and privacy boundary | PASS | PASS | T167 reads metadata and source files only; it does not access user or production data |
| Local-first and sync coherence | PASS | PASS | Current exact migration source is bound; runtime/local IndexedDB and sync semantics remain unchanged and `UNVERIFIED` |
| Test-first evidence | PASS | PASS | Documentation-only exception is declared; dirty umbrella RED and clean timestamp baseline were captured before artifacts, without laundering timestamp freshness into semantic proof |
| Cross-platform parity | PASS | PASS | Five platforms receive an explicit static shared-contract impact; runtime parity remains `UNVERIFIED` |
| Reversible scope | PASS | PASS | Rollback removes only the new sub-spec, ignored evidence, and restores the previous feature pointer |
| Evidence honesty | PASS | PASS | Source selection, deferred replay/generation, and remaining owner/external gates are separate statuses |

No constitution exception or complexity waiver is used.

## Project Structure

### Documentation and evidence for this feature

```text
.specify/feature.json
specs/002-authoritative-schema-and-types/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── contracts/
│   └── local-schema-replay.md
└── checklists/
    ├── requirements.md
    └── schema-source.md

output/android21/data/schema-source.json  # ignored receipt
```

### Read-only repository surfaces

```text
supabase/config.toml
supabase/migrations/*.sql
src/types/supabase.ts
scripts/check-types-freshness.cjs
package-lock.json
```

### Read-only dirty-umbrella provenance surfaces

```text
specs/002-android-2-1-connected-release/tasks.md
specs/002-android-2-1-connected-release/recovery-planning-manifest.md
supabase/config.toml
supabase/migrations/20260808000000_automation_transaction_ledger.sql
supabase/migrations/20260808010000_journal_sync_event_privacy.sql
```

**Structure Decision**: Keep T167 isolated under a dedicated Spec Kit sub-spec. No production source directory is modified. The ignored receipt is retained outside the tracked specification so machine evidence does not become an authoritative schema input or release artifact.

## Implementation Phases

### Phase 0 - Source-selection research

- Revalidate R0 closure and clean-lane identity before writes.
- Classify each current, candidate, and excluded source with exact provenance and hashes.
- Select disposable local replay and reject remote, linked-project, timestamp-only, and dirty-umbrella alternatives.
- Preserve Docker and Supabase CLI availability as future `UNVERIFIED` prerequisites.

Output: [research.md](./research.md)

### Phase 1 - Contract design

- Define evidence entities and status semantics.
- Define the future two-step local-only command contract without executing it.
- Define invalidation rules for any set, index, working-tree, config, or tool drift.
- Define receipt fields, rollback, platform matrix, and remaining gates.

Outputs: [data-model.md](./data-model.md), [contracts/local-schema-replay.md](./contracts/local-schema-replay.md), [quickstart.md](./quickstart.md)

### Phase 2 - Documentation/evidence implementation

- Generate a requirements-quality checklist and path-specific implementation tasks.
- Run read-only cross-artifact analysis; resolve all critical contradictions before implementation.
- Create and validate only the bounded ignored receipt.
- Recompute hashes and diff/status boundaries, then converge without adding new scope.

Output: [tasks.md](./tasks.md) and ignored `output/android21/data/schema-source.json`

## Rollback

Restore `.specify/feature.json` to `specs/001-pending-batch-delivery`, remove only `specs/002-authoritative-schema-and-types/**`, remove only `output/android21/data/schema-source.json`, and remove the ignored `.preflight-token` if it belongs to this run. No database, migration, generated type, runtime, package, remote, Git history, or production rollback exists because T167 changes none of those surfaces.

## Complexity Tracking

No constitution violation, new architecture component, production dependency, runtime abstraction, or cross-platform implementation is introduced.
