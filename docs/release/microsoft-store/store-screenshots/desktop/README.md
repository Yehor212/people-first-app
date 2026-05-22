# Desktop Store Screenshots

These screenshots are the approved desktop upload set for the current ZenFlow
Microsoft Store draft.

They were captured from the public ZenFlow surface, not from localhost, and are
kept as release assets so Partner Center upload does not depend on temporary
`tmp/` files.

## Upload Order

| Order | File | Caption |
| --- | --- | --- |
| 1 | `01-v2-orb-desktop.png` | `Name your mood in a quiet visual flow that stays out of your way.` |
| 2 | `02-v2-habits-desktop.png` | `Build steady daily rituals without turning your day into a dashboard.` |
| 3 | `03-v2-diary-desktop.png` | `Keep private reflection close to your work, with space to start small.` |

## Quality Notes

- All files are PNG.
- All files are `1440x900`, above the Microsoft Store desktop minimum of
  `1366x768`.
- The `languagecode=en` Store listing must use English UI screenshots only.
- The first screenshot shows the canonical V2 orb flow and should remain first.
- The diary screenshot is intentionally privacy-safe and avoids real user text.
- Do not add marketing overlays, captions inside the image, browser chrome, or
  debug badges.
- Do not upload rejected `tmp/store-candidates/04-desktop-download-page*.png`
  captures until the hero text/orb overlap is fixed.

## Required Checks Before Upload

Run these after any screenshot replacement:

```bash
npm run check:canonical-orbs
npm run desktop:store:check
npm run check:task-completion
```

If any check fails, do not upload the screenshots.
