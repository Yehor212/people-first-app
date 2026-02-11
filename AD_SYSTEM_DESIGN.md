# Ad System Design — ZenFlow

> Complete end-to-end user journey for non-intrusive, mood-aware advertising in a mental health app.

---

## 1. Goal

Monetize free-tier users via ads while preserving the app's core mental health UX. Revenue funds development; premium tier removes ads entirely. Ads must **never** interrupt active wellness activities (focus sessions, breathing exercises, mood logging, journaling).

**Success metrics:**
- eCPM > $8 (rewarded video), > $2 (banner)
- Ad-driven churn < 2% monthly
- Rewarded ad opt-in rate > 40%
- Zero ads shown when user mood is "bad" or "terrible"

---

## 2. Actors / Permissions

| Actor | Can | Cannot |
|-------|-----|--------|
| **Free user** | See ads, watch rewarded ads for bonuses, buy premium | N/A |
| **Premium user** | Use app ad-free, access exclusive features | See any ads (hard guarantee) |
| **Guest (no auth)** | See ads, watch rewarded ads | Buy premium (requires auth) |
| **Minor (<16, COPPA)** | See non-personalized ads only | See personalized/targeted ads |
| **GDPR-declined user** | See non-personalized ads only | Be tracked for ad targeting |
| **Admin (future)** | Configure ad frequency, test ad units | N/A |

**Permission check order:** Premium? → Mood gate → Cooldown gate → Consent gate → Show ad.

---

## 3. Entry Points

### 3.1 Safe Zones (ads allowed)

| Entry Point | Ad Format | Trigger | Frequency Cap |
|------------|-----------|---------|---------------|
| **Post-focus session** | Rewarded video (opt-in) | Timer reaches 0, reflection shown | 1 per session, min 5 min gap |
| **Daily rewards claim** | Rewarded video (opt-in) | "Watch to double reward" button | 1 per day |
| **Habit completion celebration** | Small banner (bottom) | After celebration animation | 1 per 10 min |
| **Stats dashboard** | Native banner (inline) | Tab opened | Refresh every 60s, max 5/session |
| **Welcome back modal** | Rewarded video (opt-in) | 3+ day absence detected | 1 per return |
| **Comeback challenge** | Interstitial (skippable after 5s) | Challenge accepted | 1 per day max |
| **Quest completion** | Rewarded video (opt-in) | "Watch to earn bonus treats" | 1 per quest |

### 3.2 Prohibited Zones (NO ads ever)

| Zone | Reason |
|------|--------|
| **Focus timer (active)** | Interruption destroys flow state; core UX |
| **Breathing exercise** | Medical-grade wellness feature; interruption harmful |
| **Mood logging** | Emotional vulnerability moment |
| **Gratitude journaling** | Reflective state; ads feel exploitative |
| **Emotion wheel** | Deep emotional processing |
| **AI coach conversation** | Therapeutic-adjacent interaction |
| **Inner world / companion care** | Nurturing activity; ads break immersion |
| **Onboarding (first 3 days)** | New user trust period |
| **Settings / Privacy** | User adjusting preferences |
| **Auth / Login screens** | Technical flow; no engagement |
| **Error states** | User frustrated; ads would compound |

---

## 4. State Machine

```
                    ┌──────────────────────────────────────────────────┐
                    │                                                  │
                    v                                                  │
              ┌──────────┐     initSDK()      ┌──────────────┐        │
     ───────> │  IDLE    │ ─────────────────> │ INITIALIZING │        │
              └──────────┘                    └──────┬───────┘        │
                    ^                                │                │
                    │                          success│ / failure     │
                    │                                │                │
                    │         ┌───────────────┐      v                │
                    │         │               │ ┌─────────┐           │
                    │         │  COOLDOWN     │ │  READY  │           │
                    │         │  (per-format  │ │         │           │
                    │         │   timer)      │ └────┬────┘           │
                    │         └──────┬────────┘      │                │
                    │                │          requestAd()           │
                    │           timer│expired         │                │
                    │                │                v                │
                    │                │         ┌──────────┐           │
                    │                └───────> │ LOADING  │           │
                    │                          └────┬─────┘           │
                    │                               │                │
                    │                     loaded / failed             │
                    │                               │                │
                    │                               v                │
                    │                         ┌──────────┐           │
                    │                         │  SHOWN   │           │
                    │                         └────┬─────┘           │
                    │                              │                  │
                    │                    dismissed / rewarded          │
                    │                              │                  │
                    │                              v                  │
                    │                        ┌──────────┐            │
                    └─────────────────────── │ COOLDOWN │ ───────────┘
                                             └──────────┘
```

