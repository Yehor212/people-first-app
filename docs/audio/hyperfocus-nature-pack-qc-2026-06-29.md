# Hyperfocus Nature Pack QC - 2026-07-01

## Decision

Ship the visible V2 Hyperfocus nature set as: forest, rain, ocean, fireplace, river, wind.

Reason: the user asked for nature sounds for Hyperfocus V2. The prior cafe/social-noise path stays legacy-only as an alias to forest, and the retired underwater/thunderstorm ids are migration aliases only. Rain and wind were added as first-class families because they are calmer, more controllable focus beds than thunderstorm and underwater-style hum for the current nature-first pack.

## Best-Practice Basis

- Nature soundscapes are supported by restorative-environment research as candidates for stress/fatigue recovery and attention restoration: https://pmc.ncbi.nlm.nih.gov/articles/PMC8107214/
- Selected rain, wind, forest, ocean, and river assets come from Mixkit free sound effects; fireplace now comes from BigSoundBank Fireplace #4 as an indoor hearth source. License evidence is recorded at https://mixkit.co/license/ and https://bigsoundbank.com/licenses.html.
- Hyperfocus ambience remains user-started, not autoplayed; MDN documents autoplay blocking and UX risk from unexpected audio: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
- MP3 remains the safest single-format choice for the current bundled Web/PWA/native path because MDN lists it as supported by all major browsers: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs

## Source Selection

| Variant | File | Source | Duration | Bytes | SHA-256 |
| --- | --- | --- | ---: | ---: | --- |
| forest:soft | `hyperfocus-forest-soft.mp3` | Wind in the forest | 30.024s | 480384 | `4b40ea1e22d473eb4a2ada97236288a9d1ad0d63ea6ffb76be218800821a1b29` |
| forest:deep | `hyperfocus-forest-deep.mp3` | Forest birds ambience | 30.024s | 480384 | `78ec636955e6c983ee634c3488a9cf200dd427ae38464ed901121de26e2d8e04` |
| forest:intense | `hyperfocus-forest-intense.mp3` | Forest at night | 30.024s | 480384 | `646ef045aeb613f56ad10a6406d05f2c204f9501174c923301609bd00db9ef70` |
| rain:soft | `hyperfocus-rain-soft.mp3` | Light rain looping | 30.072s | 481152 | `e491344e4ec1e558bce5f29d4b438ac4e9f9a4c0fff1c72470ad607e01e1a52b` |
| rain:deep | `hyperfocus-rain-deep.mp3` | Long rain ambience | 30.072s | 481152 | `f746986b775588bbc5acd8964847c7fff911840f73b2590ab333af12ae469e38` |
| rain:intense | `hyperfocus-rain-intense.mp3` | Heavy rain ambience | 30.072s | 481152 | `73031e99a4c7fac3707718e6eaf56ce83a04156fe979845d8ff98399d5ed22a4` |
| ocean:soft | `hyperfocus-ocean-soft.mp3` | Small waves harbor rocks | 30.024s | 480384 | `2881fc8be99fc3b1263ae7e5816aeec82af663442ebe8957c083aa8f1d753c7d` |
| ocean:deep | `hyperfocus-ocean-deep.mp3` | Sea coast breaking waves | 30.024s | 480384 | `8c7c27ec1aa1ac2a82431dcb992d443d791ee965ae31f27b0583ae01e7c64825` |
| ocean:intense | `hyperfocus-ocean-intense.mp3` | Sea coast breaking waves + rough sea waves blend | 30.024s | 480384 | `caa38a9a6ca6c91b8d0dd9b0299094899554a455eb389413f17126f19c0f0194` |
| fireplace:soft | `hyperfocus-fireplace-soft.mp3` | BigSoundBank Fireplace #4 indoor embers | 30.024s | 480384 | `1d654a6ec53bb4ffd348c10439bf4446de4e8a0db39c5f900d7314a06857b81b` |
| fireplace:deep | `hyperfocus-fireplace-deep.mp3` | BigSoundBank Fireplace #4 indoor hearth | 30.024s | 480384 | `0f4db7ae0a8a62c76b64e92e6466ff8022b8c18b13055b8b9930d22fe27f03dc` |
| fireplace:intense | `hyperfocus-fireplace-intense.mp3` | BigSoundBank Fireplace #4 full indoor hearth | 30.024s | 480384 | `e64cbe03214200767cf849887cd4dfbe3c969ebc6dbc63b2d3c9f6e39df99359` |
| river:soft | `hyperfocus-river-soft.mp3` | River water flow and surroundings | 30.024s | 480384 | `05322454891235d1efb5b596dd99d566b1d40c1f112d54e19299f9aa9f1dfc61` |
| river:deep | `hyperfocus-river-deep.mp3` | Wildlife environment in a river | 30.024s | 480384 | `19d97166266afba6416c0cc52fda306e75480a16948bbf538dc3b7ec7fd20caa` |
| river:intense | `hyperfocus-river-intense.mp3` | Water flowing in the river | 30.024s | 480384 | `48f65e5fd91a503463eac6be257e798e8cb3c35d688acc9a634914519f902b96` |
| wind:soft | `hyperfocus-wind-soft.mp3` | Wind blowing ambience | 30.072s | 481152 | `178d9726fe2b0c5468fc14c8beb7e07b34773a82abf5d0f04a87ce591486d70f` |
| wind:deep | `hyperfocus-wind-deep.mp3` | Wind blowing ambience | 30.072s | 481152 | `1ec296327b7bc07a20b6772a2f26b4cc4a032251bf563c3dea6b9a1065ca6f64` |
| wind:intense | `hyperfocus-wind-intense.mp3` | Wind in the top of the mountain | 30.072s | 481152 | `2fb611a9bfe7564711c966872cfd813977c6383b3afc45b896ccfe555f2fefbc` |
## Implementation Notes

