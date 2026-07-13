# Hyperfocus Nature Sounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for production changes and superpowers:verification-before-completion before final claims. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make V2 Hyperfocus use a nature-first ambient sound catalog with clear labels, free bundled sources, and verification for audio/runtime/i18n risk.

**Architecture:** Keep the current Hyperfocus audio architecture: `HyperfocusSoundSelector` reads `HYPERFOCUS_AUDIO_FAMILIES`, `useHyperfocusAudio` normalizes selected ids, and `AmbientSoundGenerator` plays bundled files through the existing mute/volume-safe audio layer. The change should be catalog/metadata/UI-copy level, not an audio runtime rewrite.

**Tech Stack:** React 18, TypeScript, Vitest/Testing Library, local MP3 assets under `public/sounds`, custom i18n.

---

### Task 1: Red Test The Nature Catalog Contract

**Files:**
- Modify: `src/lib/__tests__/hyperfocusAudioCatalog.test.ts`
- Modify: `src/components/hyperfocus/__tests__/HyperfocusSoundSelector.test.tsx`

- [ ] **Step 1: Add failing catalog assertions**

```ts
expect(HYPERFOCUS_AUDIO_FAMILIES.map((family) => family.id)).toEqual([
  "underwater",
  "thunderstorm",
  "ocean",
  "river",
  "forest",
  "fireplace",
]);
```

- [ ] **Step 2: Add failing selector assertion**

```tsx
expect(screen.getByRole("button", { name: "Underwater" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Thunderstorm" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Ocean" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "River" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Forest" })).toBeInTheDocument();
expect(screen.queryByRole("button", { name: /coffee|cafe/i })).toBeNull();
```

- [ ] **Step 3: Run red test**

Run: `npm run test -- src/lib/__tests__/hyperfocusAudioCatalog.test.ts src/components/hyperfocus/__tests__/HyperfocusSoundSelector.test.tsx --runInBand`

Expected: FAIL because current code still has `cafe` and generic/duplicate label keys.

### Task 2: Implement Catalog And Selector

**Files:**
- Modify: `src/lib/hyperfocusAudioCatalog.ts`
- Modify: `src/components/hyperfocus/HyperfocusSoundSelector.tsx`
- Modify: `src/lib/ambientSounds.ts`

- [ ] **Step 1: Replace visible `cafe` family with `forest`**

Use family ids `underwater`, `thunderstorm`, `ocean`, `river`, `forest`, `fireplace`; keep legacy alias support for `cafe` where needed so stale ids do not crash.

- [ ] **Step 2: Make selector labels come from the catalog**

Use `family.labelKey` for each button, with fallback to `sound?.nameEn` or `family.id`.

- [ ] **Step 3: Keep runtime behavior unchanged**

Continue using `useHyperfocusAudio`, `AmbientSoundGenerator`, `preloadAmbientSounds`, mute/volume gating, user gesture playback, and bundled MP3 files.

### Task 3: Update I18n And Metadata

**Files:**
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/languages/en.ts`
- Modify: `src/i18n/languages/uk.ts`
- Modify: `src/i18n/languages/es.ts`
- Modify: `src/i18n/languages/de.ts`
- Modify: `src/i18n/languages/fr.ts`
- Modify: `src/i18n/languages/ja.ts`
- Modify: `src/i18n/languages/ar.ts`
- Modify: `src/i18n/languages/he.ts`
- Modify: `src/lib/hyperfocusGeneratedAudioManifest.ts`
- Modify: `docs/audio/hyperfocus-nature-soundscape-spec.json`

- [ ] **Step 1: Add family label keys**

Add `hyperfocusSoundUnderwater`, `hyperfocusSoundThunderstorm`, `hyperfocusSoundRiver`, and `hyperfocusSoundForest` to all languages and the shared type.

- [ ] **Step 2: Update forest variant metadata**

Point `forest:soft`, `forest:deep`, and `forest:intense` to bundled free-source nature files and preserve `sha256`, `bytes`, source, and generation/source metadata.

- [ ] **Step 3: Update docs**

Record the best-practice decision: real/free bundled nature recordings first, generated pilots quarantined until they pass QC, no social-noise cafe in the nature set.

### Task 4: Verify

**Files:**
- Test: `src/lib/__tests__/hyperfocusAudioCatalog.test.ts`
- Test: `src/components/hyperfocus/__tests__/HyperfocusSoundSelector.test.tsx`
- Test: `src/lib/__tests__/ambientSounds.test.ts`

- [ ] **Step 1: Run focused tests**

Run: `npm run test -- src/lib/__tests__/hyperfocusAudioCatalog.test.ts src/components/hyperfocus/__tests__/HyperfocusSoundSelector.test.tsx src/lib/__tests__/ambientSounds.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 2: Run i18n/types checks**

Run: `npm run check:i18n`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS or report exact blockers.

- [ ] **Step 3: Run audio metadata/QC checks**

Run available local audio probes against `public/sounds/hyperfocus/*.mp3` for missing files, bytes/hash drift, duration, and obviously broken assets.

- [ ] **Step 4: Security fallback**

If Snyk MCP is unavailable, run the local Snyk CLI fallback or mark auth/network/tooling blockers as `UNVERIFIED`.

### Task 5: Done Packet

**Files:**
- No production edits.

- [ ] **Step 1: Summarize changed files**

Report catalog/UI/i18n/docs/audio asset changes.

- [ ] **Step 2: State verification status**

Include PASS/UNVERIFIED rows for focused tests, i18n, typecheck, audio QC, security, browser/native/public deploy, and subjective listening.

- [ ] **Step 3: Include implied-work ledger**

Add the required line starting `Дополнительно по подразумеваемому:`.
