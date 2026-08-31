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
  getChallengeByCode: vi.fn(),
  joinChallengeByCode: vi.fn(),
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
  resolveChallengeInviteByCode,
  shareChallenge,
  CHALLENGE_DURATIONS,
  type Challenge,
} from "@/lib/friendChallenge";
import { safeLocalStorageGet } from "@/lib/safeJson";
import {
  joinChallengeByCode,
  isCloudChallengesAvailable,
} from "@/lib/challengeService";
import { logger } from "@/lib/logger";

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

  it("round-trips only the opaque lookup code", () => {
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
    expect(decoded?.code).toBe("ZEN-XXXXXX");
    expect(decoded).toEqual({ code: "ZEN-XXXXXX" });
  });

  it("does not include Unicode habit content in the encoded payload", () => {
    const challenge = makeChallenge({ habitName: "🌸 花を育てる" });
    const encoded = encodeInviteData(challenge);
    const decoded = decodeInviteData(encoded);
    expect(decoded).toEqual({ code: challenge.code });
    expect(decodeURIComponent(atob(encoded))).not.toContain("花を育てる");
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

describe("resolveChallengeInviteByCode", () => {
  it("resolves a code-only link from existing local truth", async () => {
    const local = makeChallenge({ code: "ZEN-A2B3C4" });
    (safeLocalStorageGet as ReturnType<typeof vi.fn>).mockReturnValue([local]);

    await expect(resolveChallengeInviteByCode("zen-a2b3c4")).resolves.toEqual({
      code: local.code,
      habitName: local.habitName,
      habitIcon: local.habitIcon,
      duration: local.duration,
      creatorName: local.creatorName,
      startDate: local.startDate,
    });
  });

  it("resolves a code-only link from the authoritative cloud record", async () => {
    (isCloudChallengesAvailable as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (joinChallengeByCode as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "remote-id",
      code: "ZEN-A2B3C4",
      habitName: "Meditate",
      habitIcon: "🧘",
      duration: 14,
      startDate: "2024-06-15",
    });

    await expect(resolveChallengeInviteByCode("ZEN-A2B3C4")).resolves.toEqual({
      code: "ZEN-A2B3C4",
      habitName: "Meditate",
      habitIcon: "🧘",
      duration: 14,
      startDate: "2024-06-15",
      cloudJoined: true,
    });
    expect(joinChallengeByCode).toHaveBeenCalledWith("ZEN-A2B3C4");
  });

  it("returns an explicit unavailable result instead of fabricating challenge data", async () => {
    (isCloudChallengesAvailable as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (joinChallengeByCode as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const resolved = await resolveChallengeInviteByCode("ZEN-A2B3C4");

    expect(resolved).toBeNull();
    expect(JSON.stringify(resolved)).not.toContain("Friend Challenge");
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
  it("generates an HTTPS capability link instead of a hijackable custom scheme", () => {
    const link = generateShareLink(makeChallenge());
    expect(link).toMatch(/^https:\/\/yehor212\.github\.io\/people-first-app\/#challenge=/);
    expect(link).not.toMatch(/^zenflow:/);
  });

  it("includes encoded invite data in URL", () => {
    const challenge = makeChallenge();
    const link = generateShareLink(challenge);
    const encoded = encodeInviteData(challenge);
    expect(new URL(link).hash).toContain(encoded);
  });

  it("keeps habit and identity content out of the deep-link query payload", () => {
    const habitCanary = "ZF_T172_HABIT_4N8C2V7X5L3D";
    const identityCanary = "ZF_T172_IDENTITY_5M7R2Q9T4C8P";
    const challenge = makeChallenge({
      habitName: habitCanary,
      creatorName: identityCanary,
      code: "ZEN-A2B3C4",
    });
    const link = generateShareLink(challenge);
    const encoded = new URLSearchParams(new URL(link).hash.replace(/^#/, "")).get("challenge");
    expect(encoded).not.toBeNull();

    const decodedPayload = decodeURIComponent(atob(encoded!));
    expect(decodedPayload).not.toContain(habitCanary);
    expect(decodedPayload).not.toContain(identityCanary);
    expect(decodedPayload).toContain("ZEN-A2B3C4");
  });
});

describe("shareChallenge failure diagnostics", () => {
  it("reports a fixed-boundary diagnostic when the share fallback is unavailable", async () => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });

    await expect(shareChallenge(makeChallenge())).resolves.toBe(false);

    expect(logger.warn).toHaveBeenCalledWith(
      "[FriendChallenge] Clipboard share fallback failed",
      expect.any(TypeError),
    );
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
