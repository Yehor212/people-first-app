# Best Practices Implied Requirements Gate

Purpose: prevent literal-only task completion. When a user asks for "best
practices", "fully", "make it complete", "what did I miss", or reports a
quality issue on one surface, the agent must expand the request into the
necessary platform, accessibility, performance, security, privacy, testing, and
release requirements before implementation and before claiming completion.

This is an input gate. It complements `docs/ai/TASK_COMPLETION_PROTOCOL.md`,
which is the output gate for the final Done Packet.

## Activation Rule

Run this gate for substantive coding, debugging, UI, visual, native, PWA,
security, privacy, performance, release, documentation, or agent-process work
when any of these are true:

- The user asks for best practices, deep research, complete implementation, a
  full plan, hidden gaps, or what they may not know to ask for.
- The work touches a cross-platform surface: Web/PWA, Android, iOS, Desktop,
  Tauri, Store, GitHub Pages, service worker, auth, sync, storage, analytics,
  accessibility, performance, or visuals.
- The fix on one surface implies another required surface, for example favicon
  quality implying Android round icons, iOS icons, PWA maskable icons, Tauri
  taskbar icons, store tiles, cache busting, and proof sheets.

Tiny one-step tasks can use the checklist mentally, but hidden safety,
privacy, data-loss, accessibility, platform, or release risks must still be
named instead of silently skipped.

## Popup Question Rule

Blocking questions must use the product's popup/question UI when that tool is
available. Do not ask blocking questions as ordinary chat text when popup input
is available. If no popup tool is available in the current environment, proceed
only when a safe assumption exists; otherwise stop and mark the blocked item
`UNVERIFIED` with the reason "popup question tool unavailable".

Non-blocking uncertainty should not interrupt the user. Proceed with a labeled
assumption, keep the change reversible, and list the assumption in the final
packet.

## Explicit Requirements

Extract the user's literal request first:

- Target outcome: the visible behavior, artifact, policy, or quality bar.
- Non-goals: what must not change, such as brand shape, storage format, public
  route, or existing architecture.
- Named tools, plugins, platforms, files, commands, screenshots, URLs, or proof.
- User language around quality: best practices, complete, latest, only, public,
  deployed, round, scalable, secure, accessible, or production-ready.

## Implied Requirements

Then add necessary requirements the user may not know to mention:

- Platform siblings: if one app icon, splash, runtime, or install surface is
  changed, enumerate Web/PWA, Android, iOS, Desktop/Tauri, and Store impact.
- Quality siblings: accessibility, RTL/i18n, touch targets, safe areas,
  reduced motion, visual proof, performance budget, offline/service worker,
  cache invalidation, logging, observability, rollback, and release proof.
- Security and privacy siblings: auth boundaries, secret handling, PII/logging,
  storage/sync isolation, dependency risk, Snyk/Semgrep/security-suite status,
  and explicit `UNVERIFIED` rows for unavailable scanners or credentials.
- Testing siblings: smallest red test or characterization proof, focused green
  rerun, blast-radius checks, and public/native/browser proof when local unit
  tests cannot prove the claim.
- Ownership siblings: generator ownership for generated assets, docs ownership
  for agent/process changes, and CI/drift checks for durable enforcement.

Safe implied requirements are part of the task, not optional extras. Do them
without asking when they are inside the user's goal, low-risk, reversible,
covered by evidence, and do not change product policy, data, brand identity,
architecture, dependencies, money, deployment, auth, privacy, or external write
state. Risky implied requirements require a popup question or an explicit
`UNVERIFIED` row if popup input is unavailable.

## Implied Work Ledger

Every final answer for an activated gate must include exactly one separate
reader-facing line:

```text
Дополнительно по подразумеваемому: сделал <что именно>; причина: <почему это было нужно>; статус: PASS/UNVERIFIED.
```

If no safe implied work was added, use this line instead:

```text
Дополнительно по подразумеваемому: ничего не добавлял; причина: не было безопасных implied-требований; статус: N/A.
```

