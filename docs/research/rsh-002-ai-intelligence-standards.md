# Standards Research: AI Intelligence, Insights & Emotional Mirror

**Epic:** Epic 4 — AI Intelligence, Insights & Emotional Mirror
**Created:** 2026-04-14
**Domain:** AI/LLM Integration, NLP, Voice Transcription, Clinical Psychology Tools

---

## Library Research

**Primary libraries:**

| Library                      | Version             | Purpose                                                                     | Docs                                                    |
| ---------------------------- | ------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------- |
| Supabase Edge Functions      | Deno runtime (v1.x) | LLM API calls, background AI processing, cron-scheduled weekly reports      | supabase.com/docs/guides/functions                      |
| Web Speech API               | Browser-native      | Voice-to-text transcription (SpeechRecognition interface)                   | developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API |
| @anthropic-ai/sdk or openai  | Latest stable       | LLM API for insight generation, compassionate responses, pattern narratives | docs.anthropic.com / platform.openai.com                |
| Capacitor Speech Recognition | v6.x (stable)       | Native speech-to-text on iOS/Android when Web Speech API unavailable        | capacitor-community/speech-recognition                  |

**Key APIs:**

- `SpeechRecognition({ continuous, lang, interimResults })` — browser voice capture, supports `en-US` + other langs
- `recognition.onresult(event)` — extract `event.results[0][0].transcript` for recognized text
- `Supabase.ai.Session(model)` — built-in AI inference in Edge Functions (Mistral, etc.)
- `cron.schedule(name, interval, sql)` — pg_cron for weekly report generation scheduling
- `net.http_post(url, headers, body)` — invoke Edge Functions from cron with vault-stored keys

**Key constraints:**

- Web Speech API: Chrome/Edge only on desktop; Safari partial support; requires HTTPS — fallback to Capacitor plugin on native
- Edge Function cold start: ~200ms; batch AI calls to minimize invocations
- LLM API latency: 1-5s per call — use streaming for conversational features, background processing for reports
- PII filtering: strip names, emails, auth tokens BEFORE sending journal content to external LLM API (OWASP A01:2021)
- Offline-first: all AI features must degrade gracefully — show cached/local results when offline

**Standards compliance:**

- **OWASP A01:2021 (Broken Access Control):** PII filtering pipeline before LLM API calls; never send raw user data
- **WCAG 2.1 AA:** Voice transcription UI must show visual feedback; all AI cards keyboard-accessible
- **CBT Evidence Base:** 5-column thought record follows Beck's CBT model (Situation → Auto Thought → Emotion → Evidence → Balanced Thought); meta-analysis shows 25-50% anxiety reduction in 4 weeks
- **TF-IDF + Cosine Similarity:** Standard NLP technique for on-device document similarity; no cloud dependency needed for Echo Detection
- **AI Disclaimers:** All AI-generated insights must carry disclaimer: not clinical advice, not a replacement for professional help

**Existing guides:**

- `src/services/journalAI.ts` — existing semantic search infrastructure (extend for Q&A)
- `docs/tasks/epics/epic-4-ai-intelligence/epic.md` — full Epic specification with phases 1-17

---

## Patterns

| Pattern                    | Application                                                     | Standard                      |
| -------------------------- | --------------------------------------------------------------- | ----------------------------- |
| Background Task Processing | Weekly report generation via Edge Function + pg_cron            | Supabase Edge Functions docs  |
| Streaming LLM Response     | Conversational AI, Compassionate Stranger real-time response    | Server-Sent Events (SSE)      |
| On-Device NLP              | Emotional Echo Detection via TF-IDF + cosine similarity         | Standard NLP, no cloud needed |
| PII Sanitization Pipeline  | Filter journal content before LLM API calls                     | OWASP A01:2021                |
| Graceful Degradation       | Offline: show cached insights, disable cloud-dependent features | PWA best practices            |
| Clinical Disclaimer        | Non-therapeutic context for CBT, bias detection                 | APA ethical guidelines        |

---

**Version:** 1.0.0
