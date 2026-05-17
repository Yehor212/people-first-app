# Third-Party Notices

ZenFlow incorporates the following third-party software, assets, and content. This file aggregates their notices for legal and licensing compliance, per the attribution clauses of MIT / ISC / Apache-2.0 / SIL-OFL-1.1 / BSD licenses and per MixKit's free-use terms.

Automated verification: `npx license-checker --production --summary` (run on every CI).

---

## Audio Assets

### MixKit — Free Sound Effects
Location: `public/sounds/`

The following WAV files are provided by MixKit under the [MixKit Sound Effects Free License](https://mixkit.co/license/#sfxFree). Attribution is required in the app.

| File | MixKit ID | Title |
| --- | --- | --- |
| `mixkit-small-waves-harbor-rocks-1208.wav` | 1208 | Small waves harbor rocks |
| `mixkit-magical-winter-surprise-2135.wav` | 2135 | Magical winter surprise |
| `mixkit-thunderstorm-in-the-jungle-2415.wav` | 2415 | Thunderstorm in the jungle |
| `mixkit-wildlife-environment-in-a-river-2456.wav` | 2456 | Wildlife environment in a river |

> Sound effects obtained from [https://mixkit.co](https://mixkit.co).

In-app attribution SHOULD appear in Settings → About → Acknowledgements (TODO: surface in UI for v2.0).

---

## Fonts

Location: `node_modules/@fontsource-variable/*`. Bundled via `vite-plugin-pwa` into the web build.

| Family | License | Copyright |
| --- | --- | --- |
| Caveat | SIL Open Font License 1.1 | Copyright 2014 The Caveat Project Authors |
| Fraunces | SIL Open Font License 1.1 | Copyright 2020 The Fraunces Project Authors |
| Inter | SIL Open Font License 1.1 | Copyright 2016 The Inter Project Authors |
| Literata | SIL Open Font License 1.1 | Copyright 2017 The Literata Project Authors |

Full license text: https://openfontlicense.org/open-font-license-official-text/

---

## Icons

**Lucide Icons** — https://lucide.dev

- License: ISC
- Copyright © 2022 Lucide Contributors
- Used via `lucide-react` npm package

> Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

---

## Runtime Dependencies (NPM, production)

Consolidated via `npx license-checker --production --json --out licenses.json` (run during release process).

Major dependencies (MIT/ISC/Apache-2.0/BSD unless noted):

- **React 18** (`react`, `react-dom`) — MIT — Copyright Meta Platforms, Inc.
- **Zustand** — MIT — Copyright Poimandres
- **Dexie** — Apache-2.0 — Copyright David Fahlander
- **@supabase/supabase-js** — MIT — Copyright Supabase
- **@tanstack/react-query, react-virtual** — MIT — Copyright TanStack
- **@radix-ui/react-\*** — MIT — Copyright WorkOS, Inc.
- **framer-motion** — MIT — Copyright Framer B.V.
- **Capacitor 8** (`@capacitor/*`) — MIT — Copyright Ionic Team
- **@sentry/react** — MIT — Copyright Functional Software, Inc.
- **Zod** — MIT — Copyright Colin McDonnell
- **DOMPurify** — Apache-2.0 / MPL-2.0 — Copyright Mario Heiderich
- **nanoid** — MIT — Copyright Andrey Sitnik
- **jsPDF** — MIT — Copyright James Hall
- **recharts** — MIT — Copyright Recharts Group
- **tailwindcss** — MIT — Copyright Tailwind Labs
- **tailwind-merge** — MIT — Copyright Dany Castillo
- **class-variance-authority** — Apache-2.0 — Copyright Joe Bell
- **clsx** — MIT — Copyright Luke Edwards
- **vaul** — MIT — Copyright Emil Kowalski
- **@tanstack/react-query** — MIT
- **cmdk** — MIT — Copyright Paco Coursey
- **@capgo/capacitor-social-login** — MIT — Copyright Capgo

Full machine-readable list: run `npx license-checker --production --json` in CI and commit as `docs/third-party-licenses.json` during release.

---

## Compliance Checklist

- [x] MixKit WAV files attributed (this file)
- [x] SIL OFL fonts attributed (this file)
- [x] Lucide ISC copyright preserved (this file)
- [ ] In-app "Acknowledgements" screen surfacing this document (iOS App Store requirement — TODO for v2.0)
- [ ] `LICENSE` file at repo root (proprietary or MIT — pending user decision; tech-debt P1-10)
- [ ] CI gate: `npx license-checker --failOn 'GPL;AGPL;SSPL'` to prevent copyleft creep
- [x] `SECURITY.md` published (responsible disclosure policy)

---

## Updating This File

When adding a new runtime dependency:

1. Run `npx license-checker --production --summary` locally
2. Identify the new package's license + copyright
3. Add an entry to the appropriate section
4. Commit in the same PR as the dependency addition

When removing: sweep this file and delete the stale attribution.

*Last updated: 2026-04-18 (tech-debt audit + deep-scan extension)*
