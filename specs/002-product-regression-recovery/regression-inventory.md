# Reproduced Regression Inventory

**Baseline**: `13ca51a80d23220574deba762851fe5a32372e46`
**Saved snapshot inspected read-only**: original-repository `refs/stash` at `2199295450cc90c86b3202992544606ba3f2979b` (`codex/pre-main-sync-898-20260803T142957Z`) plus the two identical proof copies under `.codex-recovery/zenflow-experience-audit-2026-07-28/`
**Restore decision**: rejected; no stash apply/pop/cherry-pick or bulk file copy was run

## Selective comparison

Only these symptom-relevant paths were inspected: `JournalModule.tsx`, `useJournalSecurity.ts`, `journalSecurityMigration.ts`, `journalStorage.ts`, and `FeatureFlagsContext.tsx`.

- The two `.codex-recovery` proof copies had identical SHA-256 values for all five inspected files.
- Their `useJournalSecurity.ts` and `FeatureFlagsContext.tsx` matched the current main baseline; the hardcoded `journalEntries: 0` was already present.
- Their `journalStorage.ts` still used page-wide `Promise.all` display decryption and had no `unavailableCount` contract.
- Their password-removal path had no evidence of the new typed preflight, row-snapshot transaction, or resumable cleanup contract.
- The stash differed materially only in `JournalModule.tsx` among these five paths and contained an earlier eager save-ceremony host. Wave 1 does not restore or modify that ceremony path; exact admission, anchoring, and local/cloud outcome work remains scoped to Wave 3.

## History attribution

| Symptom | Earliest relevant history evidence | Current disposition |
| --- | --- | --- |
| Journal count forced to zero | `eaf14d0b8b8ed26b55fb43e23af73d3bc6d7a214` introduced the literal in `FeatureFlagsContext.tsx` | Reproduced statically; fix and runtime visibility proof are deferred to Wave 2 |
| Non-resumable password removal | `6ba34acbf1dd6a53af6b8b734ada330605b7d6b0` introduced the atomic helper/caller family later used by main | Unsafe ordering/error collapse reproduced in source and tests; exact real-data blocker remains `UNVERIFIED` |
| One unreadable row hides a page | `c902b612050dd891e5aa86958ebf8bb7f2e9f5ba` introduced `decryptEntriesForDisplay()` as page-wide `Promise.all` | Reproduced with isolated mixed fixtures and fixed with per-row settled reads |
| Ceremony can enter a bundle through a raw flag | Earlier ceremony integration and later lazy loading existed without exact-candidate release admission | Reproduced statically; Wave 1 leaves the current disabled path unchanged and Wave 3 owns exact-candidate admission |

## Other reported missing functions

No additional domain code was changed merely because it existed in the 898-file snapshot. Auth/onboarding/recovery, orb/mood, habits/garden/tasks/focus, social/insights, settings/data, PWA/offline, and native/Desktop gate inventory remains a Wave 2 task. A later PR requires a current reproduction plus focused RED test; otherwise the disposition is `UNVERIFIED / no edit`.

This prevents a historical snapshot from laundering unrelated or stale behavior back into production.
