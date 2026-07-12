import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSessionUserId: vi.fn<() => Promise<string | null>>(),
  pushQuestsToCloud: vi.fn(),
  safeLocalStorageGet: vi.fn(),
  safeLocalStorageSet: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: mocks.getCurrentSessionUserId,
}));

vi.mock("@/storage/tasksCloudSync", () => ({
  pushQuestsToCloud: mocks.pushQuestsToCloud,
}));

vi.mock("@/lib/safeJson", () => ({
  safeLocalStorageGet: mocks.safeLocalStorageGet,
  safeLocalStorageSet: mocks.safeLocalStorageSet,
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: new Proxy<Record<string, string>>(
      {},
      { get: (_target, key) => String(key) }
    ),
  }),
}));

vi.mock("@/hooks/useBackHandler", () => ({ useBackHandler: vi.fn() }));
vi.mock("@/hooks/useScrollLock", () => ({ useScrollLock: vi.fn() }));
vi.mock("@/hooks/useModalKeyboard", () => ({
  useModalKeyboard: () => ({ modalRef: { current: null }, handleKeyDown: vi.fn() }),
}));

vi.mock("@/lib/randomQuests", () => ({
  generateDailyQuest: vi.fn(),
  generateWeeklyQuest: vi.fn(),
  generateBonusQuest: vi.fn(),
  shouldRegenerateQuest: vi.fn(() => false),
}));

vi.mock("./QuestCard", () => ({
  QuestCard: () => <div data-testid="quest-card" />,
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

import { QuestsPanel } from "./QuestsPanel";
import type { Quest } from "@/lib/randomQuests";

const dailyQuestOwnedByA: Quest = {
  id: "quest-a",
  type: "daily",
  category: "focus",
  title: "Account A quest",
  description: "Complete a focused session",
  condition: { type: "focus_minutes", count: 20 },
  reward: { xp: 20, message: "Focused" },
  progress: 0,
  total: 20,
  completed: false,
  expiresAt: Date.now() + 60_000,
  createdAt: Date.now(),
};

describe("QuestsPanel cloud ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Math, "random").mockReturnValue(1);
    mocks.getCurrentSessionUserId.mockResolvedValue("account-a");
    mocks.pushQuestsToCloud.mockResolvedValue(undefined);
    mocks.safeLocalStorageGet.mockReturnValue({
      daily: dailyQuestOwnedByA,
      weekly: null,
      bonus: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("stamps the account that owned the locally loaded quest state", async () => {
    render(<QuestsPanel onClose={vi.fn()} />);

    await waitFor(() => {
      expect(mocks.pushQuestsToCloud).toHaveBeenCalledWith(
        {
          daily: dailyQuestOwnedByA,
          weekly: null,
          bonus: null,
        },
        "account-a"
      );
    });
  });
});
