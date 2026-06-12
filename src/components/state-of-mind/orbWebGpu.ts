/**
 * WebGPU renderer for the canonical ValenceOrb.
 *
 * This is a progressive enhancement tier above WebGL. If WebGPU is unavailable,
 * slow to initialize, or the shader/pipeline fails validation, ValenceOrb keeps
 * using the established WebGL worker/main-thread path.
 */

import { recordError } from '@/lib/crashReporting';
import type { Particle } from './particleSystem';

export interface OrbWebGpuRenderer {
  render: (params: {
    valence: number;
    time: number;
    size: number;
    dpr: number;
    isDark: boolean;
    color: { h: number; s: number; l: number };
    shape: { m: number; n1: number; n2: number; n3: number };
    particles: Particle[];
    genesis: number;
    touch: { x: number; y: number; age: number };
    shimmer: number;
  }) => void;
  dispose: () => void;
  isContextLost: () => boolean;
}

export interface OrbWebGpuBuildOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface OrbWebGpuBuildResult {
  renderer: OrbWebGpuRenderer;
  durationMs: number;
  tier: 'webgpu';
}

const PARTICLE_COUNT = 22;
const UNIFORM_FLOATS = 5 * 4 + PARTICLE_COUNT * 4;
const UNIFORM_BUFFER_BYTES = UNIFORM_FLOATS * Float32Array.BYTES_PER_ELEMENT;
const DEFAULT_WEBGPU_BUILD_TIMEOUT_MS = 900;

type WebGpuCanvasElement = HTMLCanvasElement & {
  getContext(contextId: 'webgpu'): GPUCanvasContext | null;
};

