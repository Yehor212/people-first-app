# Treats Spending + Journal + Tutorial — End-to-End User Journey

## Goal

Let users **spend treats** they earn (mood=5, habit=10, focus=0.5/min, gratitude=8, breathing=5) on their virtual tree,
**discover the personal journal** during onboarding, and see an **attractive journal card** in the garden tab —
while eliminating all hardcoded Russian text visible to non-Russian users.

---

## Actors / Permissions

| Actor | Permissions |
|---|---|
| **User** | Read/write IndexedDB (garden state, journal entries). No network required. |
| **System** | Reads garden state to render InnerWorldCard. Manages tree XP/stage/water decay (-2%/hr). |
| **Push Edge Function** | Reads user `language` column to select notification copy. No PII beyond `user_id`. |
| **AdMob SDK** (future) | Native-only. Requires explicit GDPR `adConsent`. PWA mode: SDK absent → all ad UI hidden. |

---

## Entry Points

### 1. Treats Spending (InnerWorldCard → TreePanel)
```
Garden Tab → InnerWorldCard (always visible)
  → Tap → TreePanel (bottom sheet modal)
    → Touch tree (free, +10 XP, 60s cooldown)
    → Water tree (10 treats, +30% water, +50 XP)
```

### 2. Journal Discovery
```
First Launch → WelcomeTutorial
  → Slide 7/9: "Personal Journal" (BookOpen, purple, float)
    → Features: text/photos/audio, PIN lock, streaks, templates
  → Slide 9: "Ready to start?" → Module Picker (OnboardingFlow)
```

### 3. Journal Card (Garden Tab)
```
Garden Tab → JournalModule card
  → Shows: today status, entry count, streak, mood emoji
  → Tap → Full journal overlay (entries, editor, calendar, stats)
```

### 4. Ad Prompt (opt-in, native only)
```
DailyRewards (after claiming) → RewardedAdPrompt (compact)
FocusTimer (post-session reflection) → RewardedAdPrompt (compact)
```

---

## State Machine

### Tree Interaction States

```
┌─────────┐     tap card      ┌───────────┐
│  CARD   │ ───────────────→  │  PANEL    │
│ (garden)│ ←─────────────── │ (modal)   │
└─────────┘   close/back      └───────────┘
                                    │
                               ┌────┴────┐
                               ▼         ▼
                          ┌─────────┐ ┌─────────┐
                          │ TOUCH   │ │ WATER   │
                          │ animating│ │ animating│
                          └────┬────┘ └────┬────┘
                               │           │
                          1.5s timeout  2s timeout
                               │           │
                               ▼           ▼
                          ┌─────────┐ ┌─────────┐
                          │ REACTION│ │ REACTION│
                          │ shown   │ │ shown   │
                          └────┬────┘ └────┬────┘
                               │           │
                               ▼           ▼
                          ┌──────────────────┐
                          │ IDLE (contextual │
                          │ message shown)   │
                          └──────────────────┘
```

### Tree Touch Transitions

| From | Event | Guard | To | Side Effects |
|---|---|---|---|---|
| IDLE | tap Touch | !isAnimating | ANIMATING | - |
| ANIMATING | 0ms | cooldown > 60s | REACTION | treeXP += 10, show random reaction |
| ANIMATING | 0ms | cooldown ≤ 60s | REACTION | treeXP += 2, show random reaction |
| REACTION | 1.5s timeout | stageUp | IDLE | Show stage-up message |
| REACTION | 1.5s timeout | !stageUp | IDLE | Show contextual message |

### Tree Water Transitions

| From | Event | Guard | To | Side Effects |
|---|---|---|---|---|
| IDLE | tap Water | balance ≥ 10 | WATERING | treats -= 10, water += 30, treeXP += 50 |
| IDLE | tap Water | balance < 10 | ERROR_REACTION | Show "Need 10, have {n}" |
| WATERING | 2s timeout | stageUp | IDLE | Show stage-up message |
| WATERING | 2s timeout | !stageUp | IDLE | Show contextual message |
| ERROR_REACTION | 1.5s timeout | - | IDLE | Re-enable buttons |

### Journal Card States

```
moduleState: 'card' | 'open'

CARD → tap → OPEN (full overlay)
OPEN → close/back → CARD
```

### Tutorial States

```
currentSlide: 0..8
  0: welcome → 1: brain → 2: features → 3: dayclock
  → 4: moodtheme → 5: mood → 6: journal → 7: focus → 8: ready

Navigation: swipe L/R, dots, Next/Back buttons
Skip: any slide → onSkip()
Complete: slide 8 → "Let's Go!" → onComplete()
```

