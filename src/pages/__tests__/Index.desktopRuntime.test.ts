import { describe, expect, it } from "vitest";

import { shouldUseNavV2Shell } from "../Index";

const baseDecision = {
  desktopRuntime: false,
  forceNavV2: false,
  designFlag: false,
  queryOverride: false,
  pathOverride: false,
};

describe("Index desktop runtime shell selection", () => {
  it("keeps normal web root on the default shell when no V2 signal is active", () => {
    expect(shouldUseNavV2Shell(baseDecision)).toBe(false);
  });

  it("opens the installed desktop runtime in the V2 shell without requiring a URL query", () => {
    expect(shouldUseNavV2Shell({ ...baseDecision, desktopRuntime: true })).toBe(true);
  });

  it("keeps existing V2 web entry points intact", () => {
    expect(shouldUseNavV2Shell({ ...baseDecision, queryOverride: true })).toBe(true);
    expect(shouldUseNavV2Shell({ ...baseDecision, pathOverride: true })).toBe(true);
    expect(shouldUseNavV2Shell({ ...baseDecision, designFlag: true })).toBe(true);
  });
});
