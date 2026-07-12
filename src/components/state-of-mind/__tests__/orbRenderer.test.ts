import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ORB_SHADER_TIME_WRAP_SECONDS } from "../ValenceOrb";
import { getShapeParams, resolveStableBreathPhase } from "../orbRenderer";

const shaderSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../orbShader.frag"),
  "utf8",
);
const webGpuSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../orbWebGpu.ts"),
  "utf8",
);
const shaderRendererSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../orbShader.ts"),
  "utf8",
);
const workerSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../orbWorker.ts"),
  "utf8",
);
const rendererSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../orbRenderer.ts"),
  "utf8",
);

function extractFunctionCalls(source: string, functionName: string): string[] {
  const calls: string[] = [];
  const marker = `${functionName}(`;
  let searchFrom = 0;

  while (searchFrom < source.length) {
    const start = source.indexOf(marker, searchFrom);
    if (start === -1) break;

    let depth = 0;
    let end = start + marker.length;
    for (; end < source.length; end += 1) {
      const character = source[end];
      if (character === "(") depth += 1;
      if (character !== ")") continue;
      if (depth === 0) {
        end += 1;
        break;
      }
      depth -= 1;
    }

    calls.push(source.slice(start, end));
    searchFrom = end;
  }

  return calls;
}

function extractDirectTimeFrequencies(source: string, variableName: string): number[] {
  const matcher = new RegExp(`\\b${variableName}\\s*\\*\\s*(\\d+(?:\\.\\d+)?)`, "g");
  return [...source.matchAll(matcher)].map((match) => Number(match[1]));
}

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

  it("keeps breathing phase speed stable in long-running orb sessions", () => {
    const period = 8;
    const frameSeconds = 1 / 60;
    const earlyStep =
      resolveStableBreathPhase(frameSeconds, period, 0.05) -
      resolveStableBreathPhase(0, period, 0.05);
    const lateStep =
      resolveStableBreathPhase(600 + frameSeconds, period, -0.05) -
      resolveStableBreathPhase(600, period, -0.05);

    expect(earlyStep).toBeCloseTo(frameSeconds / period, 8);
    expect(lateStep).toBeCloseTo(frameSeconds / period, 8);
  });

  it("integrates one age-independent breath phase across every renderer tier", () => {
    expect(shaderSource).toContain("uniform float uBreathPhase;");
    expect(shaderSource).toContain(
      "float breathBasePhase = u_time > 0.0 ? fract(uTime / breathPeriod) : uBreathPhase;",
    );
    expect(shaderSource).not.toContain("fract(uTime / breathPeriod + breathJitter)");
    expect(webGpuSource).toContain("fn uBreathPhase() -> f32");
    expect(webGpuSource).toContain("fract(uBreathPhase() + breathJitter)");
    expect(workerSource).toContain("uBreathPhase: gl.getUniformLocation");
    expect(workerSource).toContain("gl.uniform1f(loc.uBreathPhase, params.breathPhase)");
    expect(rendererSource).toContain("breathCycleFromPhase(breathPhase + breathJitter)");
  });

  it("applies the canonical atmosphere fade to every glow on both GPU tiers", () => {
    expect(shaderSource).toContain("bloom *= atmosphereFade;");
    expect(webGpuSource).toContain("var bloom = exp(-dist * 5.0) * 0.07 * darkMult;");
    expect(webGpuSource).toContain("bloom *= atmosphereFade;");
  });

  it("keeps non-periodic simplex noise on the exact-period organic clock across GPU tiers", () => {
    const glslNoiseCalls = extractFunctionCalls(shaderSource, "snoise");
    const wgslNoiseCalls = extractFunctionCalls(webGpuSource, "snoise");

    expect(shaderSource).toContain("uniform float uOrganicTime;");
    expect(shaderRendererSource).toContain(
      "uOrganicTime: gl.getUniformLocation(program, 'uOrganicTime')",
    );
    expect(shaderRendererSource).toContain(
      "gl.uniform1f(loc.uOrganicTime, params.organicTime)",
    );
    expect(workerSource).toContain(
      "uOrganicTime: gl.getUniformLocation(program, 'uOrganicTime')",
    );
    expect(workerSource).toContain(
      "gl.uniform1f(loc.uOrganicTime, params.organicTime)",
    );
    expect(webGpuSource).toContain("fn uOrganicTime() -> f32");
    expect(webGpuSource).toContain("uniformData[27 * 4 + 1] = params.organicTime");
    expect(glslNoiseCalls.length).toBeGreaterThan(10);
    expect(wgslNoiseCalls.length).toBeGreaterThan(10);

    for (const call of glslNoiseCalls) {
      expect(call).not.toMatch(/\buTime\b/);
    }
    for (const call of wgslNoiseCalls) {
      expect(call).not.toMatch(/\btime\b/);
    }
  });

  it("wraps the direct trigonometric GPU clock only at a shared full-cycle boundary", () => {
    const glslFrequencies = extractDirectTimeFrequencies(shaderSource, "uTime");
    const wgslFrequencies = extractDirectTimeFrequencies(webGpuSource, "time");
    const frequencies = [...new Set([...glslFrequencies, ...wgslFrequencies])];

    expect(frequencies.length).toBeGreaterThanOrEqual(5);
    expect([...new Set(glslFrequencies)].sort()).toEqual(
      [...new Set(wgslFrequencies)].sort(),
    );
    for (const frequency of frequencies) {
      const cyclesAtWrap = (ORB_SHADER_TIME_WRAP_SECONDS * frequency) / (Math.PI * 2);
      expect(cyclesAtWrap).toBeCloseTo(Math.round(cyclesAtWrap), 8);
    }
  });

  it("routes palette cycles and transitive ray noise through exact-period GPU clocks", () => {
    const palettePeriodSeconds = 250;
    const paletteCycleRates = [0.08, 0.08 * 1.2, 0.02, 0.02 * 0.8];

    expect(shaderSource).toContain("uniform float uPaletteTime;");
    expect(shaderRendererSource).toContain(
      "uPaletteTime: gl.getUniformLocation(program, 'uPaletteTime')",
    );
    expect(shaderRendererSource).toContain(
      "gl.uniform1f(loc.uPaletteTime, params.paletteTime)",
    );
    expect(workerSource).toContain(
      "uPaletteTime: gl.getUniformLocation(program, 'uPaletteTime')",
    );
    expect(workerSource).toContain(
      "gl.uniform1f(loc.uPaletteTime, params.paletteTime)",
    );
    expect(shaderSource).toContain("float iriPhase = uPaletteTime * 0.08;");
    expect(shaderSource).toContain("envAngle + envHeight * 0.3 + uPaletteTime * 0.02");
    expect(shaderSource).toContain(
      "float rayNoiseAngle = angle + uOrganicTime * 0.03;",
    );
    expect(shaderSource).toContain(
      "snoise(vec3(rayNoiseAngle * 2.0, uOrganicTime * 0.2, 5.0))",
    );
    expect(webGpuSource).toContain("fn uPaletteTime() -> f32");
    expect(webGpuSource).toContain("uniformData[27 * 4 + 2] = params.paletteTime");
    expect(webGpuSource).toContain("let iriPhase = uPaletteTime() * 0.08;");
    expect(webGpuSource).toContain("envAngle + envHeight * 0.3 + uPaletteTime() * 0.02");
    expect(webGpuSource).toContain(
      "let rayNoiseAngle = angle + organicTime * 0.03;",
    );
    expect(webGpuSource).toContain(
      "snoise(vec3<f32>(rayNoiseAngle * 2.0, organicTime * 0.2, 5.0))",
    );

    for (const cycleRate of paletteCycleRates) {
      const cyclesAtWrap = palettePeriodSeconds * cycleRate;
      expect(cyclesAtWrap).toBeCloseTo(Math.round(cyclesAtWrap), 8);
    }
  });
});
