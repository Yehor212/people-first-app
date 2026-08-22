# Research: PWA Motion, Navigation, and Icon Quality

## Local findings

| Question | Current evidence | Planning decision | Status |
| --- | --- | --- | --- |
| Where is user motion preference read? | `src/hooks/useMotionPreference.ts:1-24` returns `reduceMotion`; `src/lib/motionPreference.ts:1-69` persists the existing setting and broadcasts its change. | Reuse the existing preference boundary; do not create a second store. Verify effective system preference composition before implementation. | VERIFIED source / UNVERIFIED runtime |
| Why is heatmap keyboard burden in scope? | `src/components/habit-hub/HabitHeatmapGrid.tsx:227-265` assigns `role=button` and `tabIndex=0` to every actionable cell in a 182-day grid. | Replace cell actions with a read-only summary plus one History action owned by the existing detail sheet. | VERIFIED source |
| What owns current tabs? | `src/components/habit-hub/HabitDetailSheet.tsx:431-466` owns local tab state, tablist, buttons, panels, and sheet. | Keep this owner; add IDs, keyboard roving/activation semantics, and motion-safe panel behavior without a competing route or overlay. | VERIFIED source |
| What calendar semantics already exist? | `src/features/journal/JournalCalendar.tsx:194-267` derives full localized date, entry count, mood label, private-mode suppression, and a visually hidden status string. | Normalize one accessible-name contract across compact/full calendar and emotion visuals; do not derive hidden mood in private mode. | VERIFIED source |
| Why bound journal cards? | `src/features/journal/JournalEntryList.tsx:2885-2936` maps all `visibleFilteredEntries`; no render-window bound is present in this path. | Derive a 96-card window from existing ordered local results with explicit continuation and focus/scroll contract. | VERIFIED source |
| Who owns PWA icons? | `scripts/generate-icons.cjs:11-35,452-545,560-575` owns leaf paths, public/docs manifests, revisions, and raster output; `scripts/check-brand-logo-assets.cjs` guards them. | Alter only generator/check/proof code if an evidence-backed icon change is needed; never hand-edit generated PNGs and never change native files in this feature. | VERIFIED source |

## External applicability, not proof

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) applies to focus visibility, keyboard operation, target size, and non-color meaning. It supports the acceptance criteria but does not prove ZenFlow’s final implementation.
- [MDN PWA icon guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons) supports multiple size and maskable install icons. The existing generator already produces these families; launcher/cache behavior remains `UNVERIFIED` until installed-PWA observation.
- [WAI-ARIA Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) informs associated tabs/panels and keyboard behavior. The final directionality/activation behavior must be tested against the existing lightweight local pattern.

## Rejected alternatives

| Alternative | Rejection reason | Reconsider only if |
| --- | --- | --- |
| Keep interactive cells but remove keyboard support | Removes a direct keyboard interaction without replacing it and leaves pointer-only hidden state. | A separately approved detailed history interaction provides equivalent semantic access. |
| Add a new full-screen history route or modal | Contradicts the scope’s current lightweight local-panel requirement and risks a new navigation/overlay owner. | User authorizes a navigation redesign with platform/recovery evidence. |
| Use a generic virtual-list package | Adds dependency and behavior surface without evidence that a local bounded slice cannot meet the exact 96-card requirement. | Profiling proves the local contract insufficient and user authorizes dependency review. |
| Swap the orb or leaf for a static/cheap asset under reduced motion | Violates the frozen canonical-orb and canonical-logo contracts. | Explicit rebrand/orb approval with independent visual review. |

## Open evidence

`UNVERIFIED`: installed Chrome/Edge, Safari/iOS Home Screen, Android, iOS wrapper, Tauri, screen-reader user evaluation, public cache refresh, launcher/OEM icon appearance, artistic/craft approval, and actual runtime/network capture. No item is marked as a completed implementation result.
