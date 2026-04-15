# Epic 4: AI Intelligence, Insights & Emotional Mirror

**Status:** Backlog
**Created:** 2026-04-14
**Source:** [Diary Deep Redesign Research](../../reference/research/2026-04-14-diary-deep-redesign.md)

---

## Goal

Transform raw journal entries into actionable self-knowledge through AI-powered analysis, voice transcription, clinical tools, and conversational Q&A. Most-requested AI feature across all journal apps. Makes users feel their journaling effort is "paying off." Rosebud ($6M funding) and Reflectly prove market demand.

## Scope In

- **Weekly AI Emotional Report** (Tier 1 — Critical): Every Sunday, AI generates a beautiful summary card. Content: avg mood, entry count, word count, top emotions, mood triggers, recurring themes, AI suggestion. In-app card on diary home + optional push notification. Stored in `weeklyInsights` Dexie table
- **Voice-to-Text Enhancement** (Tier 2): After audio recording, show AI transcript + extracted mood + key themes. Edit transcript. Option to use as entry text. Tech: Web Speech API / Capacitor speech-to-text + AI post-processing
- **CBT Thought Record** (Tier 2): Structured 5-column worksheet: Situation → Automatic Thought → Emotion (rate 0-100%) → Evidence For/Against → Balanced Thought → Re-rate Emotion. Step-by-step guided flow, one column at a time. Research: 25-50% anxiety reduction in 4 weeks
- **Habit-Mood Correlation** (Tier 2): Analytics chart showing which habits/activities correlate with better mood. Active toggle grid in quick check-in. Bar chart: activity → avg mood. Stored in `habitMoodCorrelations` cache table
- **"Ask Your Journal" Q&A** (Tier 3): Upgrade AI search to natural language: "Summarize my March", "What patterns do you see in my anxiety?", "How has my mood changed since I started meditating?"
- **Conversational AI Journaling** (Tier 3): AI asks question → user responds → AI asks contextual follow-up → creates formatted entry. Lowest friction for new journalers
- **AI Mentor Personas** (Tier 3): 5-10 "Wisdom Guides" — Stoic Philosopher, CBT Therapist, Mindfulness Teacher, Gratitude Coach, Creative Muse. AI responds in character
- **Cognitive Bias Detection** (Tier 3): Opt-in "Thought Check" after emotional entries. AI identifies catastrophizing, black-and-white thinking, mind-reading, fortune-telling. Suggests evidence-based reframes
- **Emotion Granularity Training** (Tier 3): Guide from broad to specific emotions ("Negative → Sad → Lonely → Isolated vs Abandoned"). Research: higher granularity = better emotional regulation

## Scope Out

- AI model training/fine-tuning (use existing LLM APIs)
- Therapist export PDF formatting (deferred)
- Real-time sentiment analysis during typing (too intrusive)
- Storing AI conversations in sync pipeline (local-only initially)

## Success Criteria

- Weekly report generation < 5 seconds (background processing)
- Weekly report engagement: 50%+ of users read report, 20%+ tap "See Full Report"
- Voice transcription accuracy > 90% for English, > 80% for other languages
- CBT thought record completion rate > 60% for started records
- Habit-mood correlation requires 14+ days of data before showing (statistical significance)
- "Ask Your Journal" returns relevant results for 80%+ of natural language queries
- All AI features work offline with graceful degradation (show cached/local results)

## Dependencies

- **Epic 1**: Entry types + activities data (provides structured data for correlation)
- **Epic 2**: Streak/challenge data for Year in Review
- AI/LLM API integration (Supabase Edge Function or direct API)
- Existing `journalAI.ts` semantic search infrastructure
- Dexie tables: `weeklyInsights`, `habitMoodCorrelations`
- Web Speech API / Capacitor speech-to-text plugin

## Risks & Mitigations

| Risk                                           | Impact   | Mitigation                                                           |
| ---------------------------------------------- | -------- | -------------------------------------------------------------------- |
| AI hallucination in emotional context          | Critical | Disclaimer on all AI insights, never claim clinical authority        |
| API costs for weekly reports at scale          | High     | Cache aggressively, batch processing, edge function with rate limits |
| Voice transcription quality varies by language | Medium   | Web Speech API for supported languages, fallback to manual edit      |
| CBT misuse without professional guidance       | Medium   | Clear disclaimer, link to professional resources, not a replacement  |
| Privacy: sending journal content to AI API     | High     | PII filtering before API calls, option for fully offline mode        |
| Correlation ≠ causation in habit-mood          | Medium   | Clear "correlation" language, never say "causes"                     |

## Architecture Impact

