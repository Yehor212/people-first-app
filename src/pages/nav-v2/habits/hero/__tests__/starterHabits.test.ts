import { describe, expect, it } from "vitest";
import { habitTemplates } from "@/lib/habitTemplates";
import { STARTER_TEMPLATES, starterToHabit, templateToHabit } from "../starterHabits";

const EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

describe("v2 starter habit icon materialization", () => {
  it("stores semantic icon ids instead of emoji glyphs for new v2 habits", () => {
    for (const starter of STARTER_TEMPLATES) {
      expect(starter.icon).not.toMatch(EMOJI_PATTERN);
      expect(starter.identityIcon ?? "").not.toMatch(EMOJI_PATTERN);
      expect(starterToHabit(starter, 0, 123).icon).toBe(starter.icon);
      expect(starterToHabit(starter, 0, 123).identityIcon ?? "").not.toMatch(
        EMOJI_PATTERN,
      );
    }

    const template = habitTemplates.find((item) => item.id === "drink-water");
    expect(template).toBeTruthy();
    expect(templateToHabit(template!, 0, "en", 123).icon).toBe("drink-water");
  });
});
