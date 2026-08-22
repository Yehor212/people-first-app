# Non-Intrusive Ad System — Complete End-to-End User Journey

> Philosophy: **The user is NEVER interrupted.** Every ad interaction is opt-in.
> The ad system integrates into the existing treats economy as a "bonus earner."

---

## 1. Goal

Allow users to **voluntarily watch rewarded video ads** to earn bonus treats (in-app currency) that can be spent later in the companion/tree economy. Monetize the free tier without degrading the mental health experience. Premium users see zero ads.

**Proposed product targets (not observed production results):**
- Rewarded ad opt-in rate > 30% — `UNVERIFIED` until a consented production cohort exists.
- User retention unchanged (±2%) after introduction — `UNVERIFIED` and requires an approved measurement plan.
- Average 1.5 rewarded views per DAU — `UNVERIFIED`; this is a planning target, not current telemetry.
- Zero ad requests during sacred mental-health moments — locally enforced; production runtime evidence remains `UNVERIFIED`.

---

## 2. Actors & Permissions

| Actor | Permissions | Notes |
|---|---|---|
| **Free User** | Can watch rewarded ads, can decline, can toggle ad consent | Default actor |
| **Premium User** | All ads disabled, no ad UI shown | $4.99/mo or $29.99/yr |
| **Anonymous User** | Ads disabled until explicit opt-in | No ad requests or rewarded UI without ZenFlow ad consent; UMP status may still refresh privacy choices |
| **Ad SDK (AdMob)** | Renders video, reports completion | Client event plus opaque attempt binding; no server-side callback verification yet |
| **Mood Gatekeeper** | Blocks/reduces ads based on mood | Automatic, not user-visible |

### Permission matrix:
```
Free + adConsent=true  → Opt-in rewarded ads may initialize
Free + adConsent=false → No ad requests and no rewarded ad UI; UMP privacy-options status may still refresh when Google requires a Settings entry point
Premium                → No ads at all
mood=terrible          → All ads blocked
mood=bad               → All ads blocked
```

---

## 3. Entry Points (where users SEE an ad option)

All entry points are **opt-in buttons**, never auto-play.

| # | Location | Trigger | Format | Button Label |
|---|---|---|---|---|
| 1 | **Optional Rewards surface** | Future approved surface after separate UX review; never inside Privacy controls | Card prompt | "Optional ad: watch for a small bonus +20 treats" |
| 2 | **Focus Timer** | Future only: deferred until after reflection is saved/dismissed; never inside the reflection dialog | Compact button | "Optional ad: watch for a small bonus +20 treats" |
| 3 | **Companion** | Future only: user opens an explicit optional rewards area from the companion surface | Card prompt | "Optional ad: watch for a small bonus +20 treats" |
| 4 | **Inner World** | Future only: user opens an explicit optional rewards area from the inner-world surface | Card prompt | "Optional ad: watch for a small bonus +20 treats" |

### Psychological Safety Copy Rule

No scarcity or guilt copy is allowed for rewarded ads. Reward playback controls
must not be placed inside Privacy controls; Privacy is for consent, disclosure,
and withdrawal only. Future companion/tree placements must not imply that the
user has failed to care, that the companion or tree is suffering, that a streak
or relationship is at risk, or that an ad is needed urgently. Banned patterns
include loss timers, dependency pressure, implied neglect, resource shortage
pressure, and any copy that frames watching as required before the user can feed
or water. The prompt must stay framed as an optional bonus.

### Where ads NEVER appear (Sacred Zones):
- Focus timer while running
- Inside the focus reflection decision dialog
- Breathing exercise while active
- During mood logging flow
- Inside journal editor
- During meditation
- During onboarding (first 3 days)
- When mood = "terrible" or "bad"

The controller rejects sacred-zone calls before any rewarded prepare or show request. The only allowlisted initial zone is `optional_rewards`; former broad zones such as `daily_rewards`, `post_focus`, and companion contexts fail closed.

---

## 4. State Machine