### States

| State | Description | Duration |
|-------|-------------|----------|
| `IDLE` | SDK not initialized (app start, premium user, offline) | Until `initSDK()` |
| `INITIALIZING` | AdMob SDK loading + consent check | 1-5s typically |
| `READY` | SDK loaded, consent granted, ready to serve ads | Indefinite |
| `LOADING` | Ad request sent to AdMob, waiting for fill | Max 10s timeout |
| `SHOWN` | Ad visible to user | Until user dismisses |
| `COOLDOWN` | Per-format timer preventing next ad | See cooldown table |
| `ERROR` | SDK init failed, no fill, network error | Until retry or app restart |

### Transitions

| From | To | Trigger | Side effect |
|------|-----|---------|-------------|
| IDLE → INITIALIZING | `initSDK()` after auth + consent | Load AdMob SDK |
| INITIALIZING → READY | SDK initialized | Preload first ad |
| INITIALIZING → ERROR | SDK init failed | Log to Sentry, schedule retry |
| READY → LOADING | `requestAd(format)` | Send ad request |
| LOADING → SHOWN | Ad loaded | Display ad, pause app audio |
| LOADING → ERROR | No fill / timeout / network | Silently fail, continue UX |
| SHOWN → COOLDOWN | User dismisses / ad completes | Grant reward (if rewarded), resume audio |
| COOLDOWN → READY | Timer expires | Allow next ad request |
| ERROR → READY | Retry succeeds | Resume normal flow |
| ANY → IDLE | User upgrades to premium | Clear all ad state |

### Cooldown Table

| Format | Cooldown | Mood multiplier (bad) | Mood multiplier (terrible) |
|--------|----------|----------------------|---------------------------|
| **Rewarded video** | 2 min | 3x (6 min) | NO ADS |
| **Interstitial** | 5 min | 3x (15 min) | NO ADS |
| **Banner** | 60s refresh | 2x (120s) | NO ADS |
| **Native (inline)** | 60s refresh | 2x (120s) | NO ADS |

**Global cap:** Max 8 ad impressions per hour across all formats. Max 20 per day.

---

## 5. Verification / Authorization

### Premium check (every ad request)
```
1. Read isPremium from AdContext (cached from Supabase user_metadata)
2. If premium → BLOCK ad, return immediately
3. If not premium → continue to mood gate
```

### Mood gate
```
1. Read latest mood from IndexedDB (today's most recent MoodEntry)
2. If mood === 'terrible' → BLOCK all ads
3. If mood === 'bad' → BLOCK interstitials, apply 3x cooldown to others
4. If mood === 'okay' → apply 1.5x cooldown
5. If mood === 'great' | 'good' | null → normal frequency
```

### Consent gate
```
1. Read PrivacySettings.adConsent from localStorage
2. If adConsent === undefined → show AdConsentDialog first
3. If adConsent === false → serve non-personalized ads only (npa=1)
4. If adConsent === true → serve personalized ads
5. Respect noTracking === true → force non-personalized
```

### Zone check
```
1. Read currentZone from AdContext (set by active screen)
2. If zone is in PROHIBITED_ZONES → BLOCK ad
3. If zone is in SAFE_ZONES → continue
```

---

## 6. Error States

