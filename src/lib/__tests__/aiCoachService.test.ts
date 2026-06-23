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
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
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
});
