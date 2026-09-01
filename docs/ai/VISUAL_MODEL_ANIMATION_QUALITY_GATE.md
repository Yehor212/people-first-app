# ZenFlow Visual, Model, and Animation Quality Gate

Status: mandatory agent and review contract. This document governs UI visual assets, generated assets, motion, Lottie, TGS, video stickers, and 3D/model work. It supplements `VISUAL_INTEGRITY_CRITIC_PROTOCOL.md`; technical validation never grants artistic approval.

## Approved Baseline and Exact Approval Boundary

The immutable baseline ID is `contact-v8-layered`.

The user watched the exact MP4 below on an iPhone and gave direct human approval: “Превосходно. Я полностью одобряю эту модель и анимацию. Впредь все модели и анимации ZenFlow должны делаться в таком же или более высоком качестве.”

| Evidence             | Identity                                                                                                                                                                                                | Approval scope                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Quality master       | `bedtime-bear-contact-v8-layered-master.tgs`; SHA-256 `1d9ec0fe08bbeea17e2a513e54e2abf10054e6ac861f1390ff9c712556508a9a`; 3,270,243 bytes                                                               | Hash-bound source for the viewed preview; not Telegram-upload-ready        |
| Viewed preview       | `docs/ai/visual-quality/evidence/contact-v8-layered-preview.mp4`; SHA-256 `53f357a59b6ae64018ba9ec02da889f366428caa7e6a788d5dbdecc7f32f0ee5`; H.264/yuv420p; 512 x 512; 60 FPS; 180 frames; 3.0 seconds | `HUMAN_ARTISTIC_APPROVAL`, `Artistic-Craft`, `Motion`, and `Model`: `PASS` |
| Frame board          | `docs/ai/visual-quality/evidence/contact-v8-layered-contact-sheet.png`; SHA-256 `cffe1c1e101ff8f6fcc916e8920778558bcfd81787ae1efec2635b2aa63da107`                                                      | Portable representative visual evidence                                    |
| Critic report        | `docs/ai/visual-quality/approved-baselines/contact-v8-layered-critic.md`; SHA-256 `ef3b89fe7591b5a38c284c568a1d7ca25cfc883e5777e75f75249badaddcdbab`                                                    | Hash-bound rubric evidence; not a replacement for direct human approval    |
| Compact Telegram TGS | No separately approved artifact                                                                                                                                                                         | Artistic parity: `UNVERIFIED`                                              |

The 3.27 MB master is intentionally not duplicated in the repository. Its filename, historical source path, exact size, and SHA-256 are anchored independently in both the baseline manifest and the validator. The portable MP4 and frame board let future agents inspect the approved appearance without relying only on a machine-local absolute path.

Approval is artifact-bound. It does not transfer to a re-export, compacted TGS, converted video, still frame, reconstruction, or later revision, even when the source master is the same. A delivery artifact needs its own hash, technical evidence, rendered evidence, and direct human review before its artistic parity can be `PASS`.

## Meaning of “Same or Higher Quality”

A future candidate must be compared against the portable baseline evidence and evaluated on all applicable dimensions below. File size, path count, layer count, keyframe count, polygon count, or tool choice are diagnostic facts only; none is a quality score.

1. **Model integrity** — every character and prop reads as a complete object with stable anatomy, perspective, proportions, and material logic. No detached, floating, fused, hollow, or accidentally intersecting parts.
2. **Silhouette and hierarchy** — the primary action remains readable at target size and in representative intermediate frames. The focal character and event are not lost in texture or clutter.
3. **Edges and materials** — contours, highlights, gradients, texture, and line weight are deliberate and consistent. Tracing noise, jagged edges, muddy anti-aliasing, pasted-on highlights, and mixed rendering languages are rejection conditions.
4. **Detail discipline** — details reinforce form, story, depth, and target-size legibility. A dense but incoherent trace is not equivalent to the baseline.
5. **Object contact** — hands, paws, bedding, phone, dock, furniture, and shadows maintain credible contact and occlusion. Contact points may not pop, slide, float, or penetrate without an intentional event.
6. **Light and shadow** — lighting direction, cast/contact shadows, material response, and state transitions remain coherent. Shadows must participate in motion instead of lagging or remaining mechanically static.
7. **Coherent event motion** — the animation communicates an event with setup, action, response, settle, and a deliberate loop. Generic bobbing, sliding, scale pulses, or crossfades cannot substitute for character or object animation.
8. **Weight, overlap, and timing** — acceleration, follow-through, deformation, overlap, holds, and contact timing communicate mass and intent. Limbs, eyes, props, bedding, and shadows coordinate rather than move as unrelated layers.
9. **No cheap simplification** — optimization must preserve the approved silhouette, model identity, important materials, contact logic, and motion event. If a delivery limit forces visible degradation, record it as a separate candidate and keep artistic parity `UNVERIFIED` or `FAIL`.

“Higher quality” is accepted only through direct human approval of the candidate’s exact preview hash. The visual-integrity critic can recommend `READY_FOR_HUMAN_REVIEW`, `STOP`, or dimension-level findings; it cannot manufacture `HUMAN_ARTISTIC_APPROVAL`.

## Mandatory Proof Packet

Every new or materially changed model, animation, Lottie/TGS, video sticker, 3D asset, or generated production visual must add one JSON packet under `docs/ai/visual-quality/proofs/` that conforms to `docs/ai/visual-quality/visual-proof-packet.schema.json` and passes `npm run check:visual`.

The packet must contain:

