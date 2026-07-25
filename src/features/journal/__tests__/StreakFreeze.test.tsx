import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  get: vi.fn(() => ""),
  set: vi.fn(),
}));

vi.mock("@/lib/safeJson", () => ({
  storageGetRaw: storageMocks.get,
  storageSetRaw: storageMocks.set,
}));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      journalStreakFrozenToday: "Protected today",
      journalStreakFreezesAvailable: "{count} protections available",
    },
  }),
}));
vi.mock("@/hooks/useShouldAnimate", () => ({ useShouldAnimate: () => false }));

import { StreakFreezeIndicator, useStreakFreeze } from "../StreakFreeze";

describe("journal streak freeze civil dates and labels", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    storageMocks.get.mockReset().mockReturnValue("");
    storageMocks.set.mockReset();
  });

  afterEach(() => vi.useRealTimers());

  it("records the user's local calendar date near a UTC boundary", () => {
    vi.setSystemTime(new Date(2026, 0, 1, 23, 30));
    const { result } = renderHook(() => useStreakFreeze(7, null));

    act(() => result.current.activateFreeze());

    const stored = JSON.parse(storageMocks.set.mock.calls[0][1]) as { used: string[] };
    expect(stored.used).toEqual(["2026-01-01"]);
  });

  it("uses localized accessible labels", () => {
    const { rerender } = render(
      <StreakFreezeIndicator availableFreezes={1} isStreakFrozen={false} />,
    );
    expect(screen.getByLabelText("1 protections available")).toBeInTheDocument();

    rerender(<StreakFreezeIndicator availableFreezes={0} isStreakFrozen />);
    expect(screen.getByLabelText("Protected today")).toBeInTheDocument();
  });
});