| Error | User sees | System does | Recovery |
|-------|-----------|-------------|----------|
| **SDK init failure** | Nothing (silent) | Log to Sentry, retry in 30s (max 3) | Auto-retry with backoff |
| **No ad fill** | Nothing (silent) | Log event, try next format | Wait for next trigger |
| **Network offline** | Nothing (silent) | Skip all ad requests | Resume when online event fires |
| **Ad load timeout (>10s)** | Nothing (silent) | Cancel request, log | Try again at next trigger |
| **Ad render crash** | Nothing (dismiss ad frame) | Sentry.captureException, hide ad container | Reset ad state to READY |
| **Consent revoked mid-session** | Ads disappear immediately | Clear loaded ads, set npa=1 for future | Respect new preference |
| **Premium purchase mid-session** | All ads disappear instantly | Clear ad state, transition to IDLE | Permanent until subscription lapses |
| **Rewarded video incomplete** | "Video interrupted — no reward" toast | Don't grant reward | User can retry |
| **User force-kills ad** | Nothing | Treat as dismiss, start cooldown | Normal flow |

**Rule: Ads NEVER block app usage. Every ad failure is silent to the user.**

---

## 7. Edge Cases

| Edge case | Handling |
|-----------|---------|
| **Focus timer active + ad trigger fires** | Zone check blocks it. Ad request is silently dropped, not queued. |
| **User logs "terrible" mood WHILE ad is loading** | Cancel loading ad. `adController.cancel()` called from mood change listener. |
| **Offline → comes back online** | Don't immediately show ad. Wait for next natural trigger point. |
| **Low battery (<15%)** | Disable rewarded video (GPU-intensive). Banners still OK. |
| **First-time user (day 1-3)** | `onboardingDay < 3` → no ads. Grace period for trust building. |
| **Tab switch during rewarded video** | Pause video. Resume when tab visible. If >30s hidden, cancel + no reward. |
| **App backgrounded during ad** | AdMob SDK handles pause/resume natively on Capacitor. |
| **Multiple rapid triggers** | Cooldown gate prevents. Second trigger within cooldown is silently dropped. |
| **User watches rewarded ad but XP write fails** | Retry XP write 3x with backoff. If all fail, store in offline queue. Show toast "Reward saved, will sync later." |
| **Clock manipulation (user sets clock forward)** | Cooldowns use `performance.now()` delta, not `Date.now()`. Immune to clock changes. |
| **RTL languages (Arabic, Hebrew)** | Banner positioning respects `dir="rtl"`. Native ads use `start`/`end` instead of `left`/`right`. |
| **Screen reader active** | Announce "Advertisement" before ad. Provide "Skip ad" button with aria-label. |
| **Rapid premium toggle (buy→refund→buy)** | Poll Supabase subscription status every 5 min. Cache locally. Stale data = show no ads (favor user). |

---

## 8. Copy (Exact Labels / Messages)

### English

| Key | Text |
|-----|------|
| `adRewardedTitle` | `Watch a short video?` |
| `adRewardedBody` | `Earn {amount} bonus treats for your companion!` |
| `adRewardedCta` | `Watch video` |
| `adRewardedSkip` | `No thanks` |
| `adRewardedComplete` | `You earned {amount} treats!` |
| `adRewardedFailed` | `Video interrupted — no reward this time.` |
| `adDailyDoubleTitle` | `Double your reward?` |
| `adDailyDoubleBody` | `Watch a short video to claim {amount} instead of {base}.` |
| `adDailyDoubleCta` | `Double it!` |
| `adDailyDoubleSkip` | `Claim {base}` |
| `adConsentTitle` | `Personalized ads` |
| `adConsentBody` | `Allow personalized ads to support ZenFlow development? We never share your mood or health data.` |
| `adConsentAllow` | `Allow personalized` |
| `adConsentDeny` | `Keep generic` |
| `adConsentFooter` | `You can change this anytime in Settings > Privacy` |
| `adFreeLabel` | `Remove ads` |
| `adFreeBody` | `Upgrade to Premium for an ad-free experience and exclusive features.` |
| `adFreeCta` | `Go Premium` |
| `adBannerLabel` | `Advertisement` |
| `adLoadingText` | `Loading...` |
| `adOfflineSkipped` | `Ads disabled while offline.` |
| `adSettingsTitle` | `Advertising` |
| `adSettingsPersonalized` | `Personalized ads` |
| `adSettingsPersonalizedDesc` | `Show ads relevant to your interests. No mood or health data is ever shared.` |
| `adSettingsFrequency` | `Ad frequency` |
| `adSettingsFrequencyNormal` | `Normal` |
| `adSettingsFrequencyReduced` | `Reduced` |
| `adSettingsRemoveAds` | `Remove all ads` |

