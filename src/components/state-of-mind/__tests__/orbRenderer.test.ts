import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { getShapeParams } from "../orbRenderer";

const shaderSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../orbShader.frag"),
  "utf8",
);

describe("orb shape presets", () => {
  it("keeps the low-valence pressure lens phase-stable between adjacent negative moods", () => {
    const samples = [-1, -0.9, -0.8, -0.667, -0.5, -0.333, -0.05];

    for (const valence of samples) {
      expect(getShapeParams(valence).m).toBeCloseTo(3, 5);
    }
  });

  it("keeps the positive bloom family stable after neutral", () => {
    const samples = [0, 0.12, 0.333, 0.5, 0.667, 1];

    for (const valence of samples) {
      expect(getShapeParams(valence).m).toBeCloseTo(5, 5);
    }
  });

  it("keeps WebGL negative moods in the same stable harmonic family", () => {
    expect(shaderSource).toContain(
      "float stableShapeM = uValence < 0.0 ? 3.0 : uShapeM;",
    );
  });
});
