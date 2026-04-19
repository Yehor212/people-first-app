# Bundle Optimization — Deep Analysis (2026-04-18)

**Scope:** zero visual regression. Functional/network/loading changes are allowed; pixels, colors, layouts, animations, translation strings must remain identical.
**Baseline:** `dist/` 6.3 MB across 108 assets. Main chunk `index-DBaiusHk.js` = 1.1 MB. CSS bundle = 372 KB. 8 language chunks already split. No Brotli/gzip plugin. No legacy polyfills (good). Sourcemaps off in prod (good). ESNext + esbuild minify.
**TDZ constraint (see `memory/feedback_vite_tdz_manualchunks.md`, commit 0368e0b):** never put React-dependent libs in `manualChunks` — browser parallel init order is non-deterministic, causes `Cannot access 'V' before initialization`. Applies to: react, react-dom, @radix-ui, framer-motion, @tanstack, sonner, vaul, cmdk, lottie-react, recharts, react-hook-form.

---

## Executive summary — top wins ranked by (savings ÷ risk)

| # | Change | Est. gz saved on critical path | Risk | Effort | Visual regression? |
|---|---|---|---|---|---|
| 1 | Brotli-11 precompression via `vite-plugin-compression2`, serve from Capacitor assets | ~20% of **every** JS/CSS byte over network (~500 KB) | L | S | No |
| 2 | Sentry: `lazyLoadIntegration('replayIntegration')` + `__SENTRY_DEBUG__=false` define | −120–150 KB critical path | L | S | No |
| 3 | Dynamic import of jsPDF (used only in Export) | −290 KB off initial | L | S | No |
| 4 | Dynamic import of recharts (Stats page only) — already in StatsPage chunk, verify lazy | verify −100–370 KB off initial | L | S | No |
| 5 | `build.target: 'es2022'` + `modulePreload.polyfill: false` | ~3–8% JS (~60–150 KB) | L | S | No |
| 6 | lottie-web → `@lottiefiles/dotlottie-react` (WASM lazy) | −190 KB | L | M | No (animation parity required) |
| 7 | `lucide-react/dynamicIconImports` per-icon lazy | −30–80 KB | L | S | No |
| 8 | `framer-motion` → `LazyMotion + domAnimation` (keep same pkg) | −20–40 KB | L | S | No |
| 9 | LightningCSS minifier (`css.transformer: 'lightningcss'`) | ~3–5% CSS (~12–18 KB) + faster build | L | S | No |
| 10 | Native `CompressionStream` → drop `pako` | −45 KB | L (Capacitor WebView ≥ Chrome 80/Safari 16.4) | S | No |
| 11 | i18n dynamic load (already chunked — verify only active lang loaded on boot) | −350 KB off boot (7 × ~50 KB gz) | L | S | No |
| 12 | `build.rollupOptions.output.experimentalMinChunkSize: 20000` | −2–5% (dedup small-chunk overhead) | L | S | No |
| 13 | `esbuild.legalComments: 'none'` (keep `THIRD_PARTY.txt`) | −0.5–2 KB | L | S | No |
| 14 | `build.sourcemap: 'hidden'` + `@sentry/vite-plugin` upload | 0 runtime, eliminates accidental map ship | L | S | No |
| 15 | Font subsetting (if self-hosted) | 200 KB → 30 KB per weight | L | M | No (glyph coverage must match) |
| 16 | `npm ls react` dedupe check | avoids silent double-React (~45 KB) | L | S | No |
| 17 | Dead i18n key removal (`i18next-parser --fail-on-missing`) | ~5–15 KB × 8 langs | L | S | No |
| 18 | Tree-shake `date-fns` / `dayjs` locales | ~10–30 KB | L | S | No |
| 19 | `@tanstack/react-query` devtools must be dev-only (verify) | verify ~30 KB if leaked | L | S | No |
| 20 | DOMPurify Trusted Types fast-path on Android | −20 KB Android only | M | M | No |

**Sum of L-risk wins: ~1.0–1.4 MB reduction on initial critical path (≈50–65% boot improvement).**

---

## 1. What's already good (do NOT touch)

- `lottie-web` aliased to `lottie_light.js` ✓
- `html2canvas` aliased to `noop.ts` (−202 KB) ✓
- Sentry initialized via `requestIdleCallback` defer ✓
- CloudSync lazy on app pause ✓
- Per-language chunks already split via Vite's automatic chunking ✓
- PWA precache excludes inactive languages + jspdf + chart definitions ✓
- TDZ-aware `manualChunks` (post-0368e0b) ✓
- No `@vitejs/plugin-legacy` (correct for Capacitor) ✓
- Source maps off in prod ✓
- No `import * as` tree-shake killers ✓
- Tailwind `content` paths correct ✓

