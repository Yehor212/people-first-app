import { readFileSync } from "node:fs";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/platform", () => ({ isAndroid: true }));

import { DayCosmicBackground } from "../DayCosmicBackground";
import { calculateAndroidDayAmbiencePhases } from "../AndroidDayLargeEffects";
import {
  ANDROID_DAY_AMBIENCE_FRAGMENT_SHADER,
  ANDROID_DAY_PARTICLE_FRAGMENT_SHADER,
  ANDROID_DAY_THREAD_FRAGMENT_SHADER,
} from "../androidDayAmbienceShaders";

describe("Android DayCosmicBackground compositor isolation", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.style.removeProperty("--background");
    document.documentElement.style.removeProperty("--card");
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("computes the canonical ambience phases once per frame instead of once per pixel", () => {
    const cosineEase = (phase: number) =>
      0.5 - 0.5 * Math.cos(Math.min(1, Math.max(0, phase)) * Math.PI);
    const keyedOscillation = (seconds: number, duration: number, peak: number) => {
      const phase = (seconds % duration) / duration;
      return phase <= peak ? cosineEase(phase / peak) : cosineEase(1 - (phase - peak) / (1 - peak));
    };
    const timeSeconds = 9.36;

    expect(calculateAndroidDayAmbiencePhases(timeSeconds)).toEqual([
      keyedOscillation(timeSeconds, 18, 0.52),
      keyedOscillation(timeSeconds, 19, 0.46),
      keyedOscillation(timeSeconds, 13, 0.44),
      keyedOscillation(timeSeconds, 16, 0.5),
    ]);
    expect(ANDROID_DAY_AMBIENCE_FRAGMENT_SHADER).toContain("uniform vec4 uAmbiencePhases;");
    expect(ANDROID_DAY_AMBIENCE_FRAGMENT_SHADER).not.toContain("uniform float uTime;");
    expect(ANDROID_DAY_AMBIENCE_FRAGMENT_SHADER).not.toContain("keyedOscillation");
    expect(ANDROID_DAY_AMBIENCE_FRAGMENT_SHADER).toContain("if (curtainMask > 0.0)");
    expect(ANDROID_DAY_AMBIENCE_FRAGMENT_SHADER).toContain("if (showerMask > 0.0)");
    expect(ANDROID_DAY_AMBIENCE_FRAGMENT_SHADER).toContain("if (prismDistance < 0.105)");
    expect(ANDROID_DAY_AMBIENCE_FRAGMENT_SHADER).toContain("if (causticMask > 0.0)");
  });

  it("keeps benchmark phase sampling off the per-frame DOM mutation path", () => {
    const source = readFileSync("src/pages/nav-v2/useAndroidDayLargeEffects.ts", "utf8");

    expect(source).not.toContain("canvas.dataset.androidDayPhaseMs");
    expect(source).toContain("snapshot: () => ({");
    expect(source).toContain("elapsedMs,");
  });

  it("removes the inactive retained daylight surface from layout and composition", () => {
    const css = readFileSync("src/pages/nav-v2/DayCosmicBackground.css", "utf8");
    const inactiveSurfaceRule = css.match(
      /\.day-cosmic\[data-android-day-active="false"\],[\s\S]*?\{([\s\S]*?)\}/
    )?.[1];

    expect(inactiveSurfaceRule).toContain("display: none");
    expect(inactiveSurfaceRule).not.toContain("visibility: hidden");
  });

  it("does not publish renderer readiness for a zero-size Android viewport", () => {
    const source = readFileSync("src/pages/nav-v2/useAndroidDayLargeEffects.ts", "utf8");

    expect(source).toContain("const resize = (): boolean =>");
    expect(source).toContain("if (cssWidth <= 0 || cssHeight <= 0");
    expect(source).toContain("showPending();");
    expect(source).toMatch(/if \(!resize\(\)\) \{\s*showPending\(\);\s*return;/);
    expect(source).toContain("draw(ownerWindow.performance.now());\n      showReady();");
  });

  it("starts the Android renderer only after the parent background ref is attached", () => {
    document.documentElement.style.setProperty("--background", "174 41% 86%");
    document.documentElement.style.setProperty("--card", "158 42% 90%");
    const animationFrames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    const cancelAnimationFrame = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(360);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(800);
    const loseContext = vi.fn();
    const gl = {
      ARRAY_BUFFER: 0x8892,
      BLEND: 0x0be2,
      CLAMP_TO_EDGE: 0x812f,
      COLOR_ATTACHMENT0: 0x8ce0,
      COLOR_BUFFER_BIT: 0x4000,
      COMPILE_STATUS: 0x8b81,
      FLOAT: 0x1406,
      FRAMEBUFFER: 0x8d40,
      FRAMEBUFFER_COMPLETE: 0x8cd5,
      FRAGMENT_SHADER: 0x8b30,
      LINEAR: 0x2601,
      LINK_STATUS: 0x8b82,
      MAX_RENDERBUFFER_SIZE: 0x84e8,
      ONE: 1,
      ONE_MINUS_SRC_ALPHA: 0x0303,
      RGBA: 0x1908,
      STATIC_DRAW: 0x88e4,
      TEXTURE0: 0x84c0,
      TEXTURE_2D: 0x0de1,
      TEXTURE_MAG_FILTER: 0x2800,
      TEXTURE_MIN_FILTER: 0x2801,
      TEXTURE_WRAP_S: 0x2802,
      TEXTURE_WRAP_T: 0x2803,
      TRIANGLES: 0x0004,
      UNSIGNED_BYTE: 0x1401,
      VERTEX_SHADER: 0x8b31,
      activeTexture: vi.fn(),
      attachShader: vi.fn(),
      bindBuffer: vi.fn(),
      bindFramebuffer: vi.fn(),
      bindTexture: vi.fn(),
      bindVertexArray: vi.fn(),
      blendFunc: vi.fn(),
      bufferData: vi.fn(),
      checkFramebufferStatus: vi.fn(() => 0x8cd5),
      clear: vi.fn(),
      clearColor: vi.fn(),
      compileShader: vi.fn(),
      createBuffer: vi.fn(() => ({})),
      createFramebuffer: vi.fn(() => ({})),
      createProgram: vi.fn(() => ({})),
      createShader: vi.fn(() => ({})),
      createTexture: vi.fn(() => ({})),
      createVertexArray: vi.fn(() => ({})),
      deleteBuffer: vi.fn(),
      deleteFramebuffer: vi.fn(),
      deleteProgram: vi.fn(),
      deleteShader: vi.fn(),
      deleteTexture: vi.fn(),
      deleteVertexArray: vi.fn(),
      disable: vi.fn(),
      drawArrays: vi.fn(),
      drawArraysInstanced: vi.fn(),
      enable: vi.fn(),
      enableVertexAttribArray: vi.fn(),
      framebufferTexture2D: vi.fn(),
      getProgramInfoLog: vi.fn(() => ""),
      getProgramParameter: vi.fn(() => true),
      getParameter: vi.fn(() => 16384),
      getExtension: vi.fn((name: string) =>
        name === "WEBGL_lose_context" ? { loseContext } : null
      ),
      getShaderInfoLog: vi.fn(() => ""),
      getShaderParameter: vi.fn(() => true),
      getUniformLocation: vi.fn(() => ({})),
      linkProgram: vi.fn(),
      shaderSource: vi.fn(),
      texImage2D: vi.fn(),
      texParameteri: vi.fn(),
      uniform1i: vi.fn(),
      uniform1f: vi.fn(),
      uniform2f: vi.fn(),
      uniform3f: vi.fn(),
      uniform4f: vi.fn(),
      useProgram: vi.fn(),
      vertexAttribDivisor: vi.fn(),
      vertexAttribPointer: vi.fn(),
      viewport: vi.fn(),
    };
    vi.stubGlobal("WebGL2RenderingContext", class WebGL2RenderingContext {});
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(gl as never);

    const { container, rerender, unmount } = render(<DayCosmicBackground active motionEnabled />);

    expect(getContext).toHaveBeenCalledWith(
      "webgl2",
      expect.objectContaining({
        failIfMajorPerformanceCaveat: true,
        preserveDrawingBuffer: false,
      })
    );
    expect(screen.getByTestId("day-cosmic-background")).toHaveAttribute(
      "data-android-day-ambience",
      "ready"
    );
    expect(screen.getByTestId("android-day-webgl-large-effects")).toHaveAttribute(
      "data-android-day-pixels",
      "360x800"
    );
    expect(screen.queryByTestId("day-cosmic-light-curtain")).not.toBeInTheDocument();
    expect(screen.queryByTestId("day-cosmic-sun-shower")).not.toBeInTheDocument();
    expect(screen.queryByTestId("day-cosmic-prism-ribbon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("day-cosmic-caustics")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".day-cosmic__photon")).toHaveLength(0);
    expect(container.querySelectorAll(".day-cosmic__mote")).toHaveLength(0);
    expect(container.querySelectorAll(".day-cosmic__sun-thread")).toHaveLength(0);
    expect(gl.drawArrays).toHaveBeenCalledWith(gl.TRIANGLES, 0, 3);
    expect(gl.drawArraysInstanced).toHaveBeenCalledWith(gl.TRIANGLES, 0, 6, 18);
    expect(gl.drawArraysInstanced).toHaveBeenCalledWith(gl.TRIANGLES, 0, 6, 113);
    expect(gl.createFramebuffer).not.toHaveBeenCalled();
    expect(loseContext).not.toHaveBeenCalled();

    const uniformLookupCountAfterSetup = gl.getUniformLocation.mock.calls.length;
    const uniformWriteCountAfterSetup =
      gl.uniform1f.mock.calls.length +
      gl.uniform2f.mock.calls.length +
      gl.uniform3f.mock.calls.length +
      gl.uniform4f.mock.calls.length;
    expect(uniformLookupCountAfterSetup).toBeGreaterThan(0);
    act(() => animationFrames.shift()?.(16.67));
    expect(gl.getUniformLocation).toHaveBeenCalledTimes(uniformLookupCountAfterSetup);
    expect(
      gl.uniform1f.mock.calls.length +
        gl.uniform2f.mock.calls.length +
        gl.uniform3f.mock.calls.length +
        gl.uniform4f.mock.calls.length
    ).toBe(uniformWriteCountAfterSetup + 3);

    const canvas = screen.getByTestId("android-day-webgl-large-effects");
    const programCountAfterSetup = gl.createProgram.mock.calls.length;
    rerender(<DayCosmicBackground active={false} motionEnabled />);
    expect(screen.getByTestId("android-day-webgl-large-effects")).toBe(canvas);
    expect(canvas).toHaveAttribute("data-android-day-active", "false");
    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(gl.deleteProgram).not.toHaveBeenCalled();

    rerender(<DayCosmicBackground active motionEnabled />);
    expect(screen.getByTestId("android-day-webgl-large-effects")).toBe(canvas);
    expect(canvas).toHaveAttribute("data-android-day-active", "true");
    expect(gl.createProgram).toHaveBeenCalledTimes(programCountAfterSetup);

    act(() => {
      canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    });
    expect(screen.getByTestId("day-cosmic-background")).toHaveAttribute(
      "data-android-day-ambience",
      "fallback"
    );
    expect(container.querySelectorAll(".day-cosmic__photon")).toHaveLength(78);
    expect(container.querySelectorAll(".day-cosmic__mote")).toHaveLength(35);
    expect(container.querySelectorAll(".day-cosmic__sun-thread")).toHaveLength(18);

    act(() => {
      canvas.dispatchEvent(new Event("webglcontextrestored"));
    });
    expect(screen.getByTestId("day-cosmic-background")).toHaveAttribute(
      "data-android-day-ambience",
      "ready"
    );
    expect(container.querySelectorAll(".day-cosmic__photon")).toHaveLength(0);
    expect(container.querySelectorAll(".day-cosmic__mote")).toHaveLength(0);
    expect(container.querySelectorAll(".day-cosmic__sun-thread")).toHaveLength(0);

    unmount();
    expect(loseContext).not.toHaveBeenCalled();
    expect(gl.deleteBuffer).toHaveBeenCalledTimes(4);
    expect(gl.deleteProgram).toHaveBeenCalledTimes(3);
    expect(gl.deleteShader).toHaveBeenCalledTimes(6);
    expect(gl.deleteVertexArray).toHaveBeenCalledTimes(2);
  });

  it("keeps the canonical DOM fallback while one Android renderer owns every dynamic ambience layer", () => {
    const { container } = render(<DayCosmicBackground motionEnabled />);

    expect(screen.getByTestId("day-cosmic-background")).toHaveAttribute(
      "data-android-day-ambience",
      "fallback"
    );
    expect(screen.getByTestId("android-day-webgl-large-effects")).toBeInTheDocument();
    expect(
      screen.queryByTestId("day-cosmic-android-animated-surface-host")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-light-curtain")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-sun-shower")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-prism-ribbon")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-caustics")).toBeInTheDocument();
    expect(container.querySelectorAll(".day-cosmic__photon")).toHaveLength(78);
    expect(container.querySelectorAll(".day-cosmic__mote")).toHaveLength(35);
    expect(container.querySelectorAll(".day-cosmic__sun-thread")).toHaveLength(18);
    expect(screen.getByTestId("android-day-webgl-large-effects")).toHaveAttribute(
      "data-android-day-motion-model",
      "large:4;photons:78;motes:35;threads:18"
    );
  });

  it("keeps the animated daylight canvas outside the contained paint tree", () => {
    render(<DayCosmicBackground motionEnabled />);

    expect(screen.queryByTestId("android-day-static-color-group")).not.toBeInTheDocument();
    const background = screen.getByTestId("day-cosmic-background");
    const canvas = screen.getByTestId("android-day-webgl-large-effects");
    expect(background).not.toContainElement(canvas);
    expect(background.nextElementSibling).toBe(canvas);

    const css = readFileSync("src/pages/nav-v2/DayCosmicBackground.css", "utf8");
    expect(css).toMatch(
      /\.day-cosmic\[data-android-day-ambience="ready"\]\s*\+ \.day-cosmic__android-large-effects/
    );
    const indexCss = readFileSync("src/index.css", "utf8");
    expect(indexCss).toMatch(
      /\.v2-readable-page--ambient::before[\s\S]*?-webkit-backdrop-filter: saturate\(0\.94\) contrast\(0\.98\)[\s\S]*?backdrop-filter: saturate\(0\.94\) contrast\(0\.98\)/
    );
    expect(indexCss).toMatch(
      /:root\[data-platform="android"\]\[data-theme="paper"\][\s\S]*?body\.android-day-orb-opaque-surface[\s\S]*?\.v2-readable-page--ambient::before\s*\{\s*display:\s*none\s*!important;/
    );
    expect(css).not.toContain("backdrop-filter: none");
    expect(css).not.toContain("background: transparent");
    expect(css).not.toMatch(/\.orb-day-scope\.v2-readable-page--ambient:has\([\s\S]*?\)::after/);

    expect(css).not.toMatch(/cosmic-orb-flourish-layer[\s\S]*?filter:/);

    for (const shader of [
      ANDROID_DAY_AMBIENCE_FRAGMENT_SHADER,
      ANDROID_DAY_PARTICLE_FRAGMENT_SHADER,
      ANDROID_DAY_THREAD_FRAGMENT_SHADER,
    ]) {
      expect(shader).not.toContain("applyReadableColorMatrix");
      expect(shader).not.toContain("invertReadableFilter");
      expect(shader).toContain(
        "return vec4(clamp(treatedDynamic, 0.0, 1.0) * dynamicScene.a, dynamicScene.a);"
      );
    }
  });

  it("reconstructs the canonical readable veil in every existing dynamic pass", () => {
    for (const shader of [
      ANDROID_DAY_AMBIENCE_FRAGMENT_SHADER,
      ANDROID_DAY_PARTICLE_FRAGMENT_SHADER,
      ANDROID_DAY_THREAD_FRAGMENT_SHADER,
    ]) {
      expect(shader).toContain("uniform vec3 uVeilBackground;");
      expect(shader).toContain("uniform vec3 uVeilCard;");
      expect(shader).toContain("vec4 correctReadableDynamic(vec4 dynamicScene, vec2 cssUv)");
      expect(shader).toContain("veilPremultiplied + filteredDynamic * (1.0 - veilAlpha)");
      expect(shader).toContain("outColor = correctReadableDynamic(");
    }
  });

  it("keeps reduced motion and Settings on the canonical CSS renderer", () => {
    const reducedMotion = render(<DayCosmicBackground motionEnabled={false} />);
    expect(reducedMotion.queryByTestId("android-day-webgl-large-effects")).not.toBeInTheDocument();
    reducedMotion.unmount();

    render(<DayCosmicBackground presentation="settings" motionEnabled />);
    expect(screen.queryByTestId("android-day-webgl-large-effects")).not.toBeInTheDocument();
  });

  it("releases the fully occluded global paper grain only for the Android Orb lifecycle", () => {
    expect(document.body).not.toHaveClass("android-day-orb-opaque-surface");

    const orb = render(<DayCosmicBackground motionEnabled={false} />);
    expect(document.body).toHaveClass("android-day-orb-opaque-surface");

    orb.unmount();
    expect(document.body).not.toHaveClass("android-day-orb-opaque-surface");

    const settings = render(<DayCosmicBackground presentation="settings" motionEnabled={false} />);
    expect(document.body).not.toHaveClass("android-day-orb-opaque-surface");

    settings.unmount();
    expect(document.body).not.toHaveClass("android-day-orb-opaque-surface");
  });
});
