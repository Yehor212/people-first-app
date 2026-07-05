# Translation Quality Policy

Purpose: keep ZenFlow translations natural, calm, and useful across `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, and `he` without exposing implementation details to users.

This policy applies to user-facing i18n values and visible fallback copy. It does not change runtime behavior, storage, sync, visual design, or platform support.

## Source Basis

- Material Design writing guidance prioritizes short, scannable UI text focused on one concept at a time: https://m2.material.io/design/communication/writing.html
- Apple Human Interface Guidelines recommend simple, plain language written with accessibility and localization in mind: https://developer.apple.com/design/human-interface-guidelines/writing
- Microsoft globalization guidance says localizable text should live in resources, avoid concatenating natural-language strings, and use meaningful placeholders: https://learn.microsoft.com/en-us/globalization/internationalization/message-formatting
- W3C internationalization guidance treats human-facing fields as localizable text, warns against display-string concatenation, and calls out directionality and string-length concerns: https://www.w3.org/TR/international-specs/

## ZenFlow Translation Rules

1. User meaning beats implementation accuracy. A user needs to know whether their information is safe, on this device, on their account, or needs connection. They do not need `cloud sync`, `sync queue`, `local storage`, `IndexedDB`, `cache`, `debug`, `renderer`, `GPU`, `PWA`, or `platform` unless support instructions truly require the term.
2. Keep copy calm and non-blaming. Prefer recovery language such as "Try again" or "We'll keep your changes here" over fault language that makes the user feel responsible.
3. Do not medicalize or gamify carelessly. Words such as dopamine, ADHD, streak pressure, or productivity pressure must only appear where the feature explicitly needs them and the surrounding copy is helpful.
4. Translate whole thoughts, not fragments. Do not build sentences by concatenating translated pieces. Keep placeholders meaningful and preserve every placeholder across languages.
5. Treat `ar` and `he` as RTL risk. Avoid left/right language in copy unless it is actually about physical direction, and keep numbers/placeholders readable in mixed-direction text.
6. Fallback copy follows the same rules as i18n. A fallback string is still user-visible text when a key is missing or late to load.

## Preferred Terminology

| Avoid in user-facing copy | Prefer |
| --- | --- |
| Cloud sync | Account update, online backup, updates your account |
| Sync queue | Changes waiting to update |
| Saved locally | Saved on this device |
| Local storage | Storage on this device, saved on this device |
| Restore from cloud | Restore from your account backup |
| Debug info | Support details |
| Database recovery | Repair saving, fix saved data access |
| Cache reset | Refresh saved app files, refresh the app copy |
| Platform | Device, browser, app, phone, desktop |
| PWA | Installed web app, browser app, app shortcut |
| GPU optimized / renderer / WebGL | Smooth visuals, visual performance, battery-aware visuals |

## Required Checks

Run these before claiming translation-quality PASS:

```bash
npm run check:translation-quality
npm run i18n:check
npm run i18n:deep
```

When the change also touches product copy, docs, or agent instructions, also run:

```bash
npm run check:no-ai-templates
```

Native-device, public-deploy, and human native-speaker review are not proved by these static checks. Mark them `UNVERIFIED` unless they were freshly performed.