---

## Verification / Authorization

| Action | Verification |
|---|---|
| Water tree | `treatsBalance >= waterCost (10)` — checked in `waterTree()` before deduction |
| Touch tree | None — always allowed (XP reduced during cooldown) |
| View journal | If password set: `JournalLockScreen` PIN entry required |
| Watch ad | `canShowRewardedAd(currentMood, zone)` checks: sacred-zone block, SDK availability, mood block, frequency caps, cooldowns |
| Push notifications | `secureCompare()` (timing-safe) validates cron secret or service role key |

---

## Error States

| Error | Trigger | User Sees | Recovery |
|---|---|---|---|
| Not enough treats | Water tap with balance < 10 | "🍪 Need 10 treats, have {n}" in speech bubble | Earn treats via activities |
| Ad SDK unavailable | PWA mode or missing plugin | Nothing — RewardedAdPrompt returns `null` | N/A (graceful) |
| Ad dismissed | User closes ad early | Prompt remains, 10min dismiss cooldown | Wait cooldown, try again |
| Journal storage error | IndexedDB failure | Toast notification via sonner | Retry on next open |
| Tutorial stuck | Multiple taps with no transition | After 3 attempts: force-complete after 1s | Auto-recovery |

---

## Edge Cases

| Edge Case | Handling |
|---|---|
| Water level at 100% + water | Capped: `Math.min(100, current + 30)` — excess water lost |
| Tree at max stage (5) + more XP | XP still accrues, stage stays 5, progress shows "✓" |
| Treats balance exactly 10 | Water succeeds, balance becomes 0 |
| Touch during water animation | Blocked — `isAnimating` guard on both buttons |
| Fast double-tap on Touch | Blocked — `isAnimating` set true immediately |
| Journal card with 0 entries, no streak | Shows BookOpen icon, no streak badge, no entry count |
| RTL languages (Arabic, Hebrew) | Flexbox auto-reverses; `text-start` adapts; tested |
| Dark mode | All colors use `/opacity` format, adapts via CSS variables |
| TreePanel closed during animation | `mountedRef.current` checked before setState; timeouts cleared on unmount |
| Push notification for unsupported language | Falls back to English: `NOTIFICATION_STRINGS[language] \|\| NOTIFICATION_STRINGS.en` |
| Companion name migration (Луна → Luna) | Only affects new installs; existing users keep their renamed companion |

---

## Copy (Exact Labels)

### InnerWorldCard
| Key | English | Russian |
|---|---|---|
| `innerWorld` | Inner World | Внутренний мир |
| `treats` | treats | угощений |
| `tapToInteract` | Tap to interact | Нажмите для взаимодействия |

### TreePanel
| Key | English |
|---|---|
| `touch` | Touch |
| `water` | Water |
| `free` | Free |
| `growth` | Growth |
| `waterLevel` | Water Level |
| `treeNeedsWater` | The tree needs water! |
| `waterDecayHint` | Water level decreases -2% per hour |
| `earnTreatsHint` | Complete activities to earn treats for your tree! |

### Touch Reactions (random 1 of 4)
- "✨ *rustles leaves*" + " +{xp} XP"
- "🍃 The leaves dance!" + " +{xp} XP"
- "💚 Feels alive!" + " +{xp} XP"
- "🌿 Growing stronger!" + " +{xp} XP"

### Water Reactions (random 1 of 4)
- "💧 *absorbs water*" + " +{xp} XP"
- "🌊 Refreshing!" + " +{xp} XP"
- "💦 Thank you!" + " +{xp} XP"
- "✨ Growing!" + " +{xp} XP"

### Journal Card
| Key | English | Russian |
|---|---|---|
| `journalTitle` | Personal Journal | Личный дневник |
| `journalTodayComplete` | Done today | Записано сегодня |
| `journalWriteToday` | Write today | Написать сегодня |
| `journalProtected` | Protected | Защищён |
| `journalStreak` | streak | дней подряд |
| `journalEntries` | entries | записей |

### Tutorial Journal Slide
| Key | English |
|---|---|
| `tutorialJournalTitle` | Personal Journal |
| `tutorialJournalSubtitle` | Your private space to reflect |
| `tutorialJournalDesc` | Write about your day, capture thoughts, and track your journey... |
| `tutorialJournalFeature1` | ✍️ Text, photos, and audio entries |
| `tutorialJournalFeature2` | 🔒 Lock with PIN for privacy |
| `tutorialJournalFeature3` | 📊 Writing streaks and stats |
| `tutorialJournalFeature4` | 🎨 Templates to get you started |

