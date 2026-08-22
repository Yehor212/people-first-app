# Settings Day Cosmic Background Implementation Plan

> **Governance update (2026-08-14):** Execute only an explicitly authorized task and do so SOLO. Any custom-role, council, subagent-driven, or automatic next-task instruction below is retired and must not be executed.

**Goal:** Make Settings in the `paper` theme visibly continue the canonical daytime Mood atmosphere without copying the visual system, introducing background motion, or changing Mood/Orb, Ink, OLED, data, or copy.

**Architecture:** Extend `DayCosmicBackground` with a backwards-compatible `presentation="settings"` mode. The default Mood presentation retains every current layer and count; the Settings presentation reuses the same palette and layer source, renders every third deterministic decorative point, and forces all decoration static. `SettingsPage` mounts the shared scene only while `appliedTheme === "paper"`; route-scoped CSS owns fixed viewport/rail placement, opaque accessibility fallbacks, and no-blur cards.

**Tech Stack:** React 18, TypeScript, Vitest/Testing Library, Vite, repository theme CSS, Playwright CLI.

## Global Constraints

- No new dependency, translation key, remote asset, storage/network operation, mock production data, commit, push, or deploy.
- Preserve the default `DayCosmicBackground` output used by Mood and the separate `OrbDayFlourish`/`ValenceOrb` tree.
- The Settings scene is decorative, `aria-hidden`, pointer-free, static, and absent from Ink/OLED DOM.
- Use logical rail offsets and `var(--app-viewport-height)`; preserve safe-area foreground ownership.
- Normal text contrast must measure at least 4.5:1; for the captured Paper Settings time palettes, target at least 5:1 so the local proof is not balanced on the normative threshold. Meaningful UI boundaries/focus must reach at least 3:1.
- Stop on active infinite decoration, theme leakage, Mood/Orb diff, overflow, console/runtime failure, long task above 500 ms, or LoAF above 250 ms.

---

### Task 1: Add the shared static presentation contract

**Files:**

- Modify: `src/pages/nav-v2/__tests__/DayCosmicBackground.test.tsx`
- Modify: `src/pages/nav-v2/DayCosmicBackground.tsx`
- Modify: `src/pages/nav-v2/DayCosmicBackground.css`

**Interfaces:**

- Consumes: existing deterministic day palettes and particle arrays.
- Produces: `<DayCosmicBackground presentation="settings" />`; default remains `"orb"`.

- [ ] **Step 1: Write the failing component test**

```tsx
const { container } = render(<DayCosmicBackground presentation="settings" />);
expect(screen.getByTestId("day-cosmic-background")).toHaveAttribute(
  "data-presentation",
  "settings"
);
expect(screen.getByTestId("day-cosmic-background")).toHaveAttribute("data-animated", "false");
expect(container.querySelectorAll(".day-cosmic__photon")).toHaveLength(26);
expect(container.querySelectorAll(".day-cosmic__mote")).toHaveLength(12);
expect(container.querySelectorAll(".day-cosmic__sun-thread")).toHaveLength(6);
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/pages/nav-v2/__tests__/DayCosmicBackground.test.tsx --reporter=verbose`

Expected: assertion failure because the current component exposes neither the presentation contract nor the reduced static field.

- [ ] **Step 3: Implement the minimum shared mode**

```tsx
interface DayCosmicBackgroundProps {
  presentation?: "orb" | "settings";
}

const animated = presentation === "orb" && shouldAnimate;
const visibleMotes =
  presentation === "settings" ? motes.filter((_, index) => index % 3 === 0) : motes;
```

Apply the same deterministic every-third selection to photons and threads. Put `data-presentation` and `data-animated` on the root and use `animated` on all three field containers. Add route-scoped CSS that disables animation, transition, and `will-change` for the Settings presentation, including pseudo-elements.

- [ ] **Step 4: Run GREEN**

Run the same focused Vitest command. Expected: all file tests pass and existing Mood counts remain unchanged.

### Task 2: Mount the day scene only in Paper Settings

**Files:**

- Modify: `src/pages/nav-v2/__tests__/SettingsPage.test.tsx`
- Modify: `src/pages/nav-v2/SettingsPage.tsx`

**Interfaces:**

- Consumes: `useThemeStore(state => state.appliedTheme)` and the new Settings presentation.
- Produces: `data-testid="settings-day-cosmic-backdrop"` before the `z-10` Settings content.

- [ ] **Step 1: Write failing Settings integration assertions**

