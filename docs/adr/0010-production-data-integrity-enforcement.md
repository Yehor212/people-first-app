# ADR-0010: Production Data Integrity Enforcement

- **Status:** Proposed — implementation complete only after local verification and owner review
- **Date:** 2026-07-09
- **Decision owner:** ZenFlow repository owner; implementation prepared by Codex
- **Tags:** data-integrity, static-analysis, release, ci, hooks, security, sync

## Context

ZenFlow is local-first: Dexie/IndexedDB is durable local truth, Zustand mirrors it, and Supabase sync can propagate records between devices. The same Vite artifact ships to Web/PWA, Android, iOS, and Tauri Desktop. Edge Functions, migrations, release scripts, analytics, export/share flows, and readiness packets add separate routes by which synthetic data or fake evidence can become trusted.

Before this decision the repository had no production-data integrity gate. It did have legitimate mocks and test factories, so a keyword ban would be both noisy and unsafe. Current-session investigation also found three concrete issues:

- `src/lib/demoData.ts` contained plausible dated habits, moods, focus sessions, gratitude, and profile facts. It was not in the production graph, but the shipped settings graph imported `useDemoMode` and could persist `zenflow-demo-mode` after a hidden five-tap gesture without any product demo isolation contract.
- `src/lib/syncIntegrity.ts` converted local or Supabase count errors into five zero counts, then could log `Data consistent`.
- `scripts/smoke-sync-account.cjs` wrote synthetic sync events after any configured account signed in, even though the provisioning tool already marks the dedicated account with `user_metadata.zenflow_sync_smoke: true`.

The task requires a deterministic, offline-capable repository gate that allows isolated doubles, blocks high-confidence production paths, creates explainable findings, and does not claim absolute soundness or remote enforcement.

## Decision

Adopt a combined system with these layers:

1. A Node checker using the directly installed TypeScript compiler API.
2. Explicit path classification for production, test, dev, generated, documentation, and enforcement surfaces.
3. Production reachability from actual frontend, PWA, Capacitor/Tauri, Supabase, public-script, and production-tool entries.
4. Runtime edge modeling for static imports, re-exports, type-only exclusions, literal dynamic imports, aliases, JSON, brace-expanded `import.meta.glob`, literal `new URL(..., import.meta.url)` assets, and workers.
5. High-confidence, domain-structure-aware source detection plus targeted persistence/sync/analytics/export/share/failure sinks.
6. Static SQL target parsing with exact user-table membership, masking only unexecuted dollar-quoted bodies in `CREATE FUNCTION`/`CREATE PROCEDURE`; executable top-level statements and `DO` blocks remain visible. Java, Swift, Rust, HTML, public JSON, and generated evidence use bounded lexical controls.
7. A bounded raw-byte `dist/` canary scan across every artifact, including source maps and `.txt`; an explicit missing, empty, escaped/symlinked, or text-unreadable bundle is an error.
8. Exact content-sensitive fingerprint baseline and exact, maximum-90-day, human-approved waiver validation; PDI010 is never suppressible.
9. Per-claim release-evidence binding: proof must be on the claim object or its own direct explicitly named proof child; ancestors and sibling objects cannot launder readiness implicitly.
10. A separate Codex hook for early feedback; it is not merged with the no-AI-template gate.
11. Code-owned, order-insensitive semantic digests for all mutable detector/exclusion/evidence contracts, plus exact code-owned package commands; only reviewed production roots may grow monotonically.
12. A unique, least-privilege CI job/check named `production-data-integrity` that runs the adversarial contracts and direct-CLI source/bundle failure canaries before clean scans, plus checks in each production-capable build lifecycle.

Only high-confidence findings block. Medium-confidence PDI012 findings warn and require classification. Config/internal failures exit 2 and never become clean.

The hidden demo toggle and orphan synthetic dataset are removed rather than baselined. Sync-integrity read failures return an explicit unavailable result rather than fabricated zeros. Live sync smoke writes require the existing dedicated-account marker before the first write and stop logging an account ID prefix.

