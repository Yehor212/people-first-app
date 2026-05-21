# ZenFlow Microsoft Store Image Pack

This folder separates Store upload assets from runtime visuals.

## Recommended Upload Set

Use `official-logo/` for Microsoft Partner Center.

These files are generated from the existing vector brand source:

- `public/icon-source.svg`
- `public/feature-graphic.svg`

The geometry of the ZenFlow leaf logo is unchanged. Only raster size, spacing, background composition, and export quality were improved for Store upload slots.

Recommended mapping:

| Partner Center slot | File |
| --- | --- |
| App tile icon / Store logo | `official-logo/zenflow-official-app-tile-icon-300.png` |
| Box art 1:1 | `official-logo/zenflow-official-box-art-2160.png` |
| Poster art 2:3 / 9:16-style vertical art | `official-logo/zenflow-official-poster-art-1440x2160.png` |
| Super hero art 16:9, if requested | `official-logo/zenflow-official-super-hero-art-1920x1080.png` (no text/title) |
| Source-quality logo archive | `official-logo/zenflow-official-logo-source-1024.png` |

## Orb Drafts

`orb-draft/` contains screenshots/export drafts from the V2 WebGL orb family. They are preserved only as visual reference.

Do not use the orb drafts as the primary Store logo unless the product owner explicitly chooses orb-led branding. The runtime canonical orbs are frozen by `docs/ai/CANONICAL_ORB_INVARIANT.md`; Store assets must not change, replace, or re-route runtime orb rendering.

## Upload Rule

Upload the recommended files into Partner Center, then preview them before certification. Do not submit for certification until screenshots, listing text, package identity, and release options have all been checked against the current build.

Official Microsoft references used for this asset pack:

- Microsoft Store screenshots and images: https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/screenshots-and-images
- Windows app icon construction: https://learn.microsoft.com/en-us/windows/apps/design/style/iconography/app-icon-construction
