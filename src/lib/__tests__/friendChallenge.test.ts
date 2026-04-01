import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before imports
vi.mock("@/lib/safeJson", () => ({
  safeJsonParse: vi.fn((str: string, fallback: any) => {
    try {
      return JSON.parse(str);
    } catch {
      return fallback;
    }
  }),
  safeLocalStorageGet: vi.fn(() => []),
  safeLocalStorageSet: vi.fn(),
}));

vi.mock("@/lib/storageKeys", () => ({
  SK: { CHALLENGES: "challenges" },
}));

vi.mock("@/lib/validation", () => ({
  generateSecureId: vi.fn(
    (prefix: string) => `${prefix}_mock_${Math.random().toString(36).slice(2, 8)}`
  ),
}));

vi.mock("@/lib/utils", () => ({
  parseLocalDate: vi.fn((dateStr: string) => new Date(dateStr + "T00:00:00")),
  getToday: vi.fn(() => "2024-06-15"),
}));

vi.mock("@/lib/logger", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/challengeService", () => ({
  isCloudChallengesAvailable: vi.fn(() => false),
  syncLocalChallengeToCloud: vi.fn(),
  updateMyProgress: vi.fn(),
}));

// Mock crypto.getRandomValues
const mockGetRandomValues = vi.fn((arr: Uint8Array) => {
  for (let i = 0; i < arr.length; i++) arr[i] = i * 7 + 3;
  return arr;
});
Object.defineProperty(globalThis, "crypto", {
  value: { getRandomValues: mockGetRandomValues },
  writable: true,
});

import {
  encodeInviteData,
  decodeInviteData,
  generateShareText,
  generateShareLink,
  getChallengeProgress,
  getDaysRemaining,
  CHALLENGE_DURATIONS,
  type Challenge,
} from "@/lib/friendChallenge";
import { safeLocalStorageGet } from "@/lib/safeJson";

beforeEach(() => {
  vi.clearAllMocks();
  (safeLocalStorageGet as ReturnType<typeof vi.fn>).mockReturnValue([]);
});

// ─── Helper ──────────────────────────────────────────────────────

function makeChallenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: "ch-1",
    code: "ZEN-ABC123",
    habitName: "Meditate",
    habitIcon: "🧘",
    duration: 7,
    startDate: "2024-06-15",
    endDate: "2024-06-22",
    myProgress: 0,
    isCreator: true,
    status: "active",
    ...overrides,
  };
}

// ─── CHALLENGE_DURATIONS ─────────────────────────────────────────

describe("CHALLENGE_DURATIONS", () => {
  it("contains 4 duration options", () => {
    expect(CHALLENGE_DURATIONS).toHaveLength(4);
  });

  it("has 7, 14, 21, 30 day values", () => {
    const values = CHALLENGE_DURATIONS.map((d) => d.value);
    expect(values).toEqual([7, 14, 21, 30]);
  });

  it("each option has a label string", () => {
    for (const d of CHALLENGE_DURATIONS) {
      expect(typeof d.label).toBe("string");
      expect(d.label.length).toBeGreaterThan(0);
    }
  });
});

// ─── encodeInviteData / decodeInviteData ─────────────────────────

describe("encodeInviteData", () => {
  it("returns a base64-encoded string", () => {
    const challenge = makeChallenge();
    const encoded = encodeInviteData(challenge);
    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(0);
  });

  it("round-trips with decodeInviteData", () => {
    const challenge = makeChallenge({
      habitName: "Run",
      habitIcon: "🏃",
      duration: 14,
      creatorName: "Alice",
      code: "ZEN-XXXXXX",
      startDate: "2024-06-10",
    });
    const encoded = encodeInviteData(challenge);
    const decoded = decodeInviteData(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded?.habitName).toBe("Run");
    expect(decoded?.habitIcon).toBe("🏃");
    expect(decoded?.duration).toBe(14);
    expect(decoded?.creatorName).toBe("Alice");
    expect(decoded?.code).toBe("ZEN-XXXXXX");
    expect(decoded?.startDate).toBe("2024-06-10");
  });

  it("handles Unicode characters (emoji in habit name)", () => {
    const challenge = makeChallenge({ habitName: "🌸 花を育てる" });
    const encoded = encodeInviteData(challenge);
    const decoded = decodeInviteData(encoded);
    expect(decoded?.habitName).toBe("🌸 花を育てる");
  });

  it("handles empty creatorName", () => {
    const challenge = makeChallenge({ creatorName: undefined });
    const encoded = encodeInviteData(challenge);
    const decoded = decodeInviteData(encoded);
    expect(decoded?.creatorName).toBeUndefined();
  });
});