The line must not hide risky or missing proof. Risky implied items go in the
`UNVERIFIED Ledger`, and blocking decisions go through the Popup Question Rule.

## Platform Matrix

Every Best Practices Packet must include these rows when applicable. A row can
be `N/A`, but only with a reason.

| Surface | Questions to answer | Evidence examples |
| --- | --- | --- |
| Web/PWA | Manifest, favicon, service worker, cache, install prompt, public URL, browser layout. | manifest check, Playwright/browser proof, cache-busted URL, Lighthouse/PWA evidence. |
| Android | Adaptive icons, legacy round icon, launcher density, WebView behavior, back handling, permissions. | generated Android assets, native/resource checks, emulator/device proof, Play Console/pre-launch proof when release-scoped. |
| iOS | App icons without alpha, WKWebView render, safe areas, permissions, App Store packaging. | `cap:sync:ios`, Xcode/simulator or CI proof, icon asset checks, App Store Connect proof when release-scoped. |
| Desktop | Tauri/Windows/macOS/Linux icons, WebView runtime, installer/update signing, taskbar/start menu. | Tauri checks, store asset checks, desktop release readiness, screenshot/runtime proof. |
| Store/Release | Store listing, screenshots, package identity, signing, certification, deploy and rollback. | release checklist, CI artifacts, Partner/App Store evidence, public cache-busted URL. |
| Accessibility | WCAG fit, labels, focus, contrast, target size, reduced motion, RTL for ar/he. | automated a11y checks, DOM assertions, screenshots, keyboard/focus proof. |
| Performance | Core Web Vitals/INP, startup, long tasks, memory/bundle risk, no visual downgrades to pass metrics. | route trace, Chrome/perf smoke, bundle report, before/after metrics. |
| Security And Privacy | Auth, secrets, PII, storage, sync, dependencies, native permissions, scanner coverage. | threat note, Snyk/Semgrep/security-suite, audit, RLS/auth proof, explicit `UNVERIFIED` if blocked. |
| Testing | Correct test layer, red/green evidence, integration or E2E only where needed. | focused vitest, Playwright, native smoke, generated asset check, regression proof. |
| Release And Operations | Monitoring, logs, rollback, docs, CI/drift, release notes. | Done Packet, CI gates, rollback path, docs links. |

## Standards Map

Use official or primary sources first. If a source is unavailable or the topic
is not covered, mark that source row `UNVERIFIED` and rely on local project
contracts only for the remaining decision.

| Domain | Official basis | What it adds to the gate |
| --- | --- | --- |
| Android quality | https://developer.android.com/docs/quality-guidelines/core-app-quality | Core app quality, platform expectations, stability, UX, performance, privacy. |
| Android adaptive icons | https://developer.android.com/develop/ui/compose/system/icon_design_adaptive | Foreground/background, safe zones, launcher shape variation, round icon implications. |
| Web/PWA icons | https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons | Manifest icon coverage, sizes, purpose, install surfaces. |
| PWA manifest | https://web.dev/learn/pwa/web-app-manifest | Install metadata, manifest-owned app identity. |
| iOS app icons | https://developer.apple.com/design/human-interface-guidelines/app-icons | iOS icon clarity, platform presentation, avoiding off-brand or unclear app identity. |
| Microsoft Edge PWA | https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/best-practices | PWA install quality, app identity, theme color, icon expectations on Windows. |
| Accessibility | https://www.w3.org/TR/WCAG22/ | Perceivable, operable, understandable, robust user experience obligations. |
| Core Web Vitals | https://web.dev/articles/vitals | User-centric loading, responsiveness, and visual stability thresholds. |
| Web security | https://owasp.org/www-project-application-security-verification-standard/ | Security verification areas for web app behavior and architecture. |
| Mobile security | https://mas.owasp.org/MASVS/ | Mobile app security and privacy controls for Android/iOS surfaces. |
| Browser testing | https://playwright.dev/docs/best-practices | User-visible E2E testing, isolation, resilient locators, web-first assertions. |
| Component testing | https://testing-library.com/docs/guiding-principles/ | Tests should resemble how users interact with the software. |