---

## 2. Opportunities — detail, evidence, risk

### 2.1 Brotli-11 precompression (W1)

**Change:** add `vite-plugin-compression2` → emit `.br` for JS/CSS >1 KB.
For Android: files live under `android/app/src/main/assets/public/`. Android WebView serves from `file://` — no HTTP layer, so we need `CapacitorWebView`'s asset loader or a custom plugin to return `Content-Encoding: br`. iOS WKWebView via `WKURLSchemeHandler` similarly needs an interceptor.
**Alternative (simpler, same win):** keep `.br` alongside `.js` and decompress at runtime using `DecompressionStream('br')` — but Chromium only supports `br` decompression from ~Chrome 114. Safari 16.4+ has it. Fallback = gz (`DecompressionStream('gzip')` is universal).
**Evidence:** HTTP Archive 2024 median br-11 ÷ gz-9 = 0.78 on minified JS. Our dist JS = ~2.2 MB raw → ~550 KB saved on wire vs gz, ~800 KB saved vs uncompressed.
**Visual regression?** No — same bytes after decompression.
**Rollback:** remove plugin.

### 2.2 Sentry trim (W2)

Currently Sentry bundle is ~260 KB (treemap). Replay alone is ~180 KB of that.
```ts
// src/sentry/init.ts — replace direct replayIntegration()
Sentry.init({
  // ...
  integrations: [Sentry.browserTracingIntegration()],
});
Sentry.addIntegration(await Sentry.lazyLoadIntegration('replayIntegration'));
```
Plus in `vite.config.ts`:
```ts
define: {
  __SENTRY_DEBUG__: false,
  __SENTRY_TRACING__: 'true', // keep, we use it
  __RRWEB_EXCLUDE_IFRAME__: true,
  __RRWEB_EXCLUDE_SHADOW_DOM__: true,
}
```
**Evidence:** docs.sentry.io/platforms/javascript/session-replay/lazy-loading; tree-shaking guide.
**Visual regression?** None — replay is background telemetry, no UI.
**Rollback:** revert to direct integration import.

### 2.3 jsPDF dynamic (W3)

**Audit finding:** 384 KB chunk exists but if `import jsPDF from 'jspdf'` is static anywhere in a file loaded at boot, the chunk becomes a preload candidate. Convert export handler to:
```ts
const exportPdf = async () => {
  const { jsPDF } = await import('jspdf');
  // ...
};
```
**Visual regression?** User sees brief spinner on first Export click; Export UI unchanged.
**Rollback:** restore static import.

### 2.4 recharts verify (W4)

`chartTokens` chunk (372 KB) and recharts appear in treemap inside `StatsPage-BuSxhuE0.js`. If StatsPage is already `React.lazy`, this is fine. **Action:** verify `src/App.tsx` or `Index.tsx` — if `import StatsPage from ...` is static, convert to `lazy(() => import('./pages/StatsPage'))`.
**Visual regression?** Stats page shows skeleton briefly on first open; add Suspense fallback that matches final layout (header + empty chart grid) to avoid CLS.
**Rollback:** static import.

### 2.5 Modern target (W5)

```ts
// vite.config.ts
build: { target: 'es2022' }
```
Android WebView ≥ Chrome 100 and iOS WKWebView ≥ 15.4 both support ES2022. Capacitor 8 minimum Android is API 23+ (Chrome 114 WebView), iOS 14+. Safe.
**Visual regression?** None — just skip downleveling of `async/await`, optional chaining, class fields.
**Rollback:** target: 'es2020'.

Also add:
```ts
build: {
  modulePreload: { polyfill: false },
  rollupOptions: {
    output: { experimentalMinChunkSize: 20_000 }
  }
}
```

### 2.6 Lottie (W6)

Even with `lottie_light.js` alias, full path is ~250 KB. `@lottiefiles/dotlottie-react` uses WASM (~60 KB lazy). **Only worth it if animation parity verified** — some advanced features differ (expressions, audio layers). For our onboarding / celebration loops, simple feature set → should work.
**Visual regression?** HIGH risk of per-frame pixel differences. **Requires Playwright screenshot comparison before/after on every Lottie usage site.** Defer to Phase 2.

### 2.7 Lucide dynamic (W7)

```ts
import { dynamicIconImports } from 'lucide-react';
const Icon = lazy(dynamicIconImports[iconName]);
```
Works when icon names are data-driven. For static icons (most of our UI) the current tree-shake is already fine — only convert for `<IconMap>`-style components where icon is runtime-chosen.
**Visual regression?** Brief icon flicker on first render. Add fallback of empty 24×24 box.
**Rollback:** direct named imports.

