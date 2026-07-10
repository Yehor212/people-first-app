# Production Data Integrity Policy

**Status:** Active repository policy
**Version:** 1.0.0
**Effective:** 2026-07-09
**Owner:** ZenFlow repository owner; remote CODEOWNER/ruleset enforcement remains `UNVERIFIED`

## Purpose

ZenFlow must never present invented habits, moods, focus sessions, gratitude, journal history, account state, backend results, analytics facts, exports, or release evidence as if they were real. This policy separates legitimate test doubles and curated product content from synthetic facts that can reach a shipped runtime or a production data sink.

The mandatory gate is deterministic and local after dependency installation. It does not ask an LLM to classify source code, does not execute analyzed code, and does not upload code or user data.

## Scope

The policy covers:

- the Vite web entry (`src/main.tsx`), build entry (`vite.config.ts`), PWA service worker (`src/sw.ts`), brace-expanded Vite globs, literal `new URL(..., import.meta.url)` assets, workers, and resolvable dynamic chunks;
- the shared `dist/` artifact consumed by Web/PWA, Android, iOS, and Tauri Desktop;
- shipped `public/**`, Android Java, recursive iOS Swift under both `ios/App/App/**` and `ios/App/CapApp-SPM/Sources/**`, Tauri Rust under `src-tauri/src/**` plus `src-tauri/build.rs`, source maps, and the native/public JSON surfaces enumerated by the canonical config; a fixture-looking path inside a shipped public/native root remains production;
- Supabase Edge Function entrypoints, production migrations, and `supabase/sql`;
- production-invoked sync, migration, backup, analytics, export, share, and release tools;
- tracked readiness/release evidence plus canonical generated packets under top-level `output/*.json`, direct-child `output/*/*readiness*.json`, `output/release/**/*.json`, and `artifacts/**/*.json`; ad-hoc private/security-tool/test subdirectories are not release evidence;
- this checker, its configuration, exact baseline, waivers, hook, tests, CI workflow, package scripts, and review contracts.

The policy does not judge whether a person's private journal text is factually true. It protects provenance and presentation: software-created data may not masquerade as user-created or authoritative service data.

## Definitions

**Synthetic fact** means a hardcoded, generated, copied, or stubbed record presented as user history or authoritative backend/release state. Signals include domain fields, plausible values, generated identifiers/timestamps, fixture imports, error branches, and dangerous sinks. A variable name alone is never sufficient.

**Test double** means a mock, stub, fake timer, fixture, factory, emulator, or dedicated smoke-account record used in an isolated verification environment and never reachable from normal production flow.

**Product content** means a definition offered for deliberate user choice—such as a starter habit template, journal template, prompt, challenge definition, visual particle seed, or curated static copy. It is not history until the user explicitly selects or creates it.

**Production reachability** means a local module or asset is traversable from a configured shipped entry through a static import, runtime re-export, literal dynamic import, alias, JSON import, brace-expanded Vite glob, literal `new URL(..., import.meta.url)`, or worker URL. Staged mode materializes the Git index so an unstaged replacement cannot hide staged content. A test/dev path loses its safe classification when a production entry reaches it, and a path under a shipped public/native root is production even when a nested directory is named `fixtures` or `test`.

Genuinely type-only imports and re-exports do not create runtime edges. A mixed import/export that contains any runtime value remains a production edge; the presence of one `type` specifier does not exempt it.

**Dangerous sink** means a surface that persists, synchronizes, transmits, exports, shares, reports, or presents data as real: Zustand persistence, Dexie, Supabase, queues, backups, analytics, Sentry evidence, exports, share payloads, API results, readiness packets, and shipped bundles.

## Allowed test doubles

The following are allowed when they stay inside explicit test/dev boundaries and are not imported by production:

- `vi.mock()`, `vi.fn()`, fake timers, mocked Supabase/Capacitor APIs, Playwright fixtures, and unit-test factories;
- fixture JSON under a test/fixture path;
- local-only test migrations under an explicit test path;
- unreachable development previews;
- random visual particle positions and deterministic visual seeds;
- honest empty fallback states that log or surface the failure;
- a production-backend sync smoke only for an authenticated account whose `user_metadata.zenflow_sync_smoke` is exactly `true`, provisioned by the server-only setup tool. The smoke must use synthetic IDs, perform the paired delete, avoid personal account identifiers in logs, and fail before its first write if the marker is absent.

