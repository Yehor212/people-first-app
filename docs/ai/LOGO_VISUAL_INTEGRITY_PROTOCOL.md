# ZenFlow Logo Visual Integrity Protocol

Purpose: keep the ZenFlow leaf recognizable and high quality across browser, PWA, Android, iOS, desktop, Tauri, and store surfaces. This is a repo operator protocol for agents and humans. It complements the generated asset checks in `scripts/check-brand-logo-assets.cjs`.

## Source Evidence

Use official/current sources first when changing platform icon behavior:

- MDN PWA icons: PWAs need multiple icon sizes, maskable support, and sometimes simplified small icons when SVG detail does not scale down cleanly: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons
- Android adaptive icons: adaptive icons use foreground/background layers, multiple masks, clean edges, a 108x108 dp layer, and a 66x66 dp safe zone: https://developer.android.com/develop/ui/compose/system/icon_design_adaptive
- Apple app icons: iOS/macOS icon presentation must preserve clear app identity and platform expectations: https://developer.apple.com/design/human-interface-guidelines/app-icons
- Microsoft Edge PWA best practices: installed apps need recognizable icons across taskbar, Start, and app switcher surfaces: https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/best-practices

Local proof is still required. A web page, subagent, or platform doc is not a PASS by itself.

## Canonical Shape Lock

The canonical ZenFlow mark is the classic leaf defined in `scripts/generate-icons.cjs` and checked by `scripts/check-brand-logo-assets.cjs`.

Do not change these shape tokens without explicit rebrand approval:

- `LEAF_BODY`
- `LEAF_STEM`

Allowed quality work:

- tune raster export quality;
- tune size-aware scale, contrast, safe zone, opacity, and proof rendering;
- simplify tiny-size detail only enough to preserve readability;
- keep the same leaf silhouette and stem logic.

Forbidden without explicit approval:

- replacing the leaf with another shape;
- changing `LEAF_BODY` or `LEAF_STEM`;
- restoring the rejected flow-leaf experiment;
- adding SVG filters or glow effects that rasterize into square artifacts;
- treating a subagent, AI image tool, or design app output as canonical.

## No AI Or One-Off Raster Canonical Source

The generator owns canonical logo assets. Do not hand-edit final PNG/ICO/ICNS files as the source of truth.

- Canonical source: `scripts/generate-icons.cjs`, `scripts/generate-brand-logo-proof-sheet.cjs`, `scripts/check-brand-logo-assets.cjs`, and approved SVG/path tokens.
- Output assets: `public/*`, `docs/*`, `android/**`, `ios/**`, `src-tauri/icons/**`, and store PNGs are generated artifacts.
- AI/vectorize/Picsart-style enhancement can be used only as an explicitly approved reference experiment. It must not become canonical unless the user approves a rebrand and the shape contract is updated.

## Tiny Anti-Blob Guard

The previous failure mode: 16/30/32 px icon-class assets used a too-solid white tiny leaf, so the mark read as an empty white blob instead of a leaf.

Required tiny behavior:

- `public/favicon-16.png`, `public/favicon-32.png`, `docs/favicon-16.png`, `docs/favicon-32.png`, `src-tauri/icons/Square30x30Logo.png`, and `src-tauri/icons/32x32.png` must keep visible internal leaf structure.
- The tiny profile must not use a solid-white leaf body that erases the stem or negative space.
- `maxWhiteCoverage` in `SMALL_ICON_READABILITY_EXPECTATIONS` is the regression guard for this problem.
- If a future tiny icon needs a new threshold, update the metric, proof sheet, and visual audit evidence in the same change. Do not weaken the guard just to make checks pass.

Current local baseline after the 2026-06-30 fix:

| Asset | Expected behavior |
| --- | --- |
| `public/favicon-16.png` | Micro-leaf is small but not a white blob; internal structure visible in smooth/user proof. |
| `public/favicon-32.png` | Leaf and stem read clearly at toolbar/taskbar scale. |
| `src-tauri/icons/Square30x30Logo.png` | Desktop small tile keeps the leaf contour and internal line. |
| `src-tauri/icons/32x32.png` | Taskbar/window icon keeps the leaf contour and internal line. |

## Proof Sheet Rules

Every logo/icon/splash change must generate and inspect the proof sheet:

- Run `npm run assets:logos` after generator changes.
- Run `npm run assets:logos:check` for structural, platform, safe-zone, and anti-blob checks.
- Run `npm run assets:logos:proof` and inspect `tmp/logo-quality-proof-sheet.png`.
- Tiny cards must show `native/user/audit`, including native size, smooth/user preview, and pixel audit.
- Pixel audit is technical evidence, not the user-facing appearance. Smooth/user preview is the human-readability evidence.

## Platform Matrix

| Surface | Required logo proof |
| --- | --- |
| Web/PWA | favicon sizes, manifest icons, maskable icon, cache revision, static public/docs pages. |
| Android | adaptive foreground/background, monochrome layer, density buckets, legacy round PNGs, safe zone, no pale outer ring. |
| iOS | opaque app icon source, Apple touch icon, launch image context, no alpha where platform rejects it. |
| Desktop/Tauri | 30/32/50px small icons, ICO sizes, ICNS chunks, StoreLogo, taskbar/window readability. |
| Store/Release | Microsoft Store official-logo pack, box/poster/hero art, upload pack consistency. |
| Accessibility | SVG sources keep an accessible ZenFlow label where applicable. |
| Performance | Do not add SVG filters, huge rasters, or expensive visual effects to make icons look premium. |
| Security And Privacy | Do not introduce remote logo generation, external image URLs, secrets, or user data into asset scripts. |
| Testing | Red/green evidence for new guards, then focused and blast-radius checks. |
| Operations | Rollback path and public deploy/cache verification when claiming public behavior. |

## Visual Integrity Critic

Technical checks do not imply artistic approval. For visible logo/icon/splash work:

1. Produce the proof sheet.
2. Run or emulate the Visual Integrity Critic from `docs/ai/VISUAL_INTEGRITY_CRITIC_PROTOCOL.md`.
3. Require separate statuses for Technical, Visual Runtime, Artistic/Craft, Motion, Model, and Plan.
4. Treat real devices, app stores, public deploys, and launcher/OEM behavior as `UNVERIFIED` until fresh evidence exists.

A subagent can return GO/STOP, but it is not proof by itself. Verify against files, commands, proof sheets, or runtime evidence.

## Required Done Packet

For logo/icon/splash work, the final answer or PR note must include:

- changed source files and generated asset families;
- red-first or baseline evidence;
- green commands and exit status;
- proof artifact path;
- visual critic status;
- Platform Matrix rows marked PASS, N/A, or UNVERIFIED;
- public deploy/device/store proof status;
- rollback path.

## Minimum Commands

Use the narrowest relevant set, then widen when the change affects more surfaces:

```bash
npm run assets:logos
npm run assets:logos:check
npm run assets:logos:proof
npm run check:visual
npm run check:best-practices
npm run check:no-ai-templates
npm run check:agent-context
```

Add native, Playwright, security, build, or store checks when the claim touches those surfaces.

## Rollback

Rollback a broken logo protocol or asset change by reverting the generator/check/doc edits, rerunning `npm run assets:logos`, and rerunning `npm run assets:logos:check` plus `npm run assets:logos:proof`. Do not manually patch generated PNGs as the rollback.
