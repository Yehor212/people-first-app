import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sources = [
  "src/features/journal/FloatingMediaLayer.tsx",
  "src/features/journal/JournalHubShell.tsx",
];

describe("journal logical-axis centering", () => {
  it("reverses logical half-translation under RTL", () => {
    for (const path of sources) {
      const source = readFileSync(path, "utf8");
      const classNames = [...source.matchAll(/className="([^"]*start-1\/2[^"]*)"/g)].map(
        (match) => match[1],
      );

      expect(classNames.length, path).toBeGreaterThan(0);
      for (const className of classNames) {
        if (!className.includes("-translate-x-1/2")) continue;
        expect(className, path).toContain("rtl:translate-x-1/2");
      }
    }
  });
});