`runProvisionedSmoke` must remain import-safe and behaviorally tested: an authenticated user without the marker performs zero table calls, while a marked user reaches the first `sync_events` write. A static source-order assertion alone is insufficient. This local proof does not claim that the live account, target backend, paired-delete cleanup, or absence of residual rows has been verified.

The dedicated smoke exception proves the production path without authorizing synthetic rows for ordinary users. It remains an operational exception subject to owner review; live account identity, cleanup, and backend target are `UNVERIFIED` until the smoke actually runs.

## Forbidden production synthetic data

Forbidden behavior includes:

- initializing a production store with plausible fake history;
- returning plausible records or zero/healthy facts after an API, storage, or sync error;
- returning generated success receipts, verification responses, or readiness status without authoritative evidence;
- importing a test/fixture/mock/dev module into the shipped graph through direct, alias, barrel, multi-hop, JSON, dynamic, glob, or worker edges;
- writing synthetic records into real user namespaces, IndexedDB, queues, backups, Supabase, sync events, analytics, exports, or share payloads;
- adding user-history seed rows in a production migration;
- shipping the test-fixture canary in `dist/`;
- declaring PASS/ready/completed in release evidence without a command, exit code, timestamp no older than 168 hours, and either the exact current 40-character HEAD or a verified 64-character hash of an existing bounded artifact;
- weakening the checker, rule severity, exact ledgers, tests, hook, package wiring, or CI to make a finding disappear.

## Product content distinction

Curated product definitions are allowed when all of these are true:

1. They describe an option rather than a completed event or existing account fact.
2. They do not contain a fabricated owner, completion timestamp, streak, mood history, journal history, or service result.
3. A user action is required before a selected definition becomes personal data.
4. The resulting personal record receives the real user's identity/time at the normal validated write boundary.
5. Analytics records the user action, not an invented prior action.

Examples in this repository include starter habit definitions and journal templates. `Math.random()` used for a star or particle is visual state, not a user fact. Conversely, an array containing generated IDs, recent timestamps, mood/note values, and completed entries is synthetic history even if named `initialRecords`.

## Demo mode contract

ZenFlow currently ships no product demo-data mode. A future demo mode is allowed only through a separately reviewed product change that proves all of the following:

- explicit user opt-in and a persistent visible demo banner;
- production default off;
- a storage/database namespace that cannot overlap an ordinary account;
- no real-user Supabase tables, cloud sync, offline queue, ordinary analytics, Sentry user evidence, or unmarked exports;
- an explicit demo marker in every export/share artifact;
- safe reset that deletes only the demo namespace;
- fixture data not imported by the ordinary production flow;
- deliberate bundle exposure documented in a new ADR or amendment;
- Web/PWA, Android, iOS, Desktop, offline, export, reset, and accessibility tests.

A hidden tap gesture, a local flag in the normal namespace, or a fixture merely named `demo` does not satisfy this contract.

## Source/sink model

The checker uses layered evidence:

1. **Path classification:** production, test, dev, generated, documentation, and enforcement.
2. **Production graph:** actual frontend/backend roots and runtime dependency forms.
3. **Synthetic source heuristics:** domain-field structure plus fully hardcoded plausible values or generated identity/time. Names are supporting evidence only.
4. **Failure context:** `catch`, Promise rejection, and error/fallback branches.
5. **Sink context:** persistence/sync versus analytics/export/share/release output.
6. **Native/public/text controls:** bounded strict-UTF-8 reads and high-confidence field structure for Java, Swift, Rust, HTML, JSON, and shipped public assets.
7. **SQL classification:** static statement parsing followed by exact user-table `Set` membership; quoted identifiers are included and config never becomes a dynamic regular expression.
8. **Bundle canary:** `ZENFLOW_TEST_FIXTURE_SENTINEL_7F4C9A2E` is defined by the checker/config and injected only into transient adversarial-test or CI artifacts. It must never remain under shipped `dist/**`, including source maps and unknown/text extensions. Every bounded artifact receives a raw-byte sentinel scan; an explicitly requested missing, empty, symlinked, escaped, or text-unreadable bundle is an internal error, not clean.
9. **Governance contracts:** code-owned, order-insensitive semantic digests pin every detector/exclusion/evidence registry and repository contract; code-owned exact package commands pin all four local entrypoints. Canonical roots may grow only through the reviewed additive coverage fields. Core, CLI, config, ledgers, package, CI, hook, tests, policy, review, and waiver invariants are checked together.
10. **Evidence association:** every positive status is evaluated separately. Proof must be on the same claim object or its own direct child named `evidence`, `proof`, `verification`, or `commandEvidence`; neither an ancestor nor any sibling artifact can authenticate the claim implicitly.