### Russian (ru)

| Key | Text |
|-----|------|
| `adRewardedTitle` | `Посмотреть короткое видео?` |
| `adRewardedBody` | `Получите {amount} бонусных угощений для компаньона!` |
| `adRewardedCta` | `Смотреть видео` |
| `adRewardedSkip` | `Нет, спасибо` |
| `adRewardedComplete` | `Вы получили {amount} угощений!` |
| `adRewardedFailed` | `Видео прервано — награда не начислена.` |
| `adConsentTitle` | `Персонализированная реклама` |
| `adConsentBody` | `Разрешить персонализированную рекламу для поддержки разработки ZenFlow? Мы никогда не передаём данные о настроении или здоровье.` |
| `adConsentAllow` | `Разрешить` |
| `adConsentDeny` | `Оставить общую` |
| `adFreeLabel` | `Убрать рекламу` |
| `adFreeCta` | `Перейти на Премиум` |
| `adBannerLabel` | `Реклама` |

> Other 7 languages (uk, es, de, fr, ja, ar, he) follow the same pattern. Keys added to `src/i18n/translations.ts`.

---

## 9. Abuse / Security / Privacy

### Security

| Threat | Mitigation |
|--------|-----------|
| **Fake reward claims** | Reward only granted after AdMob server-side verification callback (SSV). Client never self-grants. |
| **Ad click fraud** | AdMob handles fraud detection. App logs click events to Sentry for anomaly detection. |
| **SDK tampering** | Use official `@capacitor-community/admob` package. Verify integrity via npm audit. |
| **Ad injection (MitM)** | All ad traffic over HTTPS. CSP header blocks inline scripts from ad frames. |
| **Client clock manipulation** | Cooldowns use monotonic `performance.now()`, not `Date.now()`. |
| **Premium status spoofing** | Premium flag validated server-side via Supabase RLS. Client cache is convenience only. |

### Privacy

| Principle | Implementation |
|-----------|---------------|
| **No health data to ad networks** | Mood, emotions, journal entries, breathing data — NEVER sent to AdMob. Only device ID + generic interests. |
| **GDPR Article 7** | Explicit opt-in for personalized ads via `AdConsentDialog`. Default = non-personalized. |
| **CCPA / CPRA** | "Do Not Sell My Data" honored via AdMob `tagForUnderAgeOfConsent` and `npa` parameter. |
| **COPPA (children)** | If user age < 16 (future feature), force `tagForChildDirectedTreatment=true`. |
| **Right to erasure** | Deleting account clears all ad preferences from IndexedDB + Supabase. |
| **Transparency** | Settings > Privacy clearly shows what data ads use and lets user revoke at any time. |
| **DNT header** | If `PrivacySettings.noTracking === true`, force non-personalized ads. |

### Abuse prevention

| Abuse vector | Prevention |
|-------------|-----------|
| **Reward farming (watch ads infinitely)** | Daily cap: max 5 rewarded videos. Global hourly cap: 8 total impressions. |
| **Ad blocker detection** | Don't detect or punish. App works fine without ads. Revenue loss accepted. |
| **Rate limiting ad requests** | Max 1 ad request per 10 seconds. Backed by `rateLimiter.ts` pattern. |

---

## 10. UI Screens / Components

### 10.1 `AdConsentDialog`

