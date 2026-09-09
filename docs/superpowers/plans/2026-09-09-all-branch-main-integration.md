# All-branch main integration

**Owner request:** On 2026-09-09, commit and push all outstanding work from every current branch into main, including other authors.

**Execution:** Use the existing locked `codex/android-103ms-20260904` lane and execute this plan inline. Preserve the original old/control working copies. Starting lane/main: `939daa7e117331ef75201cff3a2c74d314861be2`.

## Accepted boundary

Preserve all 91 inventoried working paths and the old main copy's `check:circular` tsconfig argument. Control-clone hooks are byte-identical to the lane. Preserve original commits with normal merges. Do not force, delete refs/worktrees, rewrite history, use a shared stash, bypass hooks, introduce waivers, publish ignored/private evidence or modify user data. Existing Android 103 ms failure remains open; Git publication is not universal runtime acceptance.

## 1. Preserve local inputs

- [x] Fetch origin and inventory working copies/current refs; retain exact path/size/SHA-256 manifest in ignored output.
- [x] Fresh full baseline: 867 files, 10,334 passing cases, zero failures, 23 skipped and seven unfinished cases.
- [x] Separate typecheck passes. Source-diff integrity has zero errors/warnings. All 91 safe scan-copy hashes match; Gitleaks and TruffleHog have zero findings.
- [x] Reproduce the additional circular-check argument: twelve dependency cycles, versus the original command missing alias edges.
- [x] Carry that argument and resolve only the demonstrated import cycles with characterization evidence; keep the checker strict.
- [x] Finish the preservation batch source/index review, fresh gates and Snyk triage; write truthful commit receipts.
- [x] Commit the exact reviewed local batch and preserve both original working copies. Commit `538ff957` contains the 91 original paths plus this plan.

Snyk CLI reported a medium traversal at the journey runner's `FileHandle.writeFile` data argument and a final 403 metadata failure. Focused real-filesystem journey tests pass 15/15. Check the actual sink semantics; do not suppress or claim complete scanner PASS.

The sink was verified as serialized data written through an already-open exclusive file handle, not a pathname. No suppression was added. The original clone had no configured Husky driver; the actual pre-commit checks were exercised manually. The subsequent normal npm install configured Husky, so the compatibility commit uses the installed hook path.

## 2. Integrate current remote branches

| PR | Original head | Intent |
| --- | --- | --- |
| #97 | `9c0257f36c45386a9686652564c8ee23cef5bbfd` | chore(deps): bump actions/setup-java from 5.4.0 to 6.0.0 |
| #98 | `2dd4ac90288f9dd046a43bfa4d56bc7b7a405f1f` | chore(deps): bump actions/cache from 5.1.0 to 6.1.0 |
| #99 | `83b103abb6923233b32db964bb4a80d6c3b22e8a` | chore(deps): bump actions/setup-node from 6.4.0 to 7.0.0 |
| #100 | `068b2f1202233e81c0115621eb70becb15d9c066` | chore(deps): bump actions/checkout from 6.0.3 to 7.0.1 |
| #101 | `b5d45135dc89668d49b70085a2d5498a2e9b089c` | chore(deps): bump react and @types/react |
| #102 | `ca76e12f1cc373c68ac72c442f9c2460873495dd` | chore(deps): bump actions/deploy-pages from 5.0.0 to 5.0.1 |
| #103 | `75fdcfab19e85d175b82e674b10fd031e66e7dd9` | chore(deps-dev): bump @playwright/test from 1.59.1 to 1.62.1 |
| #104 | `3dd67ea37e7800150a772fd2d1b1a7637ad53548` | chore(deps-dev): bump @tauri-apps/cli from 2.11.3 to 2.11.4 |
| #105 | `09a49d789a7336de2ec8a9fec6c34fbeac3467f7` | chore(deps): bump @radix-ui/react-progress from 1.1.8 to 1.1.16 |
| #106 | `b4e09b6cecbe918aa19877e20ce8b7846ee508d5` | chore(deps): bump @radix-ui/react-context-menu from 2.2.16 to 2.3.7 |
| #107 | `5c00f9ff4ac7ed0f8598b891fa78a846ffe1bc53` | chore(deps): bump @capacitor/core from 8.3.3 to 8.5.1 |
| #108 | `613f76f2d28f0e35f3344a7bdf814e0912d4bb31` | chore(deps-dev): bump @csstools/postcss-oklab-function from 3.0.19 to 5.0.10 |
| #109 | `49390ec685a88e54ab0fdd70ede45e4fbc088669` | chore(deps): bump @radix-ui/react-slot from 1.2.4 to 1.3.3 |
| #110 | `f6020d5a1a7ce4bf7291b861bf347d85318433db` | chore(deps): bump @capacitor/app from 8.1.0 to 8.1.1 |
| #111 | `ee9de7ba1c27184c8e53ed540a34b018909b6aca` | chore(deps-dev): bump @size-limit/file from 12.1.0 to 13.0.3 |

