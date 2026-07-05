# ZenFlow Task Completion Protocol

Purpose: define what "the task is complete" means for ZenFlow work. A task is
done only when fresh evidence proves the requested outcome, adjacent product
risks, and relevant platform contracts. "Looks done" is not a release state.

This protocol applies to every task that changes code, docs, prompts,
automation, Supabase, sync, runtime behavior, navigation, visuals, or release
state. It complements:

- `docs/ai/PREFLIGHT_OPERATOR_TEMPLATE.md`
- `docs/ai/BEST_PRACTICES_IMPLIED_REQUIREMENTS_GATE.md`
- `docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md`
- `docs/ai/V2_FULLSCREEN_EDGE_TO_EDGE_CONTRACT.md`
- `docs/ai/SYNC_CONTRACT.md`
- `docs/ai/TELEGRAM_GRADE_SYNC_100_PERCENT_CLOSURE.md`
- `docs/ai/TELEGRAM_GRADE_20_IDEA_LEDGER.md`
- `docs/ai/CANONICAL_ORB_INVARIANT.md`
- `docs/ai/DESKTOP_EXE_RUNTIME_CONTRACT.md`
- `docs/ai/BRAND_LOGO_CONTRACT.md`
- `docs/DEFINITION_OF_DONE.md`
- `docs/RELEASE_CHECKLIST.md`

## Core Rule

DONE is an evidence state, not a feeling.

Every completion claim must end with a Done Packet. The packet must show the
task goal, changed scope, proof collected, remaining unknowns, and release
state. No evidence = FAIL. Stale CI, memory, screenshots from older builds, and
static guesses are routing context, not completion proof.

## Research Basis

The protocol adapts stable engineering practices rather than inventing a local
ritual:

- Scrum's Definition of Done makes quality a shared release bar for an
  Increment: https://scrumguides.org/scrum-guide.html
- DORA metrics separate delivery speed from stability, so a "fast" change is
  not complete if it increases failures or recovery cost:
  https://dora.dev/guides/dora-metrics/
- Google SRE SLO and error-budget practice treats reliability as measured
  user-facing behavior, not internal optimism:
  https://sre.google/sre-book/service-level-objectives/
- NIST SSDF expects secure development evidence, review, and verification as
  part of producing software, not as an afterthought:
  https://csrc.nist.gov/pubs/sp/800/218/final

## Completion Status Vocabulary

Use these words exactly in reports and Done Packets:

| Status | Meaning |
| --- | --- |
| `PASS` | Fresh evidence from this working tree or public deployment proves the requirement. |
| `PARTIAL` | Some requirements pass, but named scope remains incomplete. |
| `UNVERIFIED` | The requirement may be true, but fresh proof is missing or blocked. |
| `FAIL` | Evidence shows breakage, missing required proof, or regression. |
| `WAIVED` | The user explicitly accepted a named risk for this task. Include date, scope, and who waived it. |

Do not use `done`, `fixed`, `green`, or `works` as substitutes for this status
model. Those words are summaries only after the evidence table is complete.

## Completion Ladder

A task can be closed only after these steps are true:

1. **Scope is locked.**
   - The target route, feature, entity, platform, and user-visible outcome are
     named.
   - Adjacent surfaces are listed: V1/V2, phone/desktop, PWA/native, public URL,
     account state, offline state, and visual state where applicable.

2. **Best-practices implied requirements are expanded.**
   - When the user asks for best practices, complete implementation, deep
     research, or hidden gaps, the Best Practices Packet from
     `docs/ai/BEST_PRACTICES_IMPLIED_REQUIREMENTS_GATE.md` is created before
     completion claims.
   - Explicit requirements, implied requirements, Platform Matrix rows,
     Standards Map, Acceptance Evidence, and the `UNVERIFIED` ledger are named.

3. **Relevant contracts are read.**
   - Runtime, sync, canonical orb, Supabase, security, release, and preflight
     contracts are cited when touched.
   - Protected docs such as `docs/law*.md` and `docs/visual-aesthetic.md` are
     not edited unless the user explicitly asks and the protected-file flow is
     satisfied.

4. **Implementation boundaries are declared.**
   - State what is intentionally unchanged.
   - For performance work, canonical visuals remain unchanged.
   - For sync work, durable event ordering and tombstones remain authoritative.

5. **Proof map is chosen before claiming completion.**
   - Commands, browser routes, screenshots, public URLs, SQL/RLS checks, and
     manual test matrices are named up front.
   - If a proof path is unavailable, it is marked `UNVERIFIED`, not hidden.

6. **Verification runs after the final change.**
   - Evidence must be from the final tree, final build, or final public deploy.
   - A passing check before the last edit does not close the task.

7. **Regression scan is task-specific.**
   - Visual work gets screenshot or trace evidence.
   - Sync work gets V1/V2, account, offline, delete, and multi-tab evidence as
     applicable.
   - Performance work gets route timing evidence.
   - Security and Supabase work gets policy, secret, and migration evidence.