```
┌─────────────────────────────────────┐
│  🛡️  Personalized ads               │
│                                      │
│  Allow personalized ads to support   │
│  ZenFlow development? We never       │
│  share your mood or health data.     │
│                                      │
│  ┌─────────────┐ ┌───────────────┐  │
│  │ Keep generic │ │   Allow ✓    │  │
│  └─────────────┘ └───────────────┘  │
│                                      │
│  You can change this in Settings     │
└─────────────────────────────────────┘
```

- **Where:** Shown once after ConsentBanner (analytics), before first ad load.
- **Pattern:** Same modal pattern as `ConsentBanner.tsx` (`fixed inset-0`, `bg-black/50`, `animate-scale-in`).
- **Storage:** `PrivacySettings.adConsent: boolean` in localStorage.

### 10.2 `RewardedAdPrompt`

```
┌─────────────────────────────────────┐
│              ✨                       │
│  Watch a short video?                │
│                                      │
│  Earn 20 bonus treats for your       │
│  companion!                          │
│                                      │
│  ┌─────────────┐ ┌───────────────┐  │
│  │  No thanks  │ │ Watch video ▶ │  │
│  └─────────────┘ └───────────────┘  │
└─────────────────────────────────────┘
```

- **Where:** Post-focus session (after reflection), daily rewards, quest completion.
- **Behavior:** Opt-in only. "No thanks" dismisses with zero friction.
- **Animation:** `animate-scale-in`, same as DailyRewards confetti overlay.

### 10.3 `AdBanner` (inline component)

```
┌─────────────────────────────────────┐
│  [Advertisement]     320×50 AdMob   │
└─────────────────────────────────────┘
```

- **Where:** Stats dashboard (between charts), celebration screens.
- **Rendered via:** `createPortal(document.body)` to avoid PullToRefresh `transform` trap (same pattern as HyperfocusMode).
- **Size:** Adaptive banner (320×50 min, scales to screen width).
- **Label:** Small "Advertisement" text above, using `adBannerLabel` translation.
- **Dismiss:** No close button. Disappears naturally when user navigates away.

### 10.4 `AdSettingsSection`

```
┌─────────────────────────────────────┐
│  📢 Advertising                      │
│  ──────────────────────────────────  │
│  Personalized ads        [  toggle ] │
│  Show ads relevant to your interests │
│  ──────────────────────────────────  │
│  Ad frequency                        │
│  ○ Normal   ● Reduced               │
│  ──────────────────────────────────  │
│  ┌─────────────────────────────────┐│
│  │  ⭐ Remove all ads              ││
│  │  Go Premium — $4.99/month       ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

- **Where:** Settings tab, after Privacy section.
- **Hidden if:** User is premium (`isPremium === true`).
- **"Reduced" mode:** Doubles all cooldowns (2x multiplier applied globally).

### 10.5 `PremiumUpgradeBanner`

```
┌─────────────────────────────────────┐
│  ⭐  Remove ads & unlock premium    │
│      $4.99/month         [Upgrade]  │
└─────────────────────────────────────┘
```

- **Where:** Bottom of Stats page, bottom of Settings.
- **Hidden if:** User is premium.
- **Style:** Subtle gradient border, `bg-primary/5`.

---

## 11. API Contract

### 11.1 AdMob Configuration

```typescript
// Environment variables
VITE_ADMOB_APP_ID_ANDROID=ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY
VITE_ADMOB_BANNER_ID_ANDROID=ca-app-pub-XXXXXXXXXXXXXXXX/AAAAAAAAAA
VITE_ADMOB_INTERSTITIAL_ID_ANDROID=ca-app-pub-XXXXXXXXXXXXXXXX/BBBBBBBBBB
VITE_ADMOB_REWARDED_ID_ANDROID=ca-app-pub-XXXXXXXXXXXXXXXX/CCCCCCCCCC

// Test IDs (development)
VITE_ADMOB_BANNER_ID_ANDROID=ca-app-pub-3940256099942544/6300978111
VITE_ADMOB_INTERSTITIAL_ID_ANDROID=ca-app-pub-3940256099942544/1033173712
VITE_ADMOB_REWARDED_ID_ANDROID=ca-app-pub-3940256099942544/5224354917
```

### 11.2 AdMob Plugin Interface

```typescript
// src/lib/adTypes.ts

