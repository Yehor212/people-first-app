import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    functions: {
      invoke: mocks.invoke,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

import { searchJournalSemantic } from "../journalAI";

describe("journalAI no-paid mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    mocks.invoke.mockReset();
  });

  it("returns empty results instead of throwing when Gemini search is not configured", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: { message: "Gemini API not configured" },
    });

    await expect(searchJournalSemantic("walk outside")).resolves.toEqual([]);
  });
});
