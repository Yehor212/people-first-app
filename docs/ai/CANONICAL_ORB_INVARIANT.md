# Canonical Orb Invariant

The state-of-mind orb visuals are frozen product canon.

## Rule

- Full-size mood/state-of-mind surfaces must render through `ValenceOrb`.
- Compact surfaces must render through `MiniValenceOrb`.
- Legacy wrappers may stay only if they delegate into `MiniValenceOrb`.
- The canonical renderer policy is WebGL-first. Canvas is only an availability fallback, not a replacement visual system.
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