export type AdFormat = 'banner' | 'interstitial' | 'rewarded';

export type AdZone =
  | 'post_focus'
  | 'daily_rewards'
  | 'habit_celebration'
  | 'stats_dashboard'
  | 'welcome_back'
  | 'comeback_challenge'
  | 'quest_completion';

export interface AdConfig {
  format: AdFormat;
  zone: AdZone;
  rewardAmount?: number;       // Treats to grant (rewarded only)
  rewardType?: 'treats' | 'xp'; // Currency type
}

export interface AdReward {
  type: string;
  amount: number;
}

export interface AdEvent {
  type: 'loaded' | 'shown' | 'dismissed' | 'rewarded' | 'failed' | 'clicked';
  format: AdFormat;
  zone: AdZone;
  reward?: AdReward;
  error?: string;
  timestamp: number;
}
```

### 11.3 IndexedDB Schema Addition

```typescript
// Addition to src/storage/db.ts

export interface AdPreferences {
  id: string;                    // Always 'singleton'
  adConsent: boolean | null;     // null = not asked yet
  reducedFrequency: boolean;     // User chose "Reduced" in settings
  lastAdTimestamps: Record<AdFormat, number>; // For cooldown tracking
  dailyImpressions: number;      // Reset at midnight
  dailyRewarded: number;         // Reset at midnight, max 5
  hourlyImpressions: number;     // Rolling window
  lastResetDate: string;         // ISO date for daily reset
}
```

### 11.4 Supabase Schema (Premium)

```sql
-- Addition to existing user metadata (no new table needed)
-- Stored in auth.users.raw_user_meta_data

{
  "subscription_tier": "free" | "premium",
  "subscription_expires": "2025-12-31T00:00:00Z",
  "subscription_platform": "android" | "web",
  "ad_preferences": {
    "consent": true,
    "reduced_frequency": false
  }
}
```

### 11.5 Server-Side Verification (Rewarded Ads)

```typescript
// Supabase Edge Function: verify-ad-reward
// Called by AdMob SSV callback

interface AdMobSSVPayload {
  ad_network: string;
  ad_unit: string;
  custom_data: string;   // JSON: { userId, zone, rewardAmount }
  reward_amount: number;
  reward_item: string;
  signature: string;
  timestamp: string;
  transaction_id: string;
  user_id: string;        // AdMob user ID
  key_id: string;
}

