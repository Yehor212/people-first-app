# Non-Intrusive Ad System — Complete End-to-End User Journey

> Philosophy: **The user is NEVER interrupted.** Every ad interaction is opt-in.
> The ad system integrates into the existing treats economy as a "bonus earner."

---

## 1. Goal

Allow users to **voluntarily watch rewarded video ads** to earn bonus treats (in-app currency) that feed their companion and water their tree. Monetize the free tier without degrading the mental health experience. Premium users see zero ads.

**Success metrics:**
- Rewarded ad opt-in rate > 30%
- User retention unchanged (±2%) after ad introduction
- Average 1.5 rewarded views per DAU
- Zero ads during sacred mental health moments

---

## 2. Actors & Permissions

| Actor | Permissions | Notes |
|---|---|---|
| **Free User** | Can watch rewarded ads, can decline, can toggle ad consent | Default actor |
| **Premium User** | All ads disabled, no ad UI shown | $4.99/mo or $29.99/yr |
| **Anonymous User** | Ads disabled until explicit opt-in | No ad SDK startup without consent |
| **Ad SDK (AdMob)** | Renders video, reports completion | Client-side only, no SSV yet |
| **Mood Gatekeeper** | Blocks/reduces ads based on mood | Automatic, not user-visible |

### Permission matrix:
```
Free + adConsent=true  → Opt-in rewarded ads may initialize
Free + adConsent=false → No ad SDK initialization, no ad UI
Premium                → No ads at all
mood=terrible          → All ads blocked
mood=bad               → Max 1 ad per session
```

---

## 3. Entry Points (where users SEE an ad option)

All entry points are **opt-in buttons**, never auto-play.