Only high-confidence findings block in version 1. Medium-confidence PDI012 findings are warnings requiring classification; the checker never creates a waiver automatically.

## Rule catalog

| Rule | Meaning | Blocking condition |
| --- | --- | --- |
| PDI001 | TEST_ARTIFACT_REACHABLE_FROM_PRODUCTION | Production graph reaches test/fixture/dev-only code |
| PDI002 | SYNTHETIC_USER_HISTORY_IN_PRODUCTION | Reachable code constructs a strongly structured plausible record/history |
| PDI003 | DECEPTIVE_ERROR_FALLBACK | Failure path returns synthetic facts instead of an honest error/empty state |
| PDI004 | SYNTHETIC_DATA_TO_PERSISTENCE_OR_SYNC | Synthetic source reaches Dexie, store persistence, queue, backup, or Supabase |
| PDI005 | STUBBED_PRODUCTION_SUCCESS | Service constructs success/verification facts without authority |
| PDI006 | UNSAFE_PRODUCTION_DEMO_MODE | Demo defaults on or persists outside the complete demo contract |
| PDI007 | SYNTHETIC_DATA_TO_ANALYTICS_EXPORT_OR_SHARE | Synthetic facts enter metrics or leave through export/share/backup |
| PDI008 | PRODUCTION_MIGRATION_SEEDS_USER_DATA | Production SQL inserts/copies rows into user-data tables |
| PDI009 | PRODUCTION_BUNDLE_CONTAINS_TEST_FIXTURE | Built artifact contains the stable fixture sentinel |
| PDI010 | ENFORCEMENT_TAMPERING | Required contract is removed, masked, broadened, or stale |
| PDI011 | FAKE_RELEASE_OR_VERIFICATION_EVIDENCE | Each PASS/ready claim lacks fresh command-bound proof associated with that claim |
| PDI012 | UNCLASSIFIED_SYNTHETIC_SOURCE | Medium-confidence unreachable/unresolved source needs review |

## Baseline policy

`config/production-data-integrity-baseline.json` stores exact entries only. Each entry contains a rule ID, normalized exact path, SHA-256 fingerprint, and a specific reason. The fingerprint binds rule, path, structural AST signature, source/sink class, and a normalized fragment hash; variable-only renames do not change it, while literal content changes and file moves do. PDI010 cannot baseline itself.

- New findings block.
- A resolved finding makes its baseline entry stale; PDI010 blocks until the entry is removed. Diff/staged analysis computes ledger state against the complete snapshot before filtering output, so an unchanged valid baseline is not falsely called stale.
- The ordinary checker never updates the baseline.
- Counts such as `allowedViolations`, directory wildcards, or a mass baseline are invalid configuration.
- A baseline records legacy risk; it is not approval and must not be described as a fix.
- High-confidence deceptive production data should be fixed, not baselined, without a separate human decision.

The canonical baseline is empty at policy activation.

## Waiver policy

`config/production-data-integrity-waivers.json` is an exception ledger, not an escape hatch. Every waiver must contain:

- unique `PDI-WAIVER-*` ID;
- exact rule, path, and fingerprint;
- reason, risk, owner, and real human approver;
- creation and expiry dates;
- tracking issue and removal condition.

Wildcards, directory waivers, expiry beyond 90 days, impossible calendar dates, expired/future dates, weak one-character ownership/approval, `approvedBy: agent/codex/claude/AI`, missing concrete issue identifiers, PDI010 waivers, and waivers created only to green CI are configuration errors (exit 2). Dates are parsed as exact ISO calendar dates, not normalized by the JavaScript date parser. The checker does not generate waivers. If no human approval exists, the finding remains and the release status is STOP/`UNVERIFIED`.

The canonical waiver ledger is empty at policy activation.

## Hook behavior

`.codex/hooks/production-data-integrity-gate.cjs` is intentionally separate from `no-ai-template-gate.cjs`.

