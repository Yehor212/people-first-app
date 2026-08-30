import { useLayoutEffect, useRef, type RefObject } from "react";
import { logger } from "@/lib/logger";
import {
  ANDROID_DAY_AMBIENCE_FRAGMENT_SHADER,
  ANDROID_DAY_AMBIENCE_VERTEX_SHADER,
  ANDROID_DAY_PARTICLE_FRAGMENT_SHADER,
  ANDROID_DAY_PARTICLE_VERTEX_SHADER,
  ANDROID_DAY_THREAD_FRAGMENT_SHADER,
  ANDROID_DAY_THREAD_VERTEX_SHADER,
} from "./androidDayAmbienceShaders";
import {
  ANDROID_DAY_MOTION_MODEL_LABEL,
  DAY_COSMIC_MOTES,
  DAY_COSMIC_PHOTONS,
  DAY_COSMIC_SUN_THREADS,
  type DayPhotonTone,
} from "./dayCosmicMotionModel";

export const ANDROID_DAY_LARGE_EFFECT_TEST_IDS = [
  "day-cosmic-light-curtain",
  "day-cosmic-sun-shower",
  "day-cosmic-prism-ribbon",
  "day-cosmic-caustics",
] as const;

export {
  ANDROID_DAY_AMBIENCE_FRAGMENT_SHADER as ANDROID_DAY_LARGE_EFFECT_FRAGMENT_SHADER,
  ANDROID_DAY_AMBIENCE_VERTEX_SHADER as ANDROID_DAY_LARGE_EFFECT_VERTEX_SHADER,
};

type DayMode = "dawn" | "morning" | "afternoon" | "golden" | "dusk";
type Rgb = readonly [number, number, number];
type Rgba = readonly [number, number, number, number];

interface DayAmbiencePalette {
  body: Rgb;
  energy: Rgb;
  focus: Rgb;
  mind: Rgb;
  mote: Rgba;
  prism: Rgb;
  release: Rgb;
  thread: Rgba;
  trace: Rgb;
  warm: Rgb;
}

interface AndroidDayLargeEffectsActivityController {
  setActive: (active: boolean) => void;
}

interface ProgramResources {
  fragmentShader: WebGLShader;
  program: WebGLProgram;
  vertexShader: WebGLShader;
}

interface InstancedPassResources extends ProgramResources {
  instanceBuffer: WebGLBuffer;
  instanceCount: number;
  quadBuffer: WebGLBuffer;
  vertexArray: WebGLVertexArrayObject;
}

interface RendererResources {
  ambience: ProgramResources;
  particles: InstancedPassResources;
  threads: InstancedPassResources;
}

const uniformLocations = new WeakMap<WebGLProgram, Map<string, WebGLUniformLocation | null>>();

function resolveUniformLocation(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string
): WebGLUniformLocation | null {
  let programLocations = uniformLocations.get(program);
  if (!programLocations) {
    programLocations = new Map();
    uniformLocations.set(program, programLocations);
  }
  if (!programLocations.has(name)) {
    programLocations.set(name, gl.getUniformLocation(program, name));
  }
  return programLocations.get(name) ?? null;
}

interface AndroidDayMotionProbe {
  setPhaseMs: (phaseMs: number | null) => void;
  snapshot: () => {
    elapsedMs: number;
    fixedPhaseMs: number | null;
    model: string;
    running: boolean;
  };
}

declare global {
  interface Window {
    __zenAndroidDayMotionProbe?: AndroidDayMotionProbe;
  }
}

const ANDROID_MOTION_BENCHMARK_ENABLED =
  typeof __ANDROID_MOTION_BENCHMARK__ !== "undefined" && __ANDROID_MOTION_BENCHMARK__;

const PHOTON_TONE_INDEX: Record<DayPhotonTone, number> = {
  aqua: 0,
  gold: 1,
  mint: 2,
  iris: 3,
  rose: 4,
};

const QUAD_CORNERS = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
const THREAD_QUAD_CORNERS = new Float32Array([-1, 0, 1, 0, -1, 1, -1, 1, 1, 0, 1, 1]);

function cosineEase(phase: number): number {
  return 0.5 - 0.5 * Math.cos(Math.min(1, Math.max(0, phase)) * Math.PI);
}

