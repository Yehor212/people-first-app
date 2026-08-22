# Planning Feature Layer Implementation Plan

> **Governance update (2026-08-14):** Execute only an explicitly authorized task and do so SOLO. Use `superpowers:executing-plans` only for an approved plan; do not invoke subagents or auto-start the next task. Existing checkboxes are tracking only.

**Goal:** превратить V2 `Planning` не в еще одну перегруженную вкладку, а в логичный темный центр дня: сейчас/следующее, расписание, подготовка, фокус, завершение и рефлексия живут в одном управляемом пользовательском потоке.

**Architecture:** оставить `planning` пятой primary V2 page, а не добавлять шестую глобальную вкладку. Внутри `PlanningPage` добавить локальный `Feature Layer`: детерминированную модель состояния дня, компактный переключатель режимов, contextual action panel и review lane поверх уже перенесенных V1 `ScheduleTimeline` и `FocusTimer`. Новых Supabase schema/migration не делать; использовать существующие Zustand/IndexedDB/sync paths.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind/shadcn tokens, Zustand, IndexedDB/Dexie, existing syncSetting/triggerSync, custom i18n for `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, `he`, Playwright/Vitest.

---

## Product Decision

`Feature tab` для Planning должен быть внутренним feature layer, а не новой primary navigation page.

Причина: V2 уже имеет 5 главных страниц (`orb`, `habits`, `diary`, `planning`, `settings`), keyboard route sequence `Ctrl+1..5`, drawer/rail contracts, public route smoke и performance budgets. Шестая primary page ухудшит навигацию и заставит менять shell, i18n, e2e, auth redirect paths, budgets и user mental model. Внутренний слой дает нужную глубину без навигационного шума.

## Current State Evidence

- `src/pages/nav-v2/planning/PlanningPage.tsx` уже подключает `GlobalScheduleBar`, `ScheduleTimeline`, `FocusTimer`, manual schedule sync через `syncSetting("zenflow-schedule-events", nextEvents)` и `triggerSync()`.
- `src/components/navigation-v2/NavV2Orchestrator.tsx` уже lazy-loads `PlanningPage`, показывает `V2FocusMiniPlayer` и `V2MindfulMomentLayer`.
- `src/hooks/useNavigationV2.ts` уже фиксирует `NAV_V2_PAGES = ["orb", "habits", "diary", "planning", "settings"]`.
- `src/components/navigation-v2/V2FocusMiniPlayer.tsx` уже ведет активный focus timer обратно на `planning`.
- `src/pages/nav-v2/__tests__/PlanningPage.test.tsx` уже покрывает Now/Next strip, schedule add/delete sync, non-manual delete guard, focus completion path и V1 dark theme scope.

## User-Level Interaction Model

### Level 1: First Open / Empty Day

- User sees dark Planning page, empty Now/Next strip, `Мій світ` timeline, Focus block.
- The feature layer shows one primary suggestion: add the first event, start a 25/5 focus block, or review habits with scheduled reminders.
- Empty states remain actionable; no dead cards.

### Level 2: Day With Schedule

- Now/Next strip answers: what is happening now, what is next, how much time is left.
- Feature layer prioritizes the next useful action:
  - event is soon: show prepare action;
  - free gap is long enough: suggest focus session length;
  - current event is active: show details and quick complete/reflect affordance;
  - day is overloaded: show a conflict/pressure cue without creating guilt copy.

### Level 3: Focus Flow

- User can start focus from Focus block or contextual action panel.
- Active timer survives navigation via existing `useFocusTimer` persistence and mini-player bridge.
- Completion continues through existing V1 reward/sync/reflection path, then opens a Planning review lane.

### Level 4: Review / Reflection

- After focus or event completion, Planning asks for a tiny reflection only when useful.
- Review lane can prefill Diary text through existing journal prompt bridge later, but Phase 1 does not write journal entries automatically.
- User can dismiss and continue; no blocker modal for every session.

### Level 5: Cross-Device / Offline

- Manual schedule events continue using existing schedule store and sync setting key.
- Habit/generated events remain read-only in Planning.
- Offline mutations update local store immediately and queue through existing sync paths.
- No new user-data schema in Phase 1.

## Feature Layer Requirements

### Core Modes

Use a segmented control or compact rail, not global navigation tabs:

- `today`: overview, Now/Next, recommendations.
- `schedule`: timeline and event actions.
- `focus`: focus timer and focus presets.
- `review`: post-focus/event reflection and day closure.

Mobile default: `today`, with inline sections scrollable in order.
Desktop default: `today` action panel beside schedule/focus columns.

### Deterministic Priority Logic

The layer should compute a single `primaryIntent`:

```ts
export type PlanningPrimaryIntent =
  | "add_first_event"
  | "prepare_next_event"
  | "continue_current_event"
  | "start_focus_gap"
  | "resume_focus"
  | "review_recent_focus"
  | "resolve_conflict"
  | "close_day";