- `UserPromptSubmit` injects a short contract only for relevant work.
- `PreToolUse` denies obvious protected-surface weakening, broad baseline/waiver changes, workflow skips, and error masking.
- `PostToolUse` runs the fast diff checker after relevant edits.
- `Stop` runs a final diff check, blocks findings/internal errors, and honors `stop_hook_active` to avoid a continuation loop.
- `SubagentStart` injects the evidence packet; `SubagentStop` rejects success claims without findings, source evidence, platform impact, verification/skips, remaining risk, and GO/STOP/ASK.

The hook resolves the repository with `git rev-parse --show-toplevel`, even when the session cwd is a subdirectory. It reads one JSON object from stdin, emits JSON-only stdout on success, sends diagnostics to stderr, uses a 15-second checker timeout, stores no user data/secrets, and fails closed on malformed input. OpenAI documents `PreToolUse` interception as incomplete, so the hook is early feedback—not the sole boundary. A changed hook hash may require Codex trust/review again; that trust state is `UNVERIFIED` until observed.

## CI behavior

The dedicated workflow `.github/workflows/production-data-integrity.yml` has one job/check name: `production-data-integrity`. It runs on pull requests and pushes to `main`, `merge_group`, and manual dispatch. It has `contents: read`, no secrets, no `pull_request_target`, path filter, job condition, `continue-on-error`, or `|| true`; actions follow the repository's full-SHA convention.

The job installs dependencies and runs the adversarial checker/hook/workflow contracts. It then injects a structured synthetic-history canary under `public/`, invokes the CLI directly (not through the package alias), and requires exit 1, JSON status `FAIL`, exact PDI002, and the exact canary path before cleanup. After the clean source scan and production build, it injects the stable sentinel in a `.txt` artifact under `dist/` and requires the same exit/status/path binding with exact PDI009 before cleanup and the final clean bundle scan. The same clean source and bundle commands are present in Web, production preview/overwrite, Android, iOS, and Desktop build lifecycles. Local commands are:

```text
npm run check:production-data-integrity
npm run check:production-data-integrity:diff
npm run check:production-data-integrity:staged
npm run check:production-data-integrity:bundle
```

Exit codes are 0 clean, 1 findings, and 2 configuration/internal error. Exit 2 is never clean. Branch protection and the required remote status must be configured for the exact name `production-data-integrity`; those remote settings are `UNVERIFIED` in a local implementation.

Config, baseline, waivers, production source, and evidence use bounded strict UTF-8 decoding; every existing control, import, evidence, and bundle target is checked by realpath against the repository root. Ancestor or direct symlink escapes, malformed AST/JSON, impossible waiver dates, changed code-owned config semantics, missing canonical roots/sentinels/contracts, empty or text-unreadable explicit bundles, and index snapshot failures are exit 2. Noncanonical package commands are blocking PDI010 findings and exit 1; malformed package JSON or schema remains exit 2. `--staged` reads the staged snapshot, while an explicit `--bundle <path>` requires a nonempty in-repository directory with at least one bounded readable text artifact.

## Separation of duties

Repository-local enforcement cannot be tamper-proof when the same writer can change the application and verifier. Local controls increase review cost and make bypasses visible; they do not replace independent approval.

Future hardening, requiring separate authorization, includes:

- organization ruleset and required CODEOWNER review;
- required status `production-data-integrity` with no bypass actor;
- external verifier repository or SHA-pinned reusable workflow controlled by another owner;
- GitHub App status with independent credentials;
- signed provenance and policy for baseline/waiver changes.

No remote rule, CODEOWNER approval, or required-check status is claimed as PASS without querying GitHub.

## Incident response

If synthetic data or fake evidence reaches production:

1. Stop the affected release/sync/export path and preserve logs without copying private journal or tokens.
2. Record the exact source, sink, platform, account scope, artifact hash, and first known version.
3. Do not bulk-delete or rewrite user data automatically. Quarantine and owner-review affected records first.
4. Revoke a compromised waiver/credential and disable only the affected feature or job.
5. Add a RED regression fixture reproducing the path before remediation.
6. Remove contaminated data through an owner-approved, scoped migration with backup and rollback.
7. Rebuild, rerun source/bundle checks, verify affected platforms, and document remaining `UNVERIFIED` state.
8. Tighten the source/sink registry or graph model without broad keyword bans.

## Rollback

The implementation rolls back through a normal revert of checker, config, hook, CI, docs, and product remediations. Do not roll back only tests or CI while leaving an apparent policy. Do not restore the removed hidden demo toggle without the complete demo contract and a new decision record.