function keyedOscillation(seconds: number, duration: number, peak: number): number {
  const phase = (seconds % duration) / duration;
  return phase <= peak ? cosineEase(phase / peak) : cosineEase(1 - (phase - peak) / (1 - peak));
}

export function calculateAndroidDayAmbiencePhases(timeSeconds: number): Rgba {
  return [
    keyedOscillation(timeSeconds, 18, 0.52),
    keyedOscillation(timeSeconds, 19, 0.46),
    keyedOscillation(timeSeconds, 13, 0.44),
    keyedOscillation(timeSeconds, 16, 0.5),
  ];
}

function hslToRgb(hue: number, saturation: number, lightness: number): Rgb {
  const normalizedHue = (((hue % 360) + 360) % 360) / 360;
  const normalizedSaturation = saturation / 100;
  const normalizedLightness = lightness / 100;
  if (normalizedSaturation === 0) {
    return [normalizedLightness, normalizedLightness, normalizedLightness];
  }
  const q =
    normalizedLightness < 0.5
      ? normalizedLightness * (1 + normalizedSaturation)
      : normalizedLightness + normalizedSaturation - normalizedLightness * normalizedSaturation;
  const p = 2 * normalizedLightness - q;
  const channel = (offset: number) => {
    let value = normalizedHue + offset;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };
  return [channel(1 / 3), channel(0), channel(-1 / 3)];
}

function resolveThemeHslColor(
  ownerWindow: Window,
  root: HTMLElement,
  customProperty: "--background" | "--card"
): Rgb {
  const value = ownerWindow
    .getComputedStyle(root.ownerDocument.documentElement)
    .getPropertyValue(customProperty)
    .trim();
  const match = value.match(
    /^(-?(?:\d+\.?\d*|\.\d+))\s+(-?(?:\d+\.?\d*|\.\d+))%\s+(-?(?:\d+\.?\d*|\.\d+))%$/
  );
  if (!match) {
    throw new Error(
      `Android daylight cannot resolve ${customProperty} from ${JSON.stringify(value)}`
    );
  }
  return hslToRgb(Number(match[1]), Number(match[2]), Number(match[3]));
}

const BODY = hslToRgb(158, 62, 44);
const MIND = hslToRgb(268, 58, 58);
const FOCUS = hslToRgb(195, 84, 48);
const ENERGY = hslToRgb(35, 74, 58);
const RELEASE = hslToRgb(334, 68, 58);
const TRACE = hslToRgb(190, 76, 46);
const rgba = (rgb: Rgb, alpha: number): Rgba => [rgb[0], rgb[1], rgb[2], alpha];

const DAY_AMBIENCE_PALETTES: Record<DayMode, DayAmbiencePalette> = {
  dawn: {
    warm: hslToRgb(58, 100, 92),
    focus: FOCUS,
    body: BODY,
    prism: RELEASE,
    mind: MIND,
    release: RELEASE,
    energy: ENERGY,
    trace: TRACE,
    mote: rgba(RELEASE, 0.34),
    thread: rgba(hslToRgb(34, 100, 88), 0.64),
  },
  morning: {
    warm: hslToRgb(58, 100, 92),
    focus: FOCUS,
    body: BODY,
    prism: MIND,
    mind: MIND,
    release: RELEASE,
    energy: ENERGY,
    trace: TRACE,
    mote: rgba(FOCUS, 0.36),
    thread: rgba(hslToRgb(58, 100, 92), 0.64),
  },
  afternoon: {
    warm: hslToRgb(54, 100, 92),
    focus: FOCUS,
    body: BODY,
    prism: RELEASE,
    mind: MIND,
    release: RELEASE,
    energy: ENERGY,
    trace: TRACE,
    mote: rgba(FOCUS, 0.38),
    thread: rgba(hslToRgb(54, 100, 92), 0.62),
  },
  golden: {
    warm: hslToRgb(42, 100, 86),
    focus: FOCUS,
    body: BODY,
    prism: RELEASE,
    mind: MIND,
    release: RELEASE,
    energy: ENERGY,
    trace: TRACE,
    mote: rgba(ENERGY, 0.36),
    thread: rgba(hslToRgb(42, 100, 86), 0.68),
  },
  dusk: {
    warm: hslToRgb(44, 92, 82),
    focus: FOCUS,
    body: BODY,
    prism: MIND,
    mind: MIND,
    release: RELEASE,
    energy: ENERGY,
    trace: TRACE,
    mote: rgba(MIND, 0.34),
    thread: rgba(hslToRgb(44, 92, 82), 0.46),
  },
};

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Android daylight shader allocation failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "unknown shader error";
    gl.deleteShader(shader);
    throw new Error(`Android daylight shader compilation failed: ${message}`);
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string
): ProgramResources {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error("Android daylight program allocation failed");
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "unknown program error";
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error(`Android daylight program link failed: ${message}`);
  }
  return { fragmentShader, program, vertexShader };
}

