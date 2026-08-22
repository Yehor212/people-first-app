# Wave 2 Evidence: Feature Availability

**Candidate base**: `13ca51a80d23220574deba762851fe5a32372e46`
**Evidence date**: 2026-08-03
**Scope**: Local source, isolated tests, TypeScript, localization, and static route/platform inventory. No authenticated production state, remote rollout row, native runtime, or public deploy is inferred.

## Red-first receipts

- Before `src/lib/featureAvailability.ts` existed, the pure manifest test failed at module import. The active execution stream retained the failure; no standalone terminal log file was manufactured afterward.
- Before the provider rewrite, the new asynchronous count and structured-availability suite failed 11 of 12 cases against the old provider. The active execution stream retained that result.
- The tests did not use production-derived records. IndexedDB rows and flags are isolated test fixtures only.

## Implemented contract

- `src/lib/featureAvailability.ts` contains one version-1 disposition per inventoried key and fails closed for unknown keys, missing manifest entries, missing consumers, and missing unreviewed defaults.
- `src/contexts/FeatureFlagsContext.tsx` waits for the account-boundary DATA settlement before reading `db.journalEntries.count()`, models loading/error explicitly, rejects stale account-boundary/count requests, and derives the legacy boolean adapter from the structured result.
- Existing reviewed consumers for focus, quests, challenges, and delta sync use `isFeatureVisible()`. Breathing, gratitude, tasks, and inner-world have no reviewed visibility consumer and are classified `consumer-missing` if queried; no existing core route is newly hidden by this manifest.
- AI Coach, rewards, rewarded-ad acquisition, habit Lottie, and Journal Save Ceremony remain fail-closed. Rollout/build-shaped inputs cannot enable them.
- Only disclosed temporary states map to localized copy. Hidden experiments remain silent.

## Fresh green evidence

| Command | Result | Evidence boundary |
| --- | --- | --- |
| `npx vitest run src/lib/__tests__/featureAvailability.test.ts src/contexts/__tests__/FeatureFlagsContext.test.tsx scripts/__tests__/feature-availability-inventory.test.ts src/hooks/__tests__/useDeepLinkHandler.test.ts src/hooks/__tests__/useDeltaSyncEffects.test.ts` | 5 files, 60 pass, 7 todo | Pure evaluator, settled account-boundary provider races, current route/sync consumers, and requested source/platform inventory; todo is not PASS |
| `npx tsc --noEmit` | exit 0 | TypeScript only |
| `npm run i18n:check` | 8 locales × 3,637 keys valid; V2 copy and translation-quality guards PASS | Key parity/static copy rules; native-speaker acceptance UNVERIFIED |
| `npm run i18n:deep` | 8 languages, 3,637 string values PASS | Static stale-English/placeholder rules |
| `npm run check:translation-quality` | exit 0 | Static forbidden-jargon guard |
| scoped `git diff --check` | exit 0 | Whitespace only for the Wave 2 write set |

## Remaining evidence

| Claim | Status | Required proof |
| --- | --- | --- |
| Authenticated Web/PWA visibility after real create/delete/import/account switch | UNVERIFIED | Exact-candidate browser flow without exposing journal content |
| Current Supabase design rollout rows and kill switches | UNVERIFIED | Authorized live read of exact rows and consumer behavior |
| Android/iOS lifecycle parity | UNVERIFIED | Exact-build device smoke |
| Windows/Tauri runtime parity | UNVERIFIED | Exact-build Windows runtime smoke |
| Native-speaker quality for eight new messages | UNVERIFIED | Human locale review |
| Public GitHub Pages behavior | UNVERIFIED | Merged SHA, green CI, cache-busted exact-build runtime |

No optional service, reward, ad flow, Lottie runtime, or save ceremony was enabled by Wave 2.
