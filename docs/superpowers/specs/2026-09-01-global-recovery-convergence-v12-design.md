# Global Recovery Convergence and V12 Sleep Motion Design

Date: 2026-09-01

Status: approved direction; implementation planning pending owner review of this written specification

## Goal

Converge every recoverable ZenFlow product change into the canonical `main`
without regressing the newer implementation, while shipping an owner-directed
bedtime-bear completion animation for the built-in `sleep` habit in a vector
TGS no larger than 64 KB.

## Explicit Requirements

- The completed user-facing version must live in `main`, not only in local
  branches, recovery folders, or stale worktrees.
- Previously omitted button, accessibility, smoothness, Android, journal,
  storage, sync, animation, and platform fixes must receive a disposition and
  must not disappear silently.
- The final history must contain real reviewable merge commits visible in the
  VS Code Git graph. An `ours` merge or an ancestry-only marker is not accepted.
- The exact approved motion base is
  `bedtime-bear-contact-v12-high-detail-smooth.tgs`, SHA-256
  `a98ebb8bf4ec8b0d39590b421f8cd9311e03af8a4c88a3a90ade4e1dceeb9309`.
- The animation must preserve the approved `contact-v8-layered` model quality,
  use smoother continuous motion, and remain no larger than 64,000 bytes.
- The delivery candidate adds a carefully modeled night cap. Its fold carries
  one round ZenFlow badge with a green field and the unchanged canonical
  `LEAF_BODY` and `LEAF_STEM` mark. The cap and badge must look integrated with
  the character rather than pasted over the rendered frame.
- No additional clone may be created. At most one temporary locked worktree is
  active at a time, and the temporary lane is removed only after its exact tip
  is merged and recoverability is proven.
- The final Android deliverable must be built from the merged source with the
  current signing identity; signing credentials must never be printed or
  committed.

## Current Evidence

- Canonical base: `main` and `origin/main` both resolved to
  `9ec698be381fc2b3f2e98f4e30291fed7660c350` before the convergence lane was
  created.
- Recovery inventory: 56 unique non-main heads, 73 retired worktree packets,
  149 commits outside `main`, and 45,837 restored records.
- After generated/cache/local classification, 4,133 logical paths still need a
  semantic disposition; 999 of those paths have multiple distinct variants.
- The largest conflict centers include `package.json`, `package-lock.json`,
  `ARCHITECTURE.md`, all eight locale files, journal owners, Android manifests,
  navigation, storage, sync, and agent-governance scripts.
- The exact V8 quality master is 3,270,243 bytes and cannot satisfy the compact
  delivery limit by gzip tuning alone.
- The approved V12 candidate is 63,207 bytes, 512 by 512, 60 FPS, 180 frames,
  three seconds, vector-only, exact-loop, and contains no whole-pose cuts or
  crossfades. Existing evidence records successful Glaxnimate, rlottie, and
  lottie-web rendering.
- Fresh baseline typechecking passed.
- The initial fully parallel Vitest baseline produced 9,804 passing tests and
  35 failures. The failures combined missing `patch-package` postinstall state
  with resource-contention timeouts. After applying the two tracked patches,
  the affected five-file group passed 287 of 287 tests with one worker. A
  bounded-worker complete rerun remains required.

## User Failure Mode

The repository graph and filesystem contain many partially overlapping fixes,
but users receive only the tree reachable from canonical `main`. Copying every
old file would replace newer code with stale variants, while merely preserving
branches or recording ancestry leaves the app incomplete. The user also loses
the intended premium sleep animation because the matching `sleep` habit asset
is currently a static reduced-motion illustration marked as awaiting Lottie
approval.

## Chosen Architecture

### 1. Evidence-complete semantic ledger

Every one of the 149 commits, every materialized packet, and every special
recovery source receives one final disposition:

- `ALREADY_IN_MAIN`: current `main` proves the same behavior with equal or
  stronger tests.
- `SUPERSEDED_BY_MAIN`: the old variant is intentionally not copied because a
  later implementation preserves the requirement more safely.
- `APPLY_EXACT`: the recovered change remains current and can be applied
  without semantic modification.
- `REIMPLEMENT_ON_MAIN`: the requirement is valid but the old bytes conflict
  with newer architecture, so the behavior is rebuilt against current owners.