```

Priority order:

1. Active focus timer -> `resume_focus`.
2. Recently completed focus with no reflection -> `review_recent_focus`.
3. Current event exists -> `continue_current_event`.
4. Next event starts within 20 minutes -> `prepare_next_event`.
5. Schedule has overlapping events -> `resolve_conflict`.
6. No events today -> `add_first_event`.
7. Gap until next event is at least 25 minutes -> `start_focus_gap`.
8. Evening with events/focus done -> `close_day`.

### Data Boundaries

- Read: `scheduleEvents`, generated habit events, `focusSessions`, focus bridge state, `isLoading`.
- Write: manual schedule events through existing `setScheduleEvents`, `syncSetting`, `triggerSync`.
- Do not write generated habit/google/task events from Planning.
- Do not introduce Supabase tables or migrations.
- Optional local UI preference only: last selected internal Planning mode, via existing safe storage helper, not direct `localStorage`.

### Accessibility And Platform Rules

- Every mode trigger is a real `button`, min 44px target.
- `aria-pressed` for mode triggers, `aria-live="polite"` for Now/Next changes.
- RTL: mode order and spacing must work for `ar` and `he`.
- Android back: close Planning modal/sheet/detail before leaving page.
- iOS keyboard: focus label input must not be hidden by nav/mini-player; keep existing keyboard-hide behavior for mini-player.
- Desktop: keyboard shortcuts remain `Ctrl+1..5`; internal mode switching uses Tab/Enter/Arrow keys inside the segment only.

## File Structure

### Create

- `src/pages/nav-v2/planning/planningFeatureModel.ts`
  - Pure functions for current event, next event, gaps, conflicts, primary intent, mode badges.

- `src/pages/nav-v2/planning/PlanningModeRail.tsx`
  - Internal mode selector with icons, `aria-pressed`, RTL-safe layout, 44px targets.

- `src/pages/nav-v2/planning/PlanningActionPanel.tsx`
  - Renders deterministic primary action and secondary actions from the model.

- `src/pages/nav-v2/planning/PlanningReviewLane.tsx`
  - Non-blocking post-focus/event review surface.

- `src/pages/nav-v2/planning/__tests__/planningFeatureModel.test.ts`
  - Unit tests for priority logic, gaps, conflicts, read-only source handling.

- `e2e/planning-feature-layer.spec.ts`
  - Phone/web runtime checks for internal modes, dark theme, touch targets, RTL smoke.

### Modify

- `src/pages/nav-v2/planning/PlanningPage.tsx`
  - Consume model, render internal mode rail/action panel/review lane, preserve dark V1 scope.

- `src/pages/nav-v2/__tests__/PlanningPage.test.tsx`
  - Verify feature layer renders, actions are routed correctly, focus/schedule behavior remains intact.

- `src/i18n/types.ts`
  - Add typed keys for feature layer labels and concise action copy.

- `src/i18n/languages/{en,uk,es,de,fr,ja,ar,he}.ts`
  - Add real translations. No visible English fallback as primary copy.

- `e2e/deploy-smoke.spec.ts`
  - Keep route boot check; optionally assert feature layer marker on Planning route.

## Implementation Tasks

### Task 1: Pure Planning Model

**Files:**
- Create: `src/pages/nav-v2/planning/planningFeatureModel.ts`
- Create: `src/pages/nav-v2/planning/__tests__/planningFeatureModel.test.ts`

- [ ] **Step 1: Write failing tests for priority order**

```ts
import { describe, expect, it } from "vitest";
import { getToday } from "@/lib/utils";
import { derivePlanningFeatureModel } from "../planningFeatureModel";
import type { FocusSession, ScheduleEvent } from "@/types";