```
┌─────────────┐
│ AD_DISABLED  │ ← Premium OR no SDK OR no consent OR onboarding
└──────┬──────┘
       │ SDK init + consent given + not premium
       ▼
┌─────────────┐
│  AD_IDLE     │ ← Default: SDK may be ready, no inventory preloaded and no prompt visible
└──────┬──────┘
       │ User navigates to an approved separate Optional Rewards surface
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
| AD_DISABLED | verified free entitlement + local consent + current UMP + fresh service gate | AD_IDLE | Initialize only; do not preload inventory |
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
1. ZenFlow local preference gates whether rewarded ads may initialize: `PrivacySettings.adConsent === true` and no-tracking off.
2. Native builds request fresh Google UMP consent information on ad initialization.
3. If Google UMP requires consent, the native Google consent form is shown before ads can be requested.
4. If Google UMP requires a privacy-options entry point, Settings shows "Google ad privacy choices" so consent can be changed or withdrawn.

### Ad Reward Verification:
- **Current:** Persist an owner-bound attempt before playback, pass its opaque UUID as AdMob SSV custom data, and atomically award treats only after `RewardAdPluginEvents.Rewarded`; `Dismissed` alone never grants reward. Duplicate local callbacks/replay converge to one wallet transaction.
- **Future:** Add an authenticated server-side AdMob callback and reconcile the same attempt ID before treating server verification as complete. No live SSV callback is claimed today.

### Anti-Cheat (Phase 1 — simple):
- Cooldown is tracked locally with persisted daily count and session memory. The reward attempt and wallet transaction are durable and owner-bound; a future authenticated SSV callback is still required for server-authoritative completion.
- Strictly parsed daily count in local storage + date check; malformed same-day state fails closed
- Session count in memory (resets on app restart)
- Max 5 rewarded per day, 3 per session

---

## 6. Error States

| Error | User Sees | System Action |
|---|---|---|
| SDK not installed (PWA) | Button hidden | `adsAvailable = false` |
| No ad inventory | No reward; prompt remains optional | Return unavailable without a show call or automatic retry |
| Ad load timeout | No reward | End the attempt safely; future attempts remain user-initiated |
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
| Verified entitlement changes to premium mid-session | `premiumStatus="premium"` makes `AdProvider` disable requests and hide rewarded UI |
| User downgrades from premium | AdProvider re-initializes on next session |
| App goes to background during ad | SDK handles pause/resume natively |
| Ad completes but app dies before durable settlement | The prepared owner-bound attempt blocks duplicates and expires after 10 minutes; without a verified server callback the reward may remain unrecoverable, so recovery is `UNVERIFIED` rather than fabricated |
| User watches 5 ads, changes timezone | Daily count reset happens on `toDateString()` change — might get extra ads (acceptable) |
| Two tabs open (PWA) | localStorage-based count is shared, so double-counting prevented |
| User clears localStorage | Counts reset — they get ads again (acceptable, no exploit concern) |
| `mood` changes while ad is playing | Irrelevant — mood check happens before showing, not during |
| Companion at max fullness | Optional reward surfaces do not depend on fullness or resource scarcity; treats add to balance for later |
| First-time user (onboarding) | No ads for first 3 days (check `OnboardingState.daysActive < 4`) |

---

## 8. Copy (exact button labels/messages)

### Button Labels:
| Key | EN |
|---|---|
| `adWatchToEarn` | Optional ad: watch for a small bonus |
| `adWatch` | Watch optional ad |
| `adRewardLabel` | +{treats} treats |
| `adRemainingToday` | Daily optional limit applies |

### Reward Toast (after watching):
```
🎉 +20 treats earned!
```

### No Ads Available (never shown to user — button simply hidden):
N/A — the system is invisible when unavailable.

### Consent / Privacy Entry Point:
```
Ad privacy choices are managed in Settings / Privacy through Google UMP.
Do not promise treats, XP, streaks, companion care, or any reward in consent copy.
[Manage ad privacy] [Not now]
```

---

## 9. Abuse / Security / Privacy

### Abuse Vectors:
| Vector | Mitigation |
|---|---|
| Rapid ad watching for treats | 3min cooldown + 5/day cap + 3/session cap |
| Clock manipulation | Daily count is local and low-value; Phase 2 SSV can harden it |
| Fake ad completion | Reward requires AdMob rewarded event; Phase 2: SSV |
| Bot watching | Native-only (no PWA ads) + AdMob has bot detection |
| Ad injection/tampering | HTTPS only + AdMob SDK integrity |

### Privacy:
- **No ad requests or rewarded UI without ZenFlow ad consent.** `adConsent = false` prevents ad initialization for requests and hides rewarded prompts; UMP privacy-options status may still be checked so required Google privacy choices remain reachable in Settings.
- **No journal, mood note, habit name, gratitude text, or focus note is sent to ad networks.** The Google Mobile Ads SDK may process device identifiers, app context, ad interactions, and consent signals as needed to request ads.
- **Mood data NEVER sent** to ad networks — mood gating is 100% client-side
- **Premium removes all ad code paths** — no SDK initialization at all
- User can revoke ZenFlow `adConsent` anytime in Settings → Privacy. When Google UMP requires it, the app also shows Google ad privacy choices.
- GDPR Article 7: separate consent for analytics and ads

### Current release status:
- **Google Play draft is ads-enabled.** `@capacitor-community/admob` is
  installed, Android declares the AdMob app ID metadata, and the release
  manifest must request `com.google.android.gms.permission.AD_ID`.
- **Play Console must match the artifact.** App content declarations for this
  release path are `Ads = Yes` and `Advertising ID = Yes`.
- **Production monetization requires owner-controlled AdMob values.** The repo
  accepts `VITE_ADMOB_APP_ID_ANDROID` and `VITE_ADMOB_REWARDED_ID_ANDROID`;
  test IDs are allowed only for development builds. `public/app-ads.txt` must
  match the real AdMob publisher line and be verified at the public root domain.
- **User experience stays opt-in.** No banners, pop-ups, or interstitials are
  allowed in mood check-ins, active focus, or journaling; rewarded ads initialize
  only after ZenFlow privacy consent plus native Google consent.

### Security:
- Production ad unit IDs come from environment variables; Google test IDs are development-only fallbacks
- The deployed service-owned `rewarded-ads-gate` is required before SDK initialization; the app has no server-side reward-verification callback yet
- AdMob SDK is loaded through the pinned `@capacitor-community/admob` community plugin

---

## 10. UI Screens & Components

### New Components Created:

| Component | File | Purpose |
|---|---|---|
| `RewardedAdPrompt` | `src/components/ads/RewardedAdPrompt.tsx` | Opt-in optional-ad button. Two modes: compact (inline) and card. |
| `AdProvider` | `src/contexts/AdContext.tsx` | React context. Manages SDK init, mood gating, reward callbacks. |

### Modified Components:

| Component | Change |
|---|---|
| `PrivacySection.tsx` | Shows ad consent and Google UMP privacy-options controls only; it must not mount rewarded playback UI |
| `V2SettingsDataPanels.tsx` | Shows V2 ad consent and Google UMP privacy-options controls only; it must not mount rewarded playback UI |

### Future Components (not yet built):

| Component | Purpose |
|---|---|
| `AdConsentInline` | Small inline consent banner for first ad encounter |
| `OptionalRewardsPrompt` | Neutral optional bonus prompt, never tied to companion/tree dependency, urgency, or neglect pressure |

### Component Hierarchy:
```
<IndexV2Impl>
  <AuthGate>
    <AdProvider
      adConsent={canInitializeRewardedAds(privacy)}
      premiumStatus={adPremiumStatus}
      currentMood={latestTimestampedMood}
    >
      <NavV2Orchestrator />
    </AdProvider>
  </AuthGate>
