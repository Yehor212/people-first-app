/**
 * Simplified GLSL shaders for the 24px typing dynamics mini-orb.
 *
 * Keeps: superformula SDF, color, breathing, glass transparency, Fresnel rim, GGX specular.
 * Removes: caustics, particles, volumetric rays, concentric rings, iridescence, hope sparkle.
 *
 * @see TypingDynamicsMirror.tsx
 */

export const MINI_VERT_SRC = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

export const MINI_VERT_SRC_300 = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const MINI_FRAG_SRC_BODY = `
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uColor;
uniform float uBrightness;
uniform float uShapeM;
uniform float uShapeN1;
uniform float uBreathPeriod;
uniform float uIsDark;

// ── Simplex noise (minimal — single octave for 24px) ──
vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289v4(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289v4((x * 34.0 + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g, l.zxy);
  vec3 i2 = max(g, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289v3(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
  + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// ── Superformula ──
float superformula(float theta, float m, float n1, float n2, float n3) {
  float a = m * theta * 0.25;
  float t1 = pow(abs(cos(a)), n2);
  float t2 = pow(abs(sin(a)), n3);
  float sum = t1 + t2;
  if (sum < 0.0000001) return 1.0;
  return pow(sum, -1.0 / n1);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 center = uv - 0.5;
  float dist = length(center);
  float angle = atan(center.y, center.x);

  // Breathing animation
  float breathPhase = fract(uTime / uBreathPeriod);
  float breathInhale = smoothstep(0.0, 0.333, breathPhase);
  float breathExhale = 1.0 - smoothstep(0.417, 0.833, breathPhase);
  float breathPause = step(0.833, breathPhase);
  float breathCurve = min(breathInhale, breathExhale) * (1.0 - breathPause);
  float breath = 1.0 + breathCurve * 0.05 - 0.025;

  // Slow rotation
  float rotation = uTime * 0.03;
  float rotAngle = angle + rotation;

  // Single-octave noise displacement (simplified for 24px)
  float ca = cos(rotAngle);
  float sa = sin(rotAngle);
  float nv = snoise(vec3(ca * 2.5 + uTime * 0.3, sa * 2.5 + uTime * 0.21, 10.0));
  float noiseDisp = nv * 0.005;

  // Superformula shape — n2/n3 derived from n1 for simplicity
  float n2 = mix(1.25, 2.0, (uShapeN1 - 1.4) / 1.1);
  float n3 = n2;
  float sf = superformula(rotAngle, uShapeM, uShapeN1, n2, n3);
  float baseR = 0.30;
  float shapeR = baseR * sf * breath * (1.0 + noiseDisp);

  // SDF + soft edge
  float sdf = dist - shapeR;
  float edge = 1.0 - smoothstep(-0.02, 0.02, sdf);

  // 3D normal (sphere approximation)
  float normalZ = sqrt(max(0.001, 1.0 - clamp(dist * dist / (shapeR * shapeR), 0.0, 1.0)));
  vec3 normal = normalize(vec3(center * 2.0, normalZ));

  // Lighting
  vec3 lightDir = normalize(vec3(-0.4, 0.4, 1.0));
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  float diff = max(dot(normal, lightDir), 0.0);

  // GGX specular (white — glass reflects light)
  vec3 halfDir = normalize(lightDir + viewDir);
  float roughness = 0.28;
  float a2 = roughness * roughness;
  a2 = a2 * a2;
  float NdotH = max(dot(normal, halfDir), 0.0);
  float denom = NdotH * NdotH * (a2 - 1.0) + 1.0;
  float ggxD = a2 / (3.14159 * denom * denom);
  float specF = 0.08 + 0.92 * pow(1.0 - max(dot(halfDir, viewDir), 0.0), 5.0);
  vec3 specular = vec3(1.0) * ggxD * specF * 0.55;

  // Fresnel rim
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.2);
  float fresnelStr = uIsDark > 0.5 ? 0.70 : 0.55;

  // Apply brightness from typing speed
  vec3 baseColor = uColor * uBrightness;

  // Compose
  vec3 ambient = baseColor * 0.30;
  vec3 diffuse = baseColor * diff * 0.55;
  vec3 rim = mix(baseColor, vec3(1.0), 0.40) * fresnel * fresnelStr;
  vec3 litColor = ambient + diffuse + specular + rim;

  // Glass transparency (bright center, transparent edge)
  float glassDepth = exp(-dist * dist / (shapeR * shapeR * 0.18)) * 0.65 + 0.05;
  float glassEdge = edge * glassDepth;

  // Luminous core
  float coreGlow = exp(-dist * dist / (shapeR * shapeR * 0.10)) * 0.20;
  vec3 coreColor = mix(baseColor * 1.1, vec3(1.0), 0.30);
  litColor += coreColor * coreGlow;

  // Aura glow
  float aura = exp(-dist * 2.8) * 0.12 * (uIsDark > 0.5 ? 1.15 : 1.0);
  float bloom = exp(-dist * 5.0) * 0.05;

  vec3 finalColor = litColor * glassEdge + baseColor * aura + vec3(1.0) * bloom * 0.2;
  float finalAlpha = clamp(glassEdge + aura + bloom, 0.0, 1.0);

  // Vignette
  float vignette = 1.0 - smoothstep(0.42, 0.52, dist);
  finalAlpha *= vignette;

  // Kill sub-threshold alpha
  finalAlpha *= smoothstep(0.0, 0.015, finalAlpha);

  // ACES tone mapping
  float tmA = 2.51; float tmB = 0.03; float tmC = 2.43; float tmD = 0.59; float tmE = 0.14;
  finalColor = clamp((finalColor * (tmA * finalColor + tmB)) / (finalColor * (tmC * finalColor + tmD) + tmE), 0.0, 1.0);

  // Premultiplied alpha
  gl_FragColor = vec4(finalColor * finalAlpha, finalAlpha);
}
`;

export const MINI_FRAG_SRC = MINI_FRAG_SRC_BODY;

export const MINI_FRAG_SRC_300 = MINI_FRAG_SRC_BODY
  .replace(
    '\nprecision highp float;',
    '#version 300 es\nprecision highp float;\nout vec4 fragColor;',
  )
  .replace('gl_FragColor', 'fragColor');