function deleteProgram(gl: WebGL2RenderingContext, resources: ProgramResources | null): void {
  if (!resources) return;
  gl.deleteProgram(resources.program);
  gl.deleteShader(resources.vertexShader);
  gl.deleteShader(resources.fragmentShader);
}

function createInstancedPass(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
  corners: Float32Array,
  instances: Float32Array
): InstancedPassResources {
  const resources = createProgram(gl, vertexSource, fragmentSource);
  const vertexArray = gl.createVertexArray();
  const quadBuffer = gl.createBuffer();
  const instanceBuffer = gl.createBuffer();
  if (!vertexArray || !quadBuffer || !instanceBuffer) {
    if (vertexArray) gl.deleteVertexArray(vertexArray);
    if (quadBuffer) gl.deleteBuffer(quadBuffer);
    if (instanceBuffer) gl.deleteBuffer(instanceBuffer);
    deleteProgram(gl, resources);
    throw new Error("Android daylight instanced buffer allocation failed");
  }

  gl.bindVertexArray(vertexArray);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, instances, gl.STATIC_DRAW);
  const stride = 8 * Float32Array.BYTES_PER_ELEMENT;
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0);
  gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 4 * Float32Array.BYTES_PER_ELEMENT);
  gl.vertexAttribDivisor(2, 1);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return {
    ...resources,
    instanceBuffer,
    instanceCount: instances.length / 8,
    quadBuffer,
    vertexArray,
  };
}

function particleInstanceData(): Float32Array {
  const values: number[] = [];
  for (const photon of DAY_COSMIC_PHOTONS) {
    values.push(
      photon.x,
      photon.y,
      photon.size,
      photon.opacity,
      photon.duration,
      photon.delay,
      photon.drift,
      PHOTON_TONE_INDEX[photon.tone]
    );
  }
  for (const mote of DAY_COSMIC_MOTES) {
    values.push(mote.x, mote.y, mote.size, mote.opacity, mote.duration, mote.delay, 0, 5);
  }
  return new Float32Array(values);
}

function threadInstanceData(): Float32Array {
  const values: number[] = [];
  for (const thread of DAY_COSMIC_SUN_THREADS) {
    values.push(
      thread.x,
      thread.y,
      thread.length,
      thread.width,
      thread.opacity,
      thread.duration,
      thread.delay,
      thread.tilt
    );
  }
  return new Float32Array(values);
}

function deleteInstancedPass(
  gl: WebGL2RenderingContext,
  resources: InstancedPassResources | null
): void {
  if (!resources) return;
  gl.deleteBuffer(resources.instanceBuffer);
  gl.deleteBuffer(resources.quadBuffer);
  gl.deleteVertexArray(resources.vertexArray);
  deleteProgram(gl, resources);
}

function createRenderer(gl: WebGL2RenderingContext): RendererResources {
  const ambience = createProgram(
    gl,
    ANDROID_DAY_AMBIENCE_VERTEX_SHADER,
    ANDROID_DAY_AMBIENCE_FRAGMENT_SHADER
  );
  try {
    const particles = createInstancedPass(
      gl,
      ANDROID_DAY_PARTICLE_VERTEX_SHADER,
      ANDROID_DAY_PARTICLE_FRAGMENT_SHADER,
      QUAD_CORNERS,
      particleInstanceData()
    );
    try {
      const threads = createInstancedPass(
        gl,
        ANDROID_DAY_THREAD_VERTEX_SHADER,
        ANDROID_DAY_THREAD_FRAGMENT_SHADER,
        THREAD_QUAD_CORNERS,
        threadInstanceData()
      );
      return { ambience, particles, threads };
    } catch (error) {
      deleteInstancedPass(gl, particles);
      throw error;
    }
  } catch (error) {
    deleteProgram(gl, ambience);
    throw error;
  }
}