</IndexV2Impl>
```

`useAdPremiumStatus()` accepts only exact `free` or `premium` values from the
signed-in user's server-controlled `app_metadata.zenflow_ad_entitlement`. It
also requires the admitted sync owner and local data owner to match that user.
Missing, malformed, signed-out, account-transition and lookup-error states
remain `unknown` and therefore fail closed. User-editable `user_metadata` is
ignored. No production surface currently mounts `RewardedAdPrompt`; playback
still requires a separately approved `optional_rewards` surface.

---

## 11. API Contract

### AdMob SDK (via `@capacitor-community/admob`):
```typescript
// Initialize
AdMob.initialize({ initializeForTesting: boolean });

// Prepare rewarded ad
AdMob.prepareRewardVideoAd({ adId: string }): Promise<void>;

// Show rewarded ad; reward is confirmed by event, not by dismissal.
AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward) => void);
AdMob.addListener(RewardAdPluginEvents.Dismissed, () => void);
AdMob.showRewardVideoAd(): Promise<unknown>;

// Google UMP privacy choices when required.
AdMob.showPrivacyOptionsForm(): Promise<void>;
```

### Internal API (adController.ts):
```typescript
// Initialize
initializeAds(): Promise<boolean>;

// Gate check
canShowRewardedAd(options?: {
  moodSignal?: { mood: string; recordedAt: number } | null;
  premiumStatus?: 'free' | 'premium' | 'unknown';
  zone?: string;
}): { allowed: boolean; reason?: string };

