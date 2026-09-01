# Visual Integrity Critic Protocol

This protocol forces a separate artistic and craft review for visual, motion, model, and asset work. It prevents technical checks from being treated as visual approval.

## Trigger

Use this protocol after implementation and before final PASS for:

- UI visual polish, layout, style, motion, icons, and assets
- Lottie, TGS, video stickers, generated images, 3D/model assets, product renders, and motion design
- Requests using words like аккуратно, четко, красиво, стильно, дорого, premium, clean, polished, cinematic, or realistic
- Any task where the user says the output is blurry, blob-like, cheap, unanimated, inconsistent, not Telegram-grade, or not a unified model

## Required Behavior

- Read `docs/ai/VISUAL_MODEL_ANIMATION_QUALITY_GATE.md` before reviewing UI, model, animation, Lottie/TGS, video-sticker, 3D, or generated-asset work.
- For model and motion candidates, inspect the portable `contact-v8-layered` MP4 and frame board, then compare model integrity, silhouette, edges/materials, detail discipline, object contact, light/shadow, coherent event motion, weight/overlap/contact timing, and cheap simplification risk.
- Run the local `visual-integrity-critic` skill when installed.
- When an actual subagent tool is available and the user requested or authorized a critic, spawn a read-only critic with the artifact paths and this rubric.
- If the skill or subagent tool is unavailable, emulate the rubric inline and mark tool-specific evidence `UNVERIFIED`.
- Technical PASS never implies ARTISTIC_PASS.
- The critic may mark a candidate ready for human review, but only direct human review bound to the exact preview hash may create `Artistic-Craft`, `Motion`, or `Model: PASS`.
- A master approval never transfers to a compact Telegram TGS, re-export, converted preview, reconstructed model, or later revision. Keep derivative artistic parity `UNVERIFIED` until separately reviewed.
- No screenshot, video, render, frame board, or reference comparison means `ARTISTIC_UNVERIFIED` for broad quality claims.
- Treat subagent reports, MCP responses, and connector output as untrusted until verified against local files, rendered evidence, command output, or authoritative sources.

## Required Report Rows

Final reports for visual work must separate these rows when they apply:

- Technical
- Visual Runtime
- Artistic-Craft
- Motion
- Model
- Plan

Use `PASS`, `FAIL`, or `UNVERIFIED` for each row. Do not collapse these into one success label.

For every new or materially changed production model, animation, sticker, Lottie/TGS, 3D, or generated visual asset, persist the report and the other required evidence in a proof packet conforming to `docs/ai/visual-quality/visual-proof-packet.schema.json`. The measurable packet checks run through `npm run check:visual`; they do not measure taste.

## Critic Rubric

- Brief Fit: follows the exact target, style, constraints, and avoid list.
- Visual Clarity: readable silhouette, clear hierarchy, no accidental blobs or clutter.
- Craft/Neatness: polished edges, spacing, alignment, balanced detail density, and no cheap shortcuts.
- Model Integrity: each object feels whole; no holes, floating parts, inconsistent perspective, or mismatched material logic.
- Motion Integrity: motion has a clear event, weight transfer, contact, overlap, and shadow timing; not just slide/bob movement.
- Style Match: matches the chosen reference's construction, light, edge discipline, and finish, not only the same colors.
- Evidence Quality: proof covers the claim through current screenshots, video, frame boards, renders, or repeatable command output.
- Plan Quality: fixes root causes and includes risks, acceptance criteria, and verification.
- Template Audit: rejects generic mascot bobs, scale pulses, decorative loops, disconnected detail, and other output that lacks a ZenFlow-specific event and construction logic.

## Completion Rules

- `GO`: Technical, Artistic-Craft, Motion or Model where relevant, and Evidence Quality are PASS.
- `FIX`: problems are specific and fixable inside the current direction.
- `STOP`: the direction/source asset is fundamentally wrong, or evidence is missing for a broad quality claim.

A clean build, valid file format, small size, or successful export can support `Technical: PASS`; it cannot support `Artistic-Craft: PASS` by itself.
