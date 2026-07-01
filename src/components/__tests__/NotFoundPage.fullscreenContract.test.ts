import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readNotFoundPage = () => readFileSync("src/components/NotFoundPage.tsx", "utf8");

describe("NotFoundPage fullscreen recovery contract", () => {
  it("uses the shared V2 viewport and safe-area variables", () => {
    const source = readNotFoundPage();

    expect(source).toContain("min-h-[var(--app-viewport-height)]");
    expect(source).toContain("var(--safe-top)");
    expect(source).not.toContain("min-h-[100svh]");
    expect(source).not.toContain("env(safe-area-inset-top)");
  });
});
