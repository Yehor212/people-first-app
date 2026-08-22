# Wave 3 Evidence: Disabled Journal Save Ceremony Candidate

**Candidate base**: `13ca51a80d23220574deba762851fe5a32372e46` plus the current uncommitted Epic 002 write set  
**Evidence date**: 2026-08-03  
**Release disposition**: `STOP` for production enablement; schema v1 remains non-enabling, the kill switch remains active, and artistic/craft plus explicit owner approval are `UNVERIFIED`.

## Red-first receipts

- Capability and release-entry contract tests were added before the generator,
  validator, shared build owner, and four target entry points existed. Their
  missing-module/missing-wiring failures were retained in the active execution
  stream; no terminal log was reconstructed afterward.
- Host integration first failed two focused assertions because it had no
  `onFinish` callback and `JournalModule` had no independent anchor lifetime.
- The first external-worktree Chromium save reached a real saved card but failed
  with `Animated ceremony host was not observed.` The receipt was consumed
  before layout measurement, which removed the only saved-entry anchor.
- The fix keeps the private entry identifier only in ephemeral React state,
  consumes the presentation receipt once, and clears the anchor only when the
  matching nonce finishes or is cancelled. An older completion cannot clear a
  newer anchor.

## Implemented contract

- `config/feature-capabilities.json` is the single tracked schema-v1 policy.
  It has `requested=false`, `killSwitch=true`, and all admission rows
  `unverified`.
- `scripts/feature-capability-build.cjs` rejects unknown fields, malformed
  commits, unknown targets, conflicting inputs, symlinked policy/output paths,
  target disagreement, and every enabled schema-v1 receipt.
- `scripts/run-shared-dist-build.mjs` assigns one explicit target and writes
  then verifies `dist/feature-capability-receipt.json` for Pages, Android, iOS,
  and Tauri.
- Production Vite builds cannot use
  `VITE_ENABLE_JOURNAL_SAVE_CEREMONY`; that variable is a development-only
  review override. The production literal is derived from the guarded policy
  and remains false.
- The ceremony receipt distinguishes `local-saved`, `cloud-pending`, and
  `cloud-failed`. Its entry identifier never reaches the DOM, logs, build
  receipt, or support-safe evidence.
- A visible saved-card marker positions the non-modal, pointer-transparent veil
  and player. Missing/hidden anchors, reduced motion, low battery, runtime
  strain, preload failure, and circuit-open state use the static fallback.

## Fresh local evidence

| Command | Result | Evidence boundary |
| --- | --- | --- |
| `npx vitest run <8 Wave 3 journal files> --reporter=dot` | 8 files, 90/90 pass | Receipt semantics, host lifecycle, anchor privacy, list/card integration, assets, static degradation, and outbox acknowledgement |
| `npx vitest run scripts/__tests__/feature-capability-receipt.test.ts scripts/__tests__/feature-capability-release-contract.test.ts scripts/__tests__/shared-dist-build.test.mjs --reporter=dot` | 3 files, 51/51 pass | Schema, negative controls, four target wiring, and shared build owner |
| `npm run typecheck` | exit 0 | App and Node TypeScript only |
| `VITE_ENABLE_JOURNAL_SAVE_CEREMONY=true ... playwright ... -g "committed paper save"` | Chromium 1/1 pass | Reproduced RED path is GREEN on a production-equivalent local phone route |
| `VITE_ENABLE_JOURNAL_SAVE_CEREMONY=true ... playwright ... e2e/journal-save-ceremony.spec.ts` | Chromium 7/7 pass | Paper/ink/oled animation plus reduced-motion, low-battery, and runtime-strain static behavior |

The browser was intentionally run without Supabase credentials. A durable local
entry was created through the real journal UI in an isolated browser profile;
the truthful delivery state was `local-saved`. No production record or mock
runtime business data was introduced.

## Visual runtime receipts

The 399 × 869 Chromium run produced five ignored local screenshots:

| Frame | SHA-256 | Bytes |
| --- | --- | ---: |
| paper/night animated | `0184c51fa9c46a95a69a19e36797e0db6da1d75d5428b24f3ae96b58fc10726f` | 404447 |
| ink/day animated | `4f7eff651333a424d5a55ac1a624ce40b29cb0e31f98e5a39bf5f331b9d7f29b` | 346622 |
| oled/day animated | `c1bc3030f7cca13ffa0fb963b0a2ca7b2988743446b08fa4cd1d6007d1aa068a` | 295005 |
| low-battery static | `b41ceafb36914d030dd6bd20fc6d1efe2d2bda5115516d1bc23ab0e03ce59782` | 401012 |
| runtime-strain static | `3426855fd6e61fb39c4d6434e23eacd348ba7f861e35f7139e39f3d315b1ed17` | 348631 |

The run verified one visible anchor, no DOM entry ID, player proximity, safe
viewport bounds, `pointer-events:none`, `aria-hidden=true`, a transparent
radial focus veil without backdrop blur, exactly one TGS request for animated
paths, and no TGS/runtime request for degradation paths.

## Inline visual-integrity review

The named `visual-integrity-critic` skill is unavailable, so the repository
protocol was applied inline. This is not an independent artistic opinion.

| Dimension | Status | Current evidence / rejection criterion |
| --- | --- | --- |
| Technical | PASS | 90/90 focused tests, 7/7 Chromium flows, bounded player, nonblocking host, and truthful degradation |
| Visual Runtime | PASS (Chromium phone only) | Current screenshots show the exact book/pen/ink assets near the saved card across three themes; other viewports and native shells remain `UNVERIFIED` |
| Artistic-Craft | UNVERIFIED | No independent critic or owner approval. Captured frames substantially cover card content and the pen approaches the floating action control; reject enablement unless a human review accepts this emphasis or requests placement/scale changes |
| Motion | UNVERIFIED | Runtime completion is proven, but still frames do not prove timing, weight, overlap, or shadow choreography |
| Model | UNVERIFIED | Still frames show coherent book/pen/ink silhouettes, but no independent whole-sequence model-integrity review exists |
| Plan | PASS | One event owner, matching-nonce cleanup, static fallbacks, exact target receipt, kill switch, rollback, and explicit rejection gates are defined |

## Provisional four-target build evidence

Web/PWA, Android, iOS, and Tauri shared production builds were run sequentially
before the final anchor-lifetime edit. Each generated and verified a
target-specific schema-v1 receipt with capability `false`, kill switch
`true`, and no ceremony/TGS artifact in `dist`. Because the working tree is
not yet committed and changed afterward, these receipts are **provisional** and
must be regenerated from the exact staged/committed candidate before delivery.

## Remaining gates

| Claim | Status | Required proof |
| --- | --- | --- |
| Exact-candidate four-target receipt/build parity | UNVERIFIED | Rebuild all four targets after the final commit and verify exact source SHA |
| Broader accessibility/performance packet | IN PROGRESS | Final repository accessibility, performance, bundle, and platform checks |
| Android/iOS physical behavior | UNVERIFIED | Exact-build device smoke |
| Native TalkBack/VoiceOver | UNVERIFIED | Human/device assistive-technology review |
| Windows/Tauri runtime | UNVERIFIED | Exact-build Windows smoke |
| Independent Artistic/Craft and Motion review | UNVERIFIED | Hash-bound visual critic using screenshots/video |
| Explicit owner visual approval | UNVERIFIED | User approval for the same exact candidate |
| Production enablement | BLOCKED | A separately reviewed enabling schema after every preceding row closes |

