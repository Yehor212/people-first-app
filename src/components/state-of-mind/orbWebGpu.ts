/**
 * WebGPU fragment renderer for the canonical ValenceOrb.
 *
 * This is a progressive-enhancement tier above the existing WebGL renderer.
 * Unsupported browsers, denied adapters, or slow pipeline creation return null
 * so ValenceOrb can keep its proven WebGL/WebGL-worker path.
 */

import type { OrbGLBuildOptions, OrbGLBuildResult, OrbGLRenderer } from './orbShader';
import { recordError } from '@/lib/crashReporting';

const UNIFORM_VEC4_COUNT = 32;
const PARTICLE_COUNT = 22;
const WEBGPU_PIPELINE_TIMEOUT_MS = 650;

type WebGPUAny = {
  requestAdapter?: (options?: Record<string, unknown>) => Promise<unknown>;
  getPreferredCanvasFormat?: () => string;
};

type GPUAdapterAny = {
  requestDevice?: () => Promise<GPUDeviceAny>;
};

type GPUDeviceAny = {
  queue: {
    writeBuffer: (buffer: unknown, offset: number, data: ArrayBufferView) => void;
    submit: (commands: unknown[]) => void;
  };
  createShaderModule: (descriptor: Record<string, unknown>) => unknown;
  createRenderPipelineAsync: (descriptor: Record<string, unknown>) => Promise<unknown>;
  createBuffer: (descriptor: Record<string, unknown>) => unknown;
  createBindGroup: (descriptor: Record<string, unknown>) => unknown;
  createCommandEncoder: () => GPUCommandEncoderAny;
  destroy?: () => void;
  lost?: Promise<{ reason?: string; message?: string }>;
};

type GPUCommandEncoderAny = {
  beginRenderPass: (descriptor: Record<string, unknown>) => GPURenderPassEncoderAny;
  finish: () => unknown;
};

type GPURenderPassEncoderAny = {
  setPipeline: (pipeline: unknown) => void;
  setBindGroup: (index: number, bindGroup: unknown) => void;
  draw: (vertexCount: number) => void;
  end: () => void;
};

type GPUCanvasContextAny = {
  configure: (descriptor: Record<string, unknown>) => void;
  getCurrentTexture: () => { createView: () => unknown };
};

