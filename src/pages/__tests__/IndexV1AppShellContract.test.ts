import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("IndexV1 app shell marker", () => {
  it("exposes a stable app shell marker for interactive auth completion smoke", () => {
    const source = readFileSync("src/pages/IndexV1Impl.tsx", "utf8");

    expect(source).toContain('data-testid="app-shell-v1"');
  });
});
