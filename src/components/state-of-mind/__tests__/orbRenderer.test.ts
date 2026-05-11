import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { getShapeParams } from "../orbRenderer";

const shaderSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../orbShader.frag"),
  "utf8",
);

function superformula(
  theta: number,
  m: number,
  n1: number,
  n2: number,
  n3: number,
): number {
  const alpha = (m * theta) / 4;
  const sum = Math.abs(Math.cos(alpha)) ** n2 + Math.abs(Math.sin(alpha)) ** n3;
  return sum < 1e-10 ? 1 : sum ** (-1 / n1);
}

function radialContrast(params: ReturnType<typeof getShapeParams>) {
  const samples = Array.from({ length: 720 }, (_, index) =>
    superformula(
      (index / 720) * Math.PI * 2,
      Math.round(params.m),
      params.n1,
      params.n2,
      params.n3,
    ),
  );
  return Math.max(...samples) / Math.min(...samples);
}

describe("orb shape presets", () => {
  it("keeps the low-valence pressure lens phase-stable between adjacent negative moods", () => {
    const samples = [-1, -0.9, -0.8, -0.667, -0.5, -0.333, -0.05];

    for (const valence of samples) {
      expect(getShapeParams(valence).m).toBeCloseTo(3, 5);
    }
  });

  it("makes very unpleasant and unpleasant visually distinct at the orb-page V2 snap stops", () => {
    const veryUnpleasant = radialContrast(getShapeParams(-1));
    const unpleasant = radialContrast(getShapeParams(-0.667));

    expect(veryUnpleasant).toBeGreaterThan(1.25);
    expect(unpleasant).toBeLessThan(1.18);
    expect(veryUnpleasant - unpleasant).toBeGreaterThan(0.14);
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
    expect(shaderSource).toContain("else if (v < -0.500)");
  });
});
