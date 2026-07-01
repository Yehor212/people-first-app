import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
  },
}));

vi.mock("@/lib/env", () => ({
  SUPABASE_URL: "https://example.supabase.co",
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { sendAICoachMessage } from "../aiCoachService";

const originalFetch = globalThis.fetch;

const coachLiteLanguageMarkers = [
  ["en", "free local mode"],
  ["uk", "безкоштовний локальний режим"],
  ["es", "modo local gratuito"],
  ["de", "kostenloser lokaler Modus"],
  ["fr", "mode local gratuit"],
  ["ja", "無料ローカルモード"],
  ["ar", "الوضع المحلي المجاني"],
  ["he", "מצב מקומי חינמי"],
] as const;

describe("sendAICoachMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const fakeSessionToken = ["unit", "session"].join("-");
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: fakeSessionToken } },
    });
    globalThis.fetch = mocks.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns a Coach Lite reply when the edge function reports missing paid AI configuration", async () => {
    mocks.fetch.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "AI service not configured" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const response = await sendAICoachMessage({
      message: "I skipped my evening walk.",
      language: "en",
      trigger: "habit_skip",
      conversationHistory: [],
      context: {
        habits: [{ name: "Evening walk", completedToday: false, streak: 4 }],
      },
    });

    expect(response.reply).toContain("Coach Lite");
    expect(response.reply).toContain("Evening walk");
  });

  it("keeps the client-side Coach Lite fallback localized for every supported app language", async () => {
    mocks.fetch.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "AI service not configured" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    for (const [language, marker] of coachLiteLanguageMarkers) {
      const response = await sendAICoachMessage({
        message: "I skipped my evening walk.",
        language,
        trigger: "habit_skip",
        conversationHistory: [],
        context: {
          habits: [{ name: "Evening walk", completedToday: false, streak: 4 }],
        },
      });

      expect(response.reply, language).toContain(marker);
      if (language !== "en") {
        expect(response.reply, language).not.toContain("free local mode");
      }
    }
  });
});
