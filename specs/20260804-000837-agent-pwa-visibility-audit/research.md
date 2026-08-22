# Research: Agent and PWA Visibility Audit

## Decision 1 — Treat worktree identity as the file-visibility source of truth

**Decision**: Determine whether a file should be visible from the absolute VS Code root and the linked worktree's current Git state, not from a graph badge, an agent status message, or a branch name.

**Evidence**:

- The legacy checkout and clean control checkout both point to `main` at `13ca51a80d23220574deba762851fe5a32372e46`.
- The agent-doctor worktree is `/Users/yehor/Projects/ZenFlow/worktrees/codex-agent-doctor` on `codex/agent-doctor` and has modified/untracked doctor files.
- Its generated `/Users/yehor/Projects/ZenFlow/worktrees/codex-agent-doctor.code-workspace` declares exactly that one folder.

**Rationale**: Git worktrees intentionally have separate working trees. VS Code's Explorer and Source Control show the root that is open, not other linked worktrees.

**Alternatives considered**:

- Open a multi-root workspace containing writable lanes — rejected by the workspace protocol because it makes Source Control ambiguous and risks editing the wrong lane.
- Copy agent files into the legacy checkout — rejected because it destroys the branch/commit provenance that makes a safe handoff possible.

## Decision 2 — Treat the pending-898 count and the merged scope as different facts

**Decision**: Report the snapshot count separately from the final merge diff.

**Evidence**:

- PR #64 describes 893 legitimate snapshot paths after excluding five generated cache files from the original 898-record state.
- The final merge commit `04981a094f02fe73b18c2b8bc36746fb1eee5738` changes 150 paths against its first parent: 95 `src`, 13 `specs`, 9 `scripts`, 7 `e2e`, 5 `docs`, 4 `ios`, and remaining configuration/support paths.
- `codex/pending-898-speckit-batch` is reachable from `main`; it has zero branch-only commits and zero branch-only files relative to current `origin/main`, while current `main` is three commits ahead.

**Rationale**: The first count records recovery/snapshot inventory; the latter records what the reviewed PR actually delivered. Neither number means the same number of new visible screens.

**Alternatives considered**:

- Say the files disappeared because the branch is behind — rejected; a behind branch can be an ancestor of `main` after merge.
- Treat all source files as public product changes — rejected; tests, guards, platform lifecycle code, and default-disabled code can change without changing a currently visible screen.

## Decision 3 — Verify public Web/PWA deployment by SHA, deploy job, and cache-busted page

**Decision**: Require all three evidence legs before asserting that the public web release is current.

**Evidence**:

- `origin/main` resolves to `13ca51a80d23220574deba762851fe5a32372e46`.
- Actions run `30801612477` is a successful `deploy.yml` run for exactly that SHA; its `deploy` job completed successfully.
- A cache-busted request to `https://yehor212.github.io/people-first-app/` returned the public Settings page, `assets/index-u1b3za2B.js`, and a recent page `Last-Modified` value that aligns with that deployment.

**Rationale**: Source files or a merged PR alone do not prove public deployment; a page load alone does not prove which Git SHA caused it.

**Alternatives considered**:

- Use the legacy GitHub Pages build API only — rejected because its old build record is not the Actions deployment receipt.
- Treat a normal no-query browser load as sufficient — rejected because CDN and service-worker caches can retain a prior shell.

## Decision 4 — Separate the two installed-PWA freshness layers

**Decision**: Use the in-app "Перевірити оновлення" action first and never tell the owner to manually clear site data. Report the generated pre-React mismatch guard separately: it clears Cache Storage and unregisters workers before reloading if it sees a version mismatch.

**Evidence**:

- `src/lib/versionCheck.ts` fetches `version.json` with `cache: "no-store"`, produces a cache-busted navigation, and calls `prepareAppForReload()` before navigation.
- `src/main.tsx` checks a new service-worker activation and a web/PWA resume for stale app versions; it excludes native builds from this web-cache path.
- `vite-plugin-version.ts` generates the deployed `version-check.js`; its mismatch branch calls `caches.keys()`/`caches.delete(...)` and `navigator.serviceWorker.getRegistrations()`/`unregister()` before `location.reload()`.
- The public Settings DOM exposes the user-facing "Перевірити оновлення" action, while the public generated `version-check.js` exactly matches the plugin behavior for build time `1785749657356`.

**Rationale**: ZenFlow keeps local truth in IndexedDB. The generated bootstrap does not call IndexedDB deletion APIs, but Cache Storage/SW cleanup can affect offline shell availability. Its installed-profile effect must not be confused with the newer in-app safe reload contract.

**Alternatives considered**:

- Instruct browser-data clearing immediately — rejected because it can affect unsynced offline state and is not necessary to test a normal update path.
- Force a remote deploy — rejected; it is unnecessary because current web deployment is already verified and was not authorized.

**Finding**: `MEDIUM` contract/UX divergence. The in-app source tests explicitly assert that its user-triggered reload does not clear origin-wide caches or unregister the worker, while the earlier generated bootstrap deliberately does both on mismatch. This audit does not classify it as a data-loss defect because no IndexedDB deletion was observed, and it does not prove the behavior of the user's profile. A future PWA change should reconcile or explicitly explain the two behaviors and add installed-profile proof.

**Failure-path note**: the generated bootstrap catches version-fetch failures silently. If an installed profile is offline or the no-store fetch fails, the bootstrap itself leaves the existing shell in place and provides no direct status. That is a plausible stale-profile path, but it is `UNVERIFIED` for the user's device and is not evidence that the current public deployment failed.

## Decision 5 — Do not infer native or Tauri release freshness from GitHub Pages

**Decision**: Classify Android, iOS, and Desktop/Tauri separately from Web/PWA.

**Evidence**:

- `docs/CROSS_PLATFORM_RELEASE.md` assigns Web/PWA to automatic GitHub Pages deployment from `main`, Android to Google Play, iOS to App Store, and Tauri to a separate `desktop-release.yml`/GitHub Release channel.
- The screenshot contains browser extension/menu affordances, which are consistent with a Chromium/PWA window but do not prove the runtime.

**Rationale**: A correct Web/PWA deploy does not update a packaged native or Tauri application.

**Unverified**: The user's actual installed app runtime, its build identifier, its service-worker/cache state, and all native release receipts.