// Show ad
showRewardedAd(options?: {
  moodSignal?: { mood: string; recordedAt: number } | null;
  premiumStatus?: 'free' | 'premium' | 'unknown';
  zone?: string;
  ssvCustomData?: string;
}): Promise<{ success: boolean; rewarded: boolean; error?: string }>;

// Disable native ads fail-closed after local consent revocation or premium changes
disableAds(options?: { clearPrivacyOptions?: boolean }): void;

// State
getAdState(): AdControllerState;
isAdSdkAvailable(): boolean;
getRemainingRewardedAds(): number;
```

### React Context API (AdContext.tsx):
```typescript
interface AdContextValue {
  adsSupported: boolean;
  adsAvailable: boolean;
  canShowRewarded: boolean;
  remainingToday: number;
  googleConsentReady: boolean;
  privacyOptionsRequired: boolean;
  openAdPrivacyOptions: () => Promise<boolean>;
  watchRewardedAd: (zone?: AdSafeZone) => Promise<boolean>;
  rewardTreats: number;
  rewardXp: number;
  setCurrentMood: (mood: { mood: string; recordedAt: number } | null) => void;
}
```

### Backend boundary

The current client requires the `rewarded-ads-gate` Edge Function and fails
closed when its bounded response is missing, stale, malformed or OFF. A future
authenticated AdMob SSV callback is still required before reward completion can
be called server-authoritative.

---

## 12. Code Plan

### Phase 1: Foundation (DONE locally)
| File | Status |
|---|---|
| `src/lib/adConfig.ts` | Implemented |
| `src/lib/adController.ts` | Implemented |
| `src/contexts/AdContext.tsx` | Implemented |
| `src/components/ads/RewardedAdPrompt.tsx` | Implemented but not production-mounted |
| `src/features/ads/rewardedAttemptLedger.ts` | Implemented |

### Phase 2: Integration (DONE)
| File | Status | Change |
|---|---|---|
| `src/components/settings/PrivacySection.tsx` | ✅ Guarded | Privacy remains consent/disclosure/withdrawal only; no rewarded prompt |
| `src/pages/nav-v2/settings/V2SettingsDataPanels.tsx` | ✅ Guarded | V2 privacy controls remain ad-free |
| `src/i18n/languages/*.ts` | ✅ Modified | 4 keys across 8 supported locales |

### Phase 3: Native App Wiring
| Status | Task | File |
|---|---|---|
| DONE | Install `@capacitor-community/admob` | `package.json` |
| DONE | Mount one fail-closed `<AdProvider>` in the V2 shell | `src/pages/Index.tsx` |
| DONE | Persist owner-bound attempts and settle wallet updates atomically | `src/features/ads/rewardedAttemptLedger.ts` |
| DONE | Feed only the latest timestamped mood as a suppression signal | `src/pages/Index.tsx` |
| DONE | Bind exact server-controlled free/premium metadata behind admitted-owner checks | `src/features/ads/useAdPremiumStatus.ts` |
| OPEN | Add an approved optional rewards entry without scarcity or guilt copy | Product/UI decision |

### Phase 4: Entitlement (DONE locally; production population unverified)
| Task | Boundary |
|---|---|
| Read only `app_metadata.zenflow_ad_entitlement` | Exact `free`/`premium`; user-editable metadata is ignored |
| Require admitted session, validated sync owner and matching local data owner | Owner/account transitions remain `unknown` |
| Map the verified status into `AdProvider` | `src/pages/Index.tsx` |
| Populate or rotate production metadata | `UNVERIFIED`; requires an authenticated server/admin workflow outside this local change |

### Phase 5: Server-Side Verification (OPEN)
| Task | File |
|---|---|
| Supabase Edge Function for SSV | `supabase/functions/verify-ad-reward/` |
| Call server after ad completion | `src/lib/adController.ts` |
| Validate reward server-side | Edge Function |

---

## Assumptions Ledger

| # | Assumption | Default Chosen | Alternatives | Risk |
|---|---|---|---|---|
| A1 | Ad SDK | Pinned `@capacitor-community/admob` 8.0.0 | Different native bridge | Medium — community plugin; exact Android artifact/runtime still requires verification |
| A2 | Reward amount | 20 treats per video | 10, 15, 25, 30 | Medium — tunable via adConfig.ts |
| A3 | Daily cap | 5 per day | 3, 7, 10 | Low — can adjust |
| A4 | Session cap | 3 per session | 2, 5 | Low — can adjust |
| A5 | Cooldown | 3 minutes | 1, 5, 10 min | Low — can adjust |
| A6 | Dismiss cooldown | 10 minutes | 5, 15, 30 min | Low — can adjust |
| A7 | Mood blocking | terrible+bad = blocked | terrible only | Medium — chose mental-health safety over engagement |
| A8 | Mood reduction | none currently | bad = max 1/session | Low — low mood is blocked instead |
| A9 | No interstitials | Correct — only rewarded | Could add 1 interstitial/day on comeback | **Strong opinion**: interstitials damage mental health apps |
| A10 | No banners | Correct — clean UI | Could add small banner in stats | **Strong opinion**: banners cheapen the premium feel |
| A11 | Premium entitlement and pricing | `UNVERIFIED` product decision | Existing or future authoritative entitlement source | High — ads remain disabled while status is unknown |
| A12 | Onboarding grace period | 3 days no ads | 1 day, 7 days | Low — 3 days matches feature unlock schedule |
| A13 | Client event before server SSV | Local testing only; not release approval | Authenticated AdMob SSV callback | High — production readiness remains `STOP` until owner review |

---

## Contradiction & Absurdity Check

| # | Check | Status | Resolution |
|---|---|---|---|
| C1 | "Non-intrusive" but ads exist | ✅ OK | All ads are opt-in buttons. User NEVER sees an ad without tapping "Watch." No pop-ups, no interstitials, no banners. |
| C2 | Mood gating blocks ads when terrible, but user might WANT treats | ✅ OK | Mental health > monetization. A user feeling terrible shouldn't be nudged to watch ads. They can earn treats through activities instead. |
| C3 | 20 treats per ad vs 10 for completing a habit | ✅ OK | Ad reward is intentionally generous to incentivize watching. But habits still give XP + streak + garden growth + companion mood — ads only give treats. |
| C4 | Premium removes ads but ad system uses treats | ✅ OK | Premium users earn treats normally through activities. Treats economy works independently of ads. Ads are just a bonus earner. |
| C5 | `canShowRewardedAd` checks mood but mood can change | ✅ OK | Check happens before playback using current mood and safe-zone context. If mood changes while the button is visible, the next render hides it; direct calls still re-check before SDK playback. |
| C6 | Sacred zones list vs safe zones list — overlap? | ✅ Fixed | `canShowRewardedAd` and `showRewardedAd` reject sacred zones with `sacred_zone`; only `optional_rewards` is accepted as a safe zone. |
| C7 | First-time user sees ad buttons before consent | ✅ Fixed | AdProvider checks `adConsent` — if false, `adsAvailable = false`, no buttons rendered. |
| C8 | PWA users see broken ad buttons | ✅ OK | `Capacitor.isNativePlatform()` check — PWA skips SDK init entirely. All ad UI hidden. |
| C9 | Arabic/Hebrew RTL + ad button layout | ✅ OK | Using flexbox `gap` and Tailwind — naturally RTL-compatible. No absolute positioning in ad prompt. |
| C10 | Focus timer reflection + ad prompt — too much UI? | ✅ Fixed | The reflection dialog no longer renders rewarded ads; the user's reflection choice is protected from monetization pressure. |
| C11 | App reload could reset the reward cooldown | ✅ Fixed locally | Reward time and dismiss time are persisted and rechecked after module/process restart; session cap intentionally remains process-local. |
| C12 | User watches ad → app dies before durable settlement | `UNVERIFIED` recovery | Owner-bound attempts expire after ten minutes and prevent duplicate local reward; without an authenticated SSV callback an earned event cannot be reconstructed honestly. |
