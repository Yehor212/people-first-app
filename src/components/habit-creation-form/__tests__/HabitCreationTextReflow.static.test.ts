import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name: string) =>
  readFileSync(`src/components/habit-creation-form/${name}.tsx`, "utf8");

const selectorSource = read("FormSelectors");
const formSource = read("HabitCreationForm");
const identitySource = read("IdentityMappingSection");
const targetSource = read("NumericalTargetSection");
const remindersSource = read("RemindersSection");

describe("habit creation text reflow contract", () => {
  it("uses the scalable ZenFlow type tokens for meaningful helper text", () => {
    for (const source of [
      selectorSource,
      formSource,
      identitySource,
      targetSource,
      remindersSource,
    ]) {
      expect(source).not.toMatch(/text-\[(?:9|10|11)px\]/);
    }
  });

  it("lets selector choices and category names reflow instead of clipping", () => {
    expect(selectorSource.match(/grid-cols-\[repeat\(auto-fit,minmax\(min\(100%,calc\(/g))
      .toHaveLength(3);
    expect(selectorSource).not.toContain("truncate w-full text-center");
    expect(selectorSource).toContain("whitespace-normal break-words");
  });

  it("stacks advanced summaries and navigation when scaled text needs more room", () => {
    expect(formSource.match(/grid-cols-\[repeat\(auto-fit,minmax\(min\(100%,calc\(/g))
      .toHaveLength(2);
    expect(formSource).not.toContain("truncate");
    expect(formSource).not.toContain("line-clamp");
    expect(formSource).toContain("whitespace-normal break-words");
  });

  it("moves reminder days onto their own adaptive grid without shrinking targets", () => {
    expect(remindersSource).toContain("grid-cols-[minmax(0,1fr)_44px]");
    expect(remindersSource).toContain(
      "grid-cols-[repeat(auto-fit,minmax(min(100%,calc(3.25rem*var(--font-scale,1))),1fr))]",
    );
    expect(remindersSource).toContain("col-span-2");
    expect(remindersSource).toContain("min-h-[44px]");
    expect(remindersSource).toContain("min-w-[44px]");
  });
});