describe("decodeInviteData", () => {
  it("returns null for empty string", () => {
    expect(decodeInviteData("")).toBeNull();
  });

  it("returns null for invalid base64", () => {
    expect(decodeInviteData("not-valid-base64!!!")).toBeNull();
  });

  it("returns null for string exceeding 10KB", () => {
    const huge = "A".repeat(10001);
    expect(decodeInviteData(huge)).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(decodeInviteData(null as any)).toBeNull();
    expect(decodeInviteData(undefined as any)).toBeNull();
    expect(decodeInviteData(123 as any)).toBeNull();
  });

  it("returns null for valid base64 but invalid JSON", () => {
    const encoded = btoa("not json");
    expect(decodeInviteData(encoded)).toBeNull();
  });

  it("returns null for valid JSON but missing required fields", () => {
    const encoded = btoa(encodeURIComponent(JSON.stringify({ foo: "bar" })));
    const result = decodeInviteData(encoded);
    // Zod validation now rejects objects missing required fields (security hardening)
    expect(result).toBeNull();
  });
});

// ─── generateShareText ───────────────────────────────────────────

describe("generateShareText", () => {
  it("includes habit icon and name", () => {
    const challenge = makeChallenge({ habitIcon: "🧘", habitName: "Meditate" });
    const text = generateShareText(challenge);
    expect(text).toContain("🧘");
    expect(text).toContain("Meditate");
  });

  it("includes challenge code", () => {
    const challenge = makeChallenge({ code: "ZEN-ABC123" });
    const text = generateShareText(challenge);
    expect(text).toContain("ZEN-ABC123");
  });

  it("includes duration", () => {
    const challenge = makeChallenge({ duration: 21 });
    const text = generateShareText(challenge);
    expect(text).toContain("21");
  });

  it("uses custom translations when provided", () => {
    const challenge = makeChallenge();
    const text = generateShareText(challenge, {
      challengeInvite: "Присоединяйся!",
      habit: "Привычка",
      duration: "Длительность",
      days: "дней",
      code: "Код",
      challengeJoinPrompt: "Присоединяйся в ZenFlow!",
    });
    expect(text).toContain("Присоединяйся!");
    expect(text).toContain("Привычка");
    expect(text).toContain("Длительность");
  });

  it("uses default English labels when no translations", () => {
    const text = generateShareText(makeChallenge());
    expect(text).toContain("Join my challenge!");
    expect(text).toContain("Habit");
    expect(text).toContain("Duration");
  });
});

// ─── generateShareLink ──────────────────────────────────────────

describe("generateShareLink", () => {
  it("generates zenflow:// protocol link", () => {
    const link = generateShareLink(makeChallenge());
    expect(link).toMatch(/^zenflow:\/\/challenge\?data=/);
  });

  it("includes encoded invite data in URL", () => {
    const challenge = makeChallenge();
    const link = generateShareLink(challenge);
    const encoded = encodeInviteData(challenge);
    expect(link).toContain(encoded);
  });
});

// ─── getChallengeProgress ────────────────────────────────────────

describe("getChallengeProgress", () => {
  it("returns 0 for no progress", () => {
    expect(getChallengeProgress(makeChallenge({ myProgress: 0, duration: 7 }))).toBe(0);
  });

  it("returns 100 for fully completed", () => {
    expect(getChallengeProgress(makeChallenge({ myProgress: 7, duration: 7 }))).toBe(100);
  });

  it("rounds to nearest integer", () => {
    // 3/7 = 42.857...
    expect(getChallengeProgress(makeChallenge({ myProgress: 3, duration: 7 }))).toBe(43);
  });

  it("returns 0 for zero duration", () => {
    expect(getChallengeProgress(makeChallenge({ myProgress: 5, duration: 0 }))).toBe(0);
  });

  it("returns 0 for negative duration", () => {
    expect(getChallengeProgress(makeChallenge({ myProgress: 5, duration: -1 }))).toBe(0);
  });

  it("returns 50 for halfway", () => {
    expect(getChallengeProgress(makeChallenge({ myProgress: 5, duration: 10 }))).toBe(50);
  });
});

// ─── getDaysRemaining ────────────────────────────────────────────

describe("getDaysRemaining", () => {
  it("returns 0 for past end date", () => {
    const challenge = makeChallenge({ endDate: "2020-01-01" });
    expect(getDaysRemaining(challenge)).toBe(0);
  });

  it("never returns negative", () => {
    const challenge = makeChallenge({ endDate: "2000-01-01" });
    expect(getDaysRemaining(challenge)).toBeGreaterThanOrEqual(0);
  });

  it("returns positive for future end date", () => {
    // Use a far future date to ensure this test doesn't become flaky
    const challenge = makeChallenge({ endDate: "2099-12-31" });
    expect(getDaysRemaining(challenge)).toBeGreaterThan(0);
  });
});
