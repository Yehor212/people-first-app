# PWA Diary Offline Delivery Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline in the existing locked lane. No new agent or worktree.

**Goal:** Make the existing cold Diary editor/save/reload journey work after completed offline installation, then finish PR #112.

**Architecture:** Collect the emitted editor and saved-entry list's static dependency closure at build time and merge it into the existing Workbox precache manifest by URL. Keep both roots lazy and existing service-worker runtime behavior unchanged.

**Tech Stack:** Existing Vite/Rolldown, Workbox injectManifest, Node crypto and Vitest/Playwright; no added dependencies.

**Spec:** [feature005](../../../specs/005-main-integration-compatibility/spec.md), FR-009–011; owner approved at 15:23 UTC on 2026-09-09.

## Global Constraints

- Maximum added precache bytes: 655360, explicitly approved by the owner at 16:08 UTC on 2026-09-09 after measuring the editor/list/image closure. Maximum individual emitted file: 3145728 bytes, matching existing configuration.
- Preserve all error, persistence and cold-editor assertions in `e2e/diary-pwa-offline.spec.ts`; no online editor visit.
- No data/schema/retention change, optional-feature precaching, eager UI import, visual change, new dependency or native worker registration.
- Missing native/public/installed proof remains unverified; the separate Android 103 ms goal stays open.

## Task 1: Bounded Emitted Dependency Closure

Files: create `scripts/diary-offline-precache.mjs` and `scripts/__tests__/diary-offline-precache.test.mjs`; modify `vite.config.ts`.

Interface: `createDiaryOfflinePrecache({ root })` exposes `{ plugin, manifestTransform }`. `collectDiaryOfflineAssets(bundle, { root })` returns sorted `{ url, revision, size }` entries. See the exact [delivery contract](../../../specs/005-main-integration-compatibility/contracts/offline-editor-delivery.md).

- [x] Add tests constructing isolated OutputChunk/OutputAsset graphs. Require root/static child/CSS/font inclusion, cycles deduplicated, dynamic optional child excluded, content-bound revision changes, absent root/import rejection, per-file limit, transform-before-collection rejection, preservation of shell revisions, deduplication and the owner-approved 640 KiB added limit.
- [x] Run `npm test -- scripts/__tests__/diary-offline-precache.test.mjs` before the helper exists; require the expected missing-module RED, not a tooling failure.
- [x] Implement collection using `moduleIds`/`facadeModuleId`, `imports` and `viteMetadata.importedCss/importedAssets`, with a visited Set. Build revisions with `createHash("sha256").update(bytes).digest("hex")`; measure bytes with `Buffer.byteLength`. Throw for a missing emitted edge, missing root or oversized file.
- [x] Implement a build-only post plugin that resets at buildStart and collects final bytes at writeBundle, after Vite's preload-list rewrites. Subtract the emitted initial-entry static graph already used by the controlled visited-route boot; reject missing boot roots/edges or an eager editor. In its manifest transform, clone existing entries, add only absent URLs with cloned size/revision entries, sum only added bytes and throw above 655360. Require collection before transformation.
- [x] Create the helper only under the existing `pwaEnabled` flag; insert its plugin and pass `[helper.manifestTransform]` to `injectManifest.manifestTransforms` under the same flag. Do not modify `src/sw.ts` or the editor's lazy import.
- [x] Rerun the same tests, `npm run typecheck`, lint and `npm run build`. Inspect actual generated `sw.js` entries and reported size; retain the original shell entries and unchanged lazy editor source.

## Task 2: Runtime And Integration Acceptance

Files: existing `e2e/diary-pwa-offline.spec.ts`, feature005 verification/tasks, and the existing all-branch integration ledger.

- [x] Run `ZENFLOW_PWA_OFFLINE_SKIP_BUILD=true npm run test:e2e:v2:diary-pwa-offline -- --project=pwa-offline-chromium-phone`. Require cold opening, save, offline reload, reconnect and zero captured page errors on the actual worker-controlled build.
- [x] Resolve native-disabled Vite config and run the existing native bundle build without device install. Require no collector, SW registration or new delivery payload on that path.
- [x] Run focused neighbors, separate typecheck and full Vitest/broad preflight, source/diff/bundle integrity, scoped Snyk/security and unchanged-threshold visual suite. Record every actual count/skip/failure and exact source hash.
- [ ] Review final diff/status, original branch ancestry and source copies; update fresh hook evidence, commit normally, push the existing branch and require exact-head CI before PR #112 normal merge. Preserve all original refs and working copies.

Rollback: normal code/config revert PR; no reset, cache deletion, forced worker takeover or private-data cleanup.

Local acceptance at 16:45 UTC: 23 graph tests, 149 focused cases and 10363 full-suite cases passed. The final injected worker contains 25 added files/566129 bytes; final-build offline/WebKit checks passed 2 cases with 2 project-specific skips, and visual/Settings/resize checks passed 43 with 18 pre-existing skips. Earlier triple repetitions passed all 6 applicable browser journeys. See feature005 verification for exact hashes, commands, security scope and unverified device/artistic boundaries. Only the normal publication step above remains.