8. **Done Packet is written.**
   - The packet is part of the final answer, PR description, release note, or
     internal task record.
   - If a commit or push is requested, the packet includes the commit hash and
     remote/public state when available.

## Required Proof By Work Type

| Work type | Required completion proof |
| --- | --- |
| Docs-only | Relevant docs read, links valid enough for intent, docs consistency check, no protected law/visual docs touched by accident. |
| UI/layout/navigation | Screenshot or browser trace for target route, phone and desktop where applicable, scrollability, safe areas, focus, touch targets, dark/light or theme-sensitive states. V2 fullscreen or edge-to-edge work must also cite `docs/ai/V2_FULLSCREEN_EDGE_TO_EDGE_CONTRACT.md`. |
| Canonical orb or adjacent visual runtime | `npm run check:canonical-orbs`, browser screenshot evidence, no non-canonical full or mini orb implementation, no late renderer swap that changes appearance. |
| Brand logo/app icon/splash assets | `npm run assets:logos:check`, `npm run check:visual`, focused splash/loading tests when runtime splash is touched, contact sheet proof across favicon/PWA/Android/iOS/Tauri/Store surfaces, and no unapproved logo replacement or SVG-filter artifact regression. |
| Sync/account/data | `npm run check:sync-contract`, `npm run smoke:telegram-sync-drill`, `npm run check:github-sync-secrets`, touched rows from `TELEGRAM_GRADE_20_IDEA_LEDGER.md`, entity round-trip proof, V1/V2 convergence when shared, anti-resurrection proof for deletes, account-boundary proof when auth is touched. Release claims must also cite the GitHub Actions `telegram-sync-drill` artifact from a freshly built preview. |
| Supabase/backend | Migration prefix check, generated types when schema changes, RLS/permission proof, no client secrets, rollback or repair path. |
| Journal Magic Link/auth recovery | `npm run check:journal-magic-link-proof-status`, `npm run check:journal-magic-link-proof-status:pass`, `npm run check:github-journal-magic-link-secrets`, `npm run check:github-journal-magic-link-secrets:pass`, `npm run check:journal-magic-link-live`, `docs/JOURNAL_MAGIC_LINK_LIVE_PROOF.md`, and `docs/JOURNAL_MAGIC_LINK_LIVE_PROOF_STATUS.json`. Live PASS requires GitHub secret/variable names, hosted Supabase config, smoke email delivery, consumed captured Supabase verify URL proof, and fresh reapproval; missing proof stays `UNVERIFIED`, not PASS. |
| Performance/startup | `npm run smoke:chrome-performance` or route-specific Chrome trace, cold boot and steady-state notes, max long task/LoAF evidence, no visual regression. |
| Desktop EXE/runtime | `npm run check:desktop-exe-contract`, `/desktop` Desktop Dock screenshots, `npm run desktop:check`, `npm run desktop:release:check:dev` for local development artifacts or `npm run desktop:release:check` for public artifacts, WebView2/Tauri cold-start and interaction proof, signed updater/code-signing status, no bundled secrets, no visual or canonical orb regression. |
| Microsoft Store/MSIX | `npm run desktop:store:package`, `npm run desktop:store:check`, exact Partner Center Product Identity values supplied through env/CI or public identity file, accepted generated MSIXUPLOAD proof, Windows App Certification Kit or Store certification proof, no purchase/final submit unless explicitly approved, and no visual/sync/runtime fork. |
| Google Play/AdMob production | `npm run google-play:assets:check`, `npm run google-play:admob:check` for the Android rewarded-only path, `npm run google-play:admob:ump-check` for local Android/iOS UMP consent and privacy-options wiring, `npm run google-play:admob:owner-runbook:check` for owner-only AdMob finalization handoff, `npm run google-play:admob:owner-next-steps` for a public-safe owner action packet and support precheck, `npm run google-play:admob:owner-next-steps -- --require-support-ready` before claiming support escalation is ready, `npm run google-play:admob:owner-evidence:check`, `npm run google-play:admob:owner-evidence:prepare`, plus `node scripts/check-admob-owner-evidence.cjs --file output/private/admob-owner-evidence.json` after owner checks for private console evidence shape, and `npm run google-play:admob:owner-evidence:apply -- --file output/private/admob-owner-evidence.json` as a dry-run before promotion, `npm run google-play:admob:check:full` for full cross-platform/banner+iOS monetization claims, `npm run google-play:admob:external-check` for the public-safe external readiness ledger, `npm run google-play:admob:external-check:pass` before claiming current Android rewarded production ads are ready, `npm run google-play:admob:external-check:full-pass` before claiming full cross-platform/banner+iOS monetization is ready, real AdMob app/ad unit IDs from owner-controlled env, `public/app-ads.txt` generated by `npm run google-play:app-ads` with the real `ZENFLOW_ADMOB_PUBLISHER_ID`, verified by `npm run google-play:app-ads:check`, live root-domain proof with `ZENFLOW_APP_ADS_PUBLIC_URL=https://your-developer-domain.example/app-ads.txt npm run google-play:app-ads:public-check` or `npm run google-play:app-ads:public-check:zenflow`, public Play listing proof with `npm run google-play:public-listing:check`, staged privacy artifact proof with `npm run google-play:privacy:artifact-check`, post-deploy public privacy smoke from GitHub Pages, public privacy policy proof with `npm run google-play:privacy:public-check`, Android release manifest proof, current AdMob app readiness, AdMob console app-ads.txt status, Policy Center, Privacy & messages/CMP, tax, identity/address, payout method, payment holds, live device ad playback, current Play Console Ads/Advertising ID/Data safety proof, and explicit scope separation between Android rewarded-only and full cross-platform monetization. `live_ad_playback_device` cannot be PASS until app-ads console status, app readiness, Policy Center, Privacy & messages/CMP, and Play Console Ads/Data safety are PASS. Missing publisher/app/ad-unit IDs, local UMP proof, staged artifact proof, post-deploy public privacy smoke, public privacy proof, public crawler proof, AdMob console proof, owner private evidence, owner next-steps packet, payment/tax/hold proof, or Play Console proof is `UNVERIFIED`, never PASS. |
| Security/privacy | Snyk or repo security scan for changed first-party code, no PII in diagnostics, no broad logging of journal/habit content, no weakened RLS/auth boundaries. |
| Release/public URL | Remote CI/deploy result, cache-busted public URL, service-worker/stale-cache note when relevant. |
| Native/PWA/cross-platform | Android/iOS/PWA/Desktop/phone matrix row marked `PASS` or `UNVERIFIED`; never imply native proof from web-only checks. |