| # | Location | Trigger | Format | Button Label |
|---|---|---|---|---|
| 1 | **Daily Rewards** | After claiming today's reward | Compact button | "Watch to earn +20 treats" |
| 2 | **Focus Timer** | After completing focus session (reflection dialog) | Compact button | "Watch to earn +20 treats" |
| 3 | **Companion** | When treats balance < 10 (can't feed) | Card prompt | "Watch to earn +20 treats" |
| 4 | **Inner World** | When water level < 20% (can't water tree) | Card prompt | "Watch to earn +20 treats" |

### Where ads NEVER appear (Sacred Zones):
- Focus timer while running
- Breathing exercise while active
- During mood logging flow
- Inside journal editor
- During meditation
- During onboarding (first 3 days)
- When mood = "terrible"

---

## 4. State Machine

```
┌─────────────┐
│ AD_DISABLED  │ ← Premium OR no SDK OR no consent OR onboarding
└──────┬──────┘
       │ SDK init + consent given + not premium
       ▼
┌─────────────┐
│  AD_IDLE     │ ← Default: ad system ready, no prompt visible
└──────┬──────┘
       │ User navigates to safe zone (post_focus, daily_rewards, etc.)
       ▼
┌─────────────┐
│ AD_AVAILABLE │ ← "Watch" button visible (passes all gates)
└──────┬──────┘
       │ User taps "Watch"
       ▼
┌─────────────┐
│ AD_LOADING   │ ← Loading spinner, ad preparing
└──────┬──────┘
       │ Ad loaded + starts playing
       ▼
┌─────────────┐
│ AD_PLAYING   │ ← Full-screen video (SDK handles UI)
└──────┬──────┘
       ├── User completes video
       │   ▼
       │ ┌──────────────┐
       │ │ AD_REWARDED   │ ← +20 treats, +25 XP, toast shown
       │ └──────┬───────┘
       │        │ Auto → AD_COOLDOWN
       │        ▼
       │ ┌──────────────┐
       │ │ AD_COOLDOWN   │ ← 3 min cooldown, button hidden
       │ └──────┬───────┘
       │        │ cooldown expires
       │        ▼
       │      AD_IDLE
       │
       └── User dismisses/closes/error
           ▼
         ┌──────────────┐
         │ AD_DISMISSED  │ ← No reward, 10 min dismiss cooldown
         └──────┬───────┘
                │ cooldown expires
                ▼
              AD_IDLE
```

### Transitions:
| From | Event | To | Side Effects |
|---|---|---|---|
| AD_DISABLED | sdk_init + consent | AD_IDLE | Pre-load first ad |
| AD_IDLE | enter_safe_zone + gates_pass | AD_AVAILABLE | Show button |
| AD_AVAILABLE | user_tap_watch | AD_LOADING | Show spinner |
| AD_LOADING | ad_loaded | AD_PLAYING | SDK takes over |
| AD_PLAYING | video_complete | AD_REWARDED | +treats, +xp, toast |
| AD_PLAYING | user_dismiss | AD_DISMISSED | No reward |
| AD_PLAYING | error | AD_DISMISSED | Log error |
| AD_REWARDED | auto | AD_COOLDOWN | Start 3min timer |
| AD_COOLDOWN | timer_expire | AD_IDLE | Re-check gates |
| AD_DISMISSED | timer_expire | AD_IDLE | 10min cooldown |

---

## 5. Verification & Authorization

### GDPR Consent Flow:
1. First launch → `ConsentBanner` asks for analytics (existing)
2. First time user enters a safe zone with ads available → small inline banner: "Earn bonus treats by watching short videos. We use ads to keep the app free." with "Allow" / "No thanks"
3. Consent stored in `PrivacySettings.adConsent`
4. Can be changed anytime in Settings → Privacy

### Ad Reward Verification:
- **Phase 1 (current):** Client-side only. AdMob SDK reports completion → award treats.
- **Phase 2 (future):** Server-Side Verification (SSV) via Supabase Edge Function. AdMob callback → verify → award.

### Anti-Cheat (Phase 1 — simple):
- Cooldown tracked via `performance.now()` (not `Date.now()`) — immune to clock manipulation
- Daily count in localStorage + date check
- Session count in memory (resets on app restart)
- Max 5 rewarded per day, 3 per session

---

## 6. Error States

| Error | User Sees | System Action |
|---|---|---|
| SDK not installed (PWA) | Button hidden | `adsAvailable = false` |
| No ad inventory | Button hidden | `canShowRewarded = false`, retry in 30s |
| Ad load timeout | Brief "Try again later" | Pre-load next ad |
| Network error during ad | Nothing (ad closes) | Enter AD_DISMISSED state |
| User closes ad early | No reward (expected) | 10 min cooldown |
| Daily limit reached | Button hidden | Shows again tomorrow |
| Session limit reached | Button hidden | Shows next app restart |
| Mood = terrible | Button hidden | No messaging about it |
| Premium user | Button never rendered | AdProvider skips init |

---

## 7. Edge Cases

| Edge Case | Resolution |
|---|---|
| User upgrades to premium mid-session | `isPremium` prop change → AdProvider stops, all ad UI vanishes |
| User downgrades from premium | AdProvider re-initializes on next session |
| App goes to background during ad | SDK handles pause/resume natively |
| Ad completes but app crashes before reward | Treats lost (acceptable — rare, small amount) |
| User watches 5 ads, changes timezone | Daily count reset happens on `toDateString()` change — might get extra ads (acceptable) |
| Two tabs open (PWA) | localStorage-based count is shared, so double-counting prevented |
| User clears localStorage | Counts reset — they get ads again (acceptable, no exploit concern) |
| `mood` changes while ad is playing | Irrelevant — mood check happens before showing, not during |
| Companion at max fullness | Button still shown (treats add to balance for later) |
| First-time user (onboarding) | No ads for first 3 days (check `OnboardingState.daysActive < 4`) |

---

## 8. Copy (exact button labels/messages)

### Button Labels:
| Key | EN | RU | UK |
|---|---|---|---|
| `adWatchToEarn` | Watch to earn | Смотри и получай | Дивись і отримуй |
| `adWatch` | Watch | Смотреть | Дивитись |
| `adRemaining` | left today | осталось сегодня | залишилось сьогодні |
| `treats` | treats | угощений | ласощів |

### Reward Toast (after watching):
```
🎉 +20 treats earned!
```

### No Ads Available (never shown to user — button simply hidden):
N/A — the system is invisible when unavailable.

### Consent Inline Banner:
```
"Earn bonus treats by watching short videos."
[Allow] [No thanks]
```

---

## 9. Abuse / Security / Privacy

### Abuse Vectors:
| Vector | Mitigation |
|---|---|
| Rapid ad watching for treats | 3min cooldown + 5/day cap + 3/session cap |
| Clock manipulation | `performance.now()` for cooldowns (monotonic) |
| Fake ad completion | AdMob SDK validates completion; Phase 2: SSV |
| Bot watching | Native-only (no PWA ads) + AdMob has bot detection |
| Ad injection/tampering | HTTPS only + AdMob SDK integrity |

### Privacy:
- **No ad SDK without consent.** `adConsent = false` → no ad initialization and no ad UI
- **No data sent to ad networks** beyond what AdMob SDK collects (device ID, app context)
- **Mood data NEVER sent** to ad networks — mood gating is 100% client-side
- **Premium removes all ad code paths** — no SDK initialization at all
- User can revoke `adConsent` anytime in Settings → Privacy
- GDPR Article 7: separate consent for analytics and ads

### Current release status:
- **Google Play release artifact ships with ads off.** `@capacitor-community/admob`
  is not installed in `package.json`, so Android must not declare the AdMob app
  ID or request `com.google.android.gms.permission.AD_ID`.
- **Future rewarded ads require a single release change.** Install the SDK,
  restore native declarations, update Play Console Ads/Data Safety, and rerun
  the Google Play asset/declaration checks in the same release batch.

### Security:
- Ad unit IDs in env vars, not hardcoded (except test IDs as fallback)
- No server-side ad logic yet (Phase 1 is client-only)
- AdMob SDK loaded via `@capacitor-community/admob` (official Capacitor plugin)

---

## 10. UI Screens & Components

### New Components Created:

| Component | File | Purpose |
|---|---|---|
| `RewardedAdPrompt` | `src/components/ads/RewardedAdPrompt.tsx` | Opt-in "Watch to earn" button. Two modes: compact (inline) and card. |
| `AdProvider` | `src/contexts/AdContext.tsx` | React context. Manages SDK init, mood gating, reward callbacks. |

### Modified Components:

| Component | Change |
|---|---|
| `DailyRewards.tsx` | Added `<RewardedAdPrompt context="daily_rewards" compact />` after claim |
| `FocusTimer.tsx` | Added `<RewardedAdPrompt context="post_focus" compact />` in reflection dialog |

### Future Components (not yet built):

| Component | Purpose |
|---|---|
| `AdConsentInline` | Small inline consent banner for first ad encounter |
| `CompanionAdPrompt` | "Need treats? Watch a short video" when balance < 10 |

### Component Hierarchy:
```
<App>
  <AdProvider adConsent={canInitializeRewardedAds(privacy)} isPremium={false}
              onEarnTreats={earnTreats} onEarnXp={awardXp}>
    <Index>
      <DailyRewards>
        <RewardedAdPrompt context="daily_rewards" />  ← after claim
      </DailyRewards>
      <FocusTimer>
        [reflection dialog]
          <RewardedAdPrompt context="post_focus" />    ← after save/skip
      </FocusTimer>
    </Index>
  </AdProvider>
</App>
```

---

## 11. API Contract

### AdMob SDK (via `@capacitor-community/admob`):
```typescript
// Initialize
AdMob.initialize({ initializeForTesting: boolean });

// Prepare rewarded ad
AdMob.prepareRewardVideoAd({ adId: string }): Promise<void>;

// Show rewarded ad
AdMob.showRewardVideoAd(): Promise<{ type: 'earned' | 'dismissed' }>;
```

### Internal API (adController.ts):
```typescript
// Initialize
initializeAds(): Promise<boolean>;

// Gate check
canShowRewardedAd(currentMood?: string): { allowed: boolean; reason?: string };

// Show ad
showRewardedAd(): Promise<{ success: boolean; rewarded: boolean; error?: string }>;

// State
getAdState(): AdControllerState;
isAdSdkAvailable(): boolean;
getRemainingRewardedAds(): number;
```

### React Context API (AdContext.tsx):
```typescript
interface AdContextValue {
  adsAvailable: boolean;
  canShowRewarded: boolean;
  remainingToday: number;
  watchRewardedAd: () => Promise<boolean>;
  rewardTreats: number;
  rewardXp: number;
  setCurrentMood: (mood: string) => void;
}
```

### No backend API needed (Phase 1).
Phase 2 would add a Supabase Edge Function for SSV verification.

---

## 12. Code Plan

### Phase 1: Foundation (DONE)
| File | Status | Lines |
|---|---|---|
| `src/lib/adConfig.ts` | ✅ Created | ~115 |
| `src/lib/adController.ts` | ✅ Created | ~220 |
| `src/contexts/AdContext.tsx` | ✅ Created | ~155 |
| `src/components/ads/RewardedAdPrompt.tsx` | ✅ Created | ~120 |

### Phase 2: Integration (DONE)
| File | Status | Change |
|---|---|---|
| `src/components/DailyRewards.tsx` | ✅ Modified | Added RewardedAdPrompt after claim |
| `src/components/FocusTimer.tsx` | ✅ Modified | Added RewardedAdPrompt in reflection |
| `src/i18n/translations.ts` | ✅ Modified | 4 keys × 9 languages |

### Phase 3: Wire into App (TODO — when AdMob SDK installed)
| Task | File |
|---|---|
| Install `@capacitor-community/admob` | `package.json` |
| Wrap App with `<AdProvider>` | `src/pages/Index.tsx` or `App.tsx` |
| Pass `earnTreats`/`awardXp` callbacks | `src/pages/Index.tsx` |
| Feed current mood to `setCurrentMood()` | `src/pages/Index.tsx` |
| Add companion low-treats prompt | `src/components/garden/CompanionCard.tsx` |
| Add inline ad consent | New component |

### Phase 4: Premium Tier (TODO)
| Task | File |
|---|---|
| Add `isPremium` flag to user state | `src/types/index.ts` |
| Integrate RevenueCat or Stripe | New files |
| Pass `isPremium` to AdProvider | `src/pages/Index.tsx` |
| Hide all ad UI for premium | Automatic via AdProvider |

### Phase 5: Server-Side Verification (TODO)
| Task | File |
|---|---|
| Supabase Edge Function for SSV | `supabase/functions/verify-ad-reward/` |
| Call server after ad completion | `src/lib/adController.ts` |
| Validate reward server-side | Edge Function |

---

## Assumptions Ledger

| # | Assumption | Default Chosen | Alternatives | Risk |
|---|---|---|---|---|
| A1 | Ad SDK | `@capacitor-community/admob` | React Native AdMob, custom WebView | Low — official Capacitor plugin |
| A2 | Reward amount | 20 treats per video | 10, 15, 25, 30 | Medium — tunable via adConfig.ts |
| A3 | Daily cap | 5 per day | 3, 7, 10 | Low — can adjust |
| A4 | Session cap | 3 per session | 2, 5 | Low — can adjust |
| A5 | Cooldown | 3 minutes | 1, 5, 10 min | Low — can adjust |
| A6 | Dismiss cooldown | 10 minutes | 5, 15, 30 min | Low — can adjust |
| A7 | Mood blocking | terrible = blocked | terrible+bad = blocked | Medium — chose less aggressive |
| A8 | Mood reduction | bad = max 1/session | bad = max 0 | Medium — allows 1 for engagement |
| A9 | No interstitials | Correct — only rewarded | Could add 1 interstitial/day on comeback | **Strong opinion**: interstitials damage mental health apps |
| A10 | No banners | Correct — clean UI | Could add small banner in stats | **Strong opinion**: banners cheapen the premium feel |
| A11 | Premium price | $4.99/mo | $2.99, $6.99, $9.99 | Medium — market-dependent |
| A12 | Onboarding grace period | 3 days no ads | 1 day, 7 days | Low — 3 days matches feature unlock schedule |
| A13 | Client-side verification (Phase 1) | Acceptable for launch | SSV immediately | Low — small reward amounts, SSV in Phase 5 |

---

## Contradiction & Absurdity Check

| # | Check | Status | Resolution |
|---|---|---|---|
| C1 | "Non-intrusive" but ads exist | ✅ OK | All ads are opt-in buttons. User NEVER sees an ad without tapping "Watch." No pop-ups, no interstitials, no banners. |
| C2 | Mood gating blocks ads when terrible, but user might WANT treats | ✅ OK | Mental health > monetization. A user feeling terrible shouldn't be nudged to watch ads. They can earn treats through activities instead. |
| C3 | 20 treats per ad vs 10 for completing a habit | ✅ OK | Ad reward is intentionally generous to incentivize watching. But habits still give XP + streak + garden growth + companion mood — ads only give treats. |
| C4 | Premium removes ads but ad system uses treats | ✅ OK | Premium users earn treats normally through activities. Treats economy works independently of ads. Ads are just a bonus earner. |
| C5 | `canShowRewardedAd` checks mood but mood can change | ✅ OK | Check happens at button render time. If mood changes while button is visible, next render hides it. If mood changes while ad plays, irrelevant — ad is already shown. |
| C6 | Sacred zones list vs safe zones list — overlap? | ✅ OK | No overlap. Sacred = actively doing something (focus running). Safe = viewing results (post-focus). Mutually exclusive. |
| C7 | First-time user sees ad buttons before consent | ✅ Fixed | AdProvider checks `adConsent` — if false, `adsAvailable = false`, no buttons rendered. |
| C8 | PWA users see broken ad buttons | ✅ OK | `Capacitor.isNativePlatform()` check — PWA skips SDK init entirely. All ad UI hidden. |
| C9 | Arabic/Hebrew RTL + ad button layout | ✅ OK | Using flexbox `gap` and Tailwind — naturally RTL-compatible. No absolute positioning in ad prompt. |
| C10 | Focus timer reflection + ad prompt — too much UI? | ✅ OK | Ad prompt is compact (small inline button below save/skip). Hidden when ads unavailable. Doesn't interfere with reflection flow. |
| C11 | `performance.now()` resets on page reload | ✅ OK | Session cooldowns are in-memory (intentional). Only daily count persists in localStorage. Reloading the app resets the 3-min cooldown — acceptable trade-off vs complexity. |
| C12 | User watches ad → app crashes → treats not saved | ✅ Acceptable | Small amount (20 treats). Treats are saved to IndexedDB via `setWorld()` which is called by `onEarnTreats` callback immediately after ad completion. Crash would have to happen in the <100ms between callback and IndexedDB write. |
