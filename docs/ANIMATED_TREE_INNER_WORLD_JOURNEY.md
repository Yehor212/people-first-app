# Animated Tree + Inner World + Treats System
## End-to-End User Journey Design Document

**Version:** 1.0
**Last Updated:** 2026-02-10
**Status:** Production (implemented and live)
**App:** ZenFlow (People-First App)
**Platform:** React 18.3.1 + Vite 5 + TypeScript + Capacitor 8 (Android) + PWA

---

## Table of Contents

1. [Goal](#1-goal)
2. [Actors & Permissions](#2-actors--permissions)
3. [Entry Points](#3-entry-points)
4. [State Machine](#4-state-machine)
5. [Verification & Authorization](#5-verification--authorization)
6. [Error States](#6-error-states)
7. [Edge Cases](#7-edge-cases)
8. [Copy (Exact Labels)](#8-copy-exact-labels)
9. [Abuse, Security & Privacy](#9-abuse-security--privacy)
10. [UI Screens & Components](#10-ui-screens--components)
11. [API Contract](#11-api-contract)
12. [Code Plan](#12-code-plan)
13. [Assumptions Ledger](#13-assumptions-ledger)
14. [Contradiction & Absurdity Check](#14-contradiction--absurdity-check)

---

## 1. Goal

### Primary Goal

Give users a persistent, emotionally rewarding visual metaphor for their self-care progress. The **Animated Tree** grows from a seed to a great tree as users engage with the app's core activities (mood logging, habits, focus sessions, gratitude journaling, breathing exercises). A **Treats** virtual currency bridges the gap between actions and tree care, creating a simple but satisfying feedback loop:

```
User does activities  -->  Earns treats  -->  Spends treats watering tree  -->  Tree grows  -->  Visual reward
```

### Secondary Goals

- **Retention**: The tree's water level decays at 2% per hour, creating gentle urgency to return without punitive mechanics. A streak multiplier rewards consistency (up to 2x at 10 consecutive days).
- **Emotional connection**: The tree responds visually to seasons (4 real-world seasonal palettes), to care (green when watered, gray when thirsty), and to growth stage (5 stages with increasing visual complexity).
- **Accessibility**: A "calm mode" (`lowStimulus`) suppresses particles, sparkles, and reduces sway amplitude for users who find visual motion overwhelming.
- **Offline-first**: All state lives in IndexedDB (Dexie). Cloud sync to Supabase is optional and deferred. The tree works fully offline.

### Success Metrics

| Metric | Target |
|--------|--------|
| Daily return rate for users who interact with tree | +15% vs. non-tree users |
| Median treats earned per active day | 40-60 treats |
| Average tree stage after 30 days | Stage 3 (Sapling) |
| Stage 5 (Great Tree) achievement rate | ~10% of users at 60 days |

---

## 2. Actors & Permissions

### 2.1 User (Authenticated or Anonymous)

| Capability | Auth Required | Details |
|------------|---------------|---------|
| View tree in InnerWorldCard | No | Read-only preview on Garden tab |
| Open TreePanel | No | Full interactive view |
| Touch tree (free) | No | +10 XP, 60s cooldown |
| Water tree | No | Requires >= 10 treats in wallet |
| Earn treats from activities | No | Automatic on activity completion |
| Rename companion | No | Sanitized string, max length TBD |
| Toggle calm mode | No | Per-session toggle |
| Cloud sync | Yes (Supabase auth) | Bidirectional sync of InnerWorld state |
| View on multiple devices | Yes (Supabase auth) | Last-write-wins merge strategy |

### 2.2 System (Background Processes)

| Process | Trigger | Effect |
|---------|---------|--------|
| Water decay | Hourly interval + on app load | Reduces `waterLevel` by 2% per elapsed hour |
| Season update | On app load / `useEffect` | Updates `season` field based on current month |
| Welcome back detection | On app load | Sets `companion.mood = 'supportive'` if user was absent > 1 day |
| Cloud push | 5 seconds after last state change (debounced) | Pushes full `InnerWorld` object to Supabase |
| Streak sync | On streak change | Pushes `currentActiveStreak` to friends profile |

### 2.3 There Are No Admin Actors

This is a client-side system. There is no admin panel, no server-side logic for treats, and no moderation layer. All state is user-owned.

---

## 3. Entry Points

### 3.1 Primary Entry: Garden Tab -> InnerWorldCard

```
Garden tab (Index.tsx, activeTab === 'garden')
  |
  v
InnerWorldCard (src/components/InnerWorldCard.tsx)
  - Shows: SeasonalTree (size="sm"), treats balance, water level %, streak count
  - Tap anywhere -> setShowTreePanel(true)
  |
  v
TreePanel (src/components/TreePanel.tsx) — lazy-loaded
  - Full interactive tree (size="lg")
  - Touch button, Water button, XP bar, Water bar, Season display, Calm toggle
```

### 3.2 Passive Earning Entry: Any Activity Completion

Treats are earned automatically when the user completes an activity in any tab:

| Activity | Entry Point | Base Treats | Code Location |
|----------|-------------|-------------|---------------|
| Log mood | Home tab -> Mood logger | 5 | `Index.tsx:934` |
| Quick mood (notification) | Push notification -> deep link | 5 | `Index.tsx:962` |
| Complete habit | Home tab -> Habit toggle | 10 | `Index.tsx:1039, 1061` |
| Focus session | Home tab -> Focus Timer | `Math.round(duration * 0.5)` | `Index.tsx:1170-1171` |
| Gratitude entry | Home tab -> Gratitude Journal | 8 | `Index.tsx:1214` |
| Breathing exercise | Home tab -> Breathing Exercise | 5 | `Index.tsx:2291` |
| Mindful moment | Post-focus prompt | 1 | `Index.tsx:1244` |
| Quest completion | Various quest triggers | Variable (quest reward XP) | `Index.tsx:1111, 1203, 1235` |
| Comeback challenge | Post-absence habit completion | Variable (bonus XP) | `Index.tsx:1087` |
| Task completion | Tasks panel | Variable | `Index.tsx:2459` |
| Welcome back mood | Welcome back overlay | 5 | `Index.tsx:2083` |

### 3.3 Android Back Button Entry

When TreePanel is open, the Android hardware back button closes it via `useBackHandler(isOpen, onClose)`. Priority order in `Index.tsx:554`:

```
if (showTreePanel) { setShowTreePanel(false); return true; }
```

---

## 4. State Machine

### 4.1 Tree Growth State Machine

```
                    +100 XP          +200 XP          +400 XP          +800 XP
  [SEED] ---------> [SPROUT] -------> [SAPLING] ------> [TREE] --------> [GREAT TREE]
  Stage 1           Stage 2           Stage 3           Stage 4           Stage 5
  0 XP              100 XP            300 XP            700 XP            1500 XP
  Scale: 0.55       Scale: 0.7        Scale: 0.9        Scale: 1.0        Scale: 1.15
  Pot + seed        Pot + stem        Ground + trunk    Ground + trunk    Ground + trunk
                    + 2 leaves        + small canopy    + full canopy     + grand canopy
                                                        + side blobs      + crown volume
                                                                          + glow filter
                                                                          + sparkle shimmer
```

**XP sources:**
- Water: +50 XP per watering (costs 10 treats)
- Touch: +10 XP per touch (free, full effect requires 60s cooldown)
- Touch during cooldown: +2 XP (reduced, no cooldown gate on action)

**Stage calculation:** `getTreeStageFromXP(xp)` in `src/lib/seasonHelper.ts`

```typescript
if (xp >= 1500) return 5;  // Great Tree
if (xp >= 700)  return 4;  // Tree
if (xp >= 300)  return 3;  // Sapling
if (xp >= 100)  return 2;  // Sprout
return 1;                   // Seed
```

**XP progress within stage:** `getXPProgressToNextStage(xp, currentStage)` returns 0-100%.

### 4.2 Water Level State Machine

```
  100%   Flourishing (canopy full color)
   |
   |  -2%/hour decay
   |
  70%   "The tree is flourishing!" message
   |
   |  -2%/hour decay
   |
  40%   Canopy begins desaturation (useTreeColors: dryness = (40-waterLevel)/40)
   |
   |  -2%/hour decay
   |
  30%   THIRSTY THRESHOLD
   |     - ThirstyIndicator shows (wobbling emoji)
   |     - Water button pulses (animate-pulse + ring-2)
   |     - Contextual message: "The tree needs water..."
   |
   |  -2%/hour decay
   |
  10%   STARVING THRESHOLD (defined in FULLNESS_DECAY.starvingThreshold)
   |
   |  -2%/hour decay
   |
   0%   Maximum desaturation (dryness capped at 0.6 blend toward gray #9ca3af)
```

**Water recovery:** Each watering adds +30% water level, capped at 100%.

**Decay implementation** (in `useInnerWorld.ts`):
```
expectedDecay = floor(hoursSinceWatered) * 2
expectedWaterLevel = max(0, 100 - expectedDecay)
```
Decay is calculated absolutely from `lastWateredAt`, not incrementally. This prevents drift from missed intervals.

### 4.3 Treats Wallet State Machine

```
  [EARNING]                              [SPENDING]
  Activity completed                     User taps Water button
       |                                      |
       v                                      v
  calculateTreatsEarned(base, streakDays)    Check: balance >= 10?
       |                                      |
       +-- base = activity reward        NO --+-> Show: "Need {needed} treats, have {have}"
       +-- multiplier = 1 + min(streak, 10) * 0.1       |
       +-- total = round(base * multiplier)              | Return prev state (no mutation)
       +-- bonus = total - base                          |
       |                                      YES -> Deduct 10 treats
       v                                           -> Record TreatTransaction
  Add to wallet.balance                            -> Add +30 waterLevel
  Record TreatTransaction                          -> Add +50 treeXP
  Keep last 50 transactions                        -> Check stage up
  Update lifetimeEarned                            -> Update lifetimeSpent
  Show XpPopup (triggerXpPopup)
```

**Streak multiplier table:**

| Streak Days | Multiplier | Example: 10 base treats |
|-------------|------------|------------------------|
| 0 | 1.0x | 10 |
| 1 | 1.1x | 11 |
| 2 | 1.2x | 12 |
| 3 | 1.3x | 13 |
| 5 | 1.5x | 15 |
| 7 | 1.7x | 17 |
| 10+ | 2.0x (cap) | 20 |

### 4.4 Season State Machine

```
  Month:  1  2  |  3  4  5  |  6  7  8  |  9  10  11  |  12
  Season: WINTER | SPRING    | SUMMER    | AUTUMN      | WINTER
```

Each season applies a distinct visual theme:

| Season | Primary | Secondary | Accent | Particle | Visual |
|--------|---------|-----------|--------|----------|--------|
| Spring | Sakura pink `#FFB7C5` | Light green `#98D982` | Lavender blush `#FFF0F5` | Pink petals | Blossoms on canopy |
| Summer | Forest green `#228B22` | Light green `#90EE90` | Gold `#FFD700` | Green leaves | Sun dapple accents |
| Autumn | Orange `#FF6B35` | Saddle brown `#8B4513` | Yellow `#FFD93D` | Orange leaves | Falling autumn leaves |
| Winter | Silver `#E8E8E8` | Sky blue `#87CEEB` | White `#FFFFFF` | White snowflakes | Snow on canopy |

Season is determined by `getCurrentSeason()` in `seasonHelper.ts` using Northern Hemisphere months. Updated on app load and reactively via `useEffect` in `useInnerWorld.ts`.

### 4.5 Companion Mood State Machine

```
  User absent > 1 day  -->  'supportive' (welcome back)
  Streak >= 7           -->  'celebrating'
  Streak >= 3           -->  'excited'
  Active today          -->  'happy'
  22:00-06:00           -->  'sleeping'
  Default               -->  'calm'
```

Mood is recalculated on `plantSeed()` and `feedCompanion()` via `getCompanionMood()`.

---

## 5. Verification & Authorization

### 5.1 Treats Spending Verification

All spend operations use **optimistic local verification** inside functional state updaters:

```typescript
// waterTree() in useInnerWorld.ts
setWorld(prev => {
  const currentBalance = prev.treats?.balance || 0;
  if (currentBalance < treatCost) {
    result = { success: false, reason: 'not_enough_treats', ... };
    return prev; // NO STATE CHANGE
  }
  // ... proceed with deduction
});
```

This pattern:
- Reads the authoritative balance from the state updater's `prev` argument (not a stale closure)
- Returns `prev` unchanged if the check fails (atomic: either full transaction or nothing)
- Sets a `result` object that the calling UI reads synchronously after `setWorld`

### 5.2 Cooldown Verification

Touch cooldown is verified inside the functional updater:

```typescript
const timeSinceLastTouch = prev.companion.lastTouchTime
  ? now - prev.companion.lastTouchTime
  : Infinity;
const canTouchAgain = timeSinceLastTouch > 60000; // 1 minute
const xpGain = canTouchAgain ? 10 : 2; // Reduced XP during cooldown
```

Note: The touch action is **never blocked** -- it always grants XP (2 during cooldown, 10 after cooldown). The cooldown is a soft gate, not a hard gate.

### 5.3 Cloud Sync Verification

- **Zod schema validation** (`innerWorldCloudSync.ts:15-35`): Cloud data is validated with `innerWorldSchema.safeParse(data)` before being accepted. Invalid data returns `null` and falls back to local state.
- **Promise-based sync lock** (`innerWorldCloudSync.ts:53`): Prevents concurrent sync operations. If sync is already in progress, concurrent callers wait for the same Promise.
- **Merge strategy**: Winner is determined by `(currentActiveStreak + plants.length)` score. Ties broken by more recent `lastActiveDate`. Winner is pushed back to cloud.

### 5.4 Authentication Requirements

- **Tree interactions**: No authentication required. All state is local-first.
- **Cloud sync**: Requires Supabase auth. `pushInnerWorldToCloud()` and `pullInnerWorldFromCloud()` both call `supabase.auth.getUser()` and no-op if user is null.
- **No server-side validation of treats**: Treats are entirely client-side. There is no API that validates or rate-limits treat earnings.

---

## 6. Error States

### 6.1 Insufficient Treats for Watering

**Trigger:** User taps "Water" button with `treatsBalance < 10`.

**UI behavior:**
1. Water button is `disabled` and has `opacity-50 cursor-not-allowed` styling.
2. If somehow invoked (race condition), `waterTree()` returns `{ success: false, reason: 'not_enough_treats', needed: 10, have: currentBalance }`.
3. TreePanel shows speech bubble: "Need {needed} treats, have {have}".
4. `isWatering` remains `false` (no animation fires).

### 6.2 Cloud Sync Failure

**Trigger:** Network unavailable, Supabase table doesn't exist yet (`42P01`), or no data (`PGRST116`).

**UI behavior:** Silent failure. `pushInnerWorldToCloud` catches all errors and logs them. No user-facing error. Local state is authoritative.

**Known error codes handled:**
- `42P01`: Table `user_inner_world` does not exist (migration not yet run). Silently ignored.
- `PGRST116`: No rows returned (new user, no cloud data). Silently handled; local state pushed to cloud.

### 6.3 IndexedDB Unavailable

**Trigger:** Safari Private Browsing mode, storage quota exceeded, or corrupted database.

**Fallback:** The `useIndexedDB` hook falls back to `localStorage` via the `localStorageKey: 'zenflow-inner-world'` parameter. The `safeLocalStorageSet` wrapper handles Safari Private Mode exceptions.

### 6.4 Component Load Failure

**Trigger:** Lazy-loaded `TreePanel` fails to load (network error, chunk hash mismatch).

**Fallback:**
```tsx
<LazyErrorBoundary componentName="Tree Panel">
  <Suspense fallback={null}>
    <TreePanel ... />
  </Suspense>
</LazyErrorBoundary>
```
The `LazyErrorBoundary` catches render errors and shows a fallback UI. `lazyWithRetry()` retries the dynamic import once before failing.

### 6.5 State Corruption (Default Recovery)

**Trigger:** Missing `treats`, `companion`, or `treeStage` fields in stored state.

**Fallback:** All reads use null-coalescing defaults:
```typescript
treatsBalance: world.treats?.balance || 0,
treeStage: world.companion.treeStage || 1,
treeWaterLevel: world.companion.waterLevel || 0,
treeXP: world.companion.treeXP || 0,
```

### 6.6 Animation State Leak (Unmount During Timeout)

**Trigger:** User closes TreePanel while touch/water animation is in progress (1.5-2s timeout).

**Mitigation:** `mountedRef` pattern in TreePanel:
```typescript
const mountedRef = useRef(true);
useEffect(() => {
  mountedRef.current = true;
  return () => {
    mountedRef.current = false;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };
}, []);

// In timeout callbacks:
if (!mountedRef.current) return;
```

---

## 7. Edge Cases

### 7.1 Rapid Multi-Tap on Touch/Water

**Problem:** User rapidly taps Touch or Water during animation.

**Mitigation:** `isAnimating` state flag. Both `handleTouch` and `handleWater` early-return if `isAnimating === true`. Buttons receive `disabled={isAnimating}` prop.

### 7.2 Concurrent State Mutations (Race Conditions)

**Problem:** Multiple `setWorld` calls from different sources (decay timer, user action, cloud sync) interleave.

**Mitigation:** All state mutations in `useInnerWorld.ts` use **functional updaters** (`setWorld(prev => ...)`) instead of `setWorld({...world, ...})`. This ensures each mutation reads from the latest committed state, not a stale closure.

**Exception:** `activateRestMode` and `deactivateRestMode` use direct `setWorld({...world, ...})` -- these have `world` in their dependency arrays and are less performance-critical.

### 7.3 Water Decay Across Long Absence

**Problem:** User is away for 50+ hours. Water should be 0%, not negative.

**Mitigation:** Decay is calculated absolutely, not incrementally:
```typescript
const expectedWaterLevel = Math.max(0, 100 - expectedDecay);
```
The `Math.max(0, ...)` clamp ensures water never goes negative.

### 7.4 Treats Balance Goes Negative

**Problem:** Two rapid spend operations could theoretically both read the same positive balance.

**Mitigation:** The functional updater pattern reads `prev.treats?.balance` inside the updater. React guarantees serial execution of state updaters within a single component. Since `setWorld` is a single state setter from `useIndexedDB`, updates are serialized.

### 7.5 Multiple SeasonalTree Instances on Same Page

**Problem:** SVG gradient/filter IDs collide when multiple `<SeasonalTree>` components render on the same page (e.g., InnerWorldCard's `size="sm"` and TreePanel's `size="lg"`).

**Mitigation:** Each `SeasonalTree` calls `const id = useId()` (React 18's built-in unique ID hook). All SVG `<defs>` elements use `id` as a suffix: `canopyGrad-${id}`, `potGrad-${id}`, `treeGlow-${id}`, etc.

### 7.6 Season Boundary (Midnight on March 1, June 1, etc.)

**Problem:** Tree's season visual could be stale if app stays open across a season boundary.

**Mitigation:** `useEffect` in `useInnerWorld.ts` re-evaluates `getCurrentSeason()` reactively:
```typescript
useEffect(() => {
  const currentSeason = getCurrentSeason();
  if (world.season !== currentSeason) {
    setWorld(prev => ({ ...prev, season: currentSeason }));
  }
}, [world.season, setWorld]);
```
This updates on re-render (e.g., tab switch, any state change). It does not poll. If the app is backgrounded over a season boundary and resumed, the effect fires on the next render.

### 7.7 XP Overflow at Stage 5

**Problem:** User keeps earning XP past 1500 (Great Tree).

**Behavior:** XP accumulates indefinitely. `getXPProgressToNextStage(xp, 5)` returns `100` for max stage. The progress bar shows full and displays `{treeXP} XP` with a checkmark. Stage remains at 5.

### 7.8 First-Time User Experience

**Default state:**
- Treats: 20 (enough for 2 waterings)
- Water level: 70% (not immediately urgent)
- Tree stage: 1 (Seed, in terracotta pot)
- Tree XP: 0
- Companion name: "Luna"
- Companion type: "fox"

The user can immediately touch the tree (free), see the pot and seed, and has enough treats to water twice without doing any activities.

### 7.9 Streak Preservation via Rest Mode

**Problem:** User needs a day off but does not want to break their streak.

**Mitigation:** Rest mode (`activateRestMode()`) marks today as a "rest day" and sets `lastActiveDate = today`, preserving the streak. Limited to 1 rest day per 7 days (`REST_COOLDOWN_DAYS = 7`).

### 7.10 RTL Language Layout

**Problem:** Arabic and Hebrew users see mirrored layouts.

**Mitigation:** TreePanel uses standard Tailwind CSS utilities (`flex`, `grid`, `text-center`) that respect the app's global `dir="rtl"` attribute. The SVG tree itself is symmetric and does not need RTL adjustment.

---

## 8. Copy (Exact Labels)

### 8.1 InnerWorldCard Labels

| Key | Default (English) |
|-----|-------------------|
| `innerWorld` | "Inner World" |
| `treats` | "treats" |
| `tapToInteract` | "Tap to interact" |

### 8.2 TreePanel Labels

| Key | Default (English) |
|-----|-------------------|
| `myTree` | "My Tree" |
| `treats` | "Treats" |
| `close` | "Close" |
| `touch` | "Touch" |
| `free` | "Free" |
| `water` | "Water" |
| `growth` | "Growth" |
| `stage` | "Stage" |
| `waterLevel` | "Water Level" |
| `daysInRow` | "days in a row" |
| `dopamineMinimal` | (Calm visuals label) |
| `dopamineMinimalDesc` | (Calm visuals description) |
| `seasonTreeHint` | "The tree changes with the seasons!" |
| `earnTreatsHint` | "Complete activities to earn treats for your tree!" |
| `waterDecayHint` | "Water level decreases -2% per hour" |
| `treeNeedsWater` | "The tree needs water!" |
| `xpToNextStage` | "{xp} XP to {stage}" |

### 8.3 Contextual Messages (Priority Order)

| Priority | Condition | Key | Default |
|----------|-----------|-----|---------|
| 1 | `waterLevel < 30` AND `treatsBalance >= 10` | `treeThirstyCanWater` | "The tree needs water..." |
| 1 | `waterLevel < 30` AND `treatsBalance < 10` | `treeThirstyNoTreats` | "Thirsty... Do activities to earn treats!" |
| 2 | `streak >= 7` | `treeStreakLegend` | "{streak} days! The tree is glowing!" |
| 2 | `streak >= 3` | `treeStreakGood` | "{streak} days! Growing strong!" |
| 3 | `treeStage === 5` | `treeMaxStage` | "A magnificent great tree!" |
| 3 | `treeStage === 4` | `treeStage4` | "A beautiful mature tree!" |
| 3 | `treeStage === 3` | `treeStage3` | "Growing into a strong sapling!" |
| 3 | `treeStage === 2` | `treeStage2` | "A young sprout reaching for light!" |
| 3 | `treeStage === 1` | `treeStage1` | "A tiny seed full of potential!" |
| 4 | `waterLevel >= 70` | `treeHappy` | "The tree is flourishing!" |
| 5 | (fallback) | `treeSeason` | "{emoji} Beautiful {season}!" |

### 8.4 Reaction Messages (Random Selection)

**Touch reactions:**

| Key | Default |
|-----|---------|
| `touchReaction1` | "*rustles leaves*" |
| `touchReaction2` | "The leaves dance!" |
| `touchReaction3` | "Feels alive!" |
| `touchReaction4` | "Growing stronger!" |

Displayed as: `"{reaction} +{xpGain} XP"`

**Water reactions:**

| Key | Default |
|-----|---------|
| `waterReaction1` | "*absorbs water*" |
| `waterReaction2` | "Refreshing!" |
| `waterReaction3` | "Thank you!" |
| `waterReaction4` | "Growing!" |

Displayed as: `"{reaction} +{xpGain} XP"`

**Insufficient treats:**

| Key | Default |
|-----|---------|
| `waterNotEnough` | "Need {needed} treats, have {have}" |

**Stage up:**

| Key | Default |
|-----|---------|
| `treeStageUp` | "Evolved to {stage}!" |

### 8.5 Tree Stage Names (Localized)

| Stage | en | ru | uk | es | de | fr |
|-------|----|----|----|----|----|----|
| 1 | Seed | Семечко | Насіння | Semilla | Samen | Graine |
| 2 | Sprout | Росток | Паросток | Brote | Spross | Pousse |
| 3 | Sapling | Саженец | Саджанець | Planton | Schossling | Jeune arbre |
| 4 | Tree | Дерево | Дерево | Arbol | Baum | Arbre |
| 5 | Great Tree | Великое дерево | Велике дерево | Gran Arbol | Grosser Baum | Grand Arbre |

### 8.6 Season Names (Localized)

| Season | en | ru | uk | es | de | fr |
|--------|----|----|----|----|----|----|
| Spring | Spring | Весна | Весна | Primavera | Fruhling | Printemps |
| Summer | Summer | Лето | Літо | Verano | Sommer | Ete |
| Autumn | Autumn | Осень | Осінь | Otono | Herbst | Automne |
| Winter | Winter | Зима | Зима | Invierno | Winter | Hiver |

---

## 9. Abuse, Security & Privacy

### 9.1 Treats Economy Abuse

**Threat:** User manipulates localStorage/IndexedDB to set `treats.balance` to an arbitrary number.

**Assessment:** **Low severity, accepted risk.** The treats system is entirely client-side. There is no competitive element between users (leaderboards do not display treats). The tree's XP still requires legitimate interactions. Inflated treats only allow more watering, which is bounded by `Math.min(100, waterLevel + 30)`.

**Mitigation (current):** None beyond Zod validation on cloud pull.

**Future mitigation (if needed):** Server-side treats ledger with signed activity tokens.

### 9.2 Clock Manipulation (Water Decay Bypass)

**Threat:** User sets device clock forward/backward to avoid water decay or accelerate streaks.

**Assessment:** **Low severity, accepted risk.** Water decay uses `Date.now()` which follows system clock. A user who sets their clock back would see water not decaying (already calculated from `lastWateredAt`). A user who sets their clock forward would see immediate full decay and incorrect season. Neither case grants a meaningful advantage.

### 9.3 Concurrent Device State Conflict

**Threat:** User interacts on Device A and Device B simultaneously. Cloud sync could overwrite one device's progress.

**Mitigation:** The sync merge strategy uses a scoring system (`currentActiveStreak + plants.length`). The device with more progress "wins." On tie, the more recent `lastActiveDate` wins. This is last-write-wins with a heuristic for choosing the better state. Data loss is possible but unlikely for the tree system (tree XP is part of the companion object, which is in the winning state).

### 9.4 Companion Name Injection

**Threat:** User enters malicious HTML/JS in the companion name field.

**Mitigation:** The name is rendered via React's JSX (`{treeName}`) which auto-escapes HTML. The `renameCompanion` function in `useInnerWorld.ts` stores the raw string. The app has a `sanitize.ts` module with DOMPurify for explicit sanitization elsewhere, but the companion name path relies on React's built-in escaping.

### 9.5 Privacy

- **No PII in tree state:** The `InnerWorld` object contains no email, name, or identifying information beyond the user-chosen companion name.
- **Cloud storage:** The full `InnerWorld` JSON is stored in `user_inner_world` table keyed by `user_id`. It is accessible only to the authenticated user via Row Level Security (RLS) on Supabase.
- **Local storage:** IndexedDB and localStorage contain the same `InnerWorld` JSON. This persists across sessions but is scoped to the browser origin.
- **No analytics on tree interactions:** Touch, water, and XP events are not sent to any analytics service. They exist only in the local/cloud state.

### 9.6 Denial of Service via Transaction History

**Threat:** Rapid automated activity completions could bloat the transactions array.

**Mitigation:** Transaction history is capped at 50 entries:
```typescript
const transactions = [transaction, ...(prev.treats?.transactions || [])].slice(0, 50);
```

---

## 10. UI Screens & Components

### 10.1 Component Architecture

```
Index.tsx (src/pages/Index.tsx)
  |
  +-- useInnerWorld() hook (src/hooks/useInnerWorld.ts)
  |     Returns: world, earnTreats, spendTreats, waterTree, touchTree,
  |              treeStage, treeWaterLevel, treeXP, treatsBalance, ...
  |
  +-- InnerWorldCard (src/components/InnerWorldCard.tsx)
  |     Props: treeStage, waterLevel, treatsBalance, streak, onOpen
  |     Children:
  |       +-- SeasonalTree (size="sm", read-only)
  |
  +-- TreePanel (src/components/TreePanel.tsx) [lazy-loaded]
        Props: treeStage, waterLevel, treeXP, treeName, isOpen, onClose,
               onRename, onTouch, onWater, treatsBalance, waterCost,
               streak, calmMode, onCalmModeChange
        Children:
          +-- SeasonalTree (size="lg", interactive)
```

### 10.2 SeasonalTree Component (src/components/SeasonalTree.tsx)

**SVG architecture:** `viewBox="0 0 200 250"`, scales via `width`/`height` from `sizeConfig`.

| Size | Width | Height | Use |
|------|-------|--------|-----|
| `sm` | 120px | 150px | InnerWorldCard preview |
| `md` | 200px | 250px | Default / unused |
| `lg` | 280px | 350px | TreePanel interactive |

**Props interface:**
```typescript
interface SeasonalTreeProps {
  stage: TreeStage;        // 1-5
  waterLevel: number;      // 0-100
  xp?: number;             // For future use
  season?: Season;         // Override auto-detected season
  isWatering?: boolean;    // Trigger water animation
  onClick?: () => void;    // Tap handler
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  lowStimulus?: boolean;   // Calm mode
}
```

**Sub-components (13 files in `src/components/seasonal-tree/`):**

| File | Responsibility |
|------|---------------|
| `constants.ts` | `sizeConfig`, `stageScaleMap`, color math utilities (`hexToRgb`, `mixColor`, `colorWithAlpha`, `clamp`) |
| `useTreeColors.ts` | Computes all tree colors from season + waterLevel + stage. Handles water desaturation (grays canopy when waterLevel < 40). Returns `TreeColors` interface. |
| `useParticleSystem.ts` | Generates particle configs (position, duration, delay, rotation) for `TreeParticles`. Memoized per season/stage/lowStimulus. |
| `TreeDefs.tsx` | SVG `<defs>`: gradients for canopy, trunk, pot, glow filter (`feGaussianBlur`). All IDs use `useId()` suffix. |
| `TreePot.tsx` | Stages 1-2: terracotta pot (body, rim, soil), seed (stage 1) or sprout with animated stem + leaves (stage 2). |
| `TreeTrunk.tsx` | Stages 3-5: ground-level trunk with gradient fill. |
| `TreeCanopy.tsx` | Stages 3-5: multi-layer ellipse canopy (back, main center+left+right, front highlight, stage 4+ side blobs, stage 5 crown volume). Idle sway via `useMotionValue` + `useAnimationFrame` (no React re-renders). |
| `TreeAccents.tsx` | Seasonal decorations on canopy: blossoms (spring), sun dapple (summer), fruits (autumn), snow caps (winter). |
| `TreeParticles.tsx` | Falling particles: petals/leaves/snowflakes. Uses native SVG `<animate>` + `<animateTransform>` for zero JS cost. Snowflakes are circles; leaves/petals are teardrop `<path>` shapes with rotation. |
| `TreeGlow.tsx` | Stage 5 only: radial ellipse glow behind canopy + 4 sparkle shimmer points with staggered `<animate>` opacity cycles. Suppressed in `lowStimulus` mode. |
| `WaterBar.tsx` | HTML overlay: horizontal bar showing current water level percentage. |
| `WateringEffect.tsx` | HTML overlay: 5 falling water drop emojis when `isWatering=true`. Framer Motion animation, 1.5s duration. |
| `ThirstyIndicator.tsx` | HTML overlay: wobbling emoji `(scale [1,1.2,1], rotate [-5,5,-5])` at top-right corner when `waterLevel < 30` and not currently watering. |

### 10.3 TreePanel Layout (src/components/TreePanel.tsx)

**Modal type:** Custom `<motion.div>` with `position: fixed`, slide-up from bottom. NOT Radix Sheet (which is broken in this project -- see CLAUDE_CONTEXT.md).

**Z-index:** `var(--z-overlay)` (consistent with other modals).

**Sections (top to bottom):**

1. **Header bar**: Season emoji + "My Tree" title | Treats balance badge (`{treatsBalance}`) | Close button (X)
2. **Speech bubble**: Animated contextual message or reaction text. Spring-in animation on change.
3. **Tree display**: `SeasonalTree` size="lg" with scale bounce on interaction (`animate: scale [1, 1.05, 1]`).
4. **Stage name badge**: Sparkle icon + stage name + "(Stage N/5)"
5. **Action buttons (2-column grid)**:
   - Left: Touch (Hand icon, green tint, "Free" label)
   - Right: Water (Droplets icon, accent tint, "{waterCost}" label, pulsing ring when thirsty & affordable)
6. **XP Progress bar**: Sparkle icon + "Growth" label, `{xpInStage}/{xpNeeded} XP`, animated progress bar. At stage 5: `{treeXP} XP` with checkmark.
7. **Water level bar**: Water drop emoji + "Water Level" label, `{waterLevel}%`, color-coded (green >= 70, primary >= 30, warning < 30).
8. **Streak display** (if streak > 0): Fire emoji + streak count + "days in a row".
9. **Calm visuals toggle**: Switch component for `lowStimulus` mode.
10. **Season display**: Season emoji + localized season name + hint text.
11. **Earn treats hint**: "Complete activities to earn treats for your tree!"

### 10.4 InnerWorldCard Layout (src/components/InnerWorldCard.tsx)

**Layout:** Horizontal flex row inside a rounded card with emerald gradient border.

- **Left**: SeasonalTree (size="sm") in a 64x64px container
- **Center**: "Inner World" title, stats row (Sparkles icon + treats count, Droplets icon + water %, fire emoji + streak), "Tap to interact" hint
- **Right**: TreePine icon (chevron-like affordance)

**Interaction:** Entire card is a `<button>` with `active:scale-[0.98]` press feedback.

---

## 11. API Contract

### 11.1 Client-Side Hooks API

#### `useInnerWorld()` Return Shape

```typescript
{
  // Core state
  world: InnerWorld;              // Full state object
  isLoading: boolean;             // True during initial IndexedDB read

  // Treats
  earnTreats: (source: TreatSource, baseAmount: number, description?: string) =>
    { earned: number; bonus: number; multiplier: number; newBalance: number };
  spendTreats: (amount: number, purpose: string) => boolean;
  treatsBalance: number;          // Current wallet balance

  // Tree interactions
  waterTree: () => {
    success: boolean;
    reason?: string;              // 'not_enough_treats'
    needed?: number;              // 10
    have?: number;                // Current balance if insufficient
    waterGain: number;            // 30 on success, 0 on failure
    xpGain: number;               // 50 on success, 0 on failure
    treatCost?: number;           // 10
    newBalance?: number;          // Balance after deduction
    newWaterLevel?: number;       // Water level after gain
    newTreeXP?: number;           // XP after gain
    stageUp?: boolean;            // True if tree evolved
    newStage?: number;            // New stage number if evolved
  };
  touchTree: () => {
    xpGain: number;               // 10 (or 2 during cooldown)
    canTouchAgain: boolean;       // True if cooldown was expired
    stageUp: boolean;             // True if tree evolved
    newStage: number;             // Current/new stage number
    newTreeXP: number;            // XP after gain
  };

  // Derived tree data
  treeStage: TreeStage;           // 1-5
  treeWaterLevel: number;         // 0-100
  treeXP: number;                 // Cumulative XP
  WATER_COST: number;             // 10 (constant)

  // Companion
  renameCompanion: (name: string) => void;
  FEED_COST: number;              // 10 (constant)

  // Other (not tree-specific)
  plantSeed, waterPlants, attractCreature, feedCreatures,
  petCompanion, feedCompanion, talkToCompanion, updateCompanionFromActivity,
  setCompanionType, clearWelcomeBack, gardenStats,
  getPlantEmoji, getCreatureEmoji, getCompanionEmoji,
  isRestMode, activateRestMode, deactivateRestMode,
  canActivateRestMode, daysUntilRestAvailable,
}
```

### 11.2 Supabase Cloud API

#### Table: `user_inner_world`

| Column | Type | Constraint |
|--------|------|------------|
| `user_id` | uuid | PRIMARY KEY, REFERENCES auth.users(id) |
| `world_data` | jsonb | NOT NULL |
| `updated_at` | timestamptz | NOT NULL |

#### Push (Upsert)

```typescript
supabase.from('user_inner_world').upsert({
  user_id: user.id,
  world_data: world,          // Full InnerWorld JSON
  updated_at: new Date().toISOString(),
}, { onConflict: 'user_id' });
```

#### Pull (Select)

```typescript
supabase.from('user_inner_world')
  .select('world_data')
  .eq('user_id', user.id)
  .single();
```

#### Realtime Subscription: DISABLED

Realtime was disabled due to WAL query consuming 96% of database time. Data syncs on app resume via `pullInnerWorldFromCloud()` instead. The `subscribeToInnerWorldUpdates` function exists but returns a no-op unsubscribe.

### 11.3 IndexedDB Schema

**Database:** `ZenFlowDB` (Dexie)
**Table:** `settings` (key-value store)
**Key:** `'zenflow-inner-world'`
**Value:** Full `InnerWorld` JSON object
**Fallback key (localStorage):** `'zenflow-inner-world'`

### 11.4 Type Definitions

```typescript
// src/types/index.ts

type TreatSource = 'mood' | 'habit' | 'focus' | 'gratitude' | 'breathing'
                 | 'streak_bonus' | 'daily_reward' | 'mindful';

interface TreatTransaction {
  id: string;
  amount: number;           // Positive for earn, negative for spend
  source: TreatSource;
  timestamp: number;        // Unix ms
  description?: string;
}

interface TreatsWallet {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  lastEarnedAt?: number;
  transactions: TreatTransaction[];  // Last 50
}

type TreeStage = 1 | 2 | 3 | 4 | 5;

interface Companion {
  type: CompanionType;
  name: string;             // Default: "Luna"
  mood: CompanionMood;
  level: number;
  experience: number;
  unlockedOutfits: string[];
  lastInteraction: number;
  lastPetTime?: number;
  lastFeedTime?: number;
  interactionCount: number;
  fullness: number;         // 0-100
  happiness: number;        // Legacy, derived
  hunger: number;           // Legacy, derived (100 - fullness)
  personality: { energy: number; wisdom: number; warmth: number };
  treeStage: TreeStage;
  waterLevel: number;       // 0-100
  lastWateredAt?: number;
  lastTouchTime?: number;
  treeXP: number;
}

interface InnerWorld {
  treats: TreatsWallet;
  gardenStage: GardenStage;
  plants: GardenPlant[];
  creatures: GardenCreature[];
  weather: GardenWeather;
  season: Season;
  companion: Companion;
  totalPlantsGrown: number;
  totalCreaturesAttracted: number;
  daysActive: number;
  longestActiveStreak: number;
  currentActiveStreak: number;
  lastActiveDate: string;   // YYYY-MM-DD
  unlockedBackgrounds: string[];
  unlockedDecorations: string[];
  currentBackground: string;
  decorations: unknown[];
  seasonalItemsCollected: unknown[];
  pendingGrowth: {
    plantsToGrow: number;
    creaturesArrived: number;
    companionMissedYou: boolean;
  };
  restDays: string[];       // Array of YYYY-MM-DD strings
}
```

---

## 12. Code Plan

### 12.1 File Map

```
src/
  lib/
    treatConstants.ts          # TREAT_REWARDS, STREAK_MULTIPLIER, COMPANION_COSTS,
                                # COMPANION_LEVELING, FULLNESS_DECAY,
                                # getStreakMultiplier(), calculateTreatsEarned(),
                                # getXpForNextLevel()
    seasonHelper.ts            # Season, TreeStage, getCurrentSeason(),
                                # getSeasonEmoji(), getSeasonName(),
                                # getSeasonColors(), getTreeStageName(),
                                # TREE_STAGE_XP, getTreeStageFromXP(),
                                # getXPProgressToNextStage()
  hooks/
    useInnerWorld.ts           # State management: createDefaultCompanion(),
                                # createDefaultTreatsWallet(), createDefaultInnerWorld(),
                                # earnTreats(), spendTreats(), waterTree(), touchTree(),
                                # petCompanion(), feedCompanion(), water decay effect,
                                # season update effect, cloud sync effect
    useIndexedDB.ts            # Generic IndexedDB persistence hook (used by useInnerWorld)
  storage/
    db.ts                      # ZenFlowDB Dexie schema (settings table)
    innerWorldCloudSync.ts     # pushInnerWorldToCloud(), pullInnerWorldFromCloud(),
                                # syncInnerWorld(), Zod validation
  components/
    InnerWorldCard.tsx         # Garden tab card: tree preview + stats
    TreePanel.tsx              # Full interaction modal: touch, water, progress
    SeasonalTree.tsx           # SVG tree orchestrator component
    seasonal-tree/
      constants.ts             # sizeConfig, stageScaleMap, color utilities
      useTreeColors.ts         # Season/water-aware color computation
      useParticleSystem.ts     # Particle position/timing generation
      TreeDefs.tsx             # SVG <defs>: gradients, filters
      TreePot.tsx              # Stage 1-2: pot + seed/sprout
      TreeTrunk.tsx            # Stage 3-5: trunk
      TreeCanopy.tsx           # Stage 3-5: multi-layer canopy with sway
      TreeAccents.tsx          # Seasonal decorations (blossoms, snow, etc.)
      TreeParticles.tsx        # Falling particles (SVG animate)
      TreeGlow.tsx             # Stage 5 glow + sparkles
      WaterBar.tsx             # Water level bar overlay
      WateringEffect.tsx       # Water drop animation overlay
      ThirstyIndicator.tsx     # Thirsty emoji overlay
  pages/
    Index.tsx                  # Wires useInnerWorld to InnerWorldCard + TreePanel,
                                # calls earnTreats on all activity completions
  types/
    index.ts                   # TreatSource, TreatTransaction, TreatsWallet,
                                # TreeStage, Companion, InnerWorld
```

### 12.2 Data Flow Diagram

```
                          +-----------------------+
                          |     User Activity     |
                          | (mood/habit/focus/etc) |
                          +-----------+-----------+
                                      |
                                      v
                          +-----------+-----------+
                          |  Index.tsx handler     |
                          |  earnTreats(source,    |
                          |    amount, desc)       |
                          +-----------+-----------+
                                      |
                    +-----------------+-----------------+
                    |                                   |
                    v                                   v
          +--------+--------+                 +--------+--------+
          | XpPopup shows   |                 | useInnerWorld   |
          | "+N treats"     |                 | state update    |
          +-----------------+                 +--------+--------+
                                                       |
                                   +-------------------+-------------------+
                                   |                   |                   |
                                   v                   v                   v
                            +------+------+     +------+------+     +-----+------+
                            | IndexedDB   |     | localStorage|     | Cloud sync |
                            | (primary)   |     | (fallback)  |     | (debounced)|
                            +-------------+     +-------------+     +-----+------+
                                                                          |
                                                                          v
                                                                   +------+------+
                                                                   | Supabase    |
                                                                   | user_inner  |
                                                                   | _world      |
                                                                   +-------------+
```

```
                          +-----------------------+
                          |  User taps "Water"    |
                          |  in TreePanel         |
                          +-----------+-----------+
                                      |
                                      v
                          +-----------+-----------+
                          |  waterTree()          |
                          |  Checks balance >= 10 |
                          +-----------+-----------+
                                      |
                           +----------+----------+
                           |                     |
                      FAIL |                     | SUCCESS
                           v                     v
                    +------+------+       +------+------+
                    | Return prev |       | Deduct 10   |
                    | (no change) |       | treats      |
                    | Show error  |       | +30 water   |
                    | message     |       | +50 XP      |
                    +-------------+       | Check stage |
                                          | up          |
                                          +------+------+
                                                 |
                                       +---------+---------+
                                       |                   |
                                  NO STAGE UP         STAGE UP
                                       |                   |
                                       v                   v
                                Update state        Update state +
                                normally             show "Evolved
                                                     to {stage}!"
```

### 12.3 Animation Pipeline

```
SeasonalTree render pipeline:

1. useId() -> unique SVG ID prefix
2. useTreeColors(season, waterLevel, stage) -> TreeColors (memoized)
     - getSeasonColors(season) -> base palette
     - dryness = clamp((40 - waterLevel) / 40, 0, 0.6)
     - mixColor(base, gray, dryness) -> desaturated canopy

3. SVG viewBox="0 0 200 250"
     |
     +-- TreeDefs: <defs> with gradients/filters using unique IDs
     |
     +-- Ground shadow: <ellipse> scaled by stageScale
     |
     +-- [Stage >= 5] TreeGlow: feGaussianBlur ellipse + sparkle circles
     |     Sparkles: <animate attributeName="opacity" values="0;0.7;0"> (2.5-3.5s cycles)
     |
     +-- [Stage 1-2] TreePot: pot geometry + seed/sprout
     |     Stage 2: Framer Motion pathLength animation on stem
     |     Stage 2: leaf sway via motion.animate rotate
     |
     +-- [Stage 3-5] TreeTrunk + TreeCanopy + TreeAccents
     |     TreeCanopy: useMotionValue + useAnimationFrame for sway
     |       amplitude = lowStimulus ? 0.3 : 0.8
     |       angle = sin(time * 0.0012) * amplitude
     |     Canopy layers: back, main (center+left+right), front highlight
     |     Stage 4+: additional side blobs
     |     Stage 5: extra crown volume + top cap
     |
     +-- TreeParticles: native SVG <animate>/<animateTransform>
           - Count varies by stage (more particles for bigger trees)
           - lowStimulus: fewer particles, lower opacity (0.35 vs 0.55)
           - Winter: circle shapes, Other: teardrop path with rotation

4. HTML overlays (absolute positioned on top of SVG):
     +-- WaterBar: horizontal progress bar
     +-- WateringEffect: 5x falling water emoji (when isWatering=true, 1.5s)
     +-- ThirstyIndicator: wobbling emoji (when waterLevel < 30 && !isWatering)
```

---

## 13. Assumptions Ledger

| # | Assumption | Confidence | Risk if Wrong | Mitigation |
|---|-----------|------------|---------------|------------|
| A1 | Northern Hemisphere seasons are appropriate for all users. | Medium | Southern Hemisphere users see "Winter" in July. Visually confusing but not functionally broken. | Future: detect hemisphere from timezone or let user override season. |
| A2 | 20 starting treats is enough to onboard without frustration. | High | User burns both waterings immediately, then has 0 treats and must do activities. This is the intended flow. | The default water level is 70%, so the tree is not immediately thirsty. |
| A3 | 2% per hour water decay is gentle enough to not feel punitive. | High | At 2%/hr, a fully watered tree takes 50 hours (~2 days) to hit 0%. This feels reasonable. | Can be adjusted in `FULLNESS_DECAY.perHour`. |
| A4 | Users will understand that treats come from activities. | Medium | New users may not connect activity completion to treats earning. | The `earnTreatsHint` message and `XpPopup` provide feedback. |
| A5 | The companion/animal system (fox, cat, owl) coexists with the tree system without confusion. | Medium | Two parallel systems (companion animal + tree) may feel redundant. | The tree is the primary visual; companion data (name, mood, level) provides narrative context. The animal type is vestigial. |
| A6 | `getTreeStageFromXP` thresholds (0, 100, 300, 700, 1500) provide satisfying pacing. | Medium | Stage 1->2 is achievable in 2 waterings (100 XP). Stage 4->5 requires 16 waterings (800 XP = 160 treats). Could feel grindy. | Touch provides free XP (+10/min) to supplement. Treat earning from normal app use should be ~40-60/day. |
| A7 | `Math.round` on treat calculations does not create exploitable rounding. | High | `Math.round(0.5 * 1.3)` = `Math.round(0.65)` = 1. Small amounts may round down to 0 for very short focus sessions. | Minimum 1-treat floor could be added if data shows 0-earning sessions. |
| A8 | The 60-second touch cooldown is short enough to feel rewarding but long enough to prevent spam. | High | During cooldown, touch still works but gives 2 XP instead of 10. No frustration gate. | Cooldown is a soft gate by design. |
| A9 | Storing the entire `InnerWorld` JSON as a single key-value pair in IndexedDB is acceptable for performance. | High | The object is relatively small (~5-20 KB). No performance issues observed. | If the object grows (e.g., thousands of transactions), the 50-transaction cap keeps it bounded. |
| A10 | The Zod schema for cloud validation uses `.passthrough()`, allowing unknown fields to survive validation. | High | This is intentional for forward compatibility: newer app versions can add fields that older versions won't strip. | The risk is accepting truly garbage data. The schema validates critical fields (treats.balance, companion) while passing through the rest. |
| A11 | `useAnimationFrame` in TreeCanopy runs continuously even when the tree is not visible (e.g., different tab). | Low | Minor battery/CPU impact. React does not pause `useAnimationFrame` when the component is rendered but off-screen within the same DOM. | TreePanel unmounts when closed (conditional render). InnerWorldCard's small tree is always mounted on Garden tab but is small. |
| A12 | The cloud sync debounce of 5 seconds after last change is appropriate. | High | Rapid interactions (touch, touch, touch) extend the debounce, which is the desired behavior. Final state is pushed once. | If the user closes the app within 5 seconds of an interaction, the last state may not sync. The `beforeunload` event is not used as a fallback. |
| A13 | Spending transactions record `source: 'mood'` regardless of the actual spending action (watering, feeding). | Low confidence | This makes transaction history filtering by source inaccurate for spend transactions. | Low impact: the `description` field provides human-readable context ("Water tree", "Feed companion"). A dedicated `spend` source type could be added. |

---

## 14. Contradiction & Absurdity Check

### 14.1 Contradiction: Dual Leveling Systems

**Observation:** The `Companion` type has both:
- `level` / `experience` -- legacy companion leveling via `COMPANION_LEVELING.xpPerLevel(level)` (level * 50 XP per level)
- `treeStage` / `treeXP` -- tree growth via `TREE_STAGE_XP` thresholds

These are **two independent XP tracks** that advance from different sources:
- `level`/`experience` advances from `plantSeed()` (+10 XP), `petCompanion()` (+10/+2 XP), `feedCompanion()` (+50 XP), `talkToCompanion()` (+3 XP)
- `treeXP` advances from `waterTree()` (+50 XP) and `touchTree()` (+10/+2 XP)

**Verdict:** Not a contradiction -- these are intentionally separate progression tracks. The companion level is the "legacy" system (pre-tree). The tree stage is the "new" system. However, the companion level is largely invisible in the current UI (not displayed in TreePanel or InnerWorldCard). This is a **dead feature** that still consumes XP.

**Recommendation:** Either surface companion level in the UI or deprecate it to avoid user confusion about where their XP is going.

### 14.2 Contradiction: `feedCompanion` vs. `waterTree`

**Observation:** Both actions cost 10 treats and grant XP, but to different systems:
- `feedCompanion()`: +30 fullness, +50 XP to companion level
- `waterTree()`: +30 water level, +50 XP to tree stage

The tree and companion share the same data object (`world.companion`), and the companion has both `fullness` and `waterLevel` fields.

**Verdict:** These are **parallel systems that share a wallet**. The TreePanel only exposes `waterTree()` and `touchTree()`. The `feedCompanion()` path exists but is not wired into any current UI button. This is safe but could be confusing if both are ever surfaced simultaneously.

### 14.3 Absurdity: Companion Name is "Luna" but Type is "Fox"

**Observation:** The default companion is a fox named Luna, but the tree system has no fox. The tree is the visual centerpiece, and the "fox" is never rendered as a visual.

**Verdict:** The companion name and type are **narrative flavor**, not visual. The name appears in the `renameCompanion` flow and could appear in contextual messages. The fox type comes from the legacy system. Not a functional problem, but the fox/tree naming could confuse users who expect an animal character.

### 14.4 Absurdity: Spending Transaction Source is Always 'mood'

**Observation:** When watering the tree, the deducted transaction is recorded as:
```typescript
source: 'mood', description: 'Water tree'
```

**Verdict:** This is a **minor data quality issue**. The `TreatSource` type does not include a 'spend' or 'tree_care' variant. The `source` field is semantically incorrect for spend transactions. The `description` field carries the correct human-readable purpose. Low impact since transaction history is capped at 50 and not displayed in a filterable UI.

### 14.5 Absurdity: Water Decay Starts from 100, Not from Actual Level

**Observation:** Water decay formula:
```typescript
expectedWaterLevel = Math.max(0, 100 - expectedDecay);
```

This calculates the expected level as if the tree started at 100% water at `lastWateredAt`. If the user watered at 70% -> new level is `Math.min(100, 70 + 30) = 100`, so `lastWateredAt` is reset, and decay correctly starts from 100.

**Verdict:** Not absurd. The formula works correctly because `lastWateredAt` is updated on every watering, and the water level is capped at 100 on the `waterGain` side. The decay always starts from 100 (the max possible value after watering). If the user never waters and `lastWateredAt` is the initial value, the tree decays from 100 down to 0. This is correct because the initial water level is 70, but the initial `lastWateredAt` is `Date.now()` at creation time, meaning the first decay will correctly subtract from the effective start.

**Edge case verified:** If `lastWateredAt` is very old (e.g., 200 hours), `expectedDecay = 200 * 2 = 400`, `expectedWaterLevel = max(0, 100 - 400) = 0`. Correct.

### 14.6 Check: Can Treats Balance Go Below Zero?

**Code path analysis:**
1. `waterTree()`: Checks `currentBalance < treatCost` and returns `prev` if insufficient. **Safe.**
2. `feedCompanion()`: Same check. **Safe.**
3. `spendTreats()`: Same check. **Safe.**
4. No other code path deducts treats.

**Verdict:** Balance cannot go negative through normal code paths. Only client-side state manipulation could produce a negative balance.

### 14.7 Check: Can Tree Stage Decrease?

**Code path analysis:**
1. `getTreeStageFromXP()` is monotonic: higher XP always produces equal or higher stage.
2. `treeXP` is only ever incremented (in `waterTree` and `touchTree`). No code path decreases it.
3. Cloud sync could potentially overwrite with a lower XP value if the cloud state "wins" with lower tree progress but higher streak/plants score.

**Verdict:** Stage can technically decrease after a cloud sync merge if the "winning" state has lower treeXP. This is an edge case of the merge strategy that prioritizes streak + plant count over tree progress. **Low probability, accepted risk.**

### 14.8 Check: Focus Session Treats Rounding

**Calculation:** `Math.round(duration * 0.5)`
- 1 minute session: `Math.round(0.5)` = 1 treat (rounds up by IEEE 754 "round half to even" -- actually 0 in some engines)
- 25 minute session: `Math.round(12.5)` = 12 or 13 depending on engine (banker's rounding)

**Verdict:** JavaScript's `Math.round` uses "round half away from zero" (not banker's rounding). `Math.round(0.5)` = 1. `Math.round(12.5)` = 13. Short sessions (1-2 min) yield 1 treat. This is fine. A 0-minute session would yield `Math.round(0)` = 0 treats, which is correct (no reward for zero effort).

---

*End of document.*
