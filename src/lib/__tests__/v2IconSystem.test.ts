import { describe, expect, it } from "vitest";
import {
  BookOpenCheck,
  Dumbbell,
  GlassWater,
  Footprints,
  AlarmClockCheck,
  HeartPulse,
  Menu,
} from "lucide-react";
import {
  V2_HABIT_TEMPLATE_ICONS,
  V2_HABIT_TEMPLATE_SYMBOLS,
  V2_SHELL_ICONS,
  getV2HabitTemplateIcon,
  getV2HabitTemplateSymbol,
} from "../v2IconSystem";

describe("v2IconSystem", () => {
  it("uses a recognizable menu glyph for the global drawer trigger", () => {
    expect(V2_SHELL_ICONS.menu).toBe(Menu);
  });

  it("maps V2 starter templates to semantic lucide icons instead of emoji glyphs", () => {
    expect(getV2HabitTemplateIcon("drink-water")).toBe(GlassWater);
    expect(getV2HabitTemplateIcon("walk-distance")).toBe(Footprints);
    expect(getV2HabitTemplateIcon("exercise")).toBe(Dumbbell);
    expect(getV2HabitTemplateIcon("read")).toBe(BookOpenCheck);
    expect(getV2HabitTemplateIcon("meditate")).toBe(HeartPulse);
    expect(getV2HabitTemplateIcon("sleep")).toBe(AlarmClockCheck);
  });

  it("keeps the curated template icon registry component-based", () => {
    for (const icon of Object.values(V2_HABIT_TEMPLATE_ICONS)) {
      expect(icon).toBeTruthy();
      expect(typeof icon).not.toBe("string");
    }
  });

  it("provides modern ritual symbols separately from lucide component icons", () => {
    expect(getV2HabitTemplateSymbol("drink-water")).toBe("💧");
    expect(getV2HabitTemplateSymbol("walk-run")).toBe("👟");
    expect(getV2HabitTemplateSymbol("read-page")).toBe("📖");
    expect(getV2HabitTemplateSymbol("sleep")).toBe("🛏️");
    expect(getV2HabitTemplateSymbol("unknown-template")).toBe("✨");
    expect(Object.values(V2_HABIT_TEMPLATE_SYMBOLS).every((symbol) => typeof symbol === "string")).toBe(
      true,
    );
  });
});
