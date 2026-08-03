# Operator Quickstart: Pending Batch Delivery

Run all commands from the isolated worktree:

```bash
cd /Users/yehor/Documents/Codex/2026-06-10/new-chat/people-first-app/.superpowers/worktrees/pending-898-speckit-batch
export SPECIFY_FEATURE=001-pending-batch-delivery
```

## 1. Confirm Spec Kit and the safety boundary

```bash
specify version
specify integration list
.specify/scripts/bash/check-zenflow-constitution-status.sh --json
git status --short --branch
git log --oneline --decorate -5
```

Expected boundaries:

- Specify CLI is 0.15.1.
- Codex is installed and default.
- Constitution status is `PROPOSAL_CRITERIA_ONLY`, nonbinding.
- Git branch is `codex/pending-898-speckit-batch`.
- Snapshot commit `c902b612050dd891e5aa86958ebf8bb7f2e9f5ba` remains in ancestry.

## 2. Validate the feature packet

```bash
.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks
npx --yes ajv-cli validate \
  -s specs/001-pending-batch-delivery/contracts/delivery-evidence.schema.json \
  -d specs/001-pending-batch-delivery/evidence/verification.json \
  --spec=draft2020
```

The schema command may install a transient CLI in the npm cache only; it must not modify `package.json` or `package-lock.json`.

## 3. Run repository checks in stable artifact order

```bash
npm run typecheck
npm test
npx eslint . --max-warnings=0
npm run check:all
npm run check:production-data-integrity
npm run build
npm run check:size
npm run check:production-data-integrity:bundle
npm run ci:preflight
```

Do not run a second build concurrently with either bundle-integrity check. Record exact outputs and counts in `evidence/verification.json`.

The save ceremony is intentionally default-disabled. Its Lottie runtime must be absent from the default build graph, while the explicitly enabled build must retain the complete animation and fallback paths:

```bash
VITE_ENABLE_JOURNAL_SAVE_CEREMONY=true npm run build
npx playwright test e2e/journal-save-ceremony.spec.ts \
  --config=e2e/helpers/save-ceremony/playwright.config.ts --workers=1
ZENFLOW_SAVE_CEREMONY_SCHEME=http npx playwright test \
  e2e/journal-save-ceremony-pwa.spec.ts \
  --config=e2e/helpers/save-ceremony/playwright.config.ts \
  --project=chromium --workers=1
npm run build
npm run check:size
```

The final unflagged build restores the exact artifact mode exercised by default GitHub CI.

## 4. Inspect and publish

```bash
git diff --check origin/main...HEAD
git status --short
git push -u origin codex/pending-898-speckit-batch
gh pr checks --watch
```

Create and merge the pull request only after final local evidence is committed. Use a merge commit; do not squash, force push, bypass hooks, or bypass failed/pending CI. If all required checks are green and the only remaining protection is impossible self-approval, a repository-admin merge is allowed only with the user's explicit authorization and must be recorded as such.

## 5. Converge

After the merged `main` SHA and post-merge workflows are green:

1. Verify `git merge-base --is-ancestor c902b612050dd891e5aa86958ebf8bb7f2e9f5ba <merged-main-sha>`.
2. Restore the owner checkout's ignored guard files to their captured hashes and modes.
3. Recompute its HEAD, 898-record count, and status digest.
4. Complete `convergence.md` only from retained evidence.

No step in this quickstart authorizes production data writes, a deployment bypass, or handling user credentials.
