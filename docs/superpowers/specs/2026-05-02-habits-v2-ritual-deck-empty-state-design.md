# ZenFlow V2 Habits Ritual Deck Empty State Design Spec

Date: 2026-05-02
Status: Draft for product review
Scope: V2 Habits empty state, quick starter cards, template library sheet, and template setup entry. Filled-state habit rows are explicitly out of scope for this pass.

## 1. Executive Summary

The V2 Habits empty state should stop looking like a generic neon dashboard and become a premium ritual-selection surface.

The approved direction is:

- visual language: Ink and Paper Premium;
- hero concept: Ritual Deck;
- implementation scope: empty state plus template library only;
- interaction structure: a compact hero deck on the page, with the full template library opening as a deck-style bottom sheet.

The screen should feel like the user is choosing the first card from a small ritual deck, not configuring a productivity app. It should still be fast: the user can start with one tap, browse the full library, or create a custom habit.

## 2. Decisions Already Approved

### 2.1 Direction

Use `Ink and Paper Premium` as the baseline.

This means:

- warm dark paper surface;
- copper, parchment, sage, muted rose, and ink colors;
- less cyan/neon and fewer saturated gradients;
- premium editorial typography;
- emoji as modern ritual symbols, not as childish decoration;
- motion that feels like cards breathing, fanning, and being selected.

### 2.2 Scope

This pass covers:

- `HeroEmptyJourney`;
- quick starter habit cards inside the empty state;
- `HeroTemplateLibrarySheet`;
- the entry state of `HabitCreateSheet` when launched from a template;
- V2 presentation hooks inside `HabitCreationForm` only where needed to make template setup feel consistent.

This pass does not cover:

- filled-state habit rows;
- weekly habit cards;
- detail sheet redesign;
- nav shell redesign;
- V1 habit UI changes.

### 2.3 Structure

Use the `A + C` hybrid selected during brainstorming:

- page empty state uses a clean `Hero Deck + Sheet` structure;
- template library sheet itself becomes the richer `Library As Deck Sheet`.

## 3. Product Goal

When the user opens an empty Habits page, the screen should answer three questions immediately:

- What is this page for? Start one tiny ritual today.
- What should I do first? Pick one card or create a custom habit.
- Why does this feel like ZenFlow? The surface is ritualistic, warm, and distinctive, not generic wellness SaaS.

The empty state should be strong enough that it can become the visual foundation for future filled-state redesign work.

## 4. Visual System

### 4.1 Palette

The palette should move away from the current high-saturation cyan/green/purple grid.

Use these semantic families:

- Ink base: near-black brown/green-black background.
- Parchment text: warm off-white foreground.
- Copper action: primary warmth for create and selected states.
- Sage action: secondary success/growth accent.
- Muted rose: mind/rest accents.
- Faint gold: highlights, card rims, scan line.

Colors should remain implemented through tokens or shared V2 role helpers. Do not add scattered hardcoded colors in components unless a local CSS variable is created as a bridge and later tokenized.

### 4.2 Surface Treatment

The hero board should feel like raised dark paper:

- rounded but not pill-like for every surface;
- subtle border, inner hairline, and low-opacity paper grain;
- no oversized bright gradient slabs;
- one quiet glow around the deck scene;
- strong text hierarchy: heading, short body, then choices.

Quick starter cards should feel like small cards from the same deck:

- one emoji as a large symbol;
- one habit name;
- one compact meta hint such as `2 min`, `easy`, `today`, or the configured target;
- a thin category tint rather than a full saturated background.

## 5. Hero Empty State

### 5.1 Layout

The empty state layout remains one-screen-first on phone:

1. Page header: `Habits`.
2. Hero board with Ritual Deck scene and short copy.
3. Three journey chips, visually quieter than today.
4. Quick starter ritual cards.
5. Primary create button and secondary library button.

The current selected target in the screenshot, `Start first ritual`, should become more compact and less visually noisy. The scene and copy should sit together as one coherent hero, not as an icon block plus unrelated controls.

### 5.2 Ritual Deck Scene

The hero scene uses three overlapping cards:

- left card: water/body ritual;
- center card: movement/growth ritual;
- right card: reading/rest/mind ritual.

Each card is a small rounded paper tile with a large emoji. The card fan is the animated icon. It should not be a standalone generic icon.

Motion:

- cards breathe with a very small rotation/translate loop;
- a warm scan line or underline gently passes beneath the cards;
- on reduced motion, cards render statically with no loop.

### 5.3 Journey Chips

The current three onboarding chips are retained conceptually but restyled:

- identity;
- cue;
- repeat.

They should become compact parchment tabs or wax-label style chips. They must not dominate the hero. They should explain the method only after the user notices the ritual deck.

### 5.4 Quick Starter Cards

Starter cards should show the six existing routine starters:

- drink water;
- walk or run;
- stretch;
- read one page;
- breathing pause;
- gratitude.

Each card uses:

- a large emoji or existing template icon fallback;
- localized habit name;
- one meta hint;
- category-tinted edge or corner mark;
- pressed/selected feedback.

The card grid should stay two columns on phone. Text must not overflow in Ukrainian, Japanese, Arabic, or Hebrew.

### 5.5 CTA Row

The primary action remains custom habit creation.

The secondary action opens the full library.

The library button should no longer feel like a small afterthought. It can be shorter than the primary CTA, but it should read as a meaningful path: "open the deck", not just "misc library".

## 6. Template Library Deck Sheet

### 6.1 Sheet Layout