- Visible V2 family order is now: forest, rain, ocean, fireplace, river, wind.
- `cafe` and `cafe:<level>` normalize to `forest:deep` and `forest:<level>` respectively.
- `underwater` normalizes to `ocean:deep`; `thunderstorm` normalizes to `rain:deep`; level suffixes are preserved for old saved ids.
- `focus-rain` and `focus-wind` are registered as local app-owned audio assets and point at the deep generated loop for fallback/default routing.
- The selector uses lucide icons for sound-family buttons and localized family/level labels.

## QC Status

| Check | Status | Evidence |
| --- | --- | --- |
| Free/source trace | PASS | Mixkit and BigSoundBank source URLs, item ids, licenses, hashes, and processing notes are recorded in `docs/audio/hyperfocus-generated-audio-provenance.json` and this QC note. |
| Bundled local files | PASS | Files are under `public/sounds/hyperfocus/`; no runtime external audio URL is needed. |
| MP3 readability | PASS | `node scripts/check-hyperfocus-audio-assets.cjs` decoded and measured all 18 files as 2ch/48000Hz MP3. |
| Objective duration and loop seam | PASS | All 18 Hyperfocus MP3s pass duration, byte-size, RMS, peak, clipping, start/end RMS, and seam limits. |
| Level logic | PASS | `npm run test -- src/lib/__tests__/hyperfocusAudioProgression.test.ts` verifies each family progresses `soft < deep < intense`. |
| Runtime selector tests | PASS | Focused audio/UI suite passed 8 files / 64 tests. |
| Soundscape contract | PASS | `node scripts/check-hyperfocus-nature-soundscape-contract.cjs` passed 6 families / 18 variants. |
| Generated manifest integrity | PASS | `node scripts/check-hyperfocus-audio-assets.cjs --write-manifest` wrote 18 entries with current SHA-256 and byte counts. |
| Human fatigue listening | UNVERIFIED | Agent cannot perform reliable long-form human auditory fatigue review; needs human listen-through at low volume. |
| Physical native device playback | UNVERIFIED | Local/native packaging can be verified by artifacts, but physical Android/iOS listen-through is separate. |