## Production entrypoints and local boundaries

| Surface | Evidence | Treatment |
| --- | --- | --- |
| Web | `index.html` loads `src/runtime-perf-bootstrap.js` and `src/main.tsx` | AST graph roots |
| PWA | Vite InjectManifest builds `src/sw.ts` | independent graph root |
| Vite build/chunks | `vite.config.ts`, 159 runtime re-exports, literal dynamic imports, two `import.meta.glob` sites, literal `new URL` assets, and two orb workers observed | build root plus explicit literal/brace edge handlers |
| Dev preview | `Index.tsx` imports preview only behind `import.meta.env.DEV` | guarded edge excluded; direct production reach blocks |
| Nonliteral import | `src/lib/adController.ts` has one audited `@vite-ignore` module-name import | exact path audit; new unresolved forms warn |
| Capacitor/Tauri | both package `dist/`; Android Java, App/CapApp-SPM Swift, `src-tauri/src/**`, and `src-tauri/build.rs` remain outside TS semantics | shared raw-byte bundle scan plus bounded native lexical/field-structure controls |
| Supabase | ten function `index.ts` roots and migrations | forced production paths; TS/SQL rules |
| Public scripts/data | `public/**`, including HTML and shipped JSON | forced production paths; bounded field structure, no full HTML data-flow claim |
| Generated evidence | `docs/release/**/*.json`, top-level `output/*.json`, direct-child `output/*/*readiness*.json`, bounded `output/release/**/*.json`, `artifacts/**/*.json` | per-claim fresh command plus current HEAD or verified artifact hash; private/security-tool/test subtrees excluded exactly |
| Staged tree | Git index can differ from the worktree | isolated `checkout-index` snapshot; unstaged replacement cannot hide staged data |
| Live sync smoke | release-invoked script writes an upsert/delete pair | exported boundary is behavior-tested with a mocked write-capable client: absent marker performs zero table calls; marked account reaches the first `sync_events` write |

## Considered Alternatives

| Option | Precision / recall | Cross-file & TS | Dynamic/Vite | Performance / CI | Dependency / portability | Bypass resistance / UX | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A. Regex scanner | Low precision; easy rename/format bypass | No graph or syntax | Poor | Fast, portable | None | Noisy and easy to weaken | Rejected as primary; retained only for narrow SQL/artifact markers |
| B. ESLint custom rule | Good per-node precision | File-oriented; shared state is awkward | Limited to parsed files | Good incremental UX | Existing ESLint stack | Does not naturally cover SQL, bundle, baseline, staged mode | Rejected as primary; possible future editor feedback |
| C. TypeScript AST only | Strong syntax precision | Strong TS/TSX, weak entry context | Literal dynamic imports only by default | Under target on this repo | Installed TypeScript, Windows/Linux | Would flag unreachable fixtures or miss shipped classification | Insufficient alone |
| D. AST + production graph | High precision for explicit edges | Re-exports/aliases/JSON across files | Custom glob/worker/dev-guard handlers | Full scan target under 30s; diff under 5s | No new dependency | Explainable trace and deterministic findings | Selected core |
| E. Semgrep taint | Strong declarative patterns | Community engine is primarily intraprocedural; interfile features/availability vary | Custom modeling needed | Additional install/memory and CI variability | External tool/dependency | Useful audit, not guaranteed local gate | Optional security evidence, not mandatory boundary |
| F. Bundle scan | High precision for known sentinel | No source cause | Sees final artifact | Fast bounded text scan | No dependency | Minification/unknown fixtures evade it | Selected defense-in-depth only |
| G. Combined system | Best practical recall with layered precision | Covers repository and artifact contracts | Explicit supported edge set | More maintenance and CI time | Uses installed runtime | Harder to bypass silently; clear remediation | Selected |

Vite `write:false`, esbuild metafiles, Madge, and Knip were considered as corroboration. Current-session probes showed that no single one modeled all Vite dev guards, globs, and workers correctly: Madge included the dev preview, while esbuild missed Vite globs/workers. They are not the canonical graph.

