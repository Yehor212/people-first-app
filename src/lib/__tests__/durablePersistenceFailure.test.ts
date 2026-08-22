import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.error,
    info: mocks.info,
  },
}));

import { AccountBoundaryChangedError } from "@/storage/accountBoundaryRuntime";
import { reportDurablePersistenceFailure } from "../durablePersistenceFailure";

describe("durable persistence failure reporting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("discards a stale-account result without publishing a storage failure", () => {
    const dispatch = vi.spyOn(window, "dispatchEvent");

    reportDurablePersistenceFailure(new AccountBoundaryChangedError(), {
      domain: "Mood",
      localizedMessage: "Storage unavailable",
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.info).toHaveBeenCalledWith("[Mood] Stale account result discarded");
  });

  it("publishes a localized recovery event without logging the raw error", () => {
    const rawError = new Error("private persistence detail");
    const dispatch = vi.spyOn(window, "dispatchEvent");

    reportDurablePersistenceFailure(rawError, {
      domain: "Focus",
      localizedMessage: "Storage unavailable",
    });

    expect(mocks.error).toHaveBeenCalledWith("[Focus] Durable persistence failed");
    expect(mocks.error).not.toHaveBeenCalledWith(expect.stringContaining(rawError.message));
    expect(dispatch).toHaveBeenCalledTimes(1);
    const event = dispatch.mock.calls[0]?.[0] as CustomEvent;
    expect(event.type).toBe("zenflow:storage-error");
    expect(event.detail).toEqual({
      type: "write_failed",
      message: "Storage unavailable",
    });
  });
});
