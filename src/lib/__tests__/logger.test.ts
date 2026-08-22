import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ IS_DEV: true }));

import { DIAGNOSTIC_CODES } from "@/lib/diagnosticPrivacy";
import { logger } from "@/lib/logger";

const consoleSpy = {
  log: vi.spyOn(console, "log").mockImplementation(() => undefined),
  warn: vi.spyOn(console, "warn").mockImplementation(() => undefined),
  error: vi.spyOn(console, "error").mockImplementation(() => undefined),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("privacy-safe logger", () => {
  it("emits only fixed codes for every logging channel", () => {
    logger.log("private text", { arbitrary: "private text" });
    logger.info("private text", ["private text"]);
    logger.warn(new Error("private text"));
    logger.error(new Error("private text"), { stack: "private text" });
    logger.sync("private text", { content: "private text" });
    logger.auth("private text");

    expect(consoleSpy.log.mock.calls).toEqual([
      [DIAGNOSTIC_CODES.log],
      [DIAGNOSTIC_CODES.info],
      [DIAGNOSTIC_CODES.sync],
      [DIAGNOSTIC_CODES.auth],
    ]);
    expect(consoleSpy.warn).toHaveBeenCalledWith(DIAGNOSTIC_CODES.warning);
    expect(consoleSpy.error).toHaveBeenCalledWith(DIAGNOSTIC_CODES.error);
    expect(JSON.stringify(Object.values(consoleSpy).flatMap((spy) => spy.mock.calls))).not.toContain(
      "private text"
    );
  });

  it("does not pass Errors, arrays, or otherwise safe-looking arbitrary fields through", () => {
    const canary = "PRIVATE_CANARY";
    logger.error(new Error(canary), [canary], {
      count: 2,
      status: "ok",
      user_id: canary,
    });

    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    expect(consoleSpy.error).toHaveBeenCalledWith(DIAGNOSTIC_CODES.error);
    expect(JSON.stringify(consoleSpy.error.mock.calls)).not.toContain(canary);
  });
});
