# Canonical Orb Invariant

The state-of-mind orb visuals are frozen product canon.

## Rule

- Full-size mood/state-of-mind surfaces must render through `ValenceOrb`.
- Compact surfaces must render through `MiniValenceOrb`.
- Legacy wrappers may stay only if they delegate into `MiniValenceOrb`.
- The canonical renderer policy is WebGPU-first. Product orb surfaces that pass
  `renderer="webgpu"` must try WebGPU first and fall back only through the
  canonical WebGL renderer path.
- A WebGPU canvas (`data-orb-renderer-tier="webgpu-main"`), worker WebGL canvas
  (`data-orb-renderer-tier="webgl-worker"`), and async main-thread WebGL canvas
  (`data-orb-renderer-tier="webgl-main"`) are canonical. Synchronous main-thread
  shader compilation during first paint is not canonical because it stalls route
  boot.
- Canvas is only an explicit availability fallback for non-forced debug/auto
  paths. It must never be used as a first-paint, timeout recovery, or phone
  warmup substitute for a forced WebGPU/WebGL orb.
- Do not replace the orb with SVG icons, Lucide icons, CSS-only rings, static gradients, Lottie, canvas-first replicas, or a second mini-orb implementation.

## Protected Surfaces

- V2 orb page hero and refine orb.
- V1 state-of-mind modal.
- V1 home preview orb.
- V1 to V2 portal core.
- V2 to V1 sidebar/drawer portal mini-orbs.
- Diary empty state, diary cards, typing mirror, calendar, and memory portal mini-orbs.
- GitHub Pages, PWA, Android, iOS, phone layout, desktop layout, sidebar, and drawer must all use the same component tree.

## Enforcement

Run:

```bash
npm run check:canonical-orbs
```

This guard is wired into:

- `npm run check:visual`
- `npm run ci:preflight`
- `.husky/pre-commit`
- GitHub Pages deploy workflow
- V2 preview deploy workflow
- `src/components/state-of-mind/__tests__/canonicalOrbInvariant.test.ts`

If a future design task wants to change the orb look, it must be treated as a product-level visual-system migration, not a local component tweak.