- `NON_PRODUCT_ARTIFACT`: dependency folders, generated builds, caches,
  screenshots, logs, local tokens, environment files, and recovery metadata.
- `REJECTED_WITH_EVIDENCE`: a variant weakens a guard, reintroduces mock
  production data, violates current architecture, lacks rights/provenance, or
  fails its focused verification.
- `UNVERIFIED`: the source or proof is missing and no safe inference exists.

A source is not considered processed until its disposition names the affected
behavior, current owner file, evidence command, platform impact, and rollback.
The ledger must contain no unclassified source records at handoff.

### 2. Current architecture wins byte conflicts

Conflict resolution is behavior-first, not timestamp-first and not
branch-name-first. For each conflicting logical path:

1. Read the current owner and its tests.
2. Extract the recovered user-visible or invariant-level requirement.
3. Select or add the smallest test that detects the missing requirement.
4. Capture RED or a characterization baseline before production changes.
5. Implement against current React 18, Zustand, Dexie, Supabase, Capacitor 8,
   modal/overlay, i18n, and motion contracts.
6. Rerun the focused evidence and the domain blast-radius checks.
7. Record the exact source and disposition in the convergence ledger.

Old whole-file versions of `package.json`, lockfiles, locales, `Index.tsx`,
storage, sync, journal, native manifests, and governance files are never copied
over the current versions. Their missing behaviors are reconciled individually.

### 3. Reviewable thematic delivery

The work is divided into independently testable merge batches. A batch remains
under the repository's 500-path handoff limit and contains one coherent
rollback unit:

1. Convergence ledger and deterministic inventory support.
2. UI controls, button behavior, accessibility, i18n, and RTL.
3. Motion smoothness, canonical visual runtime, and the compact V13 `sleep`
   asset.
4. Journal privacy, media, persistence, and recovery.
5. IndexedDB, sync, tombstones, backup/import, and lifecycle ordering.
6. Android, iOS, Tauri, PWA, permissions, back handling, safe areas, and
   release contracts.
7. CI, governance, Spec Kit, production-data-integrity, and security gates.
8. Audio or other binary assets only when exact provenance, rights, hashes,
   runtime reachability, and existing asset policy all pass.

Only one batch is writable at a time. Each batch is pushed to a same-named
`codex/` branch, reviewed through a pull request, and merged with a true merge
commit. The next batch starts from the new exact `origin/main` tip. This keeps
the VS Code graph explicit and avoids a single unreviewable mega-commit.

### 4. V13 night-cap sleep animation integration

The owner-approved compact V12 is the immutable motion and model base for a new
V13 night-cap delivery candidate. The candidate maps to the existing built-in
pictogram ID `sleep`. This is grounded in:

- `src/lib/habitTemplates.ts`, where `sleep` is the built-in sleep-routine
  template;
- `src/assets/habit-icons/v2/manifest.json`, where `sleep` is currently a
  static original asset awaiting Lottie approval;
- the V12 narrative and artwork, which depict a sleeping bear ignoring a
  bedside phone.

The implementation stores the generated delivery artifact as
`src/assets/habit-icons/v2/sleep/completion.tgs` with a hash-bound
`completion-first-frame.svg` poster. It registers `sleep` in the existing
Android habit-completion celebration map; it does not enable the currently
disabled idle-Lottie runtime or change the existing multi-megabyte
`drink-water` and `read` idle assets. Web/PWA, iOS, Desktop, reduced-motion,
low-power, and runtime-failure paths retain the current static `sleep` SVG.

The cap uses a deep night-blue fabric with a soft light trim and pom. It is
anchored to the bear head so breathing and reaction motion remain coherent.
The badge sits on the visible cap fold as one small circular medallion: ZenFlow
green background, light canonical leaf, preserved body/stem geometry, and no
glow, filter, raster image, or alternate leaf silhouette. Its visual scale must
keep the leaf readable in the large completion presentation without competing
with the bear's face.

The asset manifest and TypeScript registry bind the final V13 SHA-256, byte
size, dimensions, FPS, duration, renderer, source provenance, V12 base hash,
canonical leaf paths, and direct user request. V12 approval proves only the
base model and motion; V13 Technical, Visual Runtime, Artistic-Craft, Motion,
and Model statuses are recorded independently.

The TGS path uses the existing bounded decompression and validation pattern:

