# Epic 2: Engagement & Gamification

**Status:** Backlog
**Created:** 2026-04-14
**Source:** [Diary Deep Redesign Research](../../reference/research/2026-04-14-diary-deep-redesign.md)

---

## Goal

Build the habit loop that drives daily return through streak psychology, achievement rewards, curated challenges, and smart reminders. Duolingo's proven model shows streaks increase daily retention by 2-3x. Loss aversion (not wanting to break streak) is the strongest behavioral driver in apps.

## Scope In

- **Streak System** (Tier 1 — Critical): Current streak counter, longest streak, freeze mechanic (1 free/week, max 3), 48h recovery window, milestone celebrations at 3/7/14/21/30/60/90/100/180/365/500/1000 days
- **Streak Visual**: Flame icon 🔥 with spring physics growth, progress bar to next milestone, freeze indicator ❄️
- **Streak Celebration**: Full-screen overlay (1.5s) with badge reveal (explosive spring), confetti particles (BurnThought-style), haptic success notification
- **Achievement Badges** (Tier 2 — 30-50 badges): Categories — Consistency (streak milestones), Depth (word count), Features (photos, audio, themes), Emotional Growth (mood trends), Social (future)
- **Badge Unlock Rewards**: New themes, special stickers, orb evolution stages
- **Challenges & Quests** (Tier 2): Time-limited curated programs — "21-Day Gratitude Sprint", "Shadow Work Week", "Dream Diary 7-Day", "Mindfulness Month". Completion = exclusive badge + theme unlock
- **Smart Reminders** (Tier 1 — Critical): Learn user's natural journaling time, nudge 15 min before habitual time, rotate content (quote/prompt/streak/On This Day preview), respect DND + max 1/day, streak-aware urgency near midnight

## Scope Out

- Quick check-in as streak-qualifying entry (Epic 1 provides the entry, this Epic counts it)
- AI-generated challenge prompts (Epic 4)
- On This Day preview in notifications (Epic 3 provides data)
- Orb evolution visual stages (separate orb/shader scope)

## Success Criteria

- Daily active user retention +30% after streak system launch (measured via analytics)
- Streak freeze usage rate < 20% (users actually journaling, not gaming freezes)
- Badge unlock rate: 50%+ users earn at least 5 badges in first 30 days
- Challenge completion rate > 40% for started challenges
- Smart reminder opt-in rate > 60%, with < 5% uninstall correlation
- Notification delivery at learned time ±5 minutes accuracy

## Dependencies

- **Epic 1**: Entry type system (quick check-ins count toward streaks)
- Dexie schema migration (new `journalStreak`, `journalBadges`, `journalChallenges` tables)
- Capacitor Local Notifications plugin for smart reminders
- BurnThought particle system (reuse for celebration confetti)

## Risks & Mitigations

| Risk                             | Impact | Mitigation                                                                       |
| -------------------------------- | ------ | -------------------------------------------------------------------------------- |
| Streak pressure causes anxiety   | High   | Freeze mechanic + recovery window + gentle messaging ("It's okay to miss a day") |
| Too many badges feel meaningless | Medium | Curate 30-50 meaningful badges, not 200 trivial ones. Progressive difficulty     |
| Notification fatigue             | Medium | Max 1/day, respect DND, easy opt-out, content rotation                           |
| Challenge content gets stale     | Low    | Seasonal rotation, community suggestions (future)                                |
| Streak timezone edge cases       | Medium | Use local midnight consistently, test across DST transitions                     |

## Architecture Impact

- **New Components**: `StreakDisplay.tsx`, `StreakCelebration.tsx`, `JournalBadges.tsx`, `BadgeUnlockModal.tsx`, `JournalChallenges.tsx`, `ChallengeDetailSheet.tsx`
- **New Hooks**: `useJournalStreak.ts`, `useBadges.ts`, `useChallenges.ts`, `useJournalReminders.ts`
- **New Data**: `badgeDefinitions.ts`, `challengeDefinitions.ts`
- **New Storage**: `journalStreak` (singleton), `journalBadges`, `journalChallenges` tables in Dexie
- **Modified**: `JournalModule.tsx` (streak display, badge triggers), `db.ts` (migration)

## Phases

1. Streak data model + `useJournalStreak` hook (increment/freeze/recovery logic)
2. StreakDisplay component on diary home + profile
3. Celebration animation (reuse BurnThought particle system)
4. Badge definitions (30-50) + unlock detection logic
5. Badge gallery UI + unlock modal
6. Challenge definitions (4-6 initial) + progress tracking
7. Challenge UI (list, detail, daily prompt)
8. Smart reminders (Capacitor notifications + time learning)
9. i18n for all 8 languages
