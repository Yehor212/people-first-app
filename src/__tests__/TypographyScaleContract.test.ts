import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const tailwindSource = read("tailwind.config.ts");
const realHeadingSources = [
  read("src/components/auth-screen/AuthScreen.tsx"),
  read("src/components/LanguageSelector.tsx"),
  read("src/pages/nav-v2/planning/PlanningOverview.tsx"),
  read("src/pages/nav-v2/habits/HabitsPage.tsx"),
];

describe("user text-scale typography contract", () => {
  it("provides scoped large display sizes that honor the in-app font scale", () => {
    expect(tailwindSource).toContain('"display-5xl": [');
    expect(tailwindSource).toContain('"display-6xl": [');
    expect(tailwindSource).toContain(
      'calc(clamp(2.75rem, 2.5rem + 1vw, 3.25rem) * var(--font-scale, 1))',
    );
    expect(tailwindSource).toContain(
      'calc(clamp(3.25rem, 2.875rem + 1.5vw, 4rem) * var(--font-scale, 1))',
    );
  });

  it("uses the scoped scale only for real page and entry headings", () => {
    for (const source of realHeadingSources) {
      expect(source).not.toMatch(/(?:sm:|md:|lg:)?text-(?:5xl|6xl)/);
      expect(source).toContain("text-display-5xl");
    }

    expect(realHeadingSources[0]).toContain("md:text-display-6xl");
    expect(realHeadingSources[1]).toContain("md:text-display-6xl");
  });
});
