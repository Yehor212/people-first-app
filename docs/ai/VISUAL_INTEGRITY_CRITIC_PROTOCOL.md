# Visual Integrity Critic Protocol

This protocol forces a separate artistic and craft review for visual, motion, model, and asset work. It prevents technical checks from being treated as visual approval.

## Trigger

Use this protocol after implementation and before final PASS for:

- UI visual polish, layout, style, motion, icons, and assets
- Lottie, TGS, video stickers, generated images, 3D/model assets, product renders, and motion design
- Requests using words like аккуратно, четко, красиво, стильно, дорого, premium, clean, polished, cinematic, or realistic
- Any task where the user says the output is blurry, blob-like, cheap, unanimated, inconsistent, not Telegram-grade, or not a unified model

## Required Behavior

- Run the local `visual-integrity-critic` skill when installed.
- When an actual subagent tool is available and the user requested or authorized a critic, spawn a read-only critic with the artifact paths and this rubric.
- If the skill or subagent tool is unavailable, emulate the rubric inline and mark tool-specific evidence `UNVERIFIED`.
- Technical PASS never implies ARTISTIC_PASS.
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

## Critic Rubric

- Brief Fit: follows the exact target, style, constraints, and avoid list.
- Visual Clarity: readable silhouette, clear hierarchy, no accidental blobs or clutter.
- Craft/Neatness: polished edges, spacing, alignment, balanced detail density, and no cheap shortcuts.
- Model Integrity: each object feels whole; no holes, floating parts, inconsistent perspective, or mismatched material logic.
- Motion Integrity: motion has a clear event, weight transfer, contact, overlap, and shadow timing; not just slide/bob movement.
- Style Match: matches the chosen reference's construction, light, edge discipline, and finish, not only the same colors.
- Evidence Quality: proof covers the claim through current screenshots, video, frame boards, renders, or repeatable command output.
- Plan Quality: fixes root causes and includes risks, acceptance criteria, and verification.

## Completion Rules

- `GO`: Technical, Artistic-Craft, Motion or Model where relevant, and Evidence Quality are PASS.
- `FIX`: problems are specific and fixable inside the current direction.
- `STOP`: the direction/source asset is fundamentally wrong, or evidence is missing for a broad quality claim.

A clean build, valid file format, small size, or successful export can support `Technical: PASS`; it cannot support `Artistic-Craft: PASS` by itself.
