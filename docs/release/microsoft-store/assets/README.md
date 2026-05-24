# ZenFlow Microsoft Store Image Pack

This folder separates Store upload assets from runtime visuals.

## Recommended Upload Set

Use `official-logo/` for Microsoft Partner Center.

These files are generated from the same no-filter brand pipeline as the web,
PWA, Windows/Tauri, Android, and iOS icons:

- `public/icon-source.svg`
- `public/icon-source-round.svg`
- `scripts/generate-icons.cjs`
- `scripts/generate-microsoft-store-logo-assets.cjs`

The geometry of the ZenFlow leaf logo is unchanged. Only raster size, spacing,
background composition, glow strength, and export quality are controlled for
Store upload slots. The source must not use SVG filters: the previous filter
treatment created rectangular shader artifacts in exported PNG thumbnails.

Regenerate and validate every logo surface with:

```bash
npm run assets:logos
npm run assets:logos:check
```

For Store-only work, the narrower Store pack commands remain:

```bash
npm run desktop:store:assets
npm run desktop:store:assets:check
```

Recommended mapping:

| Partner Center slot | File |
| --- | --- |
| App tile icon / Store logo 300x300 | `official-logo/zenflow-official-app-tile-icon-300.png` |
| App tile icon / Store logo 150x150 | `official-logo/zenflow-official-app-tile-icon-150.png` |
| App tile icon / Store logo 71x71 | `official-logo/zenflow-official-app-tile-icon-71.png` |
| Box art 1:1 | `official-logo/zenflow-official-box-art-2160.png` |
| Poster art 2:3 / 9:16-style vertical art | `official-logo/zenflow-official-poster-art-1440x2160.png` |
| Super hero art 16:9 | `official-logo/zenflow-official-super-hero-art-1920x1080.png` (no text/title) |
| Source-quality logo archive | `official-logo/zenflow-official-logo-source-1024.png` |

## Old Drafts

Old orb-led Store logo drafts are intentionally not kept in this folder. The
only committed Store identity source is `official-logo/`, generated from the
classic ZenFlow leaf pipeline.

The runtime canonical orbs are frozen by
`docs/ai/CANONICAL_ORB_INVARIANT.md`; Store logo work must not change, replace,
or re-route runtime orb rendering.

## Upload Rule

Upload the recommended files into Partner Center, then preview them before certification. Do not submit for certification until screenshots, listing text, package identity, and release options have all been checked against the current build.

The logo pack is allowed to use golden-ratio proportions as a composition guide,
but Store readiness is judged by practical evidence: correct dimensions, PNG
format, readable small thumbnails, safe spacing, no hard square corners on app
tiles, no excessive glow, and no visible rectangular shader blocks.

Official Microsoft references used for this asset pack:

- Microsoft Store screenshots and images: https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/screenshots-and-images
- Windows app icon construction: https://learn.microsoft.com/en-us/windows/apps/design/style/iconography/app-icon-construction

Platform icon references used by the full logo pipeline:

- PWA maskable icons: https://web.dev/articles/maskable-icon
- Android adaptive icons: https://developer.android.com/develop/ui/views/launch/icon_design_adaptive
- Apple app icons: https://developer.apple.com/design/human-interface-guidelines/app-icons
