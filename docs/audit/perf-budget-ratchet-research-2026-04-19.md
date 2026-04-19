# Performance-Budget Ratchet CI Gate — Research Brief

Date: 2026-04-19
Scope: React 18 + Vite 6 + Capacitor 8 PWA (ZenFlow)
Purpose: Wire `scripts/bundle-report.cjs` into a CI ratchet gate aligned with Law 27.

---

## 1. 2024-2026 Budget Consensus

Google web.dev recommends JS <170 KB gzipped for 5s TTI on Moto G4 / Slow 3G, CSS <30 KB, fonts <100 KB. These are aspirational; offline-first PWAs with full IndexedDB/Dexie layers routinely exceed them. ZenFlow at ~1.5 MB gzipped JS is large but defensible for 8-language, 8-store, shader-driven PWA. Source: https://web.dev/articles/performance-budgets-101

## 2. Tooling Options

(a) **size-limit** (`@size-limit/preset-app`) — package.json config, CLI, CI plugin. Best for raw bundle ceilings + local parity. (b) **bundlewatch** — GitHub checks, per-PR diff. (c) **Lighthouse CI** — end-to-end audit incl. render timings, flaky on 3G throttling. For a hard gate, size-limit wins; LHCI for trend dashboards only. Sources: https://github.com/ai/size-limit , https://github.com/bundlewatch/bundlewatch , https://github.com/GoogleChrome/lighthouse-ci

## 3. Ratchet-Only Direction (Law 27)

Floor moves DOWN only. CI fails if bundle grows past `floor + tolerance`. Legitimate increases require explicit `--update` by maintainer. Existing `scripts/check-ratchet.ts` + `quality-ledger.json` already enforce this on `bundleSizeKB` (10% warn / 20% fail canary). Source: `scripts/check-ratchet.ts` (in repo).

## 4. Tolerance Budget

Per-metric 0.5–1% tolerance absorbs minification non-determinism (terser/rollup hash deltas). `quality-ledger.json` floors already schema-support this. Source: https://github.com/rollup/rollup/issues/3555

## 5. Metrics to Track (Each as Separate Floor)

(a) total JS gzipped, (b) total JS brotli, (c) largest single chunk (catches accidental `import *`), (d) CSS total, (e) total asset count. Source: https://web.dev/articles/optimize-long-tasks#resource-loading

## 6. Per-PR Diff Reporting

On PR: checkout `origin/main`, build, run `bundle-report`, compare, emit markdown comment with deltas. Use `actions/github-script` or `hasura/comment-progress`. Source: https://github.com/actions/github-script

## 7. Audio / Media Budget

Separate ceiling for `public/sounds/` (currently 64 MB → target ≤30 MB after Opus transcode). Locale-dependent, so absolute ceiling, not ratchet. Source: https://web.dev/articles/serve-responsive-audio

## 8. Pre-Compressed Sidecars

`vite-plugin-compression` emits `.gz` / `.br` during build. `bundle-report.cjs` should prefer sidecars (50–100× faster than on-the-fly compression on large dist). Verify vite.config.ts has plugin wired. Source: https://github.com/vbenjs/vite-plugin-compression

## 9. Anti-Patterns

(a) uncompressed-only gating (real transport is gzip/brotli), (b) single magic number (use percentile + tolerance), (c) gating totals instead of deltas (noisy), (d) non-production build in CI (different chunking). Source: https://web.dev/articles/performance-budgets-101

## 10. Recommended drift-checks.yml Wiring

Add matrix entry:

```yaml
- name: bundle-size
  cmd: node scripts/bundle-report.cjs --check
  fix: npm run bundle-report:update
  needs: [build]
```

Exit 2 on regression, 0 otherwise. Run after `vite build`.

## 11. size-limit Config vs Ratchet

Complementary: `.size-limit.json` = absolute architect ceiling (human-set, rarely moves). `quality-ledger.json` floor = relative last-observed + tolerance (moves down each run). First catches "bigger than policy allows"; second catches "grew 0.5% silently". Source: https://github.com/ai/size-limit#readme

## 12. Lighthouse CI Mobile Flakiness

LHCI on 3G/Moto G4 throttling is ±10% run-to-run on TTI/LCP. Require n≥3 runs with median. Exclude lab metrics from gate; keep for trend dashboard only. Source: https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/troubleshooting.md

---

## Implementation Sketch

### `.github/workflows/drift-checks.yml` diff

```yaml
jobs:
  drift:
    strategy:
      matrix:
        check:
          - { name: doc-counts,      cmd: "npm run doc-counts:check" }
          - { name: types-freshness, cmd: "npm run types:check" }
          - { name: retry-tests,     cmd: "npm run test:retry" }
          - { name: oss-licenses,    cmd: "npm run licenses:check" }
          - { name: a11y-icons,      cmd: "npm run a11y:icons" }
          # NEW:
          - { name: bundle-size,     cmd: "npm run build && node scripts/bundle-report.cjs --check" }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: ${{ matrix.check.cmd }}
```

### `bundle-report.cjs --check` contract

```text
1. Walk dist/, compute { jsGzipKB, jsBrotliKB, cssKB, largestChunkKB, assetCount }.
2. Read quality-ledger.json → floors.{bundleJsGzipKB, bundleJsBrotliKB, bundleCssKB, bundleLargestChunkKB, bundleAssetCount}.
3. For each metric: if observed > floor * (1 + tolerance) → print red diff, exit 2.
4. If observed < floor → print green diff, suggest `npm run bundle-report:update` to ratchet down.
5. Else → exit 0.
Tolerance: 0.01 (1%) per metric. Overridable via --tolerance flag.
```

### `npm run bundle-report:update` contract

Writes each observed value back into `quality-ledger.json` floors, respecting direction=DOWN: only updates if observed < current floor. Mirrors `scripts/check-ratchet.ts` update pattern.

---

## Citations Index

1. https://web.dev/articles/performance-budgets-101
2. https://github.com/ai/size-limit
3. https://github.com/bundlewatch/bundlewatch
4. https://github.com/GoogleChrome/lighthouse-ci
5. https://github.com/rollup/rollup/issues/3555
6. https://web.dev/articles/optimize-long-tasks
7. https://github.com/actions/github-script
8. https://web.dev/articles/serve-responsive-audio
9. https://github.com/vbenjs/vite-plugin-compression
10. https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/troubleshooting.md

Internal refs: `scripts/bundle-report.cjs`, `scripts/check-ratchet.ts`, `quality-ledger.json`, `.size-limit.json`, `.github/workflows/drift-checks.yml`, `docs/law27-ratchet.md`.
