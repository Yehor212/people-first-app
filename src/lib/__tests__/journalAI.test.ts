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

  it("surfaces an account-backed private-search failure without provider-specific handling", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: { message: "Search temporarily unavailable" },
    });

    await expect(searchJournalSemantic("walk outside")).rejects.toEqual({
      message: "Search temporarily unavailable",
    });
  });
});