- **New Components**: `WeeklyInsight.tsx`, `WeeklyInsightFull.tsx`, `ThoughtRecordEditor.tsx`, `HabitCorrelationChart.tsx`, `AskJournalChat.tsx`, `MentorChat.tsx`, `BiasDetectionCard.tsx`, `EmotionPicker.tsx`
- **New Hooks**: `useWeeklyInsight.ts`, `useVoiceTranscription.ts`, `useHabitCorrelation.ts`
- **New Services**: `generateInsight.ts` (AI report generation), `transcriptionService.ts`
- **New Storage**: `weeklyInsights`, `habitMoodCorrelations` tables in Dexie
- **Modified**: `JournalStats.tsx` (correlation chart, insight history), `JournalEntryEditor.tsx` (voice-to-text flow), `journalAI.ts` (Q&A upgrade)
- **Edge Function**: Weekly report generation (Supabase)

## Phases

1. Weekly AI report: data aggregation + edge function + in-app card (MVP)
2. Weekly report: full report view + push notification
3. Voice-to-text: transcription flow after audio recording
4. CBT thought record: step-by-step guided editor
5. Habit-mood correlation: calculation engine + chart in Stats
6. "Ask Your Journal" natural language Q&A (upgrade existing AI search)
7. Conversational AI journaling (chat mode entry creation)
8. AI mentor personas (5 initial characters)
9. Cognitive bias detection (opt-in post-entry analysis)
10. Emotion granularity picker (hierarchical emotion tree)
11. i18n for all 8 languages

---

## Revolution Enhancement — AI Emotional Mirror (Source: diary-revolution.md)

### Additional Scope In

- **Compassionate Stranger** (Revolution — Tier 1): Single warm human response after writing — not therapy, not advice, just acknowledgment. System prompt: "You are a kind stranger who overheard this person's thoughts. Respond in 2-3 sentences with genuine warmth. No advice. No therapy." Handwriting font, sepia card slightly rotated — like finding a note in a returned library book
- **Emotional Echo Detection** (Revolution — Tier 1): On-device TF-IDF. Compare topic + sentiment vector against entry history. If cosine similarity > threshold, surface match with 7-day mood trajectory after those past episodes. Evidence-based hope: "This reminds me of something... You've been here before, and here's how it went."
- **The Unsaid** (Revolution — Tier 2): After a week of entries, surface what's ABSENT — topics that disappeared from writing. "Your emotional landscape focused on [work, stress]. Sometimes what we don't write about matters too."
- **Devil's Advocate** (Revolution — Tier 2): Detect cognitive distortions and use user's OWN past entries as counter-evidence. No LLM needed — pattern matching + full-text search. "Your own words tell a different story..."
- **Emotional Pattern Narrator** (Revolution — Tier 2): After 30+ entries, monthly literary narrative — not clinical report. "There was a stretch in early March where every entry carried the weight of change..."
- **Temporal Perspective Shift** (Revolution — Tier 3): Three perspectives: past-you (amplifies problem), present-you (actual words), future-you (acceptance, growth). Based on MIT "Future You" project. Three cards with distinct visual styles: yellowed paper (past), current theme (now), luminous clean (future). Swipe between

### Additional Success Criteria

- Echo Detection on-device latency < 500ms (TF-IDF + cosine similarity, no cloud)
- Compassionate Stranger response < 3 seconds after save (LLM API call)
- Pattern Narrator requires 30+ entries minimum before generating (statistical significance)
- Devil's Advocate uses ONLY user's own entries — zero external content
- The Unsaid detects topic absence after 7+ consecutive daily entries
- Temporal Perspective renders 3 cards with smooth swipe transition

### Additional Architecture Impact

- **New Components**: `CompassionateStranger.tsx`, `EchoDetection.tsx`, `TheUnsaid.tsx`, `DevilsAdvocate.tsx`, `PatternNarrator.tsx`, `TemporalPerspective.tsx`
- **New Services**: `emotionalEcho.ts` (TF-IDF + cosine similarity engine), `topicAbsenceDetector.ts`
- **Dependencies**: Epic 7 (arousal data enriches pattern detection), existing `journalAI.ts` (extend search infrastructure)

### Additional Phases

12. Compassionate Stranger (LLM prompt engineering + sepia card UI + handwriting font)
13. Emotional Echo Detection (on-device TF-IDF + cosine similarity + trajectory display)
14. The Unsaid (topic absence detection from 7-day entry windows)
15. Devil's Advocate (self-sourced counter-evidence from user's own history)
16. Pattern Narrator (monthly literary narrative generation via LLM)
17. Temporal Perspective Shift (three-card past/present/future with swipe)
