# Microsoft Store Listing Quality Gate

Purpose: make the ZenFlow Microsoft Store listing feel deliberate, premium, and truthful before any package is submitted for certification.

This gate covers the public listing text, screenshot order, captions, Store logos, and self-review proof. It does not change runtime UI, canonical orbs, sync, or app behavior.

## Source Rules

Use these Microsoft rules as the release baseline:

- Store listing is the customer-facing text and image surface. Minimum completion requires a description and at least one screenshot, but Microsoft recommends multiple images and as much helpful info as possible.
- Description is required, plain text only, and can be up to 10,000 characters.
- Product features are displayed as Store bullets; keep each brief and under 200 characters. Do not type bullet symbols yourself.
- Short description should be different from the first paragraph. Best result: keep it under 270 visible characters.
- One screenshot is required. Microsoft recommends at least four screenshots for each supported device family.
- Desktop screenshots must be PNG, at least 1366 x 768, no larger than 50 MB.
- Keep critical visuals and text in the top two-thirds of screenshots because Store overlays may appear in the bottom third.
- Do not add extra logos, icons, or marketing messages to screenshots.
- Search terms must be relevant, must not exceed seven unique terms or phrases, and must not include pricing terms or unrelated product names.
- Metadata must accurately reflect the product. No misleading claims, no unsupported features, no borrowed/trademarked identity.

Sources:

- Microsoft Store listing fields and copy limits: https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/add-and-edit-store-listing-info
- Microsoft Store screenshots and images: https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/screenshots-and-images
- Microsoft Store policies: https://learn.microsoft.com/en-us/windows/apps/publish/store-policies

## ZenFlow Listing Position

ZenFlow is not sold as a medical product, a therapy replacement, or a miracle productivity tool.

The listing should position it as:

- A calm desktop wellness space.
- A daily ritual tool for mood, habits, focus, and journaling.
- A V2 visual experience with canonical WebGL orbs.
- A privacy-aware, offline-capable app with sync-ready account flow.
- A Windows desktop shell that avoids overloaded browser profile friction.

Do not position it as:

- Medical advice, diagnosis, treatment, or mental-health therapy.
- A generic habit tracker with AI buzzwords.
- A Telegram clone.
- A browser shortcut pretending to be a finished desktop app.
- A performance guarantee for every GPU or device.

## Copy Pack

### Product Name

`ZenFlow`

Do not add keywords, version numbers, emoji, or descriptive suffixes to the product name.

### Short Description

```text
A calm Windows wellness space for mood check-ins, habits, journaling, and focus rituals - built around ZenFlow's V2 visual flow and a dedicated desktop runtime.
```

### Full Description

```text
ZenFlow turns daily wellness into a quiet desktop ritual.

Open one focused space for mood check-ins, habit tracking, private journaling, and focus sessions. The V2 experience is built around ZenFlow's canonical WebGL orb system: soft, responsive, and visual without turning your day into another noisy dashboard.

Use ZenFlow when you want to slow down for a minute, name what you feel, keep small habits visible, and return to your work without carrying the whole day in your head.

What you can do:

Track your mood with a visual V2 check-in flow.
Build habits and daily rituals without clutter.
Write private journal entries and keep reflection close.
Use focus sessions when you need a clean work block.
Review patterns and personal insights over time.
Keep working offline, then sync when your account is available.
Use the same ZenFlow visual language across V1, V2, web, PWA, and desktop.

Why the desktop version exists:

The desktop shell gives ZenFlow its own controlled Windows space instead of relying on a crowded browser profile with many tabs, extensions, and stale cache. The goal is simple: keep the same ZenFlow visuals, keep the same data contract, and make the app feel steadier on desktop.

ZenFlow is designed for everyday reflection and self-organization. It is not a medical device and does not provide medical advice, diagnosis, or treatment.
```

### Product Features

Paste these into Partner Center as separate feature rows. Do not add bullet characters.

```text
V2 mood check-ins with ZenFlow's canonical WebGL orb visuals
Habit tracking for daily rituals and streaks
Private journal for short notes and longer reflection
Focus sessions for calm work blocks
Desktop shell designed for fewer browser-profile distractions
Offline-capable workflow with sync-ready account support
Personal insights without a noisy dashboard
Light, dark, and OLED-friendly visual modes
V1 and V2 surfaces kept under one sync contract
In-app language support across English, Ukrainian, Spanish, German, French, Japanese, Arabic, and Hebrew
```

### Search Terms

Use at most seven. These are intentionally plain and relevant:

```text
wellness
mood tracker
habit tracker
journal
focus timer
offline wellness
desktop wellness
```

### Screenshot Captions

Each caption is under 200 characters.

```text
Name your mood in a quiet visual flow that stays out of your way.
Build steady daily rituals without turning your day into a dashboard.
Keep private reflection close to your work, with space to start small.
Use focus sessions when you need a clean work block.
Review patterns and return to your day with more clarity.
Run ZenFlow in a dedicated Windows desktop shell.
```

## Store Language Strategy

ZenFlow's app UI supports eight source languages:

```text
en, uk, es, de, fr, ja, ar, he
```

That is not the same thing as having eight completed Microsoft Store listing
languages. For the current Store submission:

- English is the only completed Store listing language.
- English screenshots and English descriptions are valid only for the English
  listing.
- Additional Store listing languages must not be added until each language has
  localized listing copy, localized screenshot captions, and Store-safe
  screenshots or a deliberate neutral-screenshot decision.
- `Languages supported in packages` must be verified only after the package is
  uploaded; an empty package-language table is expected while `Packages` is
  `Not started`, but it blocks multilingual release proof.

Use `STORE_SUBMISSION_AUDIT.md` before changing Partner Center language
settings.

## Screenshot Plan

Create desktop screenshots only for the current Microsoft Store submission unless another device family is explicitly enabled.

Recommended order:

1. V2 orb check-in hero.
   - Route: `/orb?nav=v2`
   - State: neutral or gently positive.
   - Must show canonical WebGL orb, question text, segmented timing control, slider, and next button.

2. V2 habits.
   - Route: `/habits?nav=v2`
   - State: at least three realistic habits, one completed today, no placeholder-only page.

3. V2 diary/journal.
   - Route: `/diary?nav=v2`
   - State: privacy-safe sample entry or locked journal screen. No real user text.

4. V2 insights/statistics.
   - Route: stats/analytics surface if enabled.
   - State: calm chart/insight state with no personal content.

5. Desktop shell/download value.
   - Route: `/desktop/`
   - State: public gated release page or desktop dock proof, depending on submission state.

6. Theme parity.
   - Route: strongest V2 surface.
   - State: show dark/OLED or light mode only if it looks polished and matches the listing language.

## Screenshot Quality Rules

Every screenshot must pass this checklist:

- Real app UI only. No marketing overlays, fake captions, browser chrome, cursor, inspector, or extension badges.
- Critical UI sits in the top two-thirds of the image.
- Bottom third can be safely covered by Store overlays.
- No private journal text, email, account identifiers, API keys, or debug flags.
- No loading spinners, blank WebGL slots, fallback orbs, stale Chrome toolbar, or `localhost`.
- Canonical orbs only. If an orb appears, it must be the real `ValenceOrb` or `MiniValenceOrb` family.
- Desktop screenshot size is at least `1366x768`; preferred export is `1920x1080` or `3840x2160`.
- File is PNG and under 50 MB.
- Caption matches what is visible in the screenshot.
- The first screenshot must answer "What is ZenFlow?" within five seconds.

## AAA Copy Rules

Good ZenFlow copy should feel human, specific, and calm.

Use:

- Concrete user actions: check in, track, write, focus, review, sync.
- Product-specific terms: V2 flow, canonical orb, desktop shell, private journal.
- Short paragraphs.
- Plain English.
- Honest limitations when needed.

Avoid:

- "Revolutionary", "game-changing", "AI-powered", "ultimate", "transform your life".
- Medical or therapeutic claims.
- Keyword stuffing.
- All caps.
- Emoji in Store metadata.
- URLs inside the description field.
- Claims that depend on unreleased signing, unavailable packages, or future features.

## Self-Audit Protocol

Before uploading listing text or screenshots, produce this evidence packet:

| Requirement | Evidence |
| --- | --- |
| Microsoft listing rules reviewed | Links to Microsoft Store listing and screenshot docs |
| Product copy is truthful | Feature list maps to current ZenFlow UI or release docs |
| Screenshots are Store-safe | File list with dimensions and sizes |
| Screenshots are visually current | Current public URL or signed desktop build screenshot path |
| Canonical orbs preserved | `npm run check:canonical-orbs` |
| Task completion protocol preserved | `npm run check:task-completion` |
| No secrets or personal content | Manual screenshot review checklist |
| No final submission by accident | Partner Center remains draft until explicit user approval |

Stop if any row is missing evidence.

## Review Scorecard

Use this score before upload:

| Area | PASS bar |
| --- | --- |
| First impression | First screenshot communicates calm V2 wellness within five seconds |
| Visual polish | No rough crop, toolbar, debug badge, low-res asset, or visual fallback |
| Copy clarity | Short description is distinct from description and under the visible 270-character target |
| Trust | No medical, pricing, performance, or sync claim exceeds evidence |
| Platform match | Listing says Windows desktop only unless another device family is actually enabled |
| Accessibility | Text in generated art has strong contrast and is not in the bottom overlay zone |
| Store policy | Search terms are relevant, no competitor names, no price terms |

Score below 7/7 means do not upload yet.

## Current Repo Evidence

- Save public desktop listing proof under `tmp/store-listing-desktop-page-current.png` during the active audit run.
- Do not use `localhost` as Store-listing proof. Use the public GitHub Pages URL or a signed desktop build capture.
- Recommended Store logo assets: `docs/release/microsoft-store/assets/official-logo/`.
- Orb drafts are reference-only: `docs/release/microsoft-store/assets/orb-draft/`.
- Do not buy, submit, or certify the Partner Center draft without explicit user approval for that final action.
