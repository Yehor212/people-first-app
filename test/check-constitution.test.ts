import { describe, expect, it } from "vitest";
import { checkConstitution } from "../scripts/check-constitution";

describe("check-constitution", () => {
  it("collects non-zero repo metrics on Windows without bash helpers", () => {
    const result = checkConstitution({ quiet: true });

    expect(result.metrics.sourceFiles).toBeGreaterThan(0);
    expect(result.metrics.testFiles).toBeGreaterThan(0);
    expect(result.metrics.reactMemo).toBeGreaterThan(0);
    expect(result.metrics.indexCssLines).toBeGreaterThan(0);
    expect(result.metrics.hooks).toBeGreaterThan(0);
  });
});
