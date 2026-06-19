import { describe, expect, it } from "vitest";
import { Menu } from "lucide-react";
import {
  V2_HABIT_TEMPLATE_SYMBOLS,
  V2_SHELL_ICONS,
  getV2HabitTemplateSymbol,
} from "../v2IconSystem";
import { isProbablyEmojiGlyph } from "../v2HabitPictograms";

describe("v2IconSystem", () => {
  it("uses a recognizable menu glyph for the global drawer trigger", () => {
    expect(V2_SHELL_ICONS.menu).toBe(Menu);
  });

  it("maps V2 starter templates to local pictogram ids instead of library icon components", () => {
    expect(getV2HabitTemplateSymbol("drink-water")).toBe("drink-water");
    expect(getV2HabitTemplateSymbol("walk-distance")).toBe("walk-distance");
    expect(getV2HabitTemplateSymbol("exercise")).toBe("exercise");
    expect(getV2HabitTemplateSymbol("read")).toBe("read");
    expect(getV2HabitTemplateSymbol("meditate")).toBe("meditate");
    expect(getV2HabitTemplateSymbol("sleep")).toBe("sleep");
  });

  it("provides semantic pictogram ids instead of emoji ritual symbols", () => {
    expect(getV2HabitTemplateSymbol("drink-water")).toBe("drink-water");
    expect(getV2HabitTemplateSymbol("walk-run")).toBe("walk-distance");
    expect(getV2HabitTemplateSymbol("read-page")).toBe("read");
    expect(getV2HabitTemplateSymbol("sleep")).toBe("sleep");
    expect(getV2HabitTemplateSymbol("unknown-template")).toBe("focus");
    expect(Object.values(V2_HABIT_TEMPLATE_SYMBOLS).every((symbol) => typeof symbol === "string")).toBe(
      true,
    );
    expect(Object.values(V2_HABIT_TEMPLATE_SYMBOLS).some((symbol) => isProbablyEmojiGlyph(symbol))).toBe(
      false,
    );
  });
});