function deleteRenderer(gl: WebGL2RenderingContext, renderer: RendererResources | null): void {
  if (!renderer) return;
  deleteProgram(gl, renderer.ambience);
  deleteInstancedPass(gl, renderer.particles);
  deleteInstancedPass(gl, renderer.threads);
}

function resolveDayMode(root: HTMLElement): DayMode {
  const value = root.dataset.daymode;
  return value === "dawn" ||
    value === "morning" ||
    value === "afternoon" ||
    value === "golden" ||
    value === "dusk"
    ? value
    : "afternoon";
}

function setUniform1f(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
  value: number
): void {
  const location = resolveUniformLocation(gl, program, name);
  if (location !== null) gl.uniform1f(location, value);
}

function setUniform2f(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
  first: number,
  second: number
): void {
  const location = resolveUniformLocation(gl, program, name);
  if (location !== null) gl.uniform2f(location, first, second);
}

function setUniform3f(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
  value: Rgb
): void {
  const location = resolveUniformLocation(gl, program, name);
  if (location !== null) gl.uniform3f(location, value[0], value[1], value[2]);
}

function setUniform4f(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
  value: Rgba
): void {
  const location = resolveUniformLocation(gl, program, name);
  if (location !== null) gl.uniform4f(location, value[0], value[1], value[2], value[3]);
}

function motionProbeAllowed(ownerWindow: Window): boolean {
  return (
    ANDROID_MOTION_BENCHMARK_ENABLED &&
    ownerWindow.location.protocol === "https:" &&
    ownerWindow.location.hostname === "localhost"
  );
}