## Source Evidence

Official sources checked 2026-07-09:

- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API) documents `Program`, `SourceFile`, AST traversal, and module-resolution building blocks.
- [ESLint custom rules](https://eslint.org/docs/latest/extend/custom-rules) support syntax visitors/code paths but do not provide this repository-wide production graph by themselves.
- [Semgrep taint analysis](https://semgrep.dev/docs/writing-rules/data-flow/taint-mode/overview) models sources/sinks/sanitizers; [Semgrep data-flow overview](https://semgrep.dev/docs/writing-rules/data-flow/data-flow-overview) documents intraprocedural defaults and soundness limitations.
- [OpenAI Codex hooks](https://developers.openai.com/codex/hooks) defines current events, JSON stdin/stdout, `apply_patch` aliases, `stop_hook_active`, and the incomplete `PreToolUse` boundary.
- [OpenAI AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md) defines instruction discovery and hierarchy.
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use) supports least privilege and immutable action references.
- [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) warns that job names should be unique and skipped/neutral results can satisfy required-check semantics.
- [GitHub `merge_group`](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#merge_group) is needed for required checks under merge queue.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/), [OWASP MASVS](https://mas.owasp.org/MASVS/), [OWASP AI Agent Security](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html), and [Prompt Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html) support deterministic validation, least privilege, and distrust of agent/tool output.
- [SLSA threat model](https://slsa.dev/spec/v1.2/threats-overview) covers source/build integrity and separation-of-duties limits.

The OpenAI manual helper was attempted first but returned no required content hash; no OpenAI documentation MCP was available. Official OpenAI web documentation was therefore the fallback. That helper path is not counted as PASS.

## Local Evidence

- Canonical remote: `https://github.com/Yehor212/people-first-app.git`; investigation started at commit `292e7ea41d79703cbd81bd1e7447c113210e6bea`.
- Installed Node is 22.22.0; installed TypeScript is 5.9.3 (`package.json` range `^5.8.3`).
- The then-current doc-count and agent-context checks passed before the original edits; that historical result is not current verification evidence.
- `npm run constitution:check` already failed before edits: source 888 vs 880, tests 422 vs 398, `index.css` 17,932 vs 17,698, and 17 vs 14 oversized components. After the scoped removals and an explicit freshness update, final `doc-counts` and `constitution:check` pass at 886 source files, 422 test files, 17,932 CSS lines, 319 inline styles, 48/76 hook coverage, and 17 recorded oversized components. This refresh records existing debt; it does not claim that the CSS or component debt was fixed.
- A read-only GitHub API check on 2026-07-09 returned `Branch not protected` for `main` (HTTP 404). The local workflow is implemented, but remote required-status enforcement is currently FAIL/not configured and cannot be claimed from this branch.
- No production source imported `DEMO_DATA`; `useDemoMode` was nevertheless shipped through both settings surfaces.
- The current workflow convention uses full-SHA action references and top-level permissions.
- The repository already provisions a smoke account with `user_metadata.zenflow_sync_smoke: true`; the runtime smoke script did not previously enforce it.

## Rule and scenario strategy

| Scenario | Expected | Detection method | Confidence | Test |
| --- | --- | --- | --- | --- |
| `vi.mock`, fake timers, mocked Supabase in test | Allow | path classification | High | allowed fixture group |
| Unreachable dev preview | Allow | production roots + DEV guard | High | allowed fixture group |
| Starter habit/journal template | Allow | no completed-history/time structure | High | product-content fixture |
| Random visual particles | Allow | no domain/source/sink structure | High | visual fixture |
| Test fixture through barrel/alias/two hops | Block PDI001 | graph trace | High | checker adversarial suite |
| Neutral variable with generated or fully hardcoded ID/time and mood/note | Block PDI002 | AST/domain structure | High | rename/content-stability test |
| Catch/Promise.catch returns plausible history | Block PDI003 | failure ancestor + source | High | catch and Promise tests |
| Synthetic record to Dexie/Supabase | Block PDI004 | local source/sink propagation | High | spread/helper/sink tests |
| Generated verification receipt | Block PDI005 | success/fact/time structure | High | service result test |
| Production-default or real-namespace demo flag | Block PDI006 | control/default/storage context | High | demo test + repository remediation |
| Synthetic analytics/export/share | Block PDI007 | external-output sink | High | analytics test |
| Production user-table SQL seed | Block PDI008 | table-aware SQL write | High | migration test |
| Direct public source canary | Require exit 1, FAIL, exact PDI002/path, cleanup, then clean scan | runtime detector proof | High | workflow contract + CI |
| Raw sentinel in any bounded `dist` artifact | Block PDI009 | raw-byte artifact search | High | bundle and CI-canary tests |
| Semantic config/package/CLI/workflow weakening | Exit 2 or block PDI010 according to malformed-state versus finding semantics | code-owned digests, exact commands, pinned contracts, direct probes | High | semantic/bootstrap/workflow tests |
| PASS/ready JSON without associated fresh current-HEAD or verified artifact proof | Block PDI011 | per-claim scope and hash binding; unrelated sibling proof rejected | High | readiness/laundering tests |
| Unreachable strong synthetic source/unresolved edge | Warn PDI012 | AST/graph uncertainty | Medium | classification test |

## False-positive strategy

- Never block on a variable, file, or string name alone.
- Require domain structure, hardcoded plausible value, generated identity/time, failure context, reachability, or a dangerous sink.
- Exclude genuinely type-only imports and re-exports plus positive `import.meta.env.DEV` branches; mixed runtime/type imports or exports and negated DEV branches remain runtime edges.
- Treat explicit persisted demo values `false`, `0`, or `off` as disabled; only high-confidence enabling values trigger PDI006.
- Model product definitions separately from completed history.
- Keep uncertain PDI012 cases nonblocking until reviewed and covered by a regression test.
- Use exact operational SQL table treatment instead of excluding all migrations. Routine definitions are not migration-time writes, while top-level DML and `DO` blocks remain blocking and are protected by negative controls.
- Do not create automatic fixes, baselines, or waivers.

## False-negative strategy

- Combine source graph, targeted flow, SQL, bundle, and governance controls.
- Warn on unresolved local or nonliteral dynamic edges unless an exact path is audited.
- Test aliases, re-exports, JSON, Vite brace globs, literal `new URL` assets, workers, BOM, CRLF, strict UTF-8, parser errors, realpath/ancestor-symlink containment, staged/worktree divergence, nested native/public/SQL, source maps and unknown bundle extensions, spreads, shorthand constants, helpers, Promise rejection, identifier renames, invalid calendar dates, and literal changes.
- Treat internal/config/parser errors as exit 2.
- Scan every production-capable build lifecycle, not only the local preflight command.
- Execute direct-CLI negative canaries in the dedicated workflow so a no-op package alias or disabled detector cannot satisfy CI.
- Keep ignored/generated output traversal bounded; new deeper evidence layouts require an explicit reviewed glob and regression test.
- Record limitations explicitly and require human review for sensitive changes.

## Security boundaries

- Scanned code is read as bounded text and parsed; it is never executed or evaluated.
- Config/ledger/source/import/evidence/bundle paths are bounded, strict UTF-8 where textual, and realpath-confined to the repository root; direct and ancestor symlink escapes plus parse diagnostics fail closed.
- Code-owned semantic digests pin detector registries, exclusions, evidence semantics, limits, aliases, and repository contracts; exact code-owned package commands reject no-op substitutions. Canonical production roots allow reviewed additive coverage but cannot be removed or redirected.
- Git uses `execFileSync` argument arrays, not concatenated shell input.
- Finding evidence reports structural fields, path, rule, and sink—not journal contents, credentials, or raw environment values.
- The CI job has `contents: read`, no secrets, no privileged PR event, no path filter, and no ignored failure.
- The CI job binds each injected canary to process exit 1, structured FAIL, exact rule, and exact path, removes it in `finally`, then requires a clean direct scan.
- The production smoke-account marker is checked before the first write.
- Hook output and subagent summaries are not authorization or proof.

## Tradeoffs

**Benefits:** deterministic local/CI behavior; no new parser dependency; explainable reachability; low application risk because tooling is not imported by runtime; source and final-artifact runtime canaries; exact governance ratchet.

**Costs:** checker and Vite-edge maintenance; targeted data flow is not whole-program taint; full build runs in the dedicated job; CI/build workflows gain repeated calls; exact baseline/waiver management requires review.

**Developer experience:** test mocks remain allowed, while findings name rule/path/line/sink/remediation. Diff/staged modes provide fast feedback; full and bundle modes remain release checks.

## Rollout

1. Land tests, checker, empty exact ledgers, policy, and ADR together.
2. Remove/fix current high-confidence risks rather than baseline them.
3. Register the hook and expect a trust/review prompt after its hash changes.
4. Run focused tests and all/diff/staged locally.
5. Run the direct-CLI source canary, build, run the direct-CLI bundle canary, confirm both exact failures and cleanup, then run clean scans.
6. Enable the dedicated GitHub workflow.
7. After the workflow is published, protect `main` and require the exact status `production-data-integrity` plus CODEOWNER review. The 2026-07-09 API check found no branch protection, so this rollout step remains incomplete.

## Rollback

Rollback is one normal revert of the whole decision implementation. Partial rollback that removes CI/tests while retaining a policy is forbidden by PDI010. The hidden demo mode must not be restored without the complete policy contract and a new/superseding ADR. A checker emergency is handled by reverting the faulty change, not `continue-on-error`, `|| true`, or an automatic baseline increase.

## Residual risks

- Computed imports, runtime code generation, reflection, encoded/encrypted data, and deliberate obfuscation can evade this checker.
- Targeted data flow is mostly intra-file; arbitrary interprocedural taint is not claimed.
- Rust/Java/Swift/HTML/SQL controls are not full semantic analyzers.
- A known canary cannot detect every unknown minified fixture.
- Same-repository app/verifier changes have no true separation of duties.
- Code-owned pins and runtime canaries stop ordinary mutation/no-op bypasses but do not stop one authorized actor from changing every local layer together.
- Deeper noncanonical `output/**` evidence outside the explicit readiness/release patterns is not traversed and remains `UNVERIFIED` until added deliberately.
- Client metadata/provenance can be forged by a compromised client; authoritative public metrics need a server boundary.
- Equal counts do not prove equal content; privacy-safe structural digests remain future work.
- Live Supabase state, production credentials/account identity, signed native/store artifacts, public deployment, remote rulesets, hook trust, and human approvals remain `UNVERIFIED` unless freshly checked.
- Human intent remains outside deterministic proof.

## Rejected shortcuts

- One regex or filename/variable keyword scanner.
- Blocking all mocks, templates, random values, or `src/**` literals.
- An LLM classifier in mandatory CI.
- Semgrep-only or bundle-only enforcement.
- Treating hooks as the security boundary.
- Broad counts, wildcards, permanent waivers, agent approvals, or automatic ledger updates.
- `continue-on-error`, `|| true`, path-filtered required jobs, job-level skip conditions, duplicate required names, or `pull_request_target` for untrusted code.
- Fake PASS/readiness packets or old CI as current evidence.
- Automatic deletion or rewriting of suspected user data.

## Future hardening

- External verifier repository or SHA-pinned reusable workflow under a separate owner.
- Organization ruleset, required CODEOWNER approval, and GitHub App status.
- Signed build provenance and independently controlled baseline/waiver approvals.
- Privacy-preserving entity-ID/version digests for sync consistency.
- Optional Semgrep/security audit as defense-in-depth after tool availability is verified.

## Consequences

The repository gains a concrete, reviewable boundary against synthetic production facts without banning legitimate testing or product templates. Releases become more expensive but more honest. Local PASS proves only the local checker/tests/build that actually ran; it does not imply remote required-check configuration, public deployment, native device behavior, or live backend truth.