const WGSL_SRC = /* wgsl */ `
struct OrbUniforms {
  v: array<vec4<f32>, ${UNIFORM_VEC4_COUNT}>,
};

struct VertexOut {
  @builtin(position) position: vec4<f32>,
};

@group(0) @binding(0) var<uniform> u: OrbUniforms;

fn uResolution() -> vec2<f32> { return u.v[0].xy; }
fn uTime() -> f32 { return u.v[0].z; }
fn uValence() -> f32 { return u.v[0].w; }
fn uIsDark() -> f32 { return u.v[1].x; }
fn uGenesis() -> f32 { return u.v[1].y; }
fn uShimmer() -> f32 { return u.v[1].z; }
fn uColor() -> vec3<f32> { return u.v[2].xyz; }
fn uShape() -> vec4<f32> { return u.v[3]; }
fn uTouch() -> vec3<f32> { return u.v[4].xyz; }
fn uParticle(i: i32) -> vec4<f32> { return u.v[5 + i]; }

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VertexOut;
  out.position = vec4<f32>(positions[vertexIndex], 0.0, 1.0);
  return out;
}

fn mod289v3(x: vec3<f32>) -> vec3<f32> {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn mod289v4(x: vec4<f32>) -> vec4<f32> {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn permute(x: vec4<f32>) -> vec4<f32> {
  return mod289v4((x * 34.0 + vec4<f32>(1.0)) * x);
}

fn taylorInvSqrt(r: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(1.79284291400159) - vec4<f32>(0.85373472095314) * r;
}

fn snoise(v: vec3<f32>) -> f32 {
  let C = vec2<f32>(1.0 / 6.0, 1.0 / 3.0);
  let D = vec4<f32>(0.0, 0.5, 1.0, 2.0);

  var i = floor(v + dot(v, vec3<f32>(C.y)));
  let x0 = v - i + dot(i, vec3<f32>(C.x));

  let g = step(x0.yzx, x0.xyz);
  let l = vec3<f32>(1.0) - g;
  let i1 = min(g, l.zxy);
  let i2 = max(g, l.zxy);

  let x1 = x0 - i1 + vec3<f32>(C.x);
  let x2 = x0 - i2 + vec3<f32>(C.y);
  let x3 = x0 - vec3<f32>(D.y);

  i = mod289v3(i);
  let p = permute(permute(permute(
    i.z + vec4<f32>(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4<f32>(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4<f32>(0.0, i1.x, i2.x, 1.0));

  let n_ = 0.142857142857;
  let ns = n_ * D.wyz - D.xzx;

  let j = p - 49.0 * floor(p * ns.z * ns.z);
  let x_ = floor(j * ns.z);
  let y_ = floor(j - 7.0 * x_);

  let x = x_ * ns.x + vec4<f32>(ns.y);
  let y = y_ * ns.x + vec4<f32>(ns.y);
  let h = vec4<f32>(1.0) - abs(x) - abs(y);

  let b0 = vec4<f32>(x.x, x.y, y.x, y.y);
  let b1 = vec4<f32>(x.z, x.w, y.z, y.w);

  let s0 = floor(b0) * 2.0 + vec4<f32>(1.0);
  let s1 = floor(b1) * 2.0 + vec4<f32>(1.0);
  let sh = -step(h, vec4<f32>(0.0));

  let a0 = vec4<f32>(b0.x, b0.z, b0.y, b0.w) + vec4<f32>(s0.x, s0.z, s0.y, s0.w) * vec4<f32>(sh.x, sh.x, sh.y, sh.y);
  let a1 = vec4<f32>(b1.x, b1.z, b1.y, b1.w) + vec4<f32>(s1.x, s1.z, s1.y, s1.w) * vec4<f32>(sh.z, sh.z, sh.w, sh.w);

  var p0 = vec3<f32>(a0.x, a0.y, h.x);
  var p1 = vec3<f32>(a0.z, a0.w, h.y);
  var p2 = vec3<f32>(a1.x, a1.y, h.z);
  var p3 = vec3<f32>(a1.z, a1.w, h.w);

  let norm = taylorInvSqrt(vec4<f32>(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  var m = max(vec4<f32>(0.6) - vec4<f32>(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), vec4<f32>(0.0));
  m = m * m;
  return 42.0 * dot(m * m, vec4<f32>(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

fn cosinePalette(t: f32, a: vec3<f32>, b: vec3<f32>, c: vec3<f32>, d: vec3<f32>) -> vec3<f32> {
  return a + b * cos(6.2832 * (c * t + d));
}

fn superformula(theta: f32, m: f32, n1: f32, n2: f32, n3: f32) -> f32 {
  let a = m * theta * 0.25;
  let t1 = pow(abs(cos(a)), n2);
  let t2 = pow(abs(sin(a)), n3);
  let sum = t1 + t2;
  if (sum < 0.0000001) {
    return 1.0;
  }
  return pow(sum, -1.0 / n1);
}

fn hueRotate(col: vec3<f32>, angle: f32) -> vec3<f32> {
  let c = cos(angle);
  let s = sin(angle);
  let k = vec3<f32>(0.57735);
  return col * c + cross(k, col) * s + k * dot(k, col) * (1.0 - c);
}

fn glassRim(s: f32, alpha: f32, fw: f32) -> f32 {
  return (smoothstep(fw, 0.0, abs(s)) * 0.65 + exp(-max(s, 0.0) * max(s, 0.0) / (fw * fw * 16.0)) * 0.35) * alpha;
}

fn glassRimWide(s: f32, alpha: f32, soft: f32) -> f32 {
  return (smoothstep(soft, 0.0, abs(s)) * 0.70 + exp(-max(s, 0.0) * max(s, 0.0) / (soft * soft * 10.0)) * 0.30) * alpha;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let resolution = max(uResolution(), vec2<f32>(1.0));
  let time = uTime();
  let valence = clamp(uValence(), -1.0, 1.0);
  let shape = uShape();
  let fragCoord = vec2<f32>(in.position.x, resolution.y - in.position.y);
  let uv = fragCoord / resolution;
  let center = uv - vec2<f32>(0.5);
  let dist = length(center);
  let angle = atan2(center.y, center.x);

  let rotSpeed = mix(0.055, 0.015, (valence + 1.0) * 0.5);
  let rotation = time * rotSpeed;
  let noiseSpeed = mix(0.85, 0.20, (valence + 1.0) * 0.5);
  let noiseAmp = 0.003 + select(abs(valence) * 0.003, abs(valence) * 0.007, valence < 0.0);

  let breathPeriod = mix(8.0, 16.0, (valence + 1.0) * 0.5);
  let breathJitter = snoise(vec3<f32>(time * 0.03, 500.0, 0.0)) * 0.05;
  let breathPhase = fract(time / breathPeriod + breathJitter);
  let breathInhale = smoothstep(0.0, 0.333, breathPhase);
  let breathExhale = 1.0 - smoothstep(0.417, 0.833, breathPhase);
  let breathPause = step(0.833, breathPhase);
  let breathCurve = min(breathInhale, breathExhale) * (1.0 - breathPause);
  let breath = 1.0 + breathCurve * 0.05 - 0.025;

  let rotAngle = angle + rotation;
  let ca = cos(rotAngle);
  let sa = sin(rotAngle);
  let nv1 = snoise(vec3<f32>(ca * 2.5 + time * noiseSpeed, sa * 2.5 + time * noiseSpeed * 0.7, 10.0));
  let nv2 = snoise(vec3<f32>(ca * 5.0 + time * noiseSpeed * 1.3 + 100.0, sa * 5.0 + time * noiseSpeed * 0.9 + 100.0, 10.0));
  let nv3 = snoise(vec3<f32>(ca * 10.0 + time * noiseSpeed * 1.7 + 200.0, sa * 10.0 + time * noiseSpeed * 1.1 + 200.0, 10.0));
  let noiseDisp = (nv1 * 0.55 + nv2 * 0.30 + nv3 * 0.15) * noiseAmp * uGenesis();

  let warpAmp = mix(0.006, 0.003, (valence + 1.0) * 0.5);
  let warp1 = snoise(vec3<f32>(ca * 1.8 + time * noiseSpeed * 0.4, sa * 1.8 + time * noiseSpeed * 0.3, time * 0.05));
  let warp2 = snoise(vec3<f32>(ca * 3.5 + time * noiseSpeed * 0.7 + 50.0, sa * 3.5 + time * noiseSpeed * 0.5 + 50.0, time * 0.08 + 100.0));
  let warpedAngle = rotAngle + (warp1 * 0.65 + warp2 * 0.35) * warpAmp * 6.2832 * uGenesis();

  let stableShapeM = select(shape.x, 3.0, valence < 0.0);
  let mLow = floor(stableShapeM);
  let mHigh = mLow + 1.0;
  let mBlend = smoothstep(0.0, 1.0, fract(stableShapeM));
  let sfLow = superformula(warpedAngle, max(mLow, 3.0), shape.y, shape.z, shape.w);
  let sfHigh = superformula(warpedAngle, max(mHigh, 3.0), shape.y, shape.z, shape.w);
  let sf = mix(sfLow, sfHigh, mBlend);
  let pressure = 1.0 - smoothstep(-1.0, -0.667, valence);
  let baseR = mix(0.25, 0.22, pressure);
  let cleanShapeR = baseR * sf * breath * max(uGenesis(), 0.01);
  let shapeR = cleanShapeR * (1.0 + noiseDisp);
  let sdf = dist - shapeR;

  let fw = max(fwidth(sdf), 0.0008);
  let edgeScale = mix(1.2, 1.8, (valence + 1.0) * 0.5);
  let edge = 1.0 - smoothstep(-fw * edgeScale, fw * edgeScale, sdf);
  let cleanSdfEarly = dist - cleanShapeR;
  let cleanFwEarly = max(fwidth(cleanSdfEarly), 0.0008);
  let cleanEdge = 1.0 - smoothstep(-cleanFwEarly * edgeScale, cleanFwEarly * edgeScale, cleanSdfEarly);

  let normalZ = sqrt(max(0.001, 1.0 - clamp(dist * dist / max(shapeR * shapeR, 0.00001), 0.0, 1.0)));
  let normal = normalize(vec3<f32>(center.x * 2.0, center.y * 2.0, normalZ));
  let lightDir1 = normalize(vec3<f32>(-0.4, 0.4, 1.0));
  let lightDir2 = normalize(vec3<f32>(0.3, -0.25, 0.8));
  let viewDir = vec3<f32>(0.0, 0.0, 1.0);

  let nv = (valence + 1.0) * 0.5;
  let wrapFactor = mix(0.0, 0.12, nv);
  let diff1 = max((dot(normal, lightDir1) + wrapFactor) / (1.0 + wrapFactor), 0.0);
  let diff2 = max((dot(normal, lightDir2) + wrapFactor) / (1.0 + wrapFactor), 0.0) * 0.3;
  let fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.2);
  let fresnelStr = select(0.60, 0.75, uIsDark() > 0.5);
  let sss = max(dot(-normal, lightDir1), 0.0) * 0.22;

  let filmThickness = 0.3 + 0.7 * (1.0 - max(dot(normal, viewDir), 0.0)) + snoise(vec3<f32>(center * 4.0, time * 0.15)) * 0.12;
  let iridescent = cosinePalette(
    filmThickness + time * 0.08,
    vec3<f32>(0.60, 0.50, 0.75),
    vec3<f32>(0.45, 0.40, 0.35),
    vec3<f32>(1.0, 1.0, 1.2),
    vec3<f32>(0.00, 0.15, 0.60)
  );
  let iriMaskBody = 0.3 + 0.7 * smoothstep(0.0, 0.7, fresnel);
  let iriStrength = iriMaskBody * mix(0.20, 0.40, nv);

  let colorFlow1 = snoise(vec3<f32>(center * 1.5 + vec2<f32>(time * 0.06), time * 0.04));
  let colorFlow2 = snoise(vec3<f32>(center * 1.8 - vec2<f32>(time * 0.05), time * 0.03 + 50.0));
  let color2 = hueRotate(uColor(), 0.78 + sin(time * 0.05) * 0.35);
  let color3 = hueRotate(uColor(), -(0.78 + cos(time * 0.07) * 0.35));
  let blend1 = smoothstep(-0.2, 0.5, colorFlow1);
  let blend2 = smoothstep(-0.2, 0.5, colorFlow2);
  let shimmerColor = max(mix(mix(uColor(), color2, blend1 * 0.45), color3, blend2 * 0.35), vec3<f32>(0.0));

  let halfDir = normalize(lightDir1 + viewDir);
  let roughness = mix(0.38, 0.20, nv);
  let ggxA = roughness * roughness;
  let ggxA2 = ggxA * ggxA;
  let NdotH = max(dot(normal, halfDir), 0.0);
  let ggxDenom = NdotH * NdotH * (ggxA2 - 1.0) + 1.0;
  let ggxD = ggxA2 / (3.14159 * ggxDenom * ggxDenom);
  let specF = 0.08 + 0.92 * pow(1.0 - max(dot(halfDir, viewDir), 0.0), 5.0);
  let specular = vec3<f32>(1.0) * ggxD * specF * 0.65;
  let halfDir2 = normalize(lightDir2 + viewDir);
  let NdotH2 = max(dot(normal, halfDir2), 0.0);
  let ggxDenom2 = NdotH2 * NdotH2 * (ggxA2 - 1.0) + 1.0;
  let specular2 = vec3<f32>(1.0) * (ggxA2 / (3.14159 * ggxDenom2 * ggxDenom2)) * specF * 0.45;

  let cSeed = snoise(vec3<f32>(center * 4.0 + vec2<f32>(time * 0.08), time * 0.05));
  let cSeed2 = snoise(vec3<f32>(center * 6.0 - vec2<f32>(time * 0.06), time * 0.04 + 30.0));
  let cPattern = pow(max(0.0, 1.0 - abs(cSeed)), 2.5) + pow(max(0.0, 1.0 - abs(cSeed2)), 3.0) * 0.6;
  let causticColor = mix(vec3<f32>(1.0), shimmerColor, 0.4) * cPattern * mix(0.06, 0.18, nv);

  let depthZone1 = exp(-dist * dist / max(shapeR * shapeR * 0.16, 0.00001)) * 0.14;
  let depthZone2 = exp(-dist * dist / max(shapeR * shapeR * 0.42, 0.00001)) * 0.08;
  let depthPulse = sin(time * 1.2) * 0.09 + 0.91;
  let depthGlow = depthZone1 * depthPulse + depthZone2 * (1.0 - depthPulse * 0.3);
  let ao = mix(smoothstep(0.0, 0.25, normalZ), 1.0, 0.65);
  let surfaceTex = 1.0 + snoise(vec3<f32>(center * 15.0, time * 0.08)) * 0.02;

  let hopeIntensity = (1.0 - nv) * (1.0 - nv);
  let hopeFlicker = pow(max(0.0, snoise(vec3<f32>(center * 3.0, time * 0.8))), 8.0);
  let hopePulse = pow(max(0.0, sin(time * 0.7 + snoise(vec3<f32>(time * 0.15, 0.0, 0.0)) * 3.0)), 4.0);
  let hopeColor = vec3<f32>(1.0, 0.85, 0.6) * hopeFlicker * hopePulse * hopeIntensity * 0.35 * edge;

  let reflected = reflect(-viewDir, normal);
  let envAngle = atan2(reflected.y, reflected.x) * 0.1591 + 0.5;
  let envHeight = reflected.z * 0.5 + 0.5;
  let envColor = cosinePalette(
    envAngle + envHeight * 0.3 + time * 0.02,
    vec3<f32>(0.5, 0.5, 0.6),
    vec3<f32>(0.25, 0.20, 0.30),
    vec3<f32>(1.0, 1.0, 0.8),
    vec3<f32>(0.0, 0.33, 0.67)
  );

  var litColor = (
    shimmerColor * 0.25
    + shimmerColor * (diff1 * 0.62 + diff2 * 0.18)
    + specular
    + specular2
    + mix(shimmerColor, vec3<f32>(1.0), 0.40) * fresnel * fresnelStr
    + shimmerColor * sss
    + iridescent * iriStrength
    + shimmerColor * depthGlow * mix(0.35, 1.0, nv)
    + hopeColor
    + envColor * fresnel * mix(0.08, 0.24, nv)
    + causticColor
  ) * ao * surfaceTex;

  let depthShadowZone = smoothstep(shapeR * 0.85, shapeR * 0.95, dist) * smoothstep(shapeR * 1.00, shapeR * 0.96, dist);
  litColor *= 1.0 - depthShadowZone * 0.08;
  let rimZone = smoothstep(shapeR * 0.70, shapeR * 0.88, dist) * smoothstep(shapeR * 1.01, shapeR * 0.92, dist);
  litColor += mix(shimmerColor * 0.9, vec3<f32>(1.0), 0.55) * rimZone * 0.55 * edge;

  let darkMult = select(1.0, 1.15, uIsDark() > 0.5);
  var innerGlow = exp(-max(sdf, 0.0) * 14.0) * 0.27 * darkMult;
  var aura = exp(-dist * 2.8) * 0.18 * darkMult;
  let bloom = exp(-dist * 5.0) * 0.07 * darkMult;
  let auraLightBoost = select(1.3, 1.0, uIsDark() > 0.5);
  let auraColor = shimmerColor * 1.15 * auraLightBoost;
  let auraEdgeNoise = 0.92 + snoise(vec3<f32>(angle * 2.0, time * 0.1, 0.0)) * 0.08;
  let atmosphereFade = 1.0 - smoothstep(shapeR * 1.6, shapeR * 2.8 * auraEdgeNoise, dist);
  aura *= atmosphereFade;
  innerGlow *= atmosphereFade;

  let rayAngle = angle + time * 0.03;
  let rays = pow(abs(cos(rayAngle * 5.0)), mix(4.0, 12.0, nv)) * 0.6
    + pow(abs(cos(rayAngle * 8.0 + 1.0)), mix(3.0, 8.0, nv)) * 0.3;
  let rayIntensity = rays * exp(-max(sdf, 0.0) * mix(8.0, 4.0, nv))
    * (snoise(vec3<f32>(rayAngle * 2.0, time * 0.2, 5.0)) * 0.3 + 0.7)
    * mix(0.04, 0.14, nv) * darkMult * atmosphereFade;

  var particleGlow = 0.0;
  for (var i = 0; i < ${PARTICLE_COUNT}; i = i + 1) {
    let p = uParticle(i);
    if (p.w > 0.01) {
      let pOff = center - (p.xy - vec2<f32>(0.5));
      let pDist = length(pOff);
      let pRadius = p.z * 3.0;
      let falloff = max(0.0, 1.0 - pDist / pRadius);
      particleGlow += falloff * falloff * p.w * 0.35;
    }
  }
  particleGlow *= atmosphereFade;

  var ripple = 0.0;
  let touch = uTouch();
  if (touch.z > 0.0) {
    let touchUV = touch.xy - vec2<f32>(0.5);
    let touchDist = length(center - touchUV);
    let rippleRadius = touch.z * 0.3;
    let rippleWidth = 0.02 + touch.z * 0.015;
    ripple = exp(-pow((touchDist - rippleRadius) / rippleWidth, 2.0)) * exp(-touch.z * 2.5) * 0.4;
  }

  let lum = dot(litColor, vec3<f32>(0.299, 0.587, 0.114));
  litColor = mix(litColor, vec3<f32>(lum * 1.5 + 0.15), uShimmer() * 0.4);
  litColor += mix(shimmerColor * 1.1, vec3<f32>(1.0), 0.35)
    * exp(-dist * dist / max(shapeR * shapeR * 0.10, 0.00001)) * 0.23;

  let glassDepth = exp(-dist * dist / max(shapeR * shapeR * 0.18, 0.00001)) * 0.65 + 0.05;
  let glassEdge = edge * glassDepth;
  let edgeHighlight = exp(-cleanSdfEarly * cleanSdfEarly / (cleanFwEarly * cleanFwEarly * 20.0)) * 0.92;
  let edgeHLColor = mix(shimmerColor * 1.15, vec3<f32>(1.0), 0.40);

  let ringFw = max(fw * 4.0, 0.008);
  let in1 = glassRim(dist - cleanShapeR * 0.65 * (1.0 + breathCurve * 0.03), 0.40, ringFw) * edge;
  let in2 = glassRim(dist - cleanShapeR * 0.35 * (1.0 + breathCurve * 0.026), 0.30, ringFw) * edge;
  let innerRings = in1 + in2;
  let pulseSpeed = 0.15;
  let ringGap = 1.08;
  let ringTravel = 0.55;
  let wp1 = fract(time * pulseSpeed);
  let wp2 = fract(time * pulseSpeed + 0.333);
  let wp3 = fract(time * pulseSpeed + 0.667);
  let ws1 = ringGap + (1.0 - pow(1.0 - wp1, 3.0)) * ringTravel;
  let ws2 = ringGap + (1.0 - pow(1.0 - wp2, 3.0)) * ringTravel;
  let ws3 = ringGap + (1.0 - pow(1.0 - wp3, 3.0)) * ringTravel;
  let wa1 = smoothstep(0.0, 0.08, wp1) * (1.0 - smoothstep(0.40, 0.72, wp1));
  let wa2 = smoothstep(0.0, 0.08, wp2) * (1.0 - smoothstep(0.40, 0.72, wp2));
  let wa3 = smoothstep(0.0, 0.08, wp3) * (1.0 - smoothstep(0.40, 0.72, wp3));
  let ring1 = glassRimWide(dist - cleanShapeR * ws1, wa1 * 0.48, ringFw * (1.0 + wp1 * 0.5));
  let ring2 = glassRimWide(dist - cleanShapeR * ws2, wa2 * 0.45, ringFw * (1.0 + wp2 * 0.5));
  let ring3 = glassRimWide(dist - cleanShapeR * ws3, wa3 * 0.40, ringFw * (1.0 + wp3 * 0.5));
  let ringPresence = ring1 + ring2 + ring3;
  let localAuraDim = 1.0 - clamp(ringPresence * 4.0, 0.0, 0.50);
  aura *= localAuraDim;
  innerGlow *= localAuraDim;

  let baseColor = litColor * glassEdge
    + edgeHLColor * edgeHighlight * cleanEdge
    + shimmerColor * 1.2 * innerRings
    + auraColor * innerGlow * (1.0 + uShimmer() * 0.8)
    + auraColor * aura * (1.0 + uShimmer() * 0.8)
    + auraColor * rayIntensity
    + vec3<f32>(1.0) * bloom * 0.25
    + (shimmerColor * 1.2 + vec3<f32>(0.15)) * particleGlow
    + shimmerColor * ripple * 2.0;

  var finalAlpha = clamp(glassEdge + edgeHighlight * 0.5 + innerRings * 0.6
    + ring1 + ring2 + ring3 + innerGlow + aura + bloom + particleGlow + rayIntensity + ripple, 0.0, 1.0);
  finalAlpha *= smoothstep(0.0, 0.15, uGenesis());
  finalAlpha *= 1.0 - smoothstep(0.46, 0.56, dist);
  finalAlpha *= smoothstep(0.0, 0.015, finalAlpha);
  if (uIsDark() > 0.5) {
    finalAlpha = min(1.0, finalAlpha * 1.15);
  }

  let tmA = 2.51;
  let tmB = 0.03;
  let tmC = 2.43;
  let tmD = 0.59;
  let tmE = 0.14;
  var finalColor = clamp((baseColor * (tmA * baseColor + vec3<f32>(tmB))) / (baseColor * (tmC * baseColor + vec3<f32>(tmD)) + vec3<f32>(tmE)), vec3<f32>(0.0), vec3<f32>(1.0));
  let tmShimmer = clamp((shimmerColor * (tmA * shimmerColor + vec3<f32>(tmB))) / (shimmerColor * (tmC * shimmerColor + vec3<f32>(tmD)) + vec3<f32>(tmE)), vec3<f32>(0.0), vec3<f32>(1.0));
  finalColor = clamp(finalColor + mix(tmShimmer * 1.15, vec3<f32>(1.0), 0.18) * ringPresence, vec3<f32>(0.0), vec3<f32>(1.0));

  return vec4<f32>(finalColor * finalAlpha, finalAlpha);
}
`;

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hSector = h / 60;
  const x = c * (1 - Math.abs((hSector % 2) - 1));
  const m = ln - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (hSector < 1) { r = c; g = x; }
  else if (hSector < 2) { r = x; g = c; }
  else if (hSector < 3) { g = c; b = x; }
  else if (hSector < 4) { g = x; b = c; }
  else if (hSector < 5) { r = x; b = c; }
  else { r = c; b = x; }

  return [r + m, g + m, b + m];
}