export function useAndroidDayLargeEffects(
  enabled: boolean,
  active: boolean,
  rootRef: RefObject<HTMLDivElement>,
  canvasRef: RefObject<HTMLCanvasElement>,
  onFallbackRequired: (required: boolean) => void
): void {
  const activeRef = useRef(active);
  const activityControllerRef = useRef<AndroidDayLargeEffectsActivityController | null>(null);

  useLayoutEffect(() => {
    activeRef.current = active;
    activityControllerRef.current?.setActive(active);
  }, [active]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!enabled || !root || !canvas) return;

    const ownerWindow = root.ownerDocument.defaultView;
    const showFallback = () => {
      root.dataset.androidDayAmbience = "fallback";
      onFallbackRequired(true);
    };
    const showReady = () => {
      root.dataset.androidDayAmbience = "ready";
      onFallbackRequired(false);
    };
    const showPending = () => {
      root.dataset.androidDayAmbience = "pending";
    };
    if (!ownerWindow || typeof ownerWindow.WebGL2RenderingContext === "undefined") {
      showFallback();
      return;
    }

    let disposed = false;
    let elapsedMs = 0;
    let fixedPhaseMs: number | null = null;
    let lastFrameTime: number | null = null;
    let rafId: number | null = null;
    let renderer: RendererResources | null = null;
    let gl: WebGL2RenderingContext | null = null;
    let probe: AndroidDayMotionProbe | null = null;
    let appliedDayMode: DayMode | null = null;
    let staticUniformsDirty = true;
    let viewport = { cssHeight: 0, cssWidth: 0, dpr: 1 };

    const stopLoop = () => {
      if (rafId !== null) ownerWindow.cancelAnimationFrame(rafId);
      rafId = null;
      lastFrameTime = null;
    };

    const clearReadyState = () => {
      showFallback();
    };

    const resize = (): boolean => {
      if (!gl || !renderer) return false;
      const cssWidth = root.clientWidth;
      const cssHeight = root.clientHeight;
      const dpr = ownerWindow.devicePixelRatio;
      if (cssWidth <= 0 || cssHeight <= 0 || !Number.isFinite(dpr) || dpr <= 0) return false;
      const pixelWidth = Math.round(cssWidth * dpr);
      const pixelHeight = Math.round(cssHeight * dpr);
      const maxRenderbufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number;
      if (pixelWidth > maxRenderbufferSize || pixelHeight > maxRenderbufferSize) {
        throw new Error(
          `Android daylight viewport ${pixelWidth}x${pixelHeight} exceeds WebGL ${maxRenderbufferSize}`
        );
      }
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      canvas.dataset.androidDayPixels = `${pixelWidth}x${pixelHeight}`;
      viewport = { cssHeight, cssWidth, dpr };
      staticUniformsDirty = true;
      gl.viewport(0, 0, pixelWidth, pixelHeight);
      return true;
    };

    const drawPass = (pass: InstancedPassResources, timeSeconds: number) => {
      if (!gl) return;
      gl.useProgram(pass.program);
      setUniform1f(gl, pass.program, "uTime", timeSeconds);
      gl.bindVertexArray(pass.vertexArray);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, pass.instanceCount);
    };

    const applyStaticUniforms = (dayMode: DayMode) => {
      if (!gl || !renderer) return;
      const { cssHeight, cssWidth, dpr } = viewport;
      const palette = DAY_AMBIENCE_PALETTES[dayMode];

      gl.useProgram(renderer.ambience.program);
      setUniform1f(gl, renderer.ambience.program, "uAspect", cssWidth / cssHeight);
      setUniform3f(gl, renderer.ambience.program, "uWarm", palette.warm);
      setUniform3f(gl, renderer.ambience.program, "uFocus", palette.focus);
      setUniform3f(gl, renderer.ambience.program, "uBody", palette.body);
      setUniform3f(gl, renderer.ambience.program, "uPrism", palette.prism);

      gl.useProgram(renderer.threads.program);
      setUniform2f(gl, renderer.threads.program, "uViewport", cssWidth, cssHeight);
      setUniform4f(gl, renderer.threads.program, "uThread", palette.thread);
      setUniform3f(gl, renderer.threads.program, "uBody", palette.body);
      setUniform3f(gl, renderer.threads.program, "uWarm", palette.warm);

      gl.useProgram(renderer.particles.program);
      setUniform2f(gl, renderer.particles.program, "uViewport", cssWidth, cssHeight);
      setUniform1f(gl, renderer.particles.program, "uDpr", dpr);
      setUniform3f(gl, renderer.particles.program, "uBody", palette.body);
      setUniform3f(gl, renderer.particles.program, "uEnergy", palette.energy);
      setUniform3f(gl, renderer.particles.program, "uFocus", palette.focus);
      setUniform3f(gl, renderer.particles.program, "uMind", palette.mind);
      setUniform3f(gl, renderer.particles.program, "uRelease", palette.release);
      setUniform3f(gl, renderer.particles.program, "uTrace", palette.trace);
      setUniform4f(gl, renderer.particles.program, "uMote", palette.mote);

      const veilBackground = resolveThemeHslColor(ownerWindow, root, "--background");
      const veilCard = resolveThemeHslColor(ownerWindow, root, "--card");
      for (const program of [
        renderer.ambience.program,
        renderer.threads.program,
        renderer.particles.program,
      ]) {
        gl.useProgram(program);
        setUniform3f(gl, program, "uVeilBackground", veilBackground);
        setUniform3f(gl, program, "uVeilCard", veilCard);
      }

      appliedDayMode = dayMode;
      staticUniformsDirty = false;
    };

    const draw = (frameTime: number) => {
      if (disposed || !gl || !renderer) return;
      if (fixedPhaseMs !== null) elapsedMs = fixedPhaseMs;
      else if (lastFrameTime !== null) elapsedMs += Math.max(0, frameTime - lastFrameTime);
      lastFrameTime = frameTime;
      const timeSeconds = elapsedMs / 1000;
      const dayMode = resolveDayMode(root);
      if (staticUniformsDirty || appliedDayMode !== dayMode) {
        applyStaticUniforms(dayMode);
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindVertexArray(null);
      gl.useProgram(renderer.ambience.program);
      setUniform4f(
        gl,
        renderer.ambience.program,
        "uAmbiencePhases",
        calculateAndroidDayAmbiencePhases(timeSeconds)
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      drawPass(renderer.threads, timeSeconds);
      drawPass(renderer.particles, timeSeconds);
      gl.bindVertexArray(null);
    };

    const loop = (frameTime: number) => {
      rafId = null;
      if (disposed || !activeRef.current || root.ownerDocument.hidden || fixedPhaseMs !== null) {
        return;
      }
      draw(frameTime);
      rafId = ownerWindow.requestAnimationFrame(loop);
    };

    const startLoop = () => {
      if (
        disposed ||
        !activeRef.current ||
        rafId !== null ||
        root.ownerDocument.hidden ||
        fixedPhaseMs !== null
      ) {
        return;
      }
      lastFrameTime = null;
      rafId = ownerWindow.requestAnimationFrame(loop);
    };

    const configureProbe = () => {
      if (probe || !motionProbeAllowed(ownerWindow)) return;
      probe = {
        setPhaseMs: (phaseMs) => {
          if (phaseMs === null) {
            fixedPhaseMs = null;
            startLoop();
            return;
          }
          if (!Number.isFinite(phaseMs) || phaseMs < 0) {
            throw new Error("Android day motion phase must be a finite non-negative value");
          }
          fixedPhaseMs = phaseMs;
          stopLoop();
          draw(ownerWindow.performance.now());
        },
        snapshot: () => ({
          elapsedMs,
          fixedPhaseMs,
          model: ANDROID_DAY_MOTION_MODEL_LABEL,
          running: rafId !== null,
        }),
      };
      ownerWindow.__zenAndroidDayMotionProbe = probe;
    };

    const presentRenderer = () => {
      if (!resize()) {
        showPending();
        return;
      }
      draw(ownerWindow.performance.now());
      showReady();
      configureProbe();
      startLoop();
    };

    const configureRenderer = () => {
      gl = canvas.getContext("webgl2", {
        alpha: true,
        antialias: false,
        depth: false,
        failIfMajorPerformanceCaveat: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        stencil: false,
      });
      if (!gl) throw new Error("Android daylight WebGL2 context is unavailable");
      renderer = createRenderer(gl);
      appliedDayMode = null;
      staticUniformsDirty = true;
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      presentRenderer();
    };

    const handleVisibility = () => {
      if (root.ownerDocument.hidden || !activeRef.current) stopLoop();
      else if (gl && renderer) presentRenderer();
    };
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      stopLoop();
      clearReadyState();
      renderer = null;
      gl = null;
    };
    const handleContextRestored = () => {
      if (disposed) return;
      try {
        configureRenderer();
      } catch (error) {
        clearReadyState();
        logger.warn("[android-day-effects] CSS fallback kept after context restore failure", error);
      }
    };
    const handleResize = () => {
      try {
        presentRenderer();
      } catch (error) {
        stopLoop();
        clearReadyState();
        logger.warn("[android-day-effects] CSS fallback kept after resize failure", error);
      }
    };

    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);
    root.ownerDocument.addEventListener("visibilitychange", handleVisibility);
    const ResizeObserverConstructor = ownerWindow.ResizeObserver;
    const resizeObserver = ResizeObserverConstructor
      ? new ResizeObserverConstructor(handleResize)
      : null;
    resizeObserver?.observe(root);
    ownerWindow.addEventListener("resize", handleResize);

    try {
      configureRenderer();
    } catch (error) {
      clearReadyState();
      logger.warn("[android-day-effects] CSS fallback kept because WebGL setup failed", error);
    }

    const activityController: AndroidDayLargeEffectsActivityController = {
      setActive: (nextActive) => {
        activeRef.current = nextActive;
        if (!nextActive) {
          stopLoop();
          return;
        }
        if (!gl || !renderer) return;
        staticUniformsDirty = true;
        try {
          presentRenderer();
        } catch (error) {
          stopLoop();
          clearReadyState();
          logger.warn("[android-day-effects] CSS fallback kept after activation failure", error);
        }
      },
    };
    activityControllerRef.current = activityController;
    activityController.setActive(activeRef.current);

    return () => {
      disposed = true;
      if (activityControllerRef.current === activityController) {
        activityControllerRef.current = null;
      }
      stopLoop();
      resizeObserver?.disconnect();
      ownerWindow.removeEventListener("resize", handleResize);
      root.ownerDocument.removeEventListener("visibilitychange", handleVisibility);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      if (probe && ownerWindow.__zenAndroidDayMotionProbe === probe) {
        delete ownerWindow.__zenAndroidDayMotionProbe;
      }
      if (gl) deleteRenderer(gl, renderer);
      renderer = null;
      gl = null;
      root.dataset.androidDayAmbience = "fallback";
    };
  }, [canvasRef, enabled, onFallbackRequired, rootRef]);
}
