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
  it("keeps negative moods on the canonical octagram-to-hexagon family", () => {
    expect(getShapeParams(-1).m).toBeCloseTo(8, 5);
    expect(getShapeParams(-0.667).m).toBeCloseTo(7, 5);
    expect(getShapeParams(-0.333).m).toBeCloseTo(6, 5);
    expect(getShapeParams(0).m).toBeCloseTo(6, 5);
  });

  it("makes very unpleasant and unpleasant visually distinct at the orb-page V2 snap stops", () => {
    const veryUnpleasant = radialContrast(getShapeParams(-1));
    const unpleasant = radialContrast(getShapeParams(-0.667));

    expect(veryUnpleasant).toBeGreaterThan(1.12);
    expect(unpleasant).toBeGreaterThan(1.08);
    expect(Math.abs(veryUnpleasant - unpleasant)).toBeGreaterThan(0.02);
  });

  it("keeps the positive bloom family stable after neutral", () => {
    const samples = [0.333, 0.5, 0.667, 1];

    for (const valence of samples) {
      expect(getShapeParams(valence).m).toBeCloseTo(5, 5);
    }
  });

  it("keeps WebGL on the canonical shape uniform instead of forcing old pressure lenses", () => {
    expect(shaderSource).not.toContain("uValence < 0.0 ? 3.0 : uShapeM");
    expect(shaderSource).toContain("float mLow = floor(uShapeM);");
    expect(shaderSource).toContain("float mBlend = smoothstep(0.0, 1.0, fract(uShapeM));");
  });
});