- [x] Inspect original diffs and normally merge each head; preserve every original head as an ancestor.
- [x] Reconcile dependency peers/lockfile without force or legacy-peer bypass.
- [x] Reproduce and minimally fix React-family, size-limit-family and Playwright assertion incompatibilities.
- [x] Reinstall, audit, test, typecheck, lint and build the combined graph; check source/bundle integrity and native package compatibility. Full preflight: 10,339 passing cases, zero failures; five native patch applications; actual native CI remains a separate gate below.

The existing Japanese-audio branch and malformed legacy recovery-ref target are already ancestors of main. Preserve the original ref metadata and quarantined historical audio; they are not new publication inputs.

All fifteen heads are preserved under published integration head `d9a71d80`. [PR #112](https://github.com/Yehor212/people-first-app/pull/112) was deliberately opened as a draft when React 19 and the newly effective import check reproduced failures. The owner approved the required repair at 13:08 UTC on 2026-09-09; [feature 005](../../../specs/005-main-integration-compatibility/verification.md) records that separate test-first implementation and current evidence. The original Android performance feature remains open.

## 3. Publish protected main

Pre-publication follow-up snapshot, 16:45 UTC: the separately approved cold Diary delivery repair is complete locally. The final full preflight passed 10363 tests with zero failures; final-built PWA/WebKit and visual/Settings/resize checks passed. The original fifteen heads remain ancestors, all 90 non-package original paths match preservation commit 538ff957, the extra circular argument is retained and both source working copies are untouched. This snapshot does not pre-claim the next commit, current-head CI or merge; their receipts belong to PR #112 and the final local evidence.

- [x] Inspect final diff/status, security, exact 80-path staged manifest and fresh receipts; staged integrity has zero errors/warnings.
- [ ] Commit with installed hooks and push only the matching codex branch.
- [ ] Obtain exact-tip workspace handoff; update existing PR #112 with truthful checks, change notice and platform matrix.
- [ ] Pass fresh strict required checks: build, android-gate, ios-gate and production-data-integrity.
- [ ] Normal merge, no squash replacement and no branch deletion.
- [ ] Fetch and prove all input heads and the local batch are ancestors of main; prove both additional working-copy deltas are represented.

Rollback is a scoped ordinary revert PR, not reset or removal of source working copies.

## Platform matrix

| Target | Impact and proof boundary |
| --- | --- |
| Web/Vite | Shared React/UI/package updates and Pages workflow; combined local tests/build and fresh CI required. Public runtime is UNVERIFIED until actually exercised. |
| Installed PWA | Shared bundle; source/build checks do not prove installed-worker behavior, which remains UNVERIFIED. |
| Android/Capacitor | Existing native/IME/navigation patches and incoming packages; native build/CI required. Prior device receipts stay tied to their original APK; 103 ms remains FAIL. |
| iOS/WKWebView | Shared UI and package graph; fresh iOS CI required, actual device behavior UNVERIFIED. |
| Desktop/Tauri | Shared UI and Tauri CLI; package/build checks required, packaged desktop runtime UNVERIFIED. |

No store upload, production data write, new product scope, app data reset, unrelated app termination or universal readiness claim is authorized here.
