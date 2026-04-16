# Typography Grammar — ZenFlow

_Phase 0-B, 2026-04-16. Living document. Violations caught by ratchet `typographySystemCompliance`._

## POV (single sentence)

ZenFlow is an **editorial literary companion**, not a productivity SaaS — every glyph serves that narrative. Display serifs carry emotional weight; the body sans disappears into the reader's attention; handwriting appears only for intimate moments. Nothing in the app should read like Notion, Linear, or Stripe.

## Slot map

| Slot    | Family                | CSS var                        | Tailwind       | When                                                           |
| ------- | --------------------- | ------------------------------ | -------------- | -------------------------------------------------------------- |
| Display | Fraunces Variable     | `--typography-family-display`  | `font-display` | Entry titles, drop-caps, streak counters, pull-quotes          |
| Serif   | Fraunces Variable     | `--typography-family-serif`    | `font-serif`   | Long-form prose passages, bound-book export, editorial pullout |
| Body    | Inter Variable        | `--typography-family-body`     | `font-body`    | Paragraphs, inputs, metadata (alias of `font-sans`)            |
| Sans    | Inter Variable        | `--typography-family-body`     | `font-sans`    | Default UI (buttons, labels, lists). Inter once loaded         |
| Hand    | Caveat Variable       | `--typography-family-hand`     | `font-hand`    | Gratitude entries, intimate annotations                        |
| Mono    | `ui-monospace` system | `--typography-family-mono`     | `font-mono`    | Tabular numerics (streak counter with `tnum`), future code     |

### Why these fonts

- **Fraunces** — only free variable font with tri-axis emotional tuning (`opsz` optical-size 9-144, `SOFT` 0-100, `WONK` 0-1, `wght` 100-900). Display serif with character. Picked over Playfair/Bodoni because the `opsz` axis auto-adjusts thick/thin contrast as we change size, preserving legibility at both 48px hero and 18px pull-quote.
- **Inter** — full Latin + Latin-Ext + Cyrillic + Cyrillic-Ext coverage. Humanist geometric, not overused at body scale the way Geist is. Geist was evaluated and **rejected**: no Cyrillic support — disqualifies for `uk` locale.
- **Caveat** — the only free handwritten variable font with full Cyrillic (critical Ukrainian characters `ґ`, `є`, `і`, `ї`). Used sparingly.

### What we do not use

- Outfit (deprecated — Phase 0-B removes the one remaining usage in `JournalEntryEditor.tsx:632`)
- Google Fonts CDN at runtime (Capacitor offline-safety; all fonts are self-hosted via `@fontsource-variable/*` NPM packages)
- Any font without OFL-1.1 or similar permissive license

## Five Sacred Moments (display serif required)

Each of these is a **moment the user remembers**. The display serif carries emotional weight the body sans cannot.

### 1. Entry title

The one-line title above every journal entry. Composition anchor.

```tsx
<h2 className="font-display font-semibold text-3xl tracking-tight leading-snug">
  {entry.title}
</h2>
```

### 2. Date as drop-cap

The date at the top of an entry, rendered as editorial drop-cap — not a metadata afterthought.

```tsx
<time
  className="font-display text-5xl font-bold tracking-tight leading-none text-foreground/80"
  style={{ fontVariationSettings: '"opsz" 144' }}
>
  {format(entry.date, "dd")}
</time>
```

Large optical-size (`opsz` 144) is essential: Fraunces at 48px+ without it looks too thin.

### 3. Quote watermark

Editorial pull-quotes from the user's past entries, rendered as italic serif with low opacity — a literary echo.

```tsx
<blockquote className="font-display italic text-2xl leading-relaxed text-primary/30">
  "{quote}"
</blockquote>
```

### 4. Streak counter

The number is the hero. Tabular numerics keep digits aligned as the count grows.

```tsx
<span
  className="font-display font-bold text-5xl tabular-nums tracking-tight"
  style={{ fontVariationSettings: '"opsz" 144, "SOFT" 50' }}
>
  {streakDays}
</span>
```

`SOFT` 50 slightly softens the terminals — celebration moment, not corporate dashboard.

### 5. Gratitude handwritten

Gratitude moments switch into Caveat. Italic is implicit in the script — no `italic` class needed.

```tsx
<p className="font-hand text-xl leading-loose text-primary">
  {gratitudeText}
</p>
```

## Variable font axes — how to use

Tailwind has no first-class `font-variation-settings` support. We use inline `style` with a standardised vocabulary:

| Axis   | Values            | Meaning                                                             |
| ------ | ----------------- | ------------------------------------------------------------------- |
| `opsz` | 9-144 (Fraunces)  | Optical size — match to rendered px (48px title → `opsz 144`)       |
| `wght` | 100-900 (F, I, C) | Use Tailwind `font-{weight}` classes, not `wght` in inline style    |
| `SOFT` | 0-100 (Fraunces)  | Softness — `SOFT 0` crisp, `SOFT 100` warm. Use for emotional peaks |
| `WONK` | 0-1 (Fraunces)    | Glyph-substitution oddness — reserved for fun moments, `WONK 1`     |

Example — emotional streak peak at day 100:

```tsx
style={{ fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1' }}
```

## Anti-patterns (violations break the voice)