function getNavigatorGpu(): WebGPUAny | null {
  const nav = navigator as Navigator & { gpu?: WebGPUAny };
  return nav.gpu ?? null;
}

function getWebGPUContext(canvas: HTMLCanvasElement): GPUCanvasContextAny | null {
  try {
    return canvas.getContext('webgpu') as GPUCanvasContextAny | null;
  } catch (err) {
    recordError(err, { component: 'ValenceOrb', action: 'webgpu-context' });
    return null;
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  options: OrbGLBuildOptions,
  timeoutMs: number,
): Promise<T | null> {
  if (options.signal?.aborted) return null;

  return await new Promise<T | null>((resolve) => {
    let done = false;
    const timeout = window.setTimeout(() => {
      if (done) return;
      done = true;
      resolve(null);
    }, timeoutMs);

    const abort = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timeout);
      resolve(null);
    };

    options.signal?.addEventListener('abort', abort, { once: true });

    promise.then(
      (value) => {
        if (done) return;
        done = true;
        window.clearTimeout(timeout);
        options.signal?.removeEventListener('abort', abort);
        resolve(value);
      },
      (err) => {
        if (done) return;
        done = true;
        window.clearTimeout(timeout);
        options.signal?.removeEventListener('abort', abort);
        recordError(err, { component: 'ValenceOrb', action: 'webgpu-build' });
        resolve(null);
      },
    );
  });
}