### 2.8 framer-motion `LazyMotion` (W8)

Wrap app in `<LazyMotion features={domAnimation} strict>` and use `<m.div>` instead of `<motion.div>`. The `features={domAnimation}` bundle is lazy-loaded. Saves ~20–40 KB.
**Visual regression?** Strict mode throws if any `motion.*` component slips through — CI catch, not runtime visual.
**Rollback:** remove LazyMotion, revert `m.` → `motion.`.

### 2.9 LightningCSS (W9)

```ts
css: { transformer: 'lightningcss' },
build: { cssMinify: 'lightningcss' }
```
2–3× faster build, 3–5% smaller CSS. **One known difference:** lightningcss normalizes some vendor prefixes more aggressively than esbuild — test `-webkit-backdrop-filter` (our blur rule Law) survives.
**Visual regression?** Low but must verify blur fallbacks. Run Playwright on modal screenshots.
**Rollback:** remove transformer option.

### 2.10 pako → CompressionStream (W10)

Audit if `pako` is used directly or only via jsPDF. If direct (e.g., for IndexedDB compression): replace with:
```ts
const compressed = await new Response(
  new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'))
).arrayBuffer();
```
**Visual regression?** None (backend code).
**Rollback:** revert to pako.

### 2.11 i18n verification (W11)

**Action:** check that `import('./languages/${lang}.ts')` is truly dynamic. Treemap shows separate chunks ✓, but need to verify main `index` chunk doesn't statically import all 8 via a registry.
**Check:**
```bash
grep -rn "from './languages/" src/i18n/
```
If any static import of multiple langs → refactor to `import(\`./languages/\${lang}.ts\`)`.
**Visual regression?** Brief "Loading…" on first language switch. Use existing translation of "Loading" from a tiny always-loaded bootstrap bundle.
**Rollback:** static imports.

### 2.12–2.14 Low-hanging config flags

All are `vite.config.ts` one-liners. See table.

### 2.15 Font subsetting (W15)

Only if self-hosting fonts. If using system-ui → skip.
`pyftsubset font.woff2 --unicodes="U+0000-00FF,U+0400-04FF,U+0590-05FF,U+0600-06FF,U+3040-309F,U+30A0-30FF,U+4E00-9FFF"` covers all 8 languages (Latin+Cyrillic+Hebrew+Arabic+Hiragana+Katakana+common CJK).
**Visual regression?** If subset misses a glyph → `.notdef` square. **Must test all 8 languages' text.**
**Rollback:** use full font.

### 2.16 `npm ls react` dedupe (W16)

```bash
npm ls react react-dom
```
Expect single version. If Radix brings a duplicate minor → `"overrides": { "react": "$react" }` in package.json.
**Visual regression?** None — fixes hooks-mismatch bugs.
**Rollback:** remove override.

### 2.17 Dead i18n keys (W17)