```tsx
expect(screen.getByTestId("settings-day-cosmic-backdrop")).toHaveAttribute("aria-hidden", "true");
expect(screen.getByTestId("day-cosmic-background")).toHaveAttribute(
  "data-presentation",
  "settings"
);
```

Add parameterized renders proving the day wrapper is absent when `appliedTheme` is `ink` or `oled`.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/pages/nav-v2/__tests__/SettingsPage.test.tsx --reporter=verbose`

Expected: missing `settings-day-cosmic-backdrop`.

- [ ] **Step 3: Implement conditional mount**

```tsx
const appliedTheme = useThemeStore((state) => state.appliedTheme);

{
  appliedTheme === "paper" ? (
    <div
      aria-hidden="true"
      className="settings-day-cosmic-backdrop"
      data-testid="settings-day-cosmic-backdrop"
    >
      <DayCosmicBackground presentation="settings" />
    </div>
  ) : null;
}
```

Keep the approved emerald night component and `Bloom` foreground order unchanged.

- [ ] **Step 4: Run GREEN**

Run the same Settings test file. Expected: Paper assertions pass; Ink/OLED assertions prove no day DOM.

### Task 3: Expose the scene with readable static surfaces

**Files:**

- Modify: `src/styles/themes.bridge.test.ts`
- Modify: `src/styles/themes.css`

**Interfaces:**

- Consumes: existing paper Settings tokens and shared day layer classes.
- Produces: fixed paper-only route wrapper, logical desktop rail offsets, transparent page canvas, solid default cards, optional no-blur translucent gradient, and accessibility fallbacks.

- [ ] **Step 1: Write the failing static CSS contract**

Assert the CSS contains paper-only day wrapper rules, `inset-inline-start` rail handling, `animation: none`, `will-change: auto`, no backdrop blur in the day block, a solid card baseline, a `prefers-reduced-transparency` fallback, and forced-colors/high-contrast hiding.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/styles/themes.bridge.test.ts --reporter=verbose`

Expected: missing Settings day CSS contract.

- [ ] **Step 3: Implement route-scoped CSS**

Use `var(--app-viewport-height)`, logical rail offsets `16rem`/`4.5rem`, and existing `--settings-v2-*` tokens. Keep the baseline card surface solid; inside `prefers-reduced-transparency: no-preference`, use a restrained translucent gradient with `backdrop-filter: none`. Hide the decorative wrapper for forced colors, more contrast, app high contrast, and reduced transparency.

Scope stronger foreground and muted-text tokens to Paper Settings only. Do not change the root Paper tokens used by Mood or other routes. The exact every-pixel palette audit is the deciding proof; a result only marginally above 4.5:1 must be strengthened and recaptured before review.

- [ ] **Step 4: Run GREEN**

Run focused Day, Settings, and theme bridge tests together.

### Task 4: Verify runtime, craft, and blast radius

**Files:**

- Evidence only under `output/playwright/settings-day-final/`.

- [ ] **Step 1: Run static and build gates**

Run focused Vitest, TypeScript, scoped lint, production build, `check:visual`, `check:canonical-orbs`, `check:no-ai-templates`, production-data diff, and local Snyk fallback when callable.

- [ ] **Step 2: Capture fresh browser evidence**

Use a production-equivalent preview and Playwright CLI for 320×568, 390×844, and desktop expanded/compact; Paper overview/detail; Ink and OLED regression; ar/he RTL; reduced motion/transparency; full scroll. Record console/network failures, active animations, overflow, target sizing, pixel contrast, long tasks, LoAF, and screenshots.

- [ ] **Step 3: Run independent visual review**

Apply the Visual Integrity Critic rubric to the current Mood reference and final Settings phone/desktop artifacts. Technical success does not imply artistic success.

- [ ] **Step 4: Run the final SOLO evidence review**

Create a hash-bound packet containing the raw request, final diff hash, commands, screenshots, metrics, and explicit `UNVERIFIED` rows. The active agent rechecks every source and resolves each reproducible in-scope blocker before repeating affected checks.

## Rollback

Remove the new `presentation` branch and Settings wrapper/CSS/tests. Because the default presentation and Mood/Orb tree remain untouched, rollback does not require data, storage, or native migration.

## Self-Review

- Spec coverage: Paper visual continuity, static motion, theme isolation, performance, accessibility, RTL, safe areas, rollback, and final evidence are mapped above.
- Type consistency: one optional `presentation` union is consumed by `SettingsPage`; no parallel palette type is introduced.
- Placeholder scan: the plan contains executable paths, assertions, commands, thresholds, and explicit unavailable-proof handling.
