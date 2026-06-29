# Hyperfocus Nature Pack QC - 2026-06-29

## Decision

Replace the visible V2 Hyperfocus cafe/social-noise family with a forest nature family.

Reason: the user asked specifically for nature sounds for Hyperfocus V2. Cafe ambience can help some users, but it is a human/social environment, can contain semantic distraction risk, and does not belong in the nature-first set. The old `cafe` id is retained only as a legacy alias to `forest` so stale selections fail gently.

## Best-Practice Basis

- Nature soundscapes are supported by restorative-environment research as candidates for stress/fatigue recovery and attention restoration: https://pmc.ncbi.nlm.nih.gov/articles/PMC8107214/
- The selected assets come from Mixkit free sound effects, whose SFX license page states free use for commercial and non-commercial projects: https://mixkit.co/license/
- Hyperfocus ambience must be user-started, not autoplayed; MDN documents autoplay blocking and the poor UX risk of unexpected audio: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
- MP3 remains the safest single-format choice for this app's current bundled web/PWA/native path because MDN lists it as supported by all major browsers: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs

## Source Selection

| Variant | File | Source | Duration | Bytes | SHA-256 |
| --- | --- | --- | ---: | ---: | --- |
| forest:soft | `public/sounds/hyperfocus/hyperfocus-forest-soft.mp3` | Mixkit item 1237, Wind in the forest | 25.36s | 788018 | `cf237d761f1b2f8977c19a384bda28163f7ef00b0ecabceb91a96a2c132b2528` |
| forest:deep | `public/sounds/hyperfocus/hyperfocus-forest-deep.mp3` | Mixkit item 1210, Forest birds ambience | 151.59s | 4716152 | `47ab079aac704576d45d252c416de1da31dd016b69b5b9a2eaaa720efb6c2411` |
| forest:intense | `public/sounds/hyperfocus/hyperfocus-forest-intense.mp3` | Mixkit item 1224, Forest at night | 47.07s | 1437810 | `5aa9d78e18efdb8589ae7257f20dc966df89cf5a8e47a0cea6f498583f05af46` |

## Implementation Notes

- Visible V2 family order is now: underwater, thunderstorm, ocean, river, forest, fireplace.
- Selector labels now come from `HYPERFOCUS_AUDIO_FAMILIES[*].labelKey`, preventing duplicate Ocean/Forest labels from hard-coded UI metadata.
- `cafe` and `cafe:<level>` normalize to `forest:deep` and `forest:<level>` respectively.
- The original top-level `focus-cafe` app audio asset remains registered as a legacy app-owned asset, but V2 Hyperfocus no longer shows it.

## QC Status

| Check | Status | Evidence |
| --- | --- | --- |
| Free/source trace | PASS | Mixkit source URLs and item ids recorded in manifest and this QC note. |
| Bundled local files | PASS | Files are under `public/sounds/hyperfocus/`; no runtime external audio URL is needed. |
| MP3 readability | PASS | `afinfo` reads all three files at 2ch/44100Hz MP3. |
| No autoplay/runtime rewrite | PASS | Existing `useHyperfocusAudio` and `AmbientSoundGenerator` remain responsible for user gesture, mute, and volume gating. |
| Objective duration | PASS | New files are 25.36s, 47.07s, and 151.59s, inside the updated real-source policy range. |
| Manifest integrity | PASS | `HYPERFOCUS_GENERATED_AUDIO_MANIFEST` SHA-256 and byte counts match all 18 bundled files. |
| Runtime selector tests | PASS | `npm run test -- src/lib/__tests__/hyperfocusAudioCatalog.test.ts src/components/hyperfocus/__tests__/HyperfocusSoundSelector.test.tsx src/components/hyperfocus/__tests__/useHyperfocusAudio.test.tsx src/lib/__tests__/ambientSounds.test.ts src/lib/__tests__/appAudioAssets.test.ts src/lib/__tests__/hyperfocusAudioCatalog.generatedManifest.test.ts src/lib/__tests__/hyperfocusAudioProgression.test.ts` passed 7 files / 52 tests. |
| Audio tooling contract | PASS | `npm run test -- scripts/__tests__/check-hyperfocus-audio-assets.test.ts` passed 78 tests; `node scripts/check-hyperfocus-nature-soundscape-contract.cjs` passed 6 families / 18 variants. |
| Localization and typing | PASS | `npm run i18n:check`, `npm run i18n:deep`, and `npm run typecheck` passed. |
| Lint/build/security fallback | PASS | `npm run lint`, `npm run build`, `npm audit --audit-level=high`, `snyk code test src`, and `snyk code test scripts` passed. |
| Source/dist cafe removal | PASS | `find public/sounds/hyperfocus dist/sounds/hyperfocus -name '*cafe*'` returned no files; `rg "hyperfocus-cafe"` returned no source/dist audio references. |
| Subjective listening fatigue | UNVERIFIED | Agent cannot perform reliable human auditory review; needs human listen-through at low volume for harsh birds, loop seams, or fatigue after several minutes. |
| Native device playback | UNVERIFIED | No Android/iOS device playback was run in this pass. |
