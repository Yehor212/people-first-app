# Accessibility and Visual Checklist

**Feature**: [PWA Motion, Navigation, and Icon Quality](../spec.md)
**Planning result**: Checks are implementation acceptance gates; no runtime/artistic pass is claimed.

## Motion and visual integrity

- [ ] Each affected motion is recorded as essential, event, decorative, or canonical in the contract.
- [ ] The 79 baseline indefinite emotion-SMIL nodes are all controlled before paint and remain stable for six seconds under effective reduced motion.
- [ ] The checked registry accounts for all 34 baseline JavaScript-loop waiver files and rejects unregistered additions.
- [ ] Effective reduced motion causes zero optional loop/asset requests and no decorative state change after six seconds.
- [ ] Static reduced-motion presentation retains functional text, controls, focus, and status.
- [ ] `ValenceOrb` and `MiniValenceOrb` are unchanged; no visual-quality downgrade is used to satisfy performance.
- [ ] Visual critic reviews implementation artifacts after rendering; Technical, Visual Runtime, Artistic/Craft, Motion, Model, and Plan statuses remain separate.

## Tabs and heatmap

- [ ] Every custom production tablist uses the same complete contract: one keyboard Tab stop enters/leaves it; triggers have `aria-controls`, panels have `aria-labelledby`, and exactly one selected state is exposed.
- [ ] Arrow/Home/End/Enter/Space behavior is tested under `dir=ltr` and `dir=rtl`.
- [ ] Interactive controls are at least 44px in both touch and keyboard-reachable geometry.
- [ ] The 182-day summary has zero interactive/focusable day cells, a non-color legend, and exactly one accessible History action.
- [ ] Focus, Escape/close, and Android back remain with the existing sheet owner; device proof is not inferred.

## Calendar, emotions, and journal list

- [ ] Compact/full calendar accessible names include localized date plus permitted entry and mood/status facts.
- [ ] `AnimatedCalendar` includes visible metric facts and rejects raw persistence tokens in accessible output.
- [ ] Private mode omits suppressed facts; color and emotion icon alone do not carry required meaning.
- [ ] Each emotion visual is either decorative with adjacent equivalent text or localized and labelled.
- [ ] The rendered journal text-result path mounts at most 96 cards; continuation preserves order, identity, focus, scroll, and card actions.
- [ ] Empty, unavailable, privacy, and error states remain honest; no synthetic journal content enters production runtime.

## Icons and platform proof

- [ ] PWA icon changes use generator sources only; `LEAF_BODY` and `LEAF_STEM` do not change.
- [ ] Structural checks and a manually inspected proof sheet cover maskable and tiny anti-blob assets.
- [ ] Web/Vite, installed PWA, Android, iOS, Desktop, Store/Release, Accessibility, Performance, Security/Privacy, Testing, and Operations are each explicitly PASS/FAIL/UNVERIFIED at handoff.
- [ ] Installed PWA/device/store/public-cache/artistic proof is not inferred from build or static checks.
