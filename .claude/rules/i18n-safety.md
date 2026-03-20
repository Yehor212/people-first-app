---
description: i18n safety rules — applies to src/i18n/**
---

# i18n Rules (Law 17: Babel Law)

- 8 languages: en, uk, es, de, fr, ja, ar, he
- ALL keys must exist in ALL 8 languages — run `npm run i18n:check` after changes
- Never use raw strings in UI components — always use translation keys
- Key naming: `section.subsection.descriptor` (dot notation)
- RTL layout considerations for Arabic (ar) and Hebrew (he)
- Translation file: `src/i18n/translations.ts` — single source of truth
- Pluralization and interpolation: follow existing patterns in the file