const ORB_WEBGPU_WGSL = /* wgsl */ `
struct OrbUniforms {
  meta0: vec4<f32>,
  meta1: vec4<f32>,
  color: vec4<f32>,
  shape: vec4<f32>,
  touch: vec4<f32>,
  particles: array<vec4<f32>, 22>,
};

@group(0) @binding(0) var<uniform> u: OrbUniforms;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
};

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0),
  );

  var output: VertexOutput;
  output.position = vec4<f32>(positions[vertexIndex], 0.0, 1.0);
  return output;
}

fn saturate(v: f32) -> f32 {
  return clamp(v, 0.0, 1.0);
}

fn smoothstepCompat(edge0: f32, edge1: f32, x: f32) -> f32 {
  let t = saturate((x - edge0) / (edge1 - edge0));
  return t * t * (3.0 - 2.0 * t);
}

fn mod1(x: f32, y: f32) -> f32 {
  return x - floor(x / y) * y;
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

  let j = p - vec4<f32>(49.0) * floor(p * ns.z * ns.z);
  let x_ = floor(j * ns.z);
  let y_ = floor(j - vec4<f32>(7.0) * x_);

  let x = x_ * ns.x + vec4<f32>(ns.y);
  let y = y_ * ns.x + vec4<f32>(ns.y);
  let h = vec4<f32>(1.0) - abs(x) - abs(y);

  let b0 = vec4<f32>(x.x, x.y, y.x, y.y);
  let b1 = vec4<f32>(x.z, x.w, y.z, y.w);

  let s0 = floor(b0) * vec4<f32>(2.0) + vec4<f32>(1.0);
  let s1 = floor(b1) * vec4<f32>(2.0) + vec4<f32>(1.0);
  let sh = -step(h, vec4<f32>(0.0));

  let a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  let a1 = b1.xzyw + s1.xzyw * sh.zzww;

  var p0 = vec3<f32>(a0.xy, h.x);
  var p1 = vec3<f32>(a0.zw, h.y);
  var p2 = vec3<f32>(a1.xy, h.z);
  var p3 = vec3<f32>(a1.zw, h.w);

  let norm = taylorInvSqrt(vec4<f32>(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 = p0 * norm.x;
  p1 = p1 * norm.y;
  p2 = p2 * norm.z;
  p3 = p3 * norm.w;

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

fn glassRim(s: f32, alpha: f32, ringFw: f32) -> f32 {
  return (
    smoothstepCompat(ringFw, 0.0, abs(s)) * 0.65 +
    exp(-max(s, 0.0) * max(s, 0.0) / (ringFw * ringFw * 16.0)) * 0.35
  ) * alpha;
}

fn glassRimWide(s: f32, alpha: f32, soft: f32) -> f32 {
  return (
    smoothstepCompat(soft, 0.0, abs(s)) * 0.70 +
    exp(-max(s, 0.0) * max(s, 0.0) / (soft * soft * 10.0)) * 0.30
  ) * alpha;
}

@fragment
fn fragmentMain(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
  let resolution = max(u.meta0.xy, vec2<f32>(1.0));
  let uTime = u.meta0.z;
  let uValence = u.meta0.w;
  let uIsDark = u.meta1.x;
  let uGenesis = u.meta1.y;
  let uShimmer = u.meta1.z;
  let uColor = u.color.rgb;
  let uShapeM = u.shape.x;
  let uShapeN1 = u.shape.y;
  let uShapeN2 = u.shape.z;
  let uShapeN3 = u.shape.w;
  let uTouch = u.touch.xyz;

  let uv = fragCoord.xy / resolution;
  let center = uv - vec2<f32>(0.5);
  let dist = length(center);
  let angle = atan2(center.y, center.x);

  let rotSpeed = mix(0.055, 0.015, (uValence + 1.0) * 0.5);
  let rotation = uTime * rotSpeed;
  let noiseSpeed = mix(0.85, 0.20, (uValence + 1.0) * 0.5);
  let noiseAmp = 0.003 + select(abs(uValence) * 0.003, abs(uValence) * 0.007, uValence < 0.0);

  let breathPeriod = mix(8.0, 16.0, (uValence + 1.0) * 0.5);
  let breathJitter = snoise(vec3<f32>(uTime * 0.03, 500.0, 0.0)) * 0.05;
  let breathPhase = fract(uTime / breathPeriod + breathJitter);
  let breathInhale = smoothstepCompat(0.0, 0.333, breathPhase);
  let breathExhale = 1.0 - smoothstepCompat(0.417, 0.833, breathPhase);
  let breathPause = step(0.833, breathPhase);
  let breathCurve = min(breathInhale, breathExhale) * (1.0 - breathPause);
  let breath = 1.0 + breathCurve * 0.05 - 0.025;

  let rotAngle = angle + rotation;
  let ca = cos(rotAngle);
  let sa = sin(rotAngle);
  let nv1 = snoise(vec3<f32>(
    ca * 2.5 + uTime * noiseSpeed,
    sa * 2.5 + uTime * noiseSpeed * 0.7,
    10.0,
  ));
  let nv2 = snoise(vec3<f32>(
    ca * 5.0 + uTime * noiseSpeed * 1.3 + 100.0,
    sa * 5.0 + uTime * noiseSpeed * 0.9 + 100.0,
    10.0,
  ));
  let nv3 = snoise(vec3<f32>(
    ca * 10.0 + uTime * noiseSpeed * 1.7 + 200.0,
    sa * 10.0 + uTime * noiseSpeed * 1.1 + 200.0,
    10.0,
  ));
  let noiseDisp = (nv1 * 0.55 + nv2 * 0.30 + nv3 * 0.15) * noiseAmp * uGenesis;

  let warpAmp = mix(0.006, 0.003, (uValence + 1.0) * 0.5);
  let warp1 = snoise(vec3<f32>(
    ca * 1.8 + uTime * noiseSpeed * 0.4,
    sa * 1.8 + uTime * noiseSpeed * 0.3,
    uTime * 0.05,
  ));
  let warp2 = snoise(vec3<f32>(
    ca * 3.5 + uTime * noiseSpeed * 0.7 + 50.0,
    sa * 3.5 + uTime * noiseSpeed * 0.5 + 50.0,
    uTime * 0.08 + 100.0,
  ));
  let warpedAngle = rotAngle + (warp1 * 0.65 + warp2 * 0.35) * warpAmp * 6.2832 * uGenesis;

  let stableShapeM = select(uShapeM, 3.0, uValence < 0.0);
  let mLow = floor(stableShapeM);
  let mHigh = mLow + 1.0;
  let mBlend = smoothstepCompat(0.0, 1.0, fract(stableShapeM));
  let sfLow = superformula(warpedAngle, max(mLow, 3.0), uShapeN1, uShapeN2, uShapeN3);
  let sfHigh = superformula(warpedAngle, max(mHigh, 3.0), uShapeN1, uShapeN2, uShapeN3);
  let sf = mix(sfLow, sfHigh, mBlend);
  let pressure = 1.0 - smoothstepCompat(-1.0, -0.667, uValence);
  let baseR = mix(0.25, 0.22, pressure);
  let cleanShapeR = baseR * sf * breath * max(uGenesis, 0.01);
  let shapeR = cleanShapeR * (1.0 + noiseDisp);

  let sdf = dist - shapeR;
  let fw = max(fwidth(sdf), 0.0005);
  let edgeScale = mix(1.2, 1.8, (uValence + 1.0) * 0.5);
  let edge = 1.0 - smoothstepCompat(-fw * edgeScale, fw * edgeScale, sdf);

  let cleanSdfEarly = dist - cleanShapeR;
  let cleanFwEarly = max(fwidth(cleanSdfEarly), 0.0005);
  let cleanEdge = 1.0 - smoothstepCompat(-cleanFwEarly * edgeScale, cleanFwEarly * edgeScale, cleanSdfEarly);

  let normalZ = sqrt(max(0.001, 1.0 - clamp(dist * dist / (shapeR * shapeR), 0.0, 1.0)));
  let normal = normalize(vec3<f32>(center * 2.0, normalZ));
  let lightDir1 = normalize(vec3<f32>(-0.4, 0.4, 1.0));
  let lightDir2 = normalize(vec3<f32>(0.3, -0.25, 0.8));
  let viewDir = vec3<f32>(0.0, 0.0, 1.0);
  let wrapFactor = mix(0.0, 0.12, (uValence + 1.0) * 0.5);
  let diff1 = max((dot(normal, lightDir1) + wrapFactor) / (1.0 + wrapFactor), 0.0);
  let diff2 = max((dot(normal, lightDir2) + wrapFactor) / (1.0 + wrapFactor), 0.0) * 0.3;
  let fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.2);
  let fresnelStr = select(0.60, 0.75, uIsDark > 0.5);
  let sss = max(dot(-normal, lightDir1), 0.0) * 0.22;

  var filmThickness = 0.3 + 0.7 * (1.0 - max(dot(normal, viewDir), 0.0));
  filmThickness = filmThickness + snoise(vec3<f32>(center * 4.0, uTime * 0.15)) * 0.12;
  let iridescent = cosinePalette(
    filmThickness + uTime * 0.08,
    vec3<f32>(0.60, 0.50, 0.75),
    vec3<f32>(0.45, 0.40, 0.35),
    vec3<f32>(1.0, 1.0, 1.2),
    vec3<f32>(0.00, 0.15, 0.60),
  );
  let iriMaskBody = 0.3 + 0.7 * smoothstepCompat(0.0, 0.7, fresnel);
  let iriStrength = iriMaskBody * mix(0.20, 0.40, (uValence + 1.0) * 0.5);

  let nv = (uValence + 1.0) * 0.5;
  let colorFlow1 = snoise(vec3<f32>(center * 1.5 + vec2<f32>(uTime * 0.06), uTime * 0.04));
  let colorFlow2 = snoise(vec3<f32>(center * 1.8 - vec2<f32>(uTime * 0.05), uTime * 0.03 + 50.0));
  let hueShift1 = 0.78 + sin(uTime * 0.05) * 0.35;
  let hueShift2 = -(0.78 + cos(uTime * 0.07) * 0.35);
  let color2 = hueRotate(uColor, hueShift1);
  let color3 = hueRotate(uColor, hueShift2);
  let blend1 = smoothstepCompat(-0.2, 0.5, colorFlow1);
  let blend2 = smoothstepCompat(-0.2, 0.5, colorFlow2);
  let shimmerColor = max(mix(mix(uColor, color2, blend1 * 0.45), color3, blend2 * 0.35), vec3<f32>(0.0));

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
  let ggxD2 = ggxA2 / (3.14159 * ggxDenom2 * ggxDenom2);
  let specular2 = vec3<f32>(1.0) * ggxD2 * specF * 0.45;

  let cSeed = snoise(vec3<f32>(center * 4.0 + vec2<f32>(uTime * 0.08), uTime * 0.05));
  let cSeed2 = snoise(vec3<f32>(center * 6.0 - vec2<f32>(uTime * 0.06), uTime * 0.04 + 30.0));
  let cPattern = pow(max(0.0, 1.0 - abs(cSeed)), 2.5)
    + pow(max(0.0, 1.0 - abs(cSeed2)), 3.0) * 0.6;
  let cStr = mix(0.06, 0.18, nv);
  let causticTint = mix(vec3<f32>(1.0), shimmerColor, 0.4);
  let causticColor = causticTint * cPattern * cStr;

  let depthZone1 = exp(-dist * dist / (shapeR * shapeR * 0.16)) * 0.14;
  let depthZone2 = exp(-dist * dist / (shapeR * shapeR * 0.42)) * 0.08;
  let depthPulse = sin(uTime * 1.2) * 0.09 + 0.91;
  let depthGlow = depthZone1 * depthPulse + depthZone2 * (1.0 - depthPulse * 0.3);
  let depthStr = mix(0.35, 1.0, (uValence + 1.0) * 0.5);
  var ao = smoothstepCompat(0.0, 0.25, normalZ);
  ao = mix(ao, 1.0, 0.65);
  let texNoise = snoise(vec3<f32>(center * 15.0, uTime * 0.08));
  let surfaceTex = 1.0 + texNoise * 0.02;
  let hopeIntensity = (1.0 - nv) * (1.0 - nv);
  let hopeFlicker = pow(max(0.0, snoise(vec3<f32>(center * 3.0, uTime * 0.8))), 8.0);
  let hopePulse = pow(max(0.0, sin(uTime * 0.7 + snoise(vec3<f32>(uTime * 0.15, 0.0, 0.0)) * 3.0)), 4.0);
  let hopeGlow = hopeFlicker * hopePulse * hopeIntensity * 0.35;
  let hopeColor = vec3<f32>(1.0, 0.85, 0.6) * hopeGlow * edge;

  let reflected = reflect(-viewDir, normal);
  let envAngle = atan2(reflected.y, reflected.x) * 0.1591 + 0.5;
  let envHeight = reflected.z * 0.5 + 0.5;
  let envColor = cosinePalette(
    envAngle + envHeight * 0.3 + uTime * 0.02,
    vec3<f32>(0.5, 0.5, 0.6),
    vec3<f32>(0.25, 0.20, 0.30),
    vec3<f32>(1.0, 1.0, 0.8),
    vec3<f32>(0.0, 0.33, 0.67),
  );
  let envStr = fresnel * mix(0.08, 0.24, nv);

  let ambient = shimmerColor * 0.25;
  let diffuse = shimmerColor * (diff1 * 0.62 + diff2 * 0.18);
  let rim = mix(shimmerColor, vec3<f32>(1.0), 0.40) * fresnel * fresnelStr;
  let subsurface = shimmerColor * sss;
  let depthColor = shimmerColor * depthGlow * depthStr;
  var litColor = (ambient + diffuse + specular + specular2 + rim + subsurface
    + iridescent * iriStrength + depthColor + hopeColor
    + envColor * envStr + causticColor) * ao * surfaceTex;

  let depthShadowZone = smoothstepCompat(shapeR * 0.85, shapeR * 0.95, dist)
    * smoothstepCompat(shapeR * 1.00, shapeR * 0.96, dist);
  litColor = litColor * (1.0 - depthShadowZone * 0.08);

  let rimZone = smoothstepCompat(shapeR * 0.70, shapeR * 0.88, dist)
    * smoothstepCompat(shapeR * 1.01, shapeR * 0.92, dist);
  let glassRimGlow = rimZone * 0.55;
  let rimGlowColor = mix(shimmerColor * 0.9, vec3<f32>(1.0), 0.55);
  litColor = litColor + rimGlowColor * glassRimGlow * edge;

  let darkMult = select(1.0, 1.15, uIsDark > 0.5);
  var innerGlow = exp(-max(sdf, 0.0) * 14.0) * 0.27 * darkMult;
  var aura = exp(-dist * 2.8) * 0.18 * darkMult;
  let bloom = exp(-dist * 5.0) * 0.07 * darkMult;
  let auraLightBoost = select(1.3, 1.0, uIsDark > 0.5);
  let auraColor = shimmerColor * 1.15 * auraLightBoost;
  let auraEdgeNoise = 0.92 + snoise(vec3<f32>(angle * 2.0, uTime * 0.1, 0.0)) * 0.08;
  let atmosphereFade = 1.0 - smoothstepCompat(shapeR * 1.6, shapeR * 2.8 * auraEdgeNoise, dist);
  aura = aura * atmosphereFade;
  innerGlow = innerGlow * atmosphereFade;
  let bloomFaded = bloom * atmosphereFade;

  let rayAngle = angle + uTime * 0.03;
  let raySharpHi = mix(4.0, 12.0, nv);
  let raySharpLo = mix(3.0, 8.0, nv);
  let rays = pow(abs(cos(rayAngle * 5.0)), raySharpHi) * 0.6
    + pow(abs(cos(rayAngle * 8.0 + 1.0)), raySharpLo) * 0.3;
  let rayDecay = mix(8.0, 4.0, nv);
  let rayFalloff = exp(-max(sdf, 0.0) * rayDecay);
  let rayNoise = snoise(vec3<f32>(rayAngle * 2.0, uTime * 0.2, 5.0)) * 0.3 + 0.7;
  let rayStr = mix(0.04, 0.14, nv) * darkMult;
  let rayIntensity = rays * rayFalloff * rayNoise * rayStr * atmosphereFade;

  var particleGlow = 0.0;
  for (var i = 0; i < 22; i = i + 1) {
    let p = u.particles[i];
    if (p.w > 0.01) {
      let pOff = center - (p.xy - vec2<f32>(0.5));
      let pDist = length(pOff);
      let pRadius = p.z * 3.0;
      let falloff = max(0.0, 1.0 - pDist / pRadius);
      particleGlow = particleGlow + falloff * falloff * p.w * 0.35;
    }
  }
  particleGlow = particleGlow * atmosphereFade;

  var ripple = 0.0;
  if (uTouch.z > 0.0) {
    let touchUV = uTouch.xy - vec2<f32>(0.5);
    let touchDist = length(center - touchUV);
    let rippleRadius = uTouch.z * 0.3;
    let rippleWidth = 0.02 + uTouch.z * 0.015;
    let ring = exp(-pow((touchDist - rippleRadius) / rippleWidth, 2.0));
    let rippleFade = exp(-uTouch.z * 2.5);
    ripple = ring * rippleFade * 0.4;
  }

  let lum = dot(litColor, vec3<f32>(0.299, 0.587, 0.114));
  litColor = mix(litColor, vec3<f32>(lum * 1.5 + 0.15), uShimmer * 0.4);
  let coreGlow = exp(-dist * dist / (shapeR * shapeR * 0.10)) * 0.23;
  let coreColor = mix(shimmerColor * 1.1, vec3<f32>(1.0), 0.35);
  litColor = litColor + coreColor * coreGlow;

  let glassDepth = exp(-dist * dist / (shapeR * shapeR * 0.18)) * 0.65 + 0.05;
  let glassEdge = edge * glassDepth;
  let edgeHighlight = exp(-cleanSdfEarly * cleanSdfEarly / (cleanFwEarly * cleanFwEarly * 20.0)) * 0.92;
  let edgeHLColor = mix(shimmerColor * 1.15, vec3<f32>(1.0), 0.40);

  let ringFw = max(fw * 4.0, 0.008);
  let ripple0 = 1.0 + breathCurve * 0.03;
  let ripple1 = 1.0 + breathCurve * 0.026;
  let in1 = glassRim(dist - cleanShapeR * 0.65 * ripple0, 0.40, ringFw) * edge;
  let in2 = glassRim(dist - cleanShapeR * 0.35 * ripple1, 0.30, ringFw) * edge;
  let innerRings = in1 + in2;
  let innerRingColor = shimmerColor * 1.2;

  let pulseSpeed = 0.15;
  let ringGap = 1.08;
  let ringTravel = 0.55;
  let wp1 = fract(uTime * pulseSpeed);
  let wp2 = fract(uTime * pulseSpeed + 0.333);
  let wp3 = fract(uTime * pulseSpeed + 0.667);
  let ws1 = ringGap + (1.0 - pow(1.0 - wp1, 3.0)) * ringTravel;
  let ws2 = ringGap + (1.0 - pow(1.0 - wp2, 3.0)) * ringTravel;
  let ws3 = ringGap + (1.0 - pow(1.0 - wp3, 3.0)) * ringTravel;
  let wa1 = smoothstepCompat(0.0, 0.08, wp1) * (1.0 - smoothstepCompat(0.40, 0.72, wp1));
  let wa2 = smoothstepCompat(0.0, 0.08, wp2) * (1.0 - smoothstepCompat(0.40, 0.72, wp2));
  let wa3 = smoothstepCompat(0.0, 0.08, wp3) * (1.0 - smoothstepCompat(0.40, 0.72, wp3));
  let ringSoft1 = ringFw * (1.0 + wp1 * 0.5);
  let ringSoft2 = ringFw * (1.0 + wp2 * 0.5);
  let ringSoft3 = ringFw * (1.0 + wp3 * 0.5);
  let ring1 = glassRimWide(dist - cleanShapeR * ws1, wa1 * 0.48, ringSoft1);
  let ring2 = glassRimWide(dist - cleanShapeR * ws2, wa2 * 0.45, ringSoft2);
  let ring3 = glassRimWide(dist - cleanShapeR * ws3, wa3 * 0.40, ringSoft3);

  let ringPresence = ring1 + ring2 + ring3;
  let localAuraDim = 1.0 - clamp(ringPresence * 4.0, 0.0, 0.50);
  aura = aura * localAuraDim;
  innerGlow = innerGlow * localAuraDim;

  let baseColor = litColor * glassEdge
    + edgeHLColor * edgeHighlight * cleanEdge
    + innerRingColor * innerRings
    + auraColor * innerGlow * (1.0 + uShimmer * 0.8)
    + auraColor * aura * (1.0 + uShimmer * 0.8)
    + auraColor * rayIntensity
    + vec3<f32>(1.0) * bloomFaded * 0.25
    + (shimmerColor * 1.2 + vec3<f32>(0.15)) * particleGlow
    + shimmerColor * ripple * 2.0;

  var finalAlpha = clamp(glassEdge + edgeHighlight * 0.5 + innerRings * 0.6
    + ring1 + ring2 + ring3 + innerGlow + aura + bloomFaded + particleGlow + rayIntensity + ripple, 0.0, 1.0);
  finalAlpha = finalAlpha * smoothstepCompat(0.0, 0.15, uGenesis);
  finalAlpha = finalAlpha * (1.0 - smoothstepCompat(0.46, 0.56, dist));
  finalAlpha = finalAlpha * smoothstepCompat(0.0, 0.015, finalAlpha);
  if (uIsDark > 0.5) {
    finalAlpha = min(1.0, finalAlpha * 1.15);
  }

  let tmA = 2.51;
  let tmB = 0.03;
  let tmC = 2.43;
  let tmD = 0.59;
  let tmE = 0.14;
  var finalColor = clamp((baseColor * (tmA * baseColor + vec3<f32>(tmB))) / (baseColor * (tmC * baseColor + vec3<f32>(tmD)) + vec3<f32>(tmE)), vec3<f32>(0.0), vec3<f32>(1.0));
  let tmShimmer = clamp((shimmerColor * (tmA * shimmerColor + vec3<f32>(tmB))) / (shimmerColor * (tmC * shimmerColor + vec3<f32>(tmD)) + vec3<f32>(tmE)), vec3<f32>(0.0), vec3<f32>(1.0));
  let ringGlowColor = mix(tmShimmer * 1.15, vec3<f32>(1.0), 0.18);
  let ringSum = ring1 + ring2 + ring3;
  finalColor = clamp(finalColor + ringGlowColor * ringSum, vec3<f32>(0.0), vec3<f32>(1.0));

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
  if (hSector < 1) {
    r = c;
    g = x;
  } else if (hSector < 2) {
    r = x;
    g = c;
  } else if (hSector < 3) {
    g = c;
    b = x;
  } else if (hSector < 4) {
    g = x;
    b = c;
  } else if (hSector < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return [r + m, g + m, b + m];
}

function hasWebGpuSupport(): boolean {
  try {
    return Boolean(navigator.gpu);
  } catch {
    return false;
  }
}

function shouldAbort(signal?: AbortSignal): boolean {
  return signal?.aborted === true;
}

function waitForWebGpu<T>(
  promise: Promise<T>,
  options: OrbWebGpuBuildOptions,
  label: string,
): Promise<T | null> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_WEBGPU_BUILD_TIMEOUT_MS;

  return new Promise((resolve) => {
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      recordError(new Error(`WebGPU ${label} timed out after ${timeoutMs}ms`), {
        component: 'ValenceOrb',
        action: 'webgpu-timeout',
      });
      resolve(null);
    }, timeoutMs);

    const finish = (value: T | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(value);
    };

    promise.then(
      (value) => finish(value),
      (err) => {
        recordError(err, { component: 'ValenceOrb', action: `webgpu-${label}` });
        finish(null);
      },
    );
  });
}

export async function createOrbWebGpuAsync(
  canvas: HTMLCanvasElement,
  options: OrbWebGpuBuildOptions = {},
): Promise<OrbWebGpuBuildResult | null> {
  if (!hasWebGpuSupport() || shouldAbort(options.signal)) return null;

  const started = performance.now();

  try {
    const context = (canvas as WebGpuCanvasElement).getContext('webgpu');
    if (!context) return null;

    const adapter = await waitForWebGpu(
      navigator.gpu!.requestAdapter(),
      options,
      'request-adapter',
    );
    if (!adapter || shouldAbort(options.signal)) return null;
    if (adapter.isFallbackAdapter) return null;

    const device = await waitForWebGpu(adapter.requestDevice(), options, 'request-device');
    if (!device || shouldAbort(options.signal)) return null;

    let deviceLost = false;
    let disposed = false;
    device.lost.then(
      (info) => {
        deviceLost = true;
        if (disposed) return;
        recordError(new Error(`WebGPU device lost: ${info.message || info.reason || 'unknown'}`), {
          component: 'ValenceOrb',
          action: 'webgpu-device-lost',
        });
      },
      () => {
        deviceLost = true;
      },
    );

    const format = navigator.gpu!.getPreferredCanvasFormat();
    context.configure({
      device,
      format,
      alphaMode: 'premultiplied',
    });

    device.pushErrorScope('validation');
    const shaderModule = device.createShaderModule({
      label: 'zenflow-orb-webgpu-shader',
      code: ORB_WEBGPU_WGSL,
    });
    const pipeline = await waitForWebGpu(
      device.createRenderPipelineAsync({
        label: 'zenflow-orb-webgpu-pipeline',
        layout: 'auto',
        vertex: {
          module: shaderModule,
          entryPoint: 'vertexMain',
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fragmentMain',
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
      'pipeline',
    );
    const validationError = await device.popErrorScope().catch(() => null);
    if (validationError) {
      recordError(new Error(`WebGPU validation failed: ${validationError.message}`), {
        component: 'ValenceOrb',
        action: 'webgpu-validation',
      });
      disposed = true;
      device.destroy();
      return null;
    }
    if (!pipeline || shouldAbort(options.signal)) {
      disposed = true;
      device.destroy();
      return null;
    }

    const uniformData = new Float32Array(UNIFORM_FLOATS);
    const uniformBuffer = device.createBuffer({
      label: 'zenflow-orb-webgpu-uniforms',
      size: UNIFORM_BUFFER_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const bindGroup = device.createBindGroup({
      label: 'zenflow-orb-webgpu-bind-group',
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: uniformBuffer },
        },
      ],
    });

    const renderer: OrbWebGpuRenderer = {
      render(params) {
        if (deviceLost) return;

        const width = params.size * params.dpr;
        const height = params.size * params.dpr;
        const [r, g, b] = hslToRgb(params.color.h, params.color.s, params.color.l);

        uniformData[0] = width;
        uniformData[1] = height;
        uniformData[2] = params.time;
        uniformData[3] = params.valence;
        uniformData[4] = params.isDark ? 1 : 0;
        uniformData[5] = params.genesis;
        uniformData[6] = params.shimmer;
        uniformData[7] = 0;
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
          const offset = 20 + i * 4;
          const particle = params.particles[i];
          if (!particle) {
            uniformData[offset] = 0;
            uniformData[offset + 1] = 0;
            uniformData[offset + 2] = 0;
            uniformData[offset + 3] = 0;
            continue;
          }

          uniformData[offset] = particle.x / params.size;
          uniformData[offset + 1] = 1 - particle.y / params.size;
          uniformData[offset + 2] = particle.radius / params.size;
          uniformData[offset + 3] = particle.alpha;
        }

        device.queue.writeBuffer(uniformBuffer, 0, uniformData);
        const encoder = device.createCommandEncoder({ label: 'zenflow-orb-webgpu-frame' });
        const pass = encoder.beginRenderPass({
          label: 'zenflow-orb-webgpu-pass',
          colorAttachments: [
            {
              view: context.getCurrentTexture().createView(),
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              loadOp: 'clear',
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
        disposed = true;
        try {
          context.unconfigure();
        } catch {
          // Graceful: some browsers may already have torn down the context.
        }
        try {
          device.destroy();
        } catch {
          // Graceful: destruction is best-effort on older implementations.
        }
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
    recordError(err, { component: 'ValenceOrb', action: 'createOrbWebGpuAsync' });
    return null;
  }
}