// Response: 200 OK → AdMob marks reward as verified
// Then: Edge function writes reward to user's treats/XP in Supabase
```

---

## 12. Code Plan

### New Files (8)

| File | Purpose | Lines (est.) |
|------|---------|-------------|
| `src/contexts/AdContext.tsx` | React context: ad state machine, premium check, mood gate, zone tracking | ~250 |
| `src/lib/adTypes.ts` | TypeScript types for ad system (AdFormat, AdZone, AdConfig, etc.) | ~60 |
| `src/lib/adController.ts` | AdMob SDK wrapper: init, load, show, cooldown logic, SSV | ~300 |
| `src/lib/adCooldowns.ts` | Cooldown timer logic using `performance.now()`, mood multipliers | ~80 |
| `src/components/AdConsentDialog.tsx` | GDPR ad consent modal | ~80 |
| `src/components/RewardedAdPrompt.tsx` | Opt-in prompt for rewarded videos | ~90 |
| `src/components/AdBanner.tsx` | Inline banner ad with portal rendering | ~70 |
| `src/components/settings/AdSettingsSection.tsx` | Ad preferences in Settings | ~100 |

### Modified Files (7)

| File | Change | Lines changed (est.) |
|------|--------|---------------------|
| `src/types/index.ts` | Add `adConsent` to `PrivacySettings` | +2 |
| `src/storage/db.ts` | Add `adPreferences` table to Dexie schema | +10 |
| `src/pages/Index.tsx` | Wrap with `AdProvider`, add zone tracking | +8 |
| `src/components/FocusTimer.tsx` | Show `RewardedAdPrompt` after session | +15 |
| `src/components/DailyRewards.tsx` | Add "Double reward" CTA with rewarded ad | +20 |
| `src/components/StatsPage.tsx` | Insert `AdBanner` between chart sections | +5 |
| `src/components/settings/PrivacySection.tsx` | Add `AdSettingsSection` below privacy toggles | +3 |
| `src/i18n/translations.ts` | Add ad-related translation keys (9 languages) | +180 |

### Implementation Phases

**Phase 1 — Foundation (no visible ads yet)**
1. Create `adTypes.ts` — all TypeScript types
2. Create `adCooldowns.ts` — cooldown timer logic
3. Create `adController.ts` — AdMob SDK wrapper with mock mode for dev
4. Create `AdContext.tsx` — state machine + mood gate + zone gate
5. Add `adConsent` to `PrivacySettings`
6. Add `adPreferences` to Dexie schema

**Phase 2 — Consent + Settings**
7. Create `AdConsentDialog.tsx`
8. Create `AdSettingsSection.tsx`
9. Wire consent flow into existing `ConsentBanner` sequence
10. Add to `PrivacySection.tsx`

**Phase 3 — Rewarded Ads**
11. Create `RewardedAdPrompt.tsx`
12. Integrate into `FocusTimer.tsx` (post-session)
13. Integrate into `DailyRewards.tsx` (double reward)
14. Wire up treat/XP granting with offline queue fallback

**Phase 4 — Banner Ads**
15. Create `AdBanner.tsx` with portal
16. Insert into `StatsPage.tsx`
17. Test with all 3 themes (light, dark, OLED)

**Phase 5 — Install AdMob + Native Integration**
18. `npm install @capacitor-community/admob`
19. Configure `capacitor.config.ts`
20. Add AdMob app ID to `AndroidManifest.xml`
21. `npx cap sync android`
22. Replace mock mode with real SDK calls

**Phase 6 — Server-Side Verification**
23. Create Supabase Edge Function `verify-ad-reward`
24. Configure AdMob SSV callback URL
25. Add premium subscription check to edge function

---

## Assumptions Ledger

| # | Assumption | Options | Chosen Default | Rationale |
|---|-----------|---------|---------------|-----------|
| A1 | Ad provider | AdMob, Unity Ads, AppLovin, Meta Audience Network | **AdMob** (`@capacitor-community/admob`) | Largest fill rates, best Capacitor plugin support, SSV built-in |
| A2 | Premium pricing | $2.99/mo, $4.99/mo, $29.99/yr, one-time $19.99 | **$4.99/month** (defer to user) | Mental health apps have higher willingness-to-pay. Annual option TBD. |
| A3 | Onboarding grace period | 1 day, 3 days, 7 days | **3 days** | Balances trust building with revenue. Matches existing feature unlock pace. |
| A4 | Mood data sharing with ads | Share anonymized, share nothing, share mood category | **Share nothing** | Core privacy principle. Mood data is health data under GDPR. |
| A5 | Rewarded ad daily cap | 3, 5, 10, unlimited | **5 per day** | Prevents reward farming, keeps value of treats meaningful. |
| A6 | Banner position | Top, bottom, inline | **Inline** (inside scroll content) | Bottom banners conflict with tab nav. Top banners conflict with status bar. Inline is least intrusive. |
| A7 | Interstitial frequency | After every session, 1/day, 2/day, never | **1 per day max** (comeback only) | Interstitials are the most disruptive format. Minimize usage. |
| A8 | Web (PWA) ads | AdSense, no ads on web, AdMob web adapter | **No ads on PWA** (Android only) | AdMob is mobile-native. PWA users get ad-free experience (drives app install). |
| A9 | Premium feature set | No ads only, no ads + AI coach + themes, no ads + all features | **No ads + exclusive themes + AI coach unlimited** (defer to user) | "No ads" alone isn't compelling enough for $4.99/mo. Bundle with premium content. |
| A10 | Payment processor | Google Play Billing, Stripe, RevenueCat | **RevenueCat** wrapping Google Play Billing | Handles receipt validation, subscription management, analytics. Best DX. |

---

## Contradiction & Absurdity Check

| # | Check | Finding | Resolution |
|---|-------|---------|-----------|
| C1 | "No ads during focus timer" vs "Post-focus rewarded ad" | Not contradictory. Post-focus = timer has ended, user sees reflection screen. Timer is no longer active. Verified: zone changes from `focus_active` to `post_focus` on completion. | OK |
| C2 | "Mood-based blocking" vs "User already saw ad before mood logged" | User could see ad, then log terrible mood. This is fine — we gate on latest known mood, not predicted mood. If no mood today, default to normal frequency. | OK |
| C3 | "Silent ad failures" vs "User taps 'Watch video' and nothing happens" | Contradiction found. If user explicitly taps "Watch video" and ad fails to load, silence is bad UX. | **Fix:** Show toast `"Video not available right now. Try again later."` for user-initiated rewarded ads only. Keep other formats silent. |
| C4 | "Max 5 rewarded/day" vs "Daily rewards + post-focus + quests all offering rewarded" | User could exhaust cap early and see "Watch video" buttons that don't work. | **Fix:** Hide "Watch video" CTA when `dailyRewarded >= 5`. Button replaced with "Daily limit reached" disabled state. |
| C5 | "COOLDOWN uses performance.now()" vs "App killed and restarted" | `performance.now()` resets on app restart. Cooldowns lost. User could kill+restart to bypass. | **Fix:** Store last impression timestamps in IndexedDB (`AdPreferences.lastAdTimestamps`). On startup, restore cooldowns from stored timestamps using `Date.now()` delta. `performance.now()` only for in-session precision. |
| C6 | "Premium check from Supabase" vs "Offline user" | User buys premium while offline. Local cache says free. Ads still show. | **Fix:** Cache premium status in IndexedDB with 30-day TTL. Offline = trust cache. If cache expired + offline, err toward no ads (favor user). |
| C7 | "3-day onboarding grace" vs "Re-engagement welcome back" | Returning user who was absent 30 days — are they in "onboarding grace" again? No. Onboarding = `first install date + 3 days`. Not related to absence. | OK |
| C8 | "Inline banner on Stats page" vs "Stats page has 3 inner tabs" | Banner renders on all 3 sub-tabs (overview, trends, calendar). That's fine — single component, single DOM node. Tab switch doesn't remount. | OK |
| C9 | "No ads on PWA" vs "Same codebase" | Need to check `Capacitor.isNativePlatform()` before initializing AdMob. PWA users see zero ad components. | **Fix:** `AdContext` checks platform before init. All ad components render `null` on web. |
| C10 | "RTL support" vs "Banner positioning" | AdMob handles RTL internally for ad content. Our wrapper just needs to not override `direction`. Inline container inherits page direction. | OK |
| C11 | `adConsent` added to `PrivacySettings` vs existing `ConsentBanner` flow | `ConsentBanner` only asks about analytics. Adding `adConsent` to same banner would change existing flow. | **Fix:** Keep as separate dialog. Show `AdConsentDialog` after `ConsentBanner` is dismissed (if on native platform). Two-step consent: analytics first, then ads. |
| C12 | "Rewarded ad grants treats" vs "Treats stored in IndexedDB" vs "Offline queue" | If reward verified server-side (SSV) but client is offline, treat write could fail. | **Fix:** SSV writes to Supabase. Client also writes locally immediately (optimistic). Next cloud sync reconciles. If conflict, take higher value (max merge). |

---

## Summary

This design covers the complete user journey from first ad consent through daily interaction, with mood-aware frequency gating, server-side reward verification, and a clear premium upgrade path. All 12 contradiction/absurdity checks pass after fixes.

**Implementation order:** Phase 1 (foundation) → Phase 2 (consent) → Phase 3 (rewarded, highest revenue) → Phase 4 (banners) → Phase 5 (native SDK) → Phase 6 (SSV).

**Estimated new code:** ~1,030 lines across 8 new files + ~233 lines modified in 8 existing files.
