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

  it("stacks recovery actions until there is enough room and preserves readable labels", () => {
    const source = readNotFoundPage();

    expect(source).toContain('"grid-cols-1 sm:grid-cols-2"');
    expect(source).not.toContain('"grid-cols-2" : "grid-cols-1"');
    expect(source).toMatch(/min-w-0[^"]*whitespace-normal[^"]*break-words/);
    expect(source).toContain("[overflow-wrap:break-word]");
  });
});