If the checker itself causes an emergency release block, preserve exit 2/fail-closed behavior, revert the entire untrusted change, and use a time-limited human waiver only when its exact contract can be satisfied. Never add `|| true` or raise a baseline automatically.

## Review checklist

- [ ] Production graph roots and new dynamic/glob/worker forms are represented.
- [ ] Code-owned semantic digests and exact package commands reject both removals and broadening mutations; additive production coverage still passes.
- [ ] Public/native/source-map/evidence roots and staged index behavior are covered by adversarial tests.
- [ ] Test doubles remain isolated; production imports no test/dev/fixture path.
- [ ] Product content is opt-in definition, not fabricated history.
- [ ] Failure paths return an honest unavailable/error/empty state.
- [ ] No synthetic source reaches persistence, sync, analytics, export, backup, or share.
- [ ] Any production smoke write proves the dedicated `zenflow_sync_smoke` marker before writing.
- [ ] Production migrations seed no user-data table.
- [ ] Demo-mode contract is either fully satisfied or no demo mode ships.
- [ ] Baseline did not grow without explicit human decision; no stale entry remains.
- [ ] Every waiver is exact, current, tracked, and human-approved.
- [ ] Checker, hook, workflow, and adversarial tests ran with fresh output.
- [ ] Direct-CLI source and bundle runtime canaries failed with exit 1, status FAIL, exact rule, and exact path; cleanup and final clean scans passed.
- [ ] Evidence packets include command, exit code, fresh timestamp, and current-HEAD or verified existing-artifact binding.
- [ ] Every positive evidence claim is bound to its own object or own named proof child; ancestor and sibling proofs do not satisfy it implicitly.
- [ ] Remote branch protection/required status is PASS only if directly verified; otherwise `UNVERIFIED`.

## Known limitations

- Nonliteral computed imports, runtime-generated code, reflection, encoded/encrypted payloads, and deliberate obfuscation are not soundly modeled.
- Data flow is targeted and mostly intra-file; complex interprocedural aliases may produce false negatives.
- Vite-specific literal/brace globs, literal `new URL` assets, and workers are modeled, but computed patterns and future plugin-generated entrypoints require config/test updates.
- Rust, Java, Swift, HTML, and SQL receive path/lexical controls rather than a full language semantic model.
- Generated evidence scanning is intentionally bounded to tracked release roots, top-level output JSON, one-directory-deep readiness filenames, `output/release/**`, and `artifacts/**`; deeper noncanonical output packets require a new reviewed glob/test and otherwise remain `UNVERIFIED`.
- Raw-byte bundle canaries detect the known fixture sentinel in bounded artifacts, not every unknown/minified/compressed synthetic value.
- Code-owned semantic pins and runtime canaries raise the cost of accidental or single-layer weakening, but one authorized actor can still change every same-repository trust layer together.
- Client provenance and user metadata are forgeable from a compromised client; authoritative public metrics require a server trust boundary.
- Equal record counts do not prove equal content. The repaired sync-integrity check now distinguishes unavailable reads from verified counts, but privacy-safe structural digests remain future work.
- Live Supabase state, external SDK behavior, native signed/store artifacts, public deployment, branch protection, hook trust, and human approval identity are outside local proof.
- Human intent cannot be inferred deterministically; PDI012 remains a review warning.

## Source evidence

Checked 2026-07-09:

- [OpenAI Codex hooks](https://developers.openai.com/codex/hooks) — supported lifecycle events, stdin/stdout contracts, apply-patch aliases, recursion guard, and incomplete `PreToolUse` boundary.
- [OpenAI AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md) — repository instruction hierarchy.
- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API) — AST/program/module-resolution foundation.
- [GitHub secure use of Actions](https://docs.github.com/en/actions/reference/security/secure-use) — least privilege and immutable action references.
- [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) — unique required-check names and skipped-result caveats.
- [GitHub `merge_group` event](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#merge_group) — merge-queue required-check reporting.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) and [OWASP MASVS](https://mas.owasp.org/MASVS/) — web/mobile control verification categories.
- [OWASP AI Agent Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html) and [Prompt Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html) — least privilege, deterministic validation, and untrusted agent/tool output.
- [SLSA threat model](https://slsa.dev/spec/v1.2/threats-overview) — source/build integrity and separation-of-duties limits.