- **No `font-sans` on entry titles.** Body-weight titles read like notifications, not entries. Always `font-display`.
- **No `font-display` on body paragraphs.** Fraunces at body size tires the eye over long reads; Inter maintains legibility.
- **No `font-hand` outside gratitude moments.** Caveat everywhere reads like a birthday card, not a journal.
- **No hardcoded font-family strings in components.** Always `font-display|sans|body|serif|hand|mono`. Tokens are the SSOT.
- **No `font-['Outfit',sans-serif]` or any arbitrary font class.** Ratchet catches `font-\[` usage on adoption.
- **No non-variable fallback fonts with wght ranges > 1.** Fraunces/Inter/Caveat are variable; `wght: 100 900` emitted by `@font-face` only works for them. Samsung Internet 13- degrades to 400 weight cleanly — acceptable.
- **No Google Fonts `<link>` or `@import url(fonts.googleapis.com/...)`.** Capacitor offline-safety — the app must work offline on day 1.

## RTL & i18n safety

Arabic (`ar`) and Hebrew (`he`) locales:

- Fraunces does **not** cover Arabic/Hebrew glyphs. When `lang="ar"` or `lang="he"` is set, browser font-matching falls to `Georgia` (the Fraunces stack's first fallback), which also lacks full Arabic/Hebrew — so it cascades further to `system-ui`, which resolves to platform Arabic/Hebrew system font (Arial/Tahoma on desktop; Geeza Pro on iOS; Roboto on Android). No code change needed — the font stack handles it.
- A later phase will lazy-load **Frank Ruhl Libre** (Hebrew display serif) and **Noto Naskh Arabic** (Arabic body/display) via dynamic `@font-face` import when the active locale matches.
- Caveat also doesn't cover ar/he. Gratitude entries in those locales fall to `"Comic Sans MS", cursive` — not great but functional. Later phase replaces with locale-specific handwritten faces (**Reem Kufi Ink** for ar; **Suez One** or similar for he).

Ukrainian (`uk`) specifically:

- Inter + Caveat ship Cyrillic subsets including `ґ`, `є`, `і`, `ї` — confirmed present in the `cyrillic` unicode-range `U+0400-045F, U+0490-0491`.
- **Fraunces does not ship Cyrillic.** Display titles in `uk` locale render in **Georgia** via stack fallback — acceptable: Georgia is a well-drawn Cyrillic-capable serif pre-installed on iOS/Android/Windows/macOS. Future phase may add Frank Ruhl Libre or PT Serif for better brand match.

## Font-display strategy

| Font     | `font-display` | Rationale                                                                                  |
| -------- | -------------- | ------------------------------------------------------------------------------------------ |
| Fraunces | `swap`         | Display text — brief FOUT to Georgia is acceptable; invisible text would break the moment. |
| Inter    | `optional`     | Body text — prevent any FOUT flash; user keeps reading in system font if net is slow.      |
| Caveat   | `swap`         | Gratitude — emotional moment, readable early > invisible Caveat briefly.                   |

## Subset policy

To keep payload minimal for the primary 6 locales (en, uk, es, de, fr, ja-fallback):

| Font     | Subsets shipped       | Approx gzipped size | Locales covered fully           |
| -------- | --------------------- | ------------------- | ------------------------------- |
| Fraunces | latin, latin-ext      | ~48 KB              | en, es, de, fr (ja fallback)    |
| Inter    | latin, latin-ext, cyrillic, cyrillic-ext | ~44 KB | en, uk, es, de, fr              |
| Caveat   | latin, latin-ext, cyrillic, cyrillic-ext | ~20 KB | en, uk, es, de, fr              |

**Total critical font budget ≈ 112 KB**, separate from JS bundle (not counted against `bundleSizeKB` ratchet). Browser downloads subsets lazily per `unicode-range` — visiting an all-Latin view fetches only Latin subsets (~60 KB).

## Ratchet enforcement

- `typographySystemCompliance=1` — set when this doc exists and Tailwind has display/serif/hand/mono families. Future phases will ratchet up by checking component-level adoption.
- `fontFaceCount=3` — fonts shipped (Fraunces, Inter, Caveat). Adding a locale font increments.
- `bundleSizeKB` — JS only. Font woff2 files count separately against the ~200KB font-asset budget.

## Adoption checklist (Phase 0-B exit)

- [x] `src/styles/fonts.css` with 16 `@font-face` declarations (Fraunces 4 + Inter 8 + Caveat 4)
- [x] `src/index.css` imports `fonts.css` and `generated/tokens.css` before `@tailwind`
- [x] `tokens.json` typography category (family, scale, weight, leading, tracking) — 28 real tokens
- [x] Style Dictionary transforms: fontFamily + dimension (in addition to color)
- [x] `tailwind.config.ts` fontFamily extended with display, serif, body, hand, mono
- [x] `JournalEntryEditor.tsx` dogfood: one header swapped from `font-['Outfit',sans-serif]` to `font-display`
- [x] `docs/typography-grammar.md` (this file)
- [ ] Phase 1+ follow-up: audit other components for hardcoded font families, migrate to tokens

## References

- DTCG spec (fontFamily, dimension, fontWeight): <https://design-tokens.github.io/community-group/format/> (2025-10-28)
- Fraunces project: <https://github.com/undercasetype/Fraunces>
- Inter project: <https://github.com/rsms/inter>
- Caveat project: <https://fonts.google.com/specimen/Caveat>
- Variable fonts guide (MDN): <https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_fonts/Variable_fonts_guide>
