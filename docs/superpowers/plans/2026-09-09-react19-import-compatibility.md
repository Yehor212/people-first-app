# React 19 And Import Compatibility Implementation

Owner approved the migration and twelve-cycle repair on 2026-09-09 after the all-branch main integration stopped at reproduced failures. Continue in the existing locked codex/android-103ms-20260904 lane; no new worktree, agent or renewed design approval.

The detailed executable plan is [feature 005](../../../specs/005-main-integration-compatibility/plan.md), with [ordered test-first tasks](../../../specs/005-main-integration-compatibility/tasks.md) and [requirement coverage](../../../specs/005-main-integration-compatibility/analysis.md). This supplements, not replaces, the [all-branch integration plan](2026-09-09-all-branch-main-integration.md).

Implementation order: reproduce current React/graph failures; add actual DOM inert and shared writer/cache tests; adapt ref and DOM contracts; move unchanged event producer and deletion keys to leaf modules; repoint producer and stats imports; rerun focused then full source/build/security/runtime proof; commit through normal hooks and merge PR #112 only with current required checks. Retain the original fifteen branch heads, preservation commit and source working copies.

No storage schema, real-user data, journal recovery algorithm, canonical visual, motion timing, native source or new production dependency changes. Five-platform and security/public/device proof limits are explicit in the feature plan. The separate Android 103 ms acceptance work remains open.
