# ADR-0004: Custom i18n implementation over i18next / react-intl

- **Status:** Accepted (retroactive — built over 2025-Q4 / 2026-Q1)
- **Date:** 2026-04-18 (retroactively recorded)
- **Deciders:** Team Lead + frontend-builder
- **Tags:** i18n, bundle-size, mobile, infrastructure

## Context

ZenFlow supports 8 languages: English, Ukrainian, Spanish, German, French, Japanese, Arabic, Hebrew (2 RTL). Translation tables are large — ~2,500 keys × 8 languages = ~2,800 LOC per language file (`src/i18n/languages/{code}.ts`).

Constraints:

1. **Bundle size on 3G is load-bearing.** Each translation file is ~75-90 KB gzip; shipping all 8 in the initial bundle adds ~700 KB gzip — catastrophic for mobile launch.
2. **Type-safety is non-negotiable.** We rely on `t.errorBoundaryTitle` autocomplete and compile-time errors when a key is removed. This is enforced by Law 17 (Babel) and `npm run i18n:check`.
3. **Offline-first.** Once a language is loaded, it must survive reloads, works without network.
4. **RTL support.** Arabic + Hebrew require directional CSS + BiDi handling — must not require a separate library.
5. **Zero runtime dependencies** for translation fetch. No `fetch('/locales/uk.json')` calls — all translations must compile to TS and be bundled as lazy chunks.

## Decision

We ship a ~50-line custom `src/i18n/index.ts` with:

- `translations: Record<string, Translations>` — mutable cache, seeded with English on boot.
- `languageLoaders: Record<string, () => Promise<...>>` — `() => import("./languages/uk")` per non-English language, each a separate Vite chunk.
- `loadLanguage(code)` — async loader with cache check + English fallback on error.
- Strict TypeScript `Translations` interface — all keys typed; missing/extra keys fail `tsc`.
- Context provider (`LanguageContext`) — React side, hydrates persisted choice from IndexedDB.

Per-language chunks are code-split by Vite's dynamic import. English ships in the main chunk (~85 KB gzip), each other language is a lazy chunk loaded on first use.

`scripts/check-i18n.ts` (run in CI) enforces: every key in every language; no orphaned keys in non-English files; plural/interpolation consistency.

## Alternatives Considered

- **`i18next + react-i18next`** — rejected:
  - +45 KB gzip runtime overhead (i18next core + react binding + ICU plural plugin).
  - JSON translation files lose TS autocomplete + compile-time key validation.
  - Namespacing + plural pluralization APIs are overkill for our needs.
  - Dynamic backend loading adds network round-trip on each language switch.

- **`react-intl` (FormatJS)** — rejected:
  - Designed around ICU message syntax; heavier than our needs (we don't use Select/Plural/DateFormat heavily).
  - +30 KB gzip runtime.
  - Static key extraction tooling (`babel-plugin-formatjs`) conflicts with our Vite setup.

- **`next-intl` / `@lingui/core`** — rejected:
  - `next-intl` is Next.js-specific (we use Vite).
  - `@lingui` has a good DX but adds a compilation step and ~20 KB runtime.

- **Ship all languages in main bundle** — rejected: ~700 KB gzip blows our 1560 KB budget on first byte alone.

- **Remote-hosted JSON + cache** — rejected: adds a network dependency for a core UX path; breaks offline-first.

## Consequences

**Positive:**
- Zero runtime dependency — `import { en } from "./languages/en"` is literally an object in the main chunk.
- Full TS type-safety — `Translations` interface in `src/i18n/types.ts` is the single source of truth (2,866 LOC).
- Lazy-loaded languages = main bundle stays lean.
- Custom plural/interpolation rules can be added incrementally in `t()` helper if needed.
- `check-i18n.ts` catches all 8-language drift in CI.

**Negative:**
- No built-in ICU MessageFormat. If future requirements need `{count, plural, one {# item} other {# items}}` we either extend manually or migrate.
- Feature gap vs i18next: no interpolation escaping by default, no namespace hierarchy, no context-based translation.
- `src/i18n/types.ts` is 2,866 LOC — hand-edited, high-churn file, reviewer fatigue. Potential pain point if we add many more keys.
- Custom code = custom bugs. If `loadLanguage` fails silently, user sees English instead of their language — no telemetry on translation failures today.

**Neutral:**
- Fontsource fonts (Caveat, Fraunces, Inter, Literata) are loaded separately via `@fontsource-variable/*`; not coupled to i18n.
- RTL (ar, he) handled by Tailwind's `rtl:` variant + `dir="rtl"` on `<html>`, not by i18n library.

## Rollout / Migration Plan

Already rolled out. No migration needed.

## Verification

- `npm run i18n:check` — all 8 languages have all keys.
- `npm run test -- test/i18n.test.ts` — round-trip tests.
- Bundle analyzer: each language chunk is separate (verified via manualChunks inspection).
- `src/i18n/types.ts` is committed and auto-compiles.

## References

- i18next bundle size analysis: https://bundlephobia.com/package/i18next (~45 KB gzip total)
- react-intl: https://bundlephobia.com/package/react-intl (~30 KB gzip)
- Vite code-splitting docs: https://vitejs.dev/guide/features.html#dynamic-import
- Internal: `docs/laws17-20.md` (Babel Law — all strings via `t()`)
- Internal: `src/i18n/index.ts`, `src/i18n/types.ts`, `scripts/check-i18n.ts`

## Future Work

- If we need ICU plural/select → evaluate migrating to `@formatjs/intl-messageformat` (standalone, 8 KB gzip) without the full `react-intl`.
- Add telemetry for `loadLanguage` failures (currently silent fallback to English).
- Consider splitting `src/i18n/types.ts` by section if LOC becomes a review burden.