- a grounded brief and explicit non-goals;
- source classification, provenance evidence, owner authorization, and legal/provenance limitations;
- the target format, delivery profile, dimensions, FPS, frame count, duration, loop behavior, codec, and alpha behavior;
- exact artifact paths, byte sizes, SHA-256 values, and portability flags;
- a portable MP4 or WebM preview and a representative frame/contact sheet;
- technical receipts for parse/schema, dimensions, FPS, duration, frame count, loop, target size, codec/alpha, supported features, bounds, and render/decode;
- a visual-integrity-critic report using the baseline rubric;
- separate `Technical`, `Visual Runtime`, `Artistic-Craft`, `Motion`, `Model`, and `Plan` rows;
- direct human approval provenance bound to the exact reviewed artifact hash, or explicit `UNVERIFIED` fields;
- all Web/PWA/native/export/accessibility/performance/security/testing/operations rows;
- explicit master-versus-compact Telegram status with `humanApprovalInherited: false`.

Candidate packets must list every changed governed production asset in `coveredPaths`. One packet may cover several variants only when each artifact has its own hash and the evidence demonstrates the claimed scope.

## Machine-Enforced Boundary

`scripts/visual-quality-proof-gate.ts` and its repository/change-scope adapter `scripts/visual-quality-repository-gate.ts`, called by the existing `scripts/check-visual-guards.ts`, fail closed for:

- malformed packets, unsafe paths, symlinks, missing files, hash/size drift, and missing required fields;
- missing baseline, preview, frame-board, receipts, critic dimensions, status rows, or platform rows;
- changed governed model/motion/sticker/generated assets not covered by a valid packet;
- TGS parse or declared canvas/FPS/frame mismatch and the 64 KiB compact Telegram limit;
- drift in the immutable baseline identity, hashes, sizes, approval scope, routing, or compact `UNVERIFIED` status;
- `Artistic-Craft`, `Motion`, or `Model: PASS` without a direct-user approval bound to an artifact role, matching SHA-256, statement, review surface, and explicit scope;
- compact Telegram artistic `PASS` inherited from a quality master rather than separately reviewed.

The guard validates machine-readable evidence and routing. It does **not** infer beauty, emotional quality, premium craft, model coherence, or motion appeal. A receipt records an executed validator; its presence is not runtime proof for every engine. False or stale receipts are review failures even when their JSON shape passes.

## Required Workflow

1. Read this contract and the visual-integrity critic protocol before implementation.
2. Define the brief, non-goals, provenance, target profile, and platform matrix.
3. Compare the candidate with the approved MP4 and frame board at the same target size.
4. Run format-specific structural validators and render/decode the complete timeline in applicable engines.
5. Produce the exact preview and frame board from the candidate being reviewed; hash every artifact after rendering.
6. Run the visual-integrity critic and record all eight critic dimensions.
7. Keep artistic rows `UNVERIFIED` or `FAIL` until the user directly reviews the exact candidate preview. Technical green output cannot promote them.
8. For Telegram, preserve the quality master and evaluate compact delivery separately. Never hide quality loss behind upload-size compliance.
9. Run the required checks and inspect `git diff` and `git status`. Do not claim device, store, public, or release parity without fresh evidence.

## Platform and Domain Evidence

The packet must include every row below. A non-applicable claim uses `SKIP` with a concrete reason; unavailable evidence uses `UNVERIFIED`.

| Row                          | Minimum relevant evidence                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Web/Vite                     | production-equivalent load/render, console, loop, sizing, and fallback behavior                                             |
| PWA                          | installed/standalone rendering, offline/cache/version behavior, and asset update path                                       |
| Android/Capacitor            | real WebView or emulator/device render, lifecycle, decoder, memory, and back/navigation interaction when relevant           |
| iOS/WKWebView                | real WKWebView or device render, codec/alpha behavior, lifecycle, and memory                                                |
| Desktop/Tauri                | desktop renderer behavior, window scaling, decoder, and packaging reachability                                              |
| Telegram/export              | exact upload artifact, supported features, 512 x 512/60 FPS/duration/loop constraints, byte limit, and native client review |
| Accessibility/reduced motion | reduced-motion alternative, no essential-information loss, and non-flashing timing                                          |
| Performance                  | bundle/network cost, decode/render cost, memory, frame pacing, and low-end target evidence                                  |
| Security/Privacy             | inert/local asset validation, external references, metadata/data leakage, provenance, and license limitations               |
| Testing                      | RED-to-GREEN guard proof, focused validation, render evidence, and relevant regression checks                               |
| Operations                   | deterministic generation/export instructions, ownership, cache invalidation, rollback, and evidence retention               |

This governance gate does not prove runtime or release parity. Unchecked surfaces remain `UNVERIFIED` even when the packet and CI checks pass.

## Baseline Files, Commands, and Rollback

- Baseline manifest: `docs/ai/visual-quality/approved-baselines/contact-v8-layered.json`
- Schema: `docs/ai/visual-quality/visual-proof-packet.schema.json`
- Critic report: `docs/ai/visual-quality/approved-baselines/contact-v8-layered-critic.md`
- Validator: `scripts/visual-quality-proof-gate.ts`
- Shared proof types and invariants: `scripts/visual-quality-proof-shared.ts`
- Artifact integrity validator: `scripts/visual-quality-artifact-validator.ts`
- Repository/change-scope adapter: `scripts/visual-quality-repository-gate.ts`
- Format validator: `scripts/visual-quality-tgs-validator.ts`
- Primary gate: `npm run check:visual`
- Focused test: `npx vitest run test/check-visual-guards.test.ts`

Rollback is repository-local: revert this contract, schema, baseline packet/evidence, validator integration, tests, routing, RAG entry, and visual workflow change together. Rollback removes enforcement only; it must not be described as revoking the user’s historical approval or deleting the external master. No runtime asset is published or integrated by this contract.
