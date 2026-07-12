import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SHADER_PATH = path.resolve(
  process.cwd(),
  "src/components/state-of-mind/orbShader.frag",
);
const OUTPUT_DIR = path.resolve(process.cwd(), "output/playwright/orb-shader-clock-wrap");
const SHADER_SOURCE = readFileSync(SHADER_PATH, "utf8");

const CLOCK_CASES = [
  { name: "trigonometric", key: "time", wrap: Math.PI * 6_000 },
  { name: "organic-simplex", key: "organicTime", wrap: 86_700 },
  { name: "palette", key: "paletteTime", wrap: 250 },
] as const;

type ClockValues = {
  time: number;
  organicTime: number;
  paletteTime: number;
};

test("canonical shader is pixel-continuous across every GPU clock wrap", async ({ page }) => {
  const results = await page.evaluate(
    ({ cases, shaderSource }) => {
      const width = 96;
      const height = 96;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const gl = canvas.getContext("webgl2", {
        alpha: true,
        antialias: false,
        depth: false,
        premultipliedAlpha: true,
        preserveDrawingBuffer: true,
        stencil: false,
      });
      if (!gl) throw new Error("WebGL 2 is unavailable for the shader wrap proof");

      const compile = (type: number, source: string) => {
        const shader = gl.createShader(type);
        if (!shader) throw new Error("Unable to allocate WebGL shader");
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          throw new Error(gl.getShaderInfoLog(shader) || "Shader compilation failed");
        }
        return shader;
      };

      const vertexShader = compile(
        gl.VERTEX_SHADER,
        "#version 300 es\nin vec2 aPosition; void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }",
      );
      const fragmentSource300 = shaderSource
        .replace(
          "\n#extension GL_OES_standard_derivatives : enable\nprecision highp float;",
          "#version 300 es\nprecision highp float;\nout vec4 fragColor;",
        )
        .replace("gl_FragColor", "fragColor");
      const fragmentShader = compile(gl.FRAGMENT_SHADER, fragmentSource300);
      const program = gl.createProgram();
      if (!program) throw new Error("Unable to allocate WebGL program");
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || "Shader linking failed");
      }

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW,
      );
      const position = gl.getAttribLocation(program, "aPosition");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.useProgram(program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      const uniform = (name: string) => gl.getUniformLocation(program, name);
      const setCommonUniforms = (clock: ClockValues) => {
        gl.uniform2f(uniform("uResolution"), width, height);
        gl.uniform1f(uniform("uTime"), clock.time);
        gl.uniform1f(uniform("uOrganicTime"), clock.organicTime);
        gl.uniform1f(uniform("uPaletteTime"), clock.paletteTime);
        gl.uniform1f(uniform("uMotionPhase"), 1.3);
        gl.uniform1f(uniform("uNoisePhase"), 2.7);
        gl.uniform1f(uniform("uPulsePhase"), 0.37);
        gl.uniform1f(uniform("uBreathPhase"), 0.41);
        gl.uniform1f(uniform("uValence"), 0.43);
        gl.uniform1f(uniform("uIsDark"), 0);
        gl.uniform3f(uniform("uColor"), 0.91, 0.47, 0.16);
        gl.uniform1f(uniform("uShapeM"), 5);
        gl.uniform1f(uniform("uShapeN1"), 1.62);
        gl.uniform1f(uniform("uShapeN2"), 1.43);
        gl.uniform1f(uniform("uShapeN3"), 1.43);
        gl.uniform1f(uniform("uGenesis"), 1);
        gl.uniform3f(uniform("uTouch"), 0, 0, 0);
        gl.uniform1f(uniform("uShimmer"), 0);
        gl.uniform1f(uniform("u_time"), 0);
        gl.uniform2f(uniform("u_resolution"), 0, 0);
        gl.uniform2f(uniform("u_mouse"), 0, 0);
      };

      const render = (clock: ClockValues) => {
        gl.viewport(0, 0, width, height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        setCommonUniforms(clock);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.finish();
        const pixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return pixels;
      };

      const difference = (left: Uint8Array, right: Uint8Array) => {
        let sum = 0;
        let maximum = 0;
        let changedChannels = 0;
        for (let index = 0; index < left.length; index += 1) {
          const delta = Math.abs(left[index] - right[index]);
          sum += delta;
          maximum = Math.max(maximum, delta);
          if (delta > 1) changedChannels += 1;
        }
        return {
          changedChannelFraction: changedChannels / left.length,
          maxChannelDifference: maximum,
          meanChannelDifference: sum / left.length,
        };
      };

      const base: ClockValues = {
        time: 17.25,
        organicTime: 123.5,
        paletteTime: 47.75,
      };
      const halfStepSeconds = 1 / 60;

      return cases.map((clockCase) => {
        const before = {
          ...base,
          [clockCase.key]: clockCase.wrap - halfStepSeconds,
        };
        const normalizedAfter = {
          ...base,
          [clockCase.key]: halfStepSeconds,
        };
        const unwrappedAfter = {
          ...base,
          [clockCase.key]: clockCase.wrap + halfStepSeconds,
        };
        const beforePixels = render(before);
        const normalizedPixels = render(normalizedAfter);
        const unwrappedPixels = render(unwrappedAfter);

        return {
          name: clockCase.name,
          wrap: clockCase.wrap,
          normalizedVsEquivalentUnwrapped: difference(normalizedPixels, unwrappedPixels),
          wrappedFrameStep: difference(beforePixels, normalizedPixels),
          mathematicallyContinuousFrameStep: difference(beforePixels, unwrappedPixels),
        };
      });
    },
    { cases: CLOCK_CASES, shaderSource: SHADER_SOURCE },
  );

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const report = {
    shaderPath: path.relative(process.cwd(), SHADER_PATH),
    shaderSha256: createHash("sha256").update(SHADER_SOURCE).digest("hex"),
    results,
  };
  writeFileSync(path.join(OUTPUT_DIR, "report.json"), `${JSON.stringify(report, null, 2)}\n`);

  for (const result of results) {
    expect(
      result.normalizedVsEquivalentUnwrapped.meanChannelDifference,
      `${result.name} normalized frame must match its mathematically equivalent unwrapped frame`,
    ).toBeLessThanOrEqual(0.12);
    expect(result.normalizedVsEquivalentUnwrapped.maxChannelDifference).toBeLessThanOrEqual(3);
    expect(result.normalizedVsEquivalentUnwrapped.changedChannelFraction).toBeLessThanOrEqual(0.01);
    expect(
      result.wrappedFrameStep.meanChannelDifference,
      `${result.name} wrap must not create a larger visual step than continuous time`,
    ).toBeLessThanOrEqual(
      result.mathematicallyContinuousFrameStep.meanChannelDifference * 1.25 + 0.08,
    );
  }
});