### Push Notifications (9 languages)
| Type | English | Arabic | Hebrew |
|---|---|---|---|
| mood | How are you feeling today? | كيف حالك اليوم؟ | ?איך אתה מרגיש היום |
| habit | Time to check your habits. | .حان وقت مراجعة عاداتك | .הגיע הזמן לבדוק את ההרגלים |
| focus | Ready for a focus session? | ؟هل أنت مستعد لجلسة تركيز | ?מוכן לסשן מיקוד |

---

## Abuse / Security / Privacy

| Concern | Mitigation |
|---|---|
| **Treat inflation** | All earn rates defined in `treatConstants.ts`; no client-side overrides. Spending deducts atomically inside `setWorld()` functional update. |
| **Double-spend** | `isAnimating` + `isWatering` flags prevent concurrent water calls. `setWorld()` uses functional updater (`prev =>`) to avoid stale closures. |
| **Journal privacy** | Optional PIN lock via `useJournalSecurity`. Screen security (FLAG_SECURE) prevents screenshots when enabled. |
| **Ad reward farming** | 5/day cap, 3/session cap, 3min cooldown, 10min dismiss cooldown, mood gating. |
| **Push notification spoofing** | `secureCompare()` constant-time comparison prevents timing attacks on cron secret. |
| **XSS in journal** | Journal entries stored in IndexedDB (not rendered as HTML). StickerRenderer uses emoji only. |
| **localStorage race** | Ad counters use `localStorage` with date-keyed reset. Session counter is in-memory only. |

---

## UI Screens / Components

### Screen 1: Garden Tab (with InnerWorldCard)
```
┌────────────────────────────┐
│ Header (user name, icons)  │
├────────────────────────────┤
│ ScheduleTimeline           │
├────────────────────────────┤
│ ┌────────────────────────┐ │
│ │ 🌲 Inner World         │ │  ← NEW: InnerWorldCard
│ │ ✨ 45 treats  💧 72%   │ │
│ │ 🔥 5                   │ │
│ │ Tap to interact        │ │
│ └────────────────────────┘ │
├────────────────────────────┤
│ ┌────────────────────────┐ │
│ │ 📖 Personal Journal    │ │  ← REDESIGNED
│ │ [Done today ✓]         │ │
│ │ 23 entries  🔥 5 streak│ │
│ └────────────────────────┘ │
├────────────────────────────┤
│ BreathingExercise          │
│ FocusTimer                 │
│ Insights                   │
└────────────────────────────┘
```

### Screen 2: TreePanel (bottom sheet)
```
┌────────────────────────────┐
│  🌸 My Tree    🍪 45   ✕  │
├────────────────────────────┤
│  ┌────────────────────┐    │
│  │ 💚 Feels alive!    │    │  ← Speech bubble
│  │    +10 XP          │    │
│  └────────────────────┘    │
│                            │
│       🌲 [Tree Visual]     │
│       Stage: Sapling       │
│                            │
│  ┌──────┐  ┌──────────┐   │
│  │ 👋   │  │ 💧       │   │
│  │Touch │  │Water     │   │
│  │ Free │  │ 🍪 10    │   │
│  └──────┘  └──────────┘   │
│                            │
│  ✨ Growth  42/100 XP      │
│  ████████░░░░░  42%        │
│                            │
│  💧 Water Level  72%       │
│  ████████████░░  72%       │
│                            │
│  🔥 5 days in a row        │
│  ⚙️ Calm Mode  [toggle]    │
│  🌸 Spring                 │
│  💡 Complete activities...  │
└────────────────────────────┘
```

### Screen 3: Tutorial — Journal Slide (7/9)
```
┌────────────────────────────┐
│                    [Skip]   │
│                             │
│     ┌─────────────────┐    │
│     │ 📖 (floating)   │    │
│     │ purple gradient  │    │
│     └─────────────────┘    │
│                             │
│    Personal Journal         │
│    Your private space       │
│    to reflect               │
│                             │
│  ┌─ ✍️ Text, photos... ──┐ │
│  ├─ 🔒 Lock with PIN    ─┤ │
│  ├─ 📊 Writing streaks  ─┤ │
│  └─ 🎨 Templates        ─┘ │
│                             │
│  ○ ○ ○ ○ ○ ○ ● ○ ○        │
│  [Back]        [Next →]     │
└─────────────────────────────┘
```

