# T167 Review Quickstart

This guide validates the T167 documentation and receipt. It is not an execution guide for schema replay or type generation.

## Safety Boundary

Do not run Supabase, Docker, migration, generation, installation, remote, Git-publication, deployment, or production-data commands while reviewing T167. The two future Supabase command strings appear only as inert documentation/evidence in this sub-spec and the ignored receipt; their recorded T167 state must be `NOT_EXECUTED`.

## 1. Confirm the active bounded feature

From the clean execution lane, verify `.specify/feature.json` resolves to `specs/002-authoritative-schema-and-types` and that Spec Kit prerequisites resolve the same feature directory. Check constitution status separately; version `1.0.1` is expected to remain proposed and proposal-only, not binding authority.

Expected tracked write boundary:

```text
.specify/feature.json
specs/002-authoritative-schema-and-types/**
```

Expected ignored evidence boundary:

```text
.preflight-token
output/android21/data/schema-source.json
```

Any other changed path is a scope failure until explained and resolved.

## 2. Recompute source bindings

Review the current clean-lane configuration and the exact tracked migration membership. The migration inventory must be sorted and serialized as:

```text
path<TAB>bytes<TAB>sha256<LF>
```

For the T167 base, expect 80 tracked SQL files, Git tree `685b1d2803cf41d0c270ed8b1eca9a45ff781476`, and aggregate SHA-256 `5d5d7013b7d41efa5b27fb5e317e8e5cb50325ef7cc192ec3120dc3ba1682c1f`.

Do not treat these values as valid for T169 after T168 admits any new file. At that point the complete membership and digest must change and be reviewed again.

## 3. Confirm exclusions and owner boundaries

Verify the receipt records:

- automation migration: `NOT_ADMITTED`, owned by T168;
- journal privacy migration: `NOT_ADMITTED`, without implied admission authority;
- dirty umbrella configuration: `EXCLUDED` because its observed change is unrelated;
- generated type file: read-only during T167;
- replay and generation: `DEFERRED / UNVERIFIED`, owned by later authorized work;
- local tools: future prerequisite `UNVERIFIED`, without installation.

## 4. Validate documentation quality

Run the repository's Spec Kit prerequisite checks, then review:

- [spec.md](./spec.md) for measurable requirements and explicit non-goals;
- [research.md](./research.md) for decisions, rejected alternatives, and exact evidence;
- [data-model.md](./data-model.md) for status semantics and invariants;
- [contracts/local-schema-replay.md](./contracts/local-schema-replay.md) for the future local-only contract;
- [checklists/requirements.md](./checklists/requirements.md) and [checklists/schema-source.md](./checklists/schema-source.md) for all-complete quality gates;
- [tasks.md](./tasks.md) for complete requirement coverage and no T168/T169 execution task.

There must be no unresolved template token, placeholder, clarification marker, or unfinished-work marker in final feature artifacts.

## 5. Validate the ignored receipt

Confirm `output/android21/data/schema-source.json`:

- is ignored and is not staged;
- parses as a JSON object;
- separates source-selection `PASS` from replay/generation `DEFERRED / UNVERIFIED`;
- contains exactly five platform rows;
- reports runtime, production/live state, native behavior, public deployment, release, and human acceptance as `UNVERIFIED`;
- records no command execution for either future Supabase command;
- binds all current and dirty provenance inputs by exact status, bytes, and SHA-256;
- includes prohibited-action assertions and a bounded rollback.

The receipt's own final byte count and SHA-256 are calculated externally after the file is complete; they are not embedded recursively inside the receipt.

## 6. Final scope review

Recompute protected invariant hashes for `supabase/config.toml`, the migration set, `src/types/supabase.ts`, `package-lock.json`, the dirty-umbrella inputs, and the workspace descriptor. Review `git diff --check`, tracked status, ignored status, and exact path allowlists.

A T167 scoped `GO` requires all documentation/evidence tasks complete, no critical cross-artifact finding, no convergence gap, no prohibited change or side effect, and no unexplained failing required check. Runtime and future owner gates remain explicitly `UNVERIFIED`; they are not T167 success criteria.

## Rollback

Restore the prior feature pointer `specs/001-pending-batch-delivery`, delete only the new T167 sub-spec, delete only its ignored receipt, and remove only its ignored preflight token. No database, migration, type, runtime, dependency, remote, production, or Git-history rollback is required because none is changed by T167.