## Stop Conditions

Stop and report instead of claiming completion when any of these are true:

- No current evidence exists for a required claim.
- A public-user issue was checked only locally.
- A visual claim has no screenshot, browser trace, or viewport checklist.
- A sync claim has no event/apply/convergence proof.
- A delete path can resurrect stale data.
- A performance fix changes canonical orb visuals or other product canon.
- A Supabase schema/auth claim lacks migration/RLS proof.
- Native or PWA behavior is affected but only desktop web was checked.
- CI or deploy status is stale or from a different commit.
- The verification command failed, timed out before running the relevant code,
  or was skipped without a user waiver.

## Done Packet Template

```text
DONE PACKET

Task:
Scope:
Out of scope:
Contracts read:
Best Practices Packet:

Changed files:
- path:

Evidence:
| Requirement | Status | Evidence |
| --- | --- | --- |
| User-visible outcome | PASS/PARTIAL/UNVERIFIED/FAIL/WAIVED | command, URL, screenshot, test, file path |
| Regression guard | PASS/PARTIAL/UNVERIFIED/FAIL/WAIVED | command, URL, screenshot, test, file path |
| Platform matrix | PASS/PARTIAL/UNVERIFIED/FAIL/WAIVED | web/PWA/Android/iOS/desktop/phone evidence |
| Sync/runtime/security impact | PASS/PARTIAL/UNVERIFIED/FAIL/WAIVED | relevant proof |
| 20-Idea ledger impact | PASS/PARTIAL/UNVERIFIED/FAIL/WAIVED | touched rows from TELEGRAM_GRADE_20_IDEA_LEDGER.md |

Known gaps:
- None / list every UNVERIFIED or WAIVED item.

Rollback:
- Commit/revert/config/SQL rollback path.

Commit/deploy:
- Commit hash:
- Remote CI:
- Public URL:
```

## Minimum Final-Answer Rules

- Say `PASS` only for requirements with current evidence.
- Say `UNVERIFIED` for blocked browser, native, account, Supabase, or public
  proof.
- Mention commands that failed or were skipped.
- Mention visual screenshots/traces for UI claims.
- Mention public URL proof for GitHub Pages claims.
- Mention the `telegram-sync-drill` artifact for release sync claims.
- If same-account credentials are missing, use `npm run setup:sync-test-account`
  only with a server-only Supabase service-role key; otherwise mark the row
  `UNVERIFIED`.
- Mention user waivers explicitly; do not invent waivers.

## Agent Workflow

1. Produce the visible preflight artifact.
2. Read this protocol plus every touched domain contract.
3. Implement only inside the declared scope.
4. Run the proof map after the final edit.
5. Self-review the diff against the stop conditions.
6. Commit/push only after local proof is acceptable for the task scope.
7. Verify remote CI/public URL when the user or bug report is public.
8. Final answer includes a Done Packet summary, not just "done".

## Maintenance

This protocol is enforced by `npm run check:sync-contract` because completion
quality is part of sync/runtime reliability. If the protocol changes, update
that guard, `npm run check:best-practices`, and re-run the repo AI checks.
