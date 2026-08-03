## What & Why

<!-- 1-2 sentences: what changed and why -->

## Agent Change Notice

<!-- Required for radical/protected-surface changes. For small safe changes, write: AGENT_CHANGE_NOTICE: N/A - <reason>. See docs/ai/AGENT_CHANGE_GOVERNANCE.md. -->

AGENT_CHANGE_NOTICE:
- Risk level:
- Trigger:
- Current behavior evidence:
- Proposed write set:
- Affected domains/platforms:
- Rollback:
- Verification:
- Verdict:

## Checklist

- [ ] Tested locally (`npm run check:all && npm test`)
- [ ] No TypeScript errors (`npx tsc --noEmit` = 0)
- [ ] Visual check done (screenshot below or "N/A — no UI changes")
- [ ] Agent change notice completed or explicitly N/A
- [ ] No AI-template output: copy/UI/docs/assets are ZenFlow-specific, placeholders removed, and `npm run check:no-ai-templates` run or marked N/A with reason
- [ ] Production data integrity: `npm run check:production-data-integrity` ran with fresh output, and the production build passed `npm run check:production-data-integrity:bundle`
- [ ] Test doubles remain test/dev-only; no fixture, deceptive fallback, synthetic user/backend fact, or unsafe demo path is production-reachable
- [ ] The exact fingerprint baseline did not grow without owner review; any stale baseline entry was removed
- [ ] No waiver was added without an exact path/fingerprint, expiry, tracking issue, removal condition, and real human approval
- [ ] Any production sync smoke write verifies the dedicated `zenflow_sync_smoke` account marker before writing
- [ ] CHANGELOG.md updated (or N/A — no user-facing changes)
- [ ] No secrets committed (.env, keystore, google-services.json)

## Cross-Platform Impact (required)

- [ ] Platform status declared for ALL targets — Web/Vite, installed PWA, Android, iOS, Desktop: shipped, N/A + reason, or follow-up issue linked
- [ ] Cross-platform data/sync/deletion impact reviewed (or N/A)
- [ ] UI: RTL (ar/he), safe-area, and desktop-width checked (or N/A — no UI changes)
- [ ] Native-only capability has a web/PWA fallback plan; web-only assumption verified on Capacitor/Tauri (or N/A)
- [ ] Release parity: user-facing change is tracked until it reaches every shipped platform (`docs/CROSS_PLATFORM_RELEASE.md`)