export async function createOrbWebGPUAsync(
  canvas: HTMLCanvasElement,
  options: OrbGLBuildOptions = {},
): Promise<OrbGLBuildResult | null> {
  const started = performance.now();
  const gpu = getNavigatorGpu();
  const context = getWebGPUContext(canvas);
  if (!gpu?.requestAdapter || !context) return null;

  try {
    const adapter = await withTimeout(
      gpu.requestAdapter({ powerPreference: 'low-power' }),
      options,
      options.timeoutMs ?? WEBGPU_PIPELINE_TIMEOUT_MS,
    ) as GPUAdapterAny | null;
    if (!adapter?.requestDevice || options.signal?.aborted) return null;

    const device = await withTimeout(
      adapter.requestDevice(),
      options,
      options.timeoutMs ?? WEBGPU_PIPELINE_TIMEOUT_MS,
    );
    if (!device || options.signal?.aborted) return null;

    const format = gpu.getPreferredCanvasFormat?.() ?? 'bgra8unorm';
    context.configure({
      device,
      format,
      alphaMode: 'premultiplied',
    });

    const shaderModule = device.createShaderModule({
      label: 'zenflow-valence-orb-webgpu-shader',
      code: WGSL_SRC,
    });

    const pipeline = await withTimeout(
      device.createRenderPipelineAsync({
        label: 'zenflow-valence-orb-webgpu-pipeline',
        layout: 'auto',
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main',
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_main',
          targets: [
            {
              format,
              blend: {
                color: {
                  srcFactor: 'one',
                  dstFactor: 'one-minus-src-alpha',
                  operation: 'add',
                },
                alpha: {
                  srcFactor: 'one',
                  dstFactor: 'one-minus-src-alpha',
                  operation: 'add',
                },
              },
            },
          ],
        },
        primitive: {
          topology: 'triangle-list',
        },
      }),
      options,
      options.timeoutMs ?? WEBGPU_PIPELINE_TIMEOUT_MS,
    );

    if (!pipeline || options.signal?.aborted) {
      device.destroy?.();
      return null;
    }

    const uniformData = new Float32Array(UNIFORM_VEC4_COUNT * 4);
    const uniformBuffer = device.createBuffer({
      label: 'zenflow-valence-orb-webgpu-uniforms',
      size: uniformData.byteLength,
      usage: 0x0040 | 0x0008, // GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    const bindGroup = device.createBindGroup({
      label: 'zenflow-valence-orb-webgpu-bind-group',
      layout: (pipeline as { getBindGroupLayout: (index: number) => unknown }).getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: uniformBuffer },
        },
      ],
    });

    let deviceLost = false;
    device.lost?.then((info) => {
      deviceLost = true;
      if (info?.reason === 'destroyed') {
        return;
      }
      recordError(
        new Error(`WebGPU device lost: ${info?.reason ?? 'unknown'} ${info?.message ?? ''}`.trim()),
        { component: 'ValenceOrb', action: 'webgpu-device-lost' },
      );
    }).catch(() => {
      deviceLost = true;
    });

    const renderer: OrbGLRenderer = {
      render(params) {
        if (deviceLost) return;

        const width = params.size * params.dpr;
        const height = params.size * params.dpr;
        uniformData[0] = width;
        uniformData[1] = height;
        uniformData[2] = params.time;
        uniformData[3] = params.valence;
        uniformData[4] = params.isDark ? 1 : 0;
        uniformData[5] = params.genesis;
        uniformData[6] = params.shimmer;
        uniformData[7] = params.dpr;

        const [r, g, b] = hslToRgb(params.color.h, params.color.s, params.color.l);
        uniformData[8] = r;
        uniformData[9] = g;
        uniformData[10] = b;
        uniformData[11] = 0;

        uniformData[12] = params.shape.m;
        uniformData[13] = params.shape.n1;
        uniformData[14] = params.shape.n2;
        uniformData[15] = params.shape.n3;

        uniformData[16] = params.touch.x;
        uniformData[17] = params.touch.y;
        uniformData[18] = params.touch.age;
        uniformData[19] = 0;

        for (let i = 0; i < PARTICLE_COUNT; i += 1) {
          const offset = (5 + i) * 4;
          const particle = params.particles[i];
          if (particle) {
            uniformData[offset] = particle.x / params.size;
            uniformData[offset + 1] = 1.0 - particle.y / params.size;
            uniformData[offset + 2] = particle.radius / params.size;
            uniformData[offset + 3] = particle.alpha;
          } else {
            uniformData[offset] = 0;
            uniformData[offset + 1] = 0;
            uniformData[offset + 2] = 0;
            uniformData[offset + 3] = 0;
          }
        }

        device.queue.writeBuffer(uniformBuffer, 0, uniformData);
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: context.getCurrentTexture().createView(),
              loadOp: 'clear',
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              storeOp: 'store',
            },
          ],
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(3);
        pass.end();
        device.queue.submit([encoder.finish()]);
      },
      dispose() {
        deviceLost = true;
        device.destroy?.();
      },
      isContextLost() {
        return deviceLost;
      },
    };

    return {
      renderer,
      durationMs: performance.now() - started,
      tier: 'webgpu',
    };
  } catch (err) {
    recordError(err, { component: 'ValenceOrb', action: 'createOrbWebGPUAsync' });
    return null;
  }
}