- compressed bytes are checked before decompression;
- canvas, FPS, frame range, layers, raster/text/expression/mask exclusions,
  and output size are validated;
- dynamic imports keep Lottie and decompression code outside unaffected
  startup chunks;
- load, decode, or renderer failures fall back to the exact static sleep SVG;
- effective reduced motion, low battery, limited performance mode, background
  lifecycle, and unmount cancellation prevent or stop playback;
- the loop does not steal focus, announce decorative content, or block the
  habit control's 48 dp interaction target.

The exact V12 approval applies to the reviewed MP4 and bound base TGS. Adding
the night cap and logo creates V13, so Artistic-Craft, Motion, and Model return
to `UNVERIFIED` until the user reviews that exact generated MP4. The canonical
leaf geometry itself is not a new logo design and must remain byte-equivalent
to the path tokens in `scripts/generate-icons.cjs`.

### 5. Reproducibility and provenance

The exact compact V12 TGS is retained as an immutable generator input, and a
repository-owned deterministic V13 generator injects the semantic night-cap
rig and canonical leaf badge. Generated frames, rlottie dumps, `.pam` files,
caches, and the 3.27 MB V8 master remain outside production source. The
repository retains:

- generator source and focused tests;
- the immutable V12 input with its approved hash;
- exact canonical leaf-path equality checks;
- immutable source hashes and owner authorization;
- deterministic export command;
- compact TGS;
- portable MP4 and contact-sheet proof;
- machine-readable proof packet;
- format, size, loop, and cross-render validation.

No external asset inherits approval through filename similarity alone.

## Excluded Material

The following recovered bytes stay preserved in the external recovery folder
but are not copied to Git:

- `node_modules`, `.playwright-*`, build, dist, coverage, output, temporary,
  Xcode/Gradle/Capacitor caches, object files, and dependency-generated data;
- `.env*`, tokens, credentials, local MCP configuration, private logs, and
  machine-local receipts;
- `.git` pointers, symlink records, worktree metadata, and recovery wrappers;
- stale screenshots or generated evidence that is not required by a current
  proof packet;
- production mock, demo, sample, canned, synthetic, or fallback business data.

This exclusion does not discard the bytes: their hash-verified recovery copy
remains at
`/Users/yehor/Projects/ZenFlow/recovered-unmerged-files-20260831`.

## Platform Matrix

| Surface | Required result | Verification |
| --- | --- | --- |
| Web/Vite | Reconciled UI and data behaviors; sleep retains its static pictogram outside Android completion playback. | Typecheck, focused Vitest, production build, Playwright route proof, console/network inspection. |
| Installed PWA | Same behavior offline; no new completion runtime or stale mixed asset version is introduced. | PWA/offline Playwright flow and service-worker asset inspection. |
| Android/Capacitor | Buttons, back handling, safe areas, lifecycle, smooth V13 sleep completion, and signed package originate from merged source. | Gradle build, Capacitor sync checks, API 36 emulator completion flow, frame evidence, package/signature verification. |
| iOS/WKWebView | No WebView, safe-area, lifecycle, or motion regression; static sleep pictogram remains available. | iOS sync/build where available; simulator/device runtime otherwise `UNVERIFIED`. |
| Desktop/Tauri | Current desktop flows and static sleep pictogram remain intact; no browser-only assumption enters storage or motion. | Tauri checks/build where available; packaged runtime otherwise `UNVERIFIED`. |
| Telegram/TGS | Exact artifact is valid gzip Lottie, 512 by 512, 60 FPS, 180 frames, three seconds, loop-safe, and no larger than 64,000 bytes. | Hash/size validator, JSON contract, Glaxnimate, rlottie, lottie-web, and exact user approval record. |
| Accessibility | 48 dp targets, labels, keyboard/focus, reduced motion, non-motion outcome, and ar/he RTL remain correct. | Testing Library, a11y checks, reduced-motion browser proof, RTL viewport screenshots. |
| Performance | No startup regression; V12 playback is continuously smooth and bounded; visual fidelity is not reduced to make metrics pass. | Bundle report, Chrome performance smoke, Android frame data, before/after long-task and frame evidence. |
| Security and privacy | No secrets, private data, mock production records, unsafe decompression, or weakened auth/storage/sync boundaries. | PDI checks, dependency audit, Snyk when available, scoped security suite, diff review. |
| Store/release | A merged source revision and exact signed artifact are traceable; upload remains a separate externally verified action. | Release checks, artifact hash/signature, CI, Play Console status or `UNVERIFIED`. |