---

## API Contract

### No new API endpoints. All data is local (IndexedDB).

**Push Function Change:**
```
// Before:
getTitleBody(type, language) → only en/ru

// After:
NOTIFICATION_STRINGS[language] || NOTIFICATION_STRINGS.en
→ supports: en, ru, uk, es, de, fr, ja, ar, he
```

**IndexedDB State Shape (unchanged):**
```typescript
// garden state (db.settings, key: 'innerWorld')
{
  treats: { balance: number; lifetimeEarned: number; lifetimeSpent: number; transactions: [...] },
  companion: {
    name: string;        // was 'Луна', now 'Luna' for new installs
    treeStage: 1|2|3|4|5;
    waterLevel: 0-100;
    treeXP: number;
    lastWateredAt: number;
    lastTouchTime: number;
    ...
  },
  currentActiveStreak: number;
  ...
}
```

---

## Code Plan

| # | File | Change | Lines |
|---|---|---|---|
| 1 | `src/components/InnerWorldCard.tsx` | **NEW** — Garden tab card | ~85 |
| 2 | `src/pages/Index.tsx` | Import + wire InnerWorldCard + TreePanel | +53 |
| 3 | `src/components/TreePanel.tsx` | Fix `newStage` type (TreeStage → number) | 2 |
| 4 | `src/lib/utils.ts` | Delete `getGreeting`, `getMonthName`, `getDayName` | -20 |
| 5 | `src/hooks/useInnerWorld.ts` | `'Луна'` → `'Luna'` | 1 |
| 6 | `supabase/.../index.ts` | 9-language NOTIFICATION_STRINGS | +12 |
| 7 | `src/components/WelcomeTutorial.tsx` | Add journal slide | +13 |
| 8 | `src/features/journal/JournalModule.tsx` | Card redesign (purple, stats, badge) | ±50 |
| 9 | `src/i18n/translations.ts` | +15 keys × 9 languages | +130 |

**Total: +358 lines, -90 lines = net +268**

---

## Assumptions Ledger

| # | Assumption | Options | Default Chosen | Rationale |
|---|---|---|---|---|
| 1 | Journal is NOT toggleable in OnboardingFlow | A) Add as ToggleableFeature B) Keep always-on | **B** | Journal has no `isFeatureVisible` gate; adding it changes arch. Always-on is safe. |
| 2 | `calmMode` for TreePanel | A) Persist in IndexedDB B) Local component state | **B** | Low importance; resets per session. No need to persist. |
| 3 | Companion name migration | A) Migrate existing Луна→Luna B) Only new installs | **B** | Existing users may have renamed companion. Only default changes. |
| 4 | TreePanel is lazy-loaded | A) Eager import B) `lazyWithRetry` | **B** | TreePanel is 473 lines with canvas; lazy reduces initial bundle. |
| 5 | Water cost shown in TreePanel | A) From config B) Hardcoded 10 | **A** | `WATER_COST` from `useInnerWorld()` return; single source of truth. |

---

## Contradiction & Absurdity Check

| # | Check | Status | Notes |
|---|---|---|---|
| 1 | Can user spend more treats than they have? | ✅ Fixed | `waterTree()` checks `balance >= treatCost` before deduction |
| 2 | Can touch + water fire simultaneously? | ✅ Fixed | `isAnimating` flag blocks both buttons |
| 3 | Does deleting utils functions break imports? | ✅ Verified | `getGreeting`, `getMonthName`, `getDayName` have 0 imports |
| 4 | Does `smartReminders.ts` break? | ✅ Safe | Has its OWN local `getDayName` (line 136) — unrelated |
| 5 | Tutorial slide count matches dots? | ✅ 9 slides | Verified: welcome, brain, features, dayclock, moodtheme, mood, **journal**, focus, ready |
| 6 | Journal card shows streak=0 without fire emoji? | ✅ Guarded | `streak > 0 &&` check before rendering |
| 7 | RTL layout breaks in InnerWorldCard? | ✅ Safe | Flexbox + `text-start` auto-adapt |
| 8 | TreePanel `newStage: number` vs `TreeStage` type? | ✅ Fixed | Changed props to accept `number` |
| 9 | Push notifications for unknown language? | ✅ Fallback | `NOTIFICATION_STRINGS[language] \|\| NOTIFICATION_STRINGS.en` |
| 10 | Ad prompt visible in PWA? | ✅ Hidden | `adsAvailable` is false when SDK absent → prompt returns null |
