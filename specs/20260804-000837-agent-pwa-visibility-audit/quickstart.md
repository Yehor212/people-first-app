# Safe Operator Validation

This guide validates visibility only. It does not merge, publish, or modify PWA data.

## 1. Inspect the Correct Agent Lane in VS Code

Open the generated single-root workspace in a new window:

```sh
code --new-window /Users/yehor/Projects/ZenFlow/worktrees/codex-agent-doctor.code-workspace
```

Expected result: Source Control is rooted at `codex-agent-doctor`; local doctor-command edits are visible there. They are not expected in the legacy `main` checkout until a normal commit → push → PR → merge path completes.

## 2. Confirm the Current Web Deployment Without Using PWA Storage

Open the public page with a harmless cache-busting query:

```text
https://yehor212.github.io/people-first-app/?visibilityAudit=20260803
```

Expected result: the current public Settings screen loads. This validates the public web artifact, not a personal installed-PWA cache.

## 3. Refresh an Installed PWA Safely

In the installed app, use **Налаштування → Допомога та інформація → Перевірити оновлення**. Allow the normal reload if the app reports an update.

Expected result: the app uses its cache-busted update path while allowing its durable writers to settle first.

- If the app reports the version is current, record only that status; it is evidence for this installed profile.
- If it offers a reload/update, let the normal app flow complete, then reopen the same route and record the new status.
- If it reports an unavailable/offline result, leave freshness as `UNVERIFIED`; do not manually escalate to data clearing.

Do not manually clear site data, unregister the service worker, or remove the installed app as a first response. Those actions are outside this audit and may affect local offline data. Note that the existing generated `version-check.js` can itself clear Cache Storage and unregister workers when it detects a mismatched build before React starts; that behavior is source-confirmed but not proof that it ran in this profile.

## 4. Determine Whether the Screenshot Is Tauri

Use the app's **About/version** surface or its release artifact/build identifier. Browser extension puzzle/menu controls are a clue that the screenshot is Chromium/PWA-style, not proof. A verified Tauri result requires the separate Desktop Release/GitHub Release receipt.

## 5. Stop Conditions

Stop and preserve evidence instead of repairing anything if:

- VS Code is open on a different absolute root than the worktree being inspected;
- an agent lane has uncommitted changes and the requested next action is merge/push/deploy;
- the installed PWA is offline or reports update state `unavailable`;
- a request would clear local data or inspect private journal/sync records.