The library opens as a bottom sheet using the existing Vaul pattern.

The sheet should contain:

1. Drag handle.
2. Title and short subtitle.
3. Category tabs.
4. Deck-style template grid.
5. Safe-area padding at the bottom.

The sheet should feel like lifting a deck from the bottom of the screen.

### 6.2 Category Tabs

Keep the existing categories:

- body;
- mind;
- focus;
- rest;
- quit.

Restyle them as compact paper labels. Active category gets a copper/sage rim. Inactive categories stay quiet and readable.

### 6.3 Template Cards

Each template card should feel like a ritual card:

- emoji or icon symbol;
- localized title;
- compact target metadata;
- category visual mark;
- added state if the user already has that template.

Cards should be large enough to scan but not so large that only two are visible. The target is roughly four visible cards on a typical phone sheet after the header and category tabs.

### 6.4 Added State

The `Added` state should not use bright generic emerald badges.

Use:

- muted sage check;
- lower opacity;
- disabled pointer state;
- clear accessible label.

## 7. Template Setup Sheet

When the user chooses a template, the create/edit sheet opens in setup mode.

The top of the sheet should acknowledge the selected ritual:

- a small ritual card preview;
- template name;
- target metadata if present;
- simple/advanced control below.

The simple mode should lead with the settings the user is most likely to adjust:

- frequency;
- reminder;
- numerical target, if applicable.

The advanced mode remains available, but it should be visually quieter. This pass should not redesign every form control deeply unless a control currently breaks the new shell.

## 8. Motion Design

Motion should feel premium and restrained.

Use:

- deck fan/breathe on hero scene;
- selected quick card lift on tap;
- library sheet rise;
- template cards stagger into view;
- tiny pressed feedback on cards and CTA buttons.

Do not use:

- constant bouncing;
- large rotations;
- confetti in the empty state;
- motion that makes text shift or overflow.

Reduced motion behavior:

- no infinite loops;
- no fan animation;
- opacity and small scale only;
- all choices remain visible and usable.

## 9. Component and File Boundaries

Expected implementation area:

- `src/pages/nav-v2/habits/hero/HeroEmptyJourney.tsx`;
- `src/pages/nav-v2/habits/hero/HeroTemplateLibrarySheet.tsx`;
- `src/pages/nav-v2/habits/HabitCreateSheet.tsx`;
- `src/components/habit-creation-form/HabitCreationForm.tsx`;
- `src/components/habit-creation-form/TemplatePicker.tsx`, only if V2 setup entry needs consistency;
- `src/lib/nonOrbVisualRoles.ts`, only if shared role tones need a deck/paper variant;
- `src/lib/v2IconSystem.ts`, only if template symbol mapping needs modernization;
- i18n files only for new user-visible labels or meta hints.

Avoid spreading one-off classes across unrelated V2 pages. If a reusable deck card helper is useful, keep it local to the V2 habits hero folder unless another V2 surface actually needs it.

## 10. Data Flow

Data flow should remain the same:

- `HeroEmptyJourney` receives callbacks from `HabitsHeroZone`;
- quick card tap calls `onPickTemplate(template)`;
- library card tap calls `onPickTemplate(template)`;
- `HabitsPage` closes library and opens `HabitCreateSheet` with the selected template;
- `HabitCreateSheet` uses `useHabitForm.startFromTemplate(template.id)`;
- save still writes through the existing habit store path.

No new persistence model is needed.

## 11. Accessibility and Localization

Touch targets remain at least 44px.

Every card must have a stable accessible name:

- quick starter cards use localized template names;
- library cards use localized template names and target metadata where useful;
- added state is announced without relying on color.

Text must fit in:

- Ukrainian;
- Japanese;
- Arabic;
- Hebrew;
- German;
- French;
- Spanish;
- English.

RTL should preserve card order and avoid breaking the deck scene. The decorative deck scene is `aria-hidden`; the actual selectable cards carry accessible labels.

## 12. Verification Plan

Before shipping implementation:

- run focused Vitest for `HeroEmptyJourney`, `HeroTemplateLibrarySheet`, and related V2 Habits tests;
- run focused ESLint on changed files;
- run `npm run typecheck`;
- run `npm run check:colors` and `npm run check:visual`;
- browser-check phone URL: `/people-first-app/habits?nav=v2&dev=true&navLayout=phone`;
- verify library sheet opens and cards are selectable;
- verify reduced-motion mode has no looping animation;
- verify text does not overflow on the visible Ukrainian empty state.

If dependencies or local environment block a command, mark it explicitly as blocked instead of claiming it passed.

## 13. Risks

### 13.1 Too Much Decoration

The deck scene can become decorative noise if it competes with the quick starter cards. Keep it compact and let cards remain the action.

### 13.2 Emoji Tone

Emoji can make the product feel modern or childish. Use them as premium ritual symbols on paper cards, not as scattered stickers.

### 13.3 Existing Dirty Tree

The current worktree already contains broad unrelated changes. Implementation must preserve those changes and stage only files touched for this feature.

### 13.4 Scope Creep

Filled-state habits are intentionally out of scope. Do not redesign `HeroHabitRow` or weekly filled-state cards in this pass unless a compile error forces a narrow compatibility fix.

## 14. Open Product Choice

No open product choice remains for this spec. The selected direction is `Ink and Paper Premium` with `Ritual Deck`, implemented as `Hero Deck + Library Deck Sheet`.

The next step after user review is an implementation plan, not immediate coding.