## Error and Failure Handling

- A recovered variant that cannot be proved safe remains `UNVERIFIED`; it is
  not silently copied and not falsely marked merged.
- A failing domain gate stops that batch without weakening tests or guards.
- A V13 load, decode, validation, timeout, or renderer error returns to the
  static `sleep` SVG and records only bounded non-PII diagnostics.
- Storage, auth, sync, deletion, and migration changes fail closed and preserve
  IndexedDB local truth, owner generation, tombstones, and retryable recovery.
- Public, native, store, human, and artistic claims stay separate from local
  technical evidence.

## Acceptance Criteria

- Every recovered head, packet, special source, and deletion intent has one
  evidence-backed ledger disposition; unclassified count is zero.
- Every `APPLY_EXACT` or `REIMPLEMENT_ON_MAIN` entry is reachable from final
  `main` and covered by its focused evidence.
- `main` does not contain dependency folders, build outputs, recovery wrappers,
  secrets, local logs, mock production records, or duplicate historical file
  variants.
- Immutable V12 base SHA-256 equals
  `a98ebb8bf4ec8b0d39590b421f8cd9311e03af8a4c88a3a90ade4e1dceeb9309`
  and its size is exactly 63,207 bytes.
- V13 is generated deterministically from that exact base, contains the night
  cap and a single green canonical-leaf medallion, records its exact final hash
  in the manifest, and remains no larger than 64,000 bytes.
- Sleep motion retains the reviewed V12 model and timing, remains smooth across
  all 179 adjacent frame pairs, preserves the exact loop, and degrades to the
  static sleep SVG under reduced motion or runtime failure.
- All affected locale keys remain structurally equal across en, uk, es, de,
  fr, ja, ar, and he; ar/he RTL layouts have rendered evidence.
- Focused tests, bounded-worker full Vitest, typecheck, lint, i18n, PDI, build,
  visual/TGS checks, applicable sync/native checks, security scans, and final
  diff/status review have no unexplained failure.
- Each remote batch is merged through a true merge commit. Final `main` equals
  `origin/main`, and the Git graph contains the merge parents.
- The temporary worktree is removed only after its branch tip and merged main
  are recoverable. The original checkout is the sole remaining worktree.
- Android APK/AAB claims include exact source SHA, artifact SHA-256, package
  identity, version, signing certificate fingerprint, and emulator/device
  evidence. Google Play upload and public availability remain `UNVERIFIED`
  until directly observed.

## Rejected Approaches

### Copy all restored files over `main`

Rejected because 37,521 logical paths are generated/cache material, 358 paths
are secret-or-local candidates, 999 product paths have conflicting variants,
and several whole snapshots predate newer security and storage work.

### Merge every historical head with `-s ours`

Rejected because it creates ancestry without delivering code and would repeat
the exact graph-versus-product mismatch reported by the user.

### Cherry-pick all 149 commits unchanged

Rejected because snapshot commits include thousands of build outputs and old
whole-file versions of protected owners. It would regress current `main` and
make conflicts decide product behavior accidentally.

### Ship the 3.27 MB V8 master

Rejected because it exceeds the user's 64 KB limit by more than fifty times.
It remains the immutable visual-quality reference, not the delivery artifact.

## Rollback

- Revert one thematic merge commit through a protected pull request.
- Restore the previous static `sleep` manifest entry and remove the V13 runtime
  registration if the V13 completion causes a runtime or accessibility
  regression.
- Keep the exact V12 base, V13 asset, generator, and proof packet available for
  diagnosis even when runtime registration is reverted.
- Never use force-push, history rewrite, destructive clean, or unbound stash
  operations for rollback.

## Remaining Unverified Before Implementation

- The exact number of recovered behaviors that require code changes rather
  than `ALREADY_IN_MAIN` or `SUPERSEDED_BY_MAIN` dispositions.
- iOS simulator/device and Desktop packaged-runtime availability on this Mac.
- Google Play Console state, uploaded artifact state, and public user rollout.
- Whether every historical audio binary has sufficient rights for production;
  no audio promotion occurs until its own provenance gate passes.
- Final Android signing-key location and certificate fingerprint; discovery
  must inspect metadata without printing private key material.
