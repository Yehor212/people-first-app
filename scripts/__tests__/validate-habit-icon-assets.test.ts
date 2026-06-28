import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { validateHabitIconManifest } = require("../validate-habit-icon-assets.cjs") as {
  validateHabitIconManifest: (
    manifest: unknown,
    options?: { rootDir?: string; checkFiles?: boolean }
  ) => {
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

  it("rejects unapproved Lottie references before visual approval", () => {
    const result = validateHabitIconManifest(
      {
        version: "bad",
        approvedLottieIds: ["read"],
        icons: [
          {
            id: "drink-water",
            label: "Drink water",
            source: "zenflow-original-v6/drink-water",
            license: "Original",
            reduced: "drink-water/reduced.svg",
            lottie: "drink-water/idle.lottie.json",
            idle: { renderer: "lottie", name: "bad", durationMs: 3000, bytes: 12000 },
            states: ["idle", "press", "complete", "disabled", "reduced"],
          },
        ],
      },
      {
        rootDir: "src/assets/habit-icons/v2",
        checkFiles: false,
      }
    );

    expect(result.errors).toContain("manifest must contain 22 icons");
    expect(result.errors).toContain(
      "drink-water: lottie renderer requires approvedLottieIds or reviewCandidateLottieIds entry"
    );
  });

  it("rejects locked still icons that still reference Lottie files", () => {
    const result = validateHabitIconManifest(
      {
        version: "bad",
        approvedLottieIds: ["read"],
        icons: [
          {
            id: "walk-distance",
            label: "Walk distance",
            source: "zenflow-static-reduced-awaiting-lottie-approval/walk-distance",
            license: "Original",
            reduced: "walk-distance/reduced.svg",
            lottie: "walk-distance/idle.lottie.json",
            idle: { renderer: "still", name: "locked", durationMs: 0, bytes: 10 },
            states: ["idle", "press", "complete", "disabled", "reduced"],
          },
        ],
      },
      {
        rootDir: "src/assets/habit-icons/v2",
        checkFiles: false,
      }
    );

    expect(result.errors).toContain(
      "walk-distance: locked still icon must not reference Lottie before approval"
    );
    expect(result.errors).toContain("walk-distance: locked still icon must use 0 animation bytes");
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
      }
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

  it("rejects asset paths that resolve outside the manifest root", () => {
    const result = validateHabitIconManifest(
      {
        version: "bad",
        icons: [
          {
            id: "drink-water",
            label: "Drink water",
            source: "fixture",
            license: "Original",
            reduced: "../outside.svg",
            idle: { renderer: "still", name: "locked", durationMs: 0, bytes: 0 },
            states: ["idle", "press", "complete", "disabled", "reduced"],
          },
        ],
      },
      {
        rootDir: "src/assets/habit-icons/v2",
        checkFiles: true,
      },
    );

    expect(result.errors).toContain("drink-water: reduced file path must stay inside the manifest root");
  });
});
