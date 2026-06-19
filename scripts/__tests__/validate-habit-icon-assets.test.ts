import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { validateHabitIconManifest } = require("../validate-habit-icon-assets.cjs") as {
  validateHabitIconManifest: (manifest: unknown, options?: { rootDir?: string; checkFiles?: boolean }) => {
    errors: string[];
    iconCount: number;
    ids: string[];
  };
};

describe("validateHabitIconManifest", () => {
  it("requires every v2 habit icon to have a reduced still and complete state contract", () => {
    const manifest = JSON.parse(readFileSync("src/assets/habit-icons/v2/manifest.json", "utf8"));
    const result = validateHabitIconManifest(manifest, {
      rootDir: "src/assets/habit-icons/v2",
      checkFiles: false,
    });

    expect(result.errors).toEqual([]);
    expect(result.iconCount).toBe(22);
    expect(result.ids).toContain("drink-water");
    expect(result.ids).toContain("quit-smoking");
    expect(new Set(result.ids).size).toBe(22);
  });

  it("rejects emoji, missing reduced stills, overlong loops, and over-budget animation JSON", () => {
    const result = validateHabitIconManifest(
      {
        version: "bad",
        icons: [
          {
            id: "drink-water",
            label: "💧",
            reduced: "",
            idle: { src: "drink-water/idle.lottie.json", durationMs: 4200, bytes: 120000 },
            states: ["idle"],
          },
        ],
      },
      {
        rootDir: "src/assets/habit-icons/v2",
        checkFiles: false,
      },
    );

    expect(result.errors).toContain("drink-water: label must not contain emoji");
    expect(result.errors).toContain("drink-water: reduced SVG is required");
    expect(result.errors).toContain("drink-water: idle duration must be <= 3000ms");
    expect(result.errors).toContain("drink-water: idle animation must be <= 80000 bytes");
    expect(result.errors).toContain("drink-water: missing state press");
    expect(result.errors).toContain("drink-water: missing state complete");
    expect(result.errors).toContain("drink-water: missing state disabled");
    expect(result.errors).toContain("drink-water: missing state reduced");
  });
});