## Acceptance Evidence

Before implementation, choose the smallest useful proof for each material risk:

1. Red test or characterization proof for the main behavior.
2. Static contract check when the work is governance, generated assets, or CI.
3. Browser/screenshot proof for user-visible layout, icon, PWA, or runtime work.
4. Native or store proof only when the claim actually includes native/store
   readiness; otherwise keep that row `UNVERIFIED`.
5. Security scanner proof for changed first-party code, protected workflows,
   auth, storage, privacy, dependency, or agent/tooling surfaces.

Do not use one green check to imply a broader claim. For example, a web favicon
proof does not prove Android round icon correctness, and local build success
does not prove the public GitHub Pages URL is updated.

## UNVERIFIED Ledger

Every missing or blocked proof becomes an explicit ledger row:

| Item | Why it is not proved | Impact | Follow-up |
| --- | --- | --- | --- |
| Public deploy | No new deploy was run. | Public users may still see old assets. | Verify cache-busted GitHub Pages URL after deploy. |
| Native device | No emulator/device proof available. | Native wrapper behavior remains unknown. | Run Android/iOS smoke when release-scoped. |

Never convert missing tools, missing credentials, stale CI, old screenshots, or
subagent summaries into `PASS`.

## Best Practices Packet

Use this packet in plans, PRs, final answers, or task records before the Done
Packet when the gate activates.

```text
BEST PRACTICES PACKET

Task:
Explicit Requirements:
-

Implied Requirements:
-

Platform Matrix:
| Surface | Status | Reason | Evidence |
| --- | --- | --- | --- |
| Web/PWA | PASS/PARTIAL/UNVERIFIED/FAIL/N/A | | |
| Android | PASS/PARTIAL/UNVERIFIED/FAIL/N/A | | |
| iOS | PASS/PARTIAL/UNVERIFIED/FAIL/N/A | | |
| Desktop | PASS/PARTIAL/UNVERIFIED/FAIL/N/A | | |
| Store/Release | PASS/PARTIAL/UNVERIFIED/FAIL/N/A | | |
| Accessibility | PASS/PARTIAL/UNVERIFIED/FAIL/N/A | | |
| Performance | PASS/PARTIAL/UNVERIFIED/FAIL/N/A | | |
| Security And Privacy | PASS/PARTIAL/UNVERIFIED/FAIL/N/A | | |

Standards Map:
- Official/current sources checked:
- Local contracts read:

Acceptance Evidence:
- Red/baseline:
- Green/final:
- Blast radius:

UNVERIFIED Ledger:
-

Implied Work Ledger:
- Дополнительно по подразумеваемому:

Rollback:
-
```

## Logo And Visual Asset Addendum

For brand/logo/icon/splash work, this gate always implies:

- Preserve the canonical source shape unless the user explicitly approves a
  rebrand.
- Keep generator-owned assets as the source of truth; do not hand-edit one-off
  rasters or use AI/vectorize output as canonical without explicit approval.
- Cover tiny, normal, maskable, adaptive, round, store, splash, and desktop
  surfaces separately.
- Verify small-size readability, safe zones, transparency/opacity requirements,
  cache revision, manifest ownership, and proof-sheet/contact-sheet output.
- Mark deployed public behavior `UNVERIFIED` until a cache-busted public target
  is checked after deploy.

## Completion Integration

- `npm run check:best-practices` is the static guard that keeps this document,
  `AGENTS.md`, CI, drift checks, and release/completion docs wired together.
- `npm run check:task-completion` remains the final Done Packet guard.
- `npm run enforcement:check`, `npm run check:agent-context`, and the drift
  workflow are adjacent health checks for protected agent/process surfaces.

If this gate changes, update `scripts/check-best-practices-gate.cjs`, the
focused contract test, and the relevant package/CI wiring in the same change.
