# Validation guide
Use the locked lane, existing lockfile dependencies and the exact source/build identity in receipts.
1. Run npm test with DrawerV2.test.tsx, useNavigationV2.test.ts and NavV2Orchestrator.test.tsx, then the new pre-commit/evidence regression files.
2. Run npm run typecheck and npm run check:all; build with upload credentials absent.
3. Run e2e/nav-v2-interaction-latency.spec.ts against that production build; retain timing attachments and normal/reduced CSS observations.
4. Run full tests, canonical-orb, production-data-integrity, agent-context, best-practices and completion checks.
5. Build the existing Android benchmark variant. Verify built/installed identity independently. Use fresh UIAutomator bounds and separate video/frame traces under the [evidence contract](contracts/interaction-evidence.md).
No physical phone connected means phone proof stays UNVERIFIED even if local checks pass.

For the 2026-09-09 native-boundary continuation, build the existing debug/androidTest variants with unchanged production source, then explicitly select ImeAnimationDiagnosticTest with imeMode=baseline or imeMode=stable-root. Default test-suite execution skips this opt-in diagnostic. Use fresh native UI bounds to open the blank editor, never enter/save/restore content, and record four matched keyboard hide/refocus cycles. Stop with the diagnostic's scoped broadcast before its bounded deadline. Compare all decoded-frame signatures and inspect the original suspect frames and full-duration boards; identical APK/source identities are required. A successful diagnostic only permits T030's production regression step, not a full-goal PASS.