```bash
npx i18next-parser --config i18next-parser.config.js --fail-on-warnings
```
List keys in `translations.ts` not used anywhere in `src/**/*.tsx`.
**Visual regression?** None (they're unused).
**Rollback:** keep keys.

### 2.18 date-fns / dayjs locales (W18)

Grep: `grep -rn "from 'date-fns/locale" src/` — ensure only needed locales imported. `dayjs`: check if `dayjs/locale/*` is bundled.
**Visual regression?** None if same locales kept.

### 2.19 @tanstack devtools (W19)

```bash
grep -rn "ReactQueryDevtools" src/
```
Must be wrapped in `import.meta.env.DEV` guard. Verify.
**Visual regression?** None (invisible in prod).

### 2.20 Trusted Types on Android (W20)

Conditional:
```ts
if ('trustedTypes' in window && Capacitor.getPlatform() === 'android') {
  // use Trusted Types policy
} else {
  // fall back to DOMPurify
}
```
Saves 20 KB on Android only. Medium effort — defer.

---

## 3. Things the user did NOT mention but SHOULD act on

1. **`@sentry/vite-plugin` source-map upload** — currently no sourcemaps in prod means Sentry errors are unreadable minified. Add `sourcemap: 'hidden'` + plugin. Zero bundle cost.
2. **CI bundle-size ratchet** — Law 27 (Ratchet) applies to bundle too. Add `size-limit` or `bundlesize2` GitHub Action with per-chunk thresholds. One regression = PR fail.
3. **Lighthouse CI mobile preset on APK** — emulator run via `@capacitor/assets`. Not bundle-size directly but catches perf regressions invisible to bundler.
4. **Service worker cache invalidation on schema bump** — Dexie upgrades can collide with stale SW cached HTML. Verify `skipWaiting` + `clientsClaim` + version bump strategy.
5. **PWA precache size cap** — current PWA precaches main + fonts; if it balloons past 4 MB, Safari PWA install fails silently. Add cap.
6. **`Cache-Control: immutable` for hashed assets** — Capacitor assets should have long cache. Check WebView asset loader.
7. **`prefers-reduced-data`** (new media query) — conditionally skip Lottie on data-saver users.
8. **Eliminate `dompurify` on trusted content paths** — not every sanitization site needs full DOMPurify; some could use DOM textContent.
9. **Remove `pako` if no direct users** — see W10.
10. **Check for duplicate Sentry copies** — `@sentry/browser` + `@sentry/react` + `@sentry/core` often duplicate internals.
11. **Tailwind `content` includes only source files** — not `dist/**` or `node_modules/**` (catches CSS bloat).
12. **`prefers-reduced-motion`** compliance already required by Law 9 — but check LazyMotion respects it (yes, `reducedMotion: 'user'` config).
13. **Tree-shake `@radix-ui/*`** — import only used primitives per package, never `import * as Radix`.
14. **Zod schema dedup** — if same schema defined in two modules, both bundled. Consolidate in `src/schemas/`.
15. **Service worker: precache manifest hash** — if `workbox` emits hash-in-filename + hash-in-manifest, double-hashing happens. Verify.
16. **`build.reportCompressedSize: false`** — speeds up CI by ~15s (cosmetic only but matters for DX).

---

## 4. Phased execution plan (no visual regression)

**Phase 1 — Config flags only (1 hour, zero code change outside vite.config.ts):**
W5, W9, W12, W13, W14, W19(verify). Expected: −10–15% bundle, zero UI risk.
Gate: CI green + Playwright baseline diff = 0 pixels.

**Phase 2 — Network/compression (2 hours):**
W1, W6.11(verify i18n), W16, W17, W18. Expected: −20% transfer size.
Gate: boot-time Lighthouse score on APK ≥ baseline.

**Phase 3 — Lazy boundaries (1 day):**
W2 (Sentry lazy), W3 (jsPDF dynamic), W4 (recharts verify), W7 (Lucide dynamic for map icons only), W8 (LazyMotion). Expected: −500 KB off critical path.
Gate: per-route Playwright screenshot diff = 0; Suspense fallbacks measured for CLS < 0.01.

**Phase 4 — Dependency swaps (multi-day, HIGH verification):**
W6 (dotlottie), W10 (CompressionStream), W15 (font subset), W20 (TT on Android). Expected: −200 KB further.
Gate: full Playwright suite + manual review of every Lottie/font site on all 8 languages.

**Phase 5 — CI enforcement (permanent):**
`size-limit` + `bundlesize2` + Lighthouse CI. Ratchet Law 27 integration.

---

## 5. Measurement protocol (evidence-only, per Empiricism Rule)

Before each phase:
```bash
npm run build && du -sh dist/assets/*.js | sort -rh | head -20 > .bundle-baseline.txt
npx vite-bundle-visualizer
```
After each change:
```bash
npm run build && du -sh dist/assets/*.js | sort -rh | head -20 > .bundle-after.txt
diff .bundle-baseline.txt .bundle-after.txt
```
Record numbers in commit message. No "feels faster" — bytes or it didn't happen.

---

## 6. Out of scope / defer

- **Rolldown migration** (voidzero.dev May 2025) — still alpha; bundle size unchanged; wait for Vite 8.
- **Module federation** — not applicable, single-origin Capacitor app.
- **Server-side rendering** — N/A.
- **Critical CSS inlining** — Capacitor ships offline, minimal first-paint benefit.
- **Removing framer-motion entirely** — massive rewrite, visual animation fidelity risk.

---

## 7. Visual regression verification contract (all phases)

1. Playwright baseline per route (desktop 1280×720 + mobile 375×812) × 8 languages × light/dark theme = matrix.
2. Pixel diff threshold = 0 (not 0.1%).
3. Animation baselines via video diff, not single-frame.
4. Law 10: iOS + Android + desktop emulator runs equal.
5. FPS recorded during orb + journal interactions (Law 8, 60 FPS floor).

If ANY phase fails the contract → rollback that phase's commits, document in `05-Incidents-Debugging/` per ZenFlow Obsidian vault convention.

---

**Status:** analysis complete. No code changed. Awaiting user approval to begin Phase 1 (config flags only, zero visual risk).