const today = getToday();

function event(partial: Partial<ScheduleEvent>): ScheduleEvent {
  return {
    id: partial.id ?? "event-1",
    title: partial.title ?? "Review",
    startHour: partial.startHour ?? 10,
    startMinute: partial.startMinute ?? 0,
    endHour: partial.endHour ?? 10,
    endMinute: partial.endMinute ?? 30,
    color: partial.color ?? "work",
    date: partial.date ?? today,
    source: partial.source ?? "manual",
    isEditable: partial.isEditable ?? true,
  };
}

describe("derivePlanningFeatureModel", () => {
  it("prioritizes an active focus timer above schedule suggestions", () => {
    const model = derivePlanningFeatureModel({
      now: new Date(`${today}T09:50:00`),
      events: [event({ startHour: 10 })],
      focusSessions: [],
      focusBridge: { endTime: Date.now() + 1200000, isRunning: true, isBreak: false, label: "Deep work" },
    });

    expect(model.primaryIntent).toBe("resume_focus");
    expect(model.recommendedMode).toBe("focus");
  });

  it("suggests preparing when the next event starts within twenty minutes", () => {
    const model = derivePlanningFeatureModel({
      now: new Date(`${today}T09:45:00`),
      events: [event({ startHour: 10, startMinute: 0 })],
      focusSessions: [],
      focusBridge: { endTime: null, isRunning: false, isBreak: false, label: "" },
    });

    expect(model.primaryIntent).toBe("prepare_next_event");
    expect(model.nextEvent?.title).toBe("Review");
  });

  it("detects overlapping schedule events as a conflict", () => {
    const model = derivePlanningFeatureModel({
      now: new Date(`${today}T08:00:00`),
      events: [
        event({ id: "a", startHour: 10, endHour: 11 }),
        event({ id: "b", startHour: 10, startMinute: 30, endHour: 11, endMinute: 30 }),
      ],
      focusSessions: [],
      focusBridge: { endTime: null, isRunning: false, isBreak: false, label: "" },
    });

    expect(model.primaryIntent).toBe("resolve_conflict");
    expect(model.conflicts).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the red test**

Run: `npm test -- src/pages/nav-v2/planning/__tests__/planningFeatureModel.test.ts`

Expected: FAIL because `planningFeatureModel.ts` does not exist.

- [ ] **Step 3: Implement the pure model**

```ts
import type { FocusSession, ScheduleEvent } from "@/types";
import { formatDate } from "@/lib/utils";

export type PlanningMode = "today" | "schedule" | "focus" | "review";

export type PlanningPrimaryIntent =
  | "add_first_event"
  | "prepare_next_event"
  | "continue_current_event"
  | "start_focus_gap"
  | "resume_focus"
  | "review_recent_focus"
  | "resolve_conflict"
  | "close_day";

export interface PlanningFocusBridgeState {
  endTime: number | null;
  isRunning: boolean;
  isBreak: boolean;
  label: string;
}

export interface PlanningConflict {
  first: ScheduleEvent;
  second: ScheduleEvent;
}

export interface PlanningFeatureModel {
  today: string;
  currentEvent: ScheduleEvent | null;
  nextEvent: ScheduleEvent | null;
  minutesUntilNext: number | null;
  nextFreeGapMinutes: number | null;
  conflicts: PlanningConflict[];
  primaryIntent: PlanningPrimaryIntent;
  recommendedMode: PlanningMode;
  manualEventCount: number;
  readOnlyEventCount: number;
  focusMinutesToday: number;
}

interface DerivePlanningFeatureModelInput {
  now: Date;
  events: ScheduleEvent[];
  focusSessions: FocusSession[];
  focusBridge: PlanningFocusBridgeState;
}

function minutesOf(hour: number, minute: number): number {
  return hour * 60 + minute;
}

function eventStart(event: ScheduleEvent): number {
  return minutesOf(event.startHour, event.startMinute);
}

function eventEnd(event: ScheduleEvent): number {
  return minutesOf(event.endHour, event.endMinute);
}

function isManual(event: ScheduleEvent): boolean {
  return (!event.source || event.source === "manual") && event.isEditable !== false;
}

export function derivePlanningFeatureModel({
  now,
  events,
  focusSessions,
  focusBridge,
}: DerivePlanningFeatureModelInput): PlanningFeatureModel {
  const today = formatDate(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayEvents = events
    .filter((event) => event.date === today)
    .sort((a, b) => eventStart(a) - eventStart(b));

  const currentEvent = todayEvents.find(
    (event) => nowMinutes >= eventStart(event) && nowMinutes < eventEnd(event),
  ) ?? null;
  const nextEvent = todayEvents.find((event) => eventStart(event) > nowMinutes) ?? null;
  const minutesUntilNext = nextEvent ? Math.max(0, eventStart(nextEvent) - nowMinutes) : null;
  const nextFreeGapMinutes = nextEvent
    ? Math.max(0, eventStart(nextEvent) - nowMinutes)
    : Math.max(0, 22 * 60 - nowMinutes);

  const conflicts: PlanningConflict[] = [];
  for (let i = 0; i < todayEvents.length - 1; i += 1) {
    const first = todayEvents[i];
    const second = todayEvents[i + 1];
    if (eventEnd(first) > eventStart(second)) {
      conflicts.push({ first, second });
    }
  }

  const focusMinutesToday = focusSessions
    .filter((session) => session.date === today && session.status !== "aborted")
    .reduce((total, session) => total + session.duration, 0);

  const hasActiveFocus = focusBridge.isRunning || focusBridge.endTime !== null;
  const hasUnreflectedFocus = focusSessions.some(
    (session) => session.date === today && session.status === "completed" && session.reflection == null,
  );

  let primaryIntent: PlanningPrimaryIntent;
  let recommendedMode: PlanningMode;

  if (hasActiveFocus) {
    primaryIntent = "resume_focus";
    recommendedMode = "focus";
  } else if (hasUnreflectedFocus) {
    primaryIntent = "review_recent_focus";
    recommendedMode = "review";
  } else if (currentEvent) {
    primaryIntent = "continue_current_event";
    recommendedMode = "schedule";
  } else if (minutesUntilNext !== null && minutesUntilNext <= 20) {
    primaryIntent = "prepare_next_event";
    recommendedMode = "today";
  } else if (conflicts.length > 0) {
    primaryIntent = "resolve_conflict";
    recommendedMode = "schedule";
  } else if (nextFreeGapMinutes >= 25) {
    primaryIntent = "start_focus_gap";
    recommendedMode = "focus";
  } else if (todayEvents.length === 0) {
    primaryIntent = "add_first_event";
    recommendedMode = "schedule";
  } else {
    primaryIntent = "close_day";
    recommendedMode = "review";
  }

  return {
    today,
    currentEvent,
    nextEvent,
    minutesUntilNext,
    nextFreeGapMinutes,
    conflicts,
    primaryIntent,
    recommendedMode,
    manualEventCount: todayEvents.filter(isManual).length,
    readOnlyEventCount: todayEvents.filter((event) => !isManual(event)).length,
    focusMinutesToday,
  };
}
```

- [ ] **Step 4: Run model tests green**

Run: `npm test -- src/pages/nav-v2/planning/__tests__/planningFeatureModel.test.ts`

Expected: PASS.

### Task 2: Internal Mode Rail

**Files:**
- Create: `src/pages/nav-v2/planning/PlanningModeRail.tsx`
- Modify: `src/pages/nav-v2/__tests__/PlanningPage.test.tsx`

- [ ] **Step 1: Add failing PlanningPage test for internal modes**

Add test:

```ts
it("renders Planning internal mode rail with accessible pressed state", () => {
  render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

  expect(screen.getByTestId("planning-mode-rail")).toBeInTheDocument();
  expect(screen.getByTestId("planning-mode-today")).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByTestId("planning-mode-focus"));
  expect(screen.getByTestId("planning-mode-focus")).toHaveAttribute("aria-pressed", "true");
});
```

- [ ] **Step 2: Run red test**

Run: `npm test -- src/pages/nav-v2/__tests__/PlanningPage.test.tsx`

Expected: FAIL because mode rail is not rendered.

- [ ] **Step 3: Implement `PlanningModeRail`**

```tsx
import { CalendarDays, CheckCircle2, Clock3, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanningMode } from "./planningFeatureModel";

interface PlanningModeRailProps {
  activeMode: PlanningMode;
  onModeChange: (mode: PlanningMode) => void;
  labels: Record<PlanningMode, string>;
}

const MODE_ITEMS = [
  { id: "today", icon: Clock3 },
  { id: "schedule", icon: CalendarDays },
  { id: "focus", icon: Timer },
  { id: "review", icon: CheckCircle2 },
] as const;

export function PlanningModeRail({ activeMode, onModeChange, labels }: PlanningModeRailProps) {
  return (
    <div
      data-testid="planning-mode-rail"
      className="flex gap-2 overflow-x-auto rounded-2xl border border-border/45 bg-card/70 p-1 backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)]"
      role="group"
    >
      {MODE_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = activeMode === item.id;
        return (
          <button
            key={item.id}
            type="button"
            data-testid={`planning-mode-${item.id}`}
            aria-pressed={active}
            onClick={() => onModeChange(item.id)}
            className={cn(
              "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{labels[item.id]}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Wire mode state in `PlanningPage`**

Add `useState<PlanningMode>("today")`; render `PlanningModeRail` above dark V1 scope. Use `recommendedMode` only as initial suggestion, not automatic mode stealing after the user changes mode.

- [ ] **Step 5: Run tests green**

Run: `npm test -- src/pages/nav-v2/__tests__/PlanningPage.test.tsx`

Expected: PASS.

### Task 3: Contextual Action Panel

**Files:**
- Create: `src/pages/nav-v2/planning/PlanningActionPanel.tsx`
- Modify: `src/pages/nav-v2/planning/PlanningPage.tsx`
- Modify: `src/pages/nav-v2/__tests__/PlanningPage.test.tsx`

- [ ] **Step 1: Add failing test for primary action routing**

```ts
it("routes the Planning primary action to schedule or focus based on model intent", async () => {
  render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

  fireEvent.click(screen.getByTestId("planning-primary-action"));
  expect(screen.getByTestId("planning-mode-schedule")).toHaveAttribute("aria-pressed", "true");
});
```

- [ ] **Step 2: Implement action panel**

The panel receives `model`, `labels`, and callbacks:

```tsx
import { ArrowRight, CalendarPlus, CheckCircle2, Timer } from "lucide-react";
import type { PlanningFeatureModel, PlanningMode } from "./planningFeatureModel";

interface PlanningActionPanelProps {
  model: PlanningFeatureModel;
  labels: Record<string, string>;
  onModeChange: (mode: PlanningMode) => void;
  onScrollToTimeline: () => void;
}

export function PlanningActionPanel({ model, labels, onModeChange, onScrollToTimeline }: PlanningActionPanelProps) {
  const action = (() => {
    if (model.primaryIntent === "add_first_event") {
      return { icon: CalendarPlus, label: labels.planningActionAddEvent, mode: "schedule" as PlanningMode };
    }
    if (model.primaryIntent === "resume_focus" || model.primaryIntent === "start_focus_gap") {
      return { icon: Timer, label: labels.planningActionStartFocus, mode: "focus" as PlanningMode };
    }
    if (model.primaryIntent === "review_recent_focus" || model.primaryIntent === "close_day") {
      return { icon: CheckCircle2, label: labels.planningActionReview, mode: "review" as PlanningMode };
    }
    return { icon: ArrowRight, label: labels.planningActionOpenSchedule, mode: "schedule" as PlanningMode };
  })();

  const Icon = action.icon;

  return (
    <section
      data-testid="planning-action-panel"
      className="rounded-2xl border border-border/45 bg-card/72 p-4 shadow-sm backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)]"
    >
      <p className="text-sm font-semibold text-foreground">{labels.planningActionTitle}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{labels[`planningIntent_${model.primaryIntent}`]}</p>
      <button
        type="button"
        data-testid="planning-primary-action"
        onClick={() => {
          onModeChange(action.mode);
          if (action.mode === "schedule") onScrollToTimeline();
        }}
        className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {action.label}
      </button>
    </section>
  );
}
```

- [ ] **Step 3: Wire panel into PlanningPage**

Place it after Now/Next strip and before the V1 dark scope. On desktop, it can sit beside mode rail later; Phase 1 keeps a single column to reduce layout risk.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/pages/nav-v2/__tests__/PlanningPage.test.tsx src/pages/nav-v2/planning/__tests__/planningFeatureModel.test.ts`

Expected: PASS.

### Task 4: Review Lane Without V1 Stats Navigation

**Files:**
- Create: `src/pages/nav-v2/planning/PlanningReviewLane.tsx`
- Modify: `src/pages/nav-v2/planning/PlanningPage.tsx`
- Modify: `src/pages/nav-v2/__tests__/planningFocusTransferContract.test.ts`

- [ ] **Step 1: Add contract test**

Assert `PlanningReviewLane` is rendered from Planning and does not import V1 `setActiveTab` or stats navigation.

- [ ] **Step 2: Implement non-blocking lane**

Use existing `focusSessions` to show completed minutes today, last session label, and a button to switch internal mode back to `focus` or `schedule`. Do not auto-write diary entries.

- [ ] **Step 3: Run tests**

Run: `npm test -- src/pages/nav-v2/__tests__/planningFocusTransferContract.test.ts src/pages/nav-v2/__tests__/PlanningPage.test.tsx`

Expected: PASS.

### Task 5: i18n For 8 Languages

**Files:**
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/languages/en.ts`
- Modify: `src/i18n/languages/uk.ts`
- Modify: `src/i18n/languages/es.ts`
- Modify: `src/i18n/languages/de.ts`
- Modify: `src/i18n/languages/fr.ts`
- Modify: `src/i18n/languages/ja.ts`
- Modify: `src/i18n/languages/ar.ts`
- Modify: `src/i18n/languages/he.ts`

- [ ] **Step 1: Add typed keys**

Add keys:

```ts
planningModeToday: string;
planningModeSchedule: string;
planningModeFocus: string;
planningModeReview: string;
planningActionTitle: string;
planningActionAddEvent: string;
planningActionStartFocus: string;
planningActionReview: string;
planningActionOpenSchedule: string;
planningIntent_add_first_event: string;
planningIntent_prepare_next_event: string;
planningIntent_continue_current_event: string;
planningIntent_start_focus_gap: string;
planningIntent_resume_focus: string;
planningIntent_review_recent_focus: string;
planningIntent_resolve_conflict: string;
planningIntent_close_day: string;
```

- [ ] **Step 2: Add real translations**

No English-only visible fallback. Keep strings short for mobile chips.

- [ ] **Step 3: Verify i18n**

Run: `npm run i18n:check && npm run i18n:deep`

Expected: PASS for all 8 languages.

### Task 6: Runtime And Cross-Platform QA

**Files:**
- Create: `e2e/planning-feature-layer.spec.ts`
- Modify: `e2e/deploy-smoke.spec.ts` only if the feature layer marker should be in deploy smoke.

- [ ] **Step 1: Add Playwright phone test**

```ts
import { expect, test } from "@playwright/test";
import { primeZenflowV2 } from "./helpers/zenflowV2State";

test("Planning feature layer works on phone in paper root theme while preserving dark V1 surfaces", async ({ page }) => {
  await primeZenflowV2(page, { language: "uk", privacyNoTracking: true, theme: "paper" });
  await page.goto("planning?nav=v2&navLayout=phone&dev=true", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("planning-page")).toHaveAttribute("data-planning-theme", "v1-dark");
  await expect(page.getByTestId("planning-mode-rail")).toBeVisible();
  await page.getByTestId("planning-mode-focus").click();
  await expect(page.getByTestId("planning-mode-focus")).toHaveAttribute("aria-pressed", "true");
});
```

- [ ] **Step 2: Add RTL smoke**

Same route with `language: "ar"` and `language: "he"`; assert no horizontal overflow and mode buttons visible.

- [ ] **Step 3: Run e2e locally**

Run: `ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER=true npx playwright test e2e/planning-feature-layer.spec.ts --project="Mobile Chrome" --workers=1`

Expected: PASS.

### Task 7: Broad Verification

- [ ] Run focused unit tests:

```bash
npm test -- src/pages/nav-v2/__tests__/PlanningPage.test.tsx src/pages/nav-v2/planning/__tests__/planningFeatureModel.test.ts src/pages/nav-v2/__tests__/planningFocusTransferContract.test.ts
```

- [ ] Run navigation contracts:

```bash
npm test -- src/hooks/__tests__/useNavigationV2.test.ts src/components/navigation-v2/__tests__/integration.keyboardNav.test.tsx src/pages/nav-v2/__tests__/v2PageCoverageContract.test.ts
```

- [ ] Run project checks:

```bash
npm run i18n:check
npm run check:all
```

- [ ] Run Snyk for modified first-party TypeScript when available:

```bash
rm -rf /tmp/zenflow-snyk-planning-feature-layer
mkdir -p /tmp/zenflow-snyk-planning-feature-layer/src/pages/nav-v2/planning
cp src/pages/nav-v2/planning/PlanningPage.tsx /tmp/zenflow-snyk-planning-feature-layer/src/pages/nav-v2/planning/PlanningPage.tsx
cp src/pages/nav-v2/planning/planningFeatureModel.ts /tmp/zenflow-snyk-planning-feature-layer/src/pages/nav-v2/planning/planningFeatureModel.ts
cp src/pages/nav-v2/planning/PlanningModeRail.tsx /tmp/zenflow-snyk-planning-feature-layer/src/pages/nav-v2/planning/PlanningModeRail.tsx
cp src/pages/nav-v2/planning/PlanningActionPanel.tsx /tmp/zenflow-snyk-planning-feature-layer/src/pages/nav-v2/planning/PlanningActionPanel.tsx
cp src/pages/nav-v2/planning/PlanningReviewLane.tsx /tmp/zenflow-snyk-planning-feature-layer/src/pages/nav-v2/planning/PlanningReviewLane.tsx
snyk code test --json-file-output=test-results/snyk-code-planning-feature-layer.json /tmp/zenflow-snyk-planning-feature-layer
```

If Snyk MCP/CLI is unavailable, mark `Snyk: UNVERIFIED`; do not call it PASS.

## Acceptance Criteria

- Planning remains a primary V2 page at `/planning?nav=v2&navLayout=phone`.
- No sixth global V2 page is added.
- Internal modes `today`, `schedule`, `focus`, `review` are accessible, keyboard usable, and 44px touch-safe.
- Now/Next, ScheduleTimeline, FocusTimer, reflection and mini-player paths continue working.
- Generated habit/google/task events remain read-only.
- Manual event add/delete still syncs through `zenflow-schedule-events` and `triggerSync()`.
- Root `paper` theme cannot force Planning's transferred V1 surfaces into light mode.
- All new user-facing copy exists in 8 languages.
- RTL smoke passes for Arabic and Hebrew.
- Android back closes internal Planning sheets/modals before leaving route.
- No new Supabase schema/migration is introduced.

## Risks And Mitigations

- Risk: internal feature layer becomes a second app inside Planning. Mitigation: only four modes, one primary action, no nested cards inside cards.
- Risk: recommendations feel random or AI-like. Mitigation: deterministic model with transparent priority order and unit tests.
- Risk: active timer state breaks across route changes. Mitigation: keep using `useFocusTimer`, `uiStore` focus bridge and `V2FocusMiniPlayer`.
- Risk: i18n chips overflow on mobile. Mitigation: short labels, Playwright mobile screenshots for `uk`, `de`, `ar`, `he`.
- Risk: root paper theme leaks into V1 surfaces. Mitigation: preserve `data-planning-theme="v1-dark"` and `planning-v1-dark-scope` tests.
- Risk: schedule sync duplicates generated events. Mitigation: persist only manual schedule events; keep generated habit events derived.

## Later, Not Phase 1

- AI planning assistant or natural-language schedule parser.
- Supabase-backed cross-user shared plans.
- Calendar provider write-back.
- Drag-and-drop timeline editing.
- Full conflict resolution automation.
- Push notification changes.

## Done Criteria

- [ ] All tasks above are implemented in order with red/green evidence.
- [ ] Focused Planning tests pass.
- [ ] Navigation contracts still prove 5 primary V2 pages.
- [ ] `npm run i18n:check` passes for 8 languages.
- [ ] `npm run check:all` passes.
- [ ] Phone Playwright screenshot shows dark Planning surfaces under root `paper` theme.
- [ ] Snyk is PASS for modified first-party code or explicitly `UNVERIFIED` with blocker reason.
- [ ] No public deployment PASS is claimed until GitHub Pages is deployed and cache-busted route is checked.

## UNVERIFIED Until Execution

- Exact final visual balance after adding the feature layer.
- Native Android/iOS WebView screenshots after implementation.
- Public GitHub Pages behavior after deployment.
- Snyk result for future implementation changes.
