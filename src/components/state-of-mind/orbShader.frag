
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform float uValence;
uniform float uIsDark;
uniform vec3 uColor;
uniform float uShapeM;
uniform float uShapeN1;
uniform float uShapeN2;
uniform float uShapeN3;
uniform vec4 uParticles[22];
uniform float uGenesis;    // 0→1 birth animation (CPU-eased elastic)
uniform vec3 uTouch;       // xy = UV touch position, z = age since touch (0 = inactive)
uniform float uShimmer;    // 0→1 transition burst (large valence change flash)

// ─── Phase 3-B.2: А+++ quality uniforms (Apotheosis) ───
// Apple Intelligence mesh-gradient always-shimmer (Q8=а) + SSS + iridescence + HDR
uniform float uOrbSize;           // CSS-computed px size (160..280), drives SDF scale + noise octaves
uniform float uShimmerStrength;   // 0..1 intensity of always-on rainbow mesh (default 0.5 in JS)
uniform float uShimmerTime;       // independent shimmer clock (pauses on reduced-motion)
uniform float uThickness;         // 0..1 SSS thickness bias (default 0.5)
uniform float uIridBandPhase;     // 0..1 slow phase drift for iridescence animation
uniform float uHDREnabled;        // 1.0 = emit linear >1.0 core for bloom pass, 0.0 = clamp

// ─── Phase 3-B.2 Task D: reactive breath + long-press metaball merge ───
uniform float uBreathRate;        // Hz, 0.25..0.5 driven by |valence| (default 0.25)
uniform float uBreathAmp;         // 0..0.1 breath amplitude (default 0.025)
uniform float uMergeProgress;     // 0..1 metaball-merge envelope (0 = rest, shader branches early)
uniform vec2  uMergeBlob2Pos;     // UV-space target for the 2nd blob (defaults to center)
uniform float uMergeBlob2Scale;   // 0..1 relative radius of the 2nd blob
uniform float uMergePulse;        // 0..1 brief main-orb scale pulse at merge peak

// ─── glsl-canvas full-cycle preview bridge ───
// glsl-canvas auto-animates u_time/u_resolution (snake_case).
// Production WebGL sets uTime/uResolution etc. (camelCase) via JS uniforms.
// Self-referential #define (C99 §6.10.3.4): macro name in own expansion is NOT re-expanded.
// In production: u_time=0 → ternaries pick original uniforms. Zero overhead.
// In preview: u_time>0 → ternaries pick cycling values. Full orb lifecycle visible.
uniform float u_time;
uniform vec2 u_resolution;

// ── Preview: HSL → sRGB ──
vec3 hsl2rgb_p(float h, float s, float l) {
  h = mod(h, 360.0) / 60.0; s *= 0.01; l *= 0.01;
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  float x = c * (1.0 - abs(mod(h, 2.0) - 1.0));
  float m = l - c * 0.5;
  vec3 rgb = (h < 1.0) ? vec3(c,x,0) : (h < 2.0) ? vec3(x,c,0) :
             (h < 3.0) ? vec3(0,c,x) : (h < 4.0) ? vec3(0,x,c) :
             (h < 5.0) ? vec3(x,0,c) : vec3(c,0,x);
  return rgb + m;
}

// ── Preview: OKLAB perceptually uniform interpolation (mirrors colorUtils.ts lerpOklab) ──
float srgb2lin_p(float c) { return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4); }
float lin2srgb_p(float c) { c = clamp(c, 0.0, 1.0); return c <= 0.0031308 ? c * 12.92 : 1.055 * pow(c, 1.0/2.4) - 0.055; }
float cbrt_p(float x) { return sign(x) * pow(abs(x), 1.0/3.0); }

vec3 rgb2oklab_p(vec3 rgb) {
  float r = srgb2lin_p(rgb.r), g = srgb2lin_p(rgb.g), b = srgb2lin_p(rgb.b);
  float l_ = cbrt_p(0.4122*r + 0.5363*g + 0.0514*b);
  float m_ = cbrt_p(0.2119*r + 0.7736*g + 0.0144*b);
  float s_ = cbrt_p(0.0883*r + 0.2289*g + 0.6928*b);
  return vec3(0.2105*l_+0.7936*m_-0.0041*s_, 1.9780*l_-2.4286*m_+0.4506*s_, 0.0259*l_+0.7828*m_-0.8087*s_);
}

vec3 oklab2rgb_p(vec3 lab) {
  float l_ = lab.x + 0.3963*lab.y + 0.2158*lab.z;
  float m_ = lab.x - 0.1056*lab.y - 0.0639*lab.z;
  float s_ = lab.x - 0.0895*lab.y - 1.2915*lab.z;
  float l = l_*l_*l_, m = m_*m_*m_, s = s_*s_*s_;
  return vec3(lin2srgb_p(4.0767*l-3.3077*m+0.2310*s), lin2srgb_p(-1.2684*l+2.6098*m-0.3413*s), lin2srgb_p(-0.0042*l-0.7034*m+1.7076*s));
}

// OKLAB lerp: HSL pair → RGB through Lab space (no hue wrapping artifacts)
vec3 lerpOklab_p(vec3 hsl0, vec3 hsl1, float t) {
  vec3 lab0 = rgb2oklab_p(hsl2rgb_p(hsl0.x, hsl0.y, hsl0.z));
  vec3 lab1 = rgb2oklab_p(hsl2rgb_p(hsl1.x, hsl1.y, hsl1.z));
  return oklab2rgb_p(mix(lab0, lab1, t));
}

// ── Preview: 9-stop valence → RGB via OKLAB (identical to production colorUtils.ts) ──
vec3 valenceColor_p(float v) {
  v = clamp(v, -1.0, 1.0);
  vec3 c0, c1;
  float f;
  if      (v < -0.714) { f=(v+1.000)/0.286; c0=vec3(280,60,26); c1=vec3(252,58,38); }
  else if (v < -0.429) { f=(v+0.714)/0.285; c0=vec3(252,58,38); c1=vec3(220,55,45); }
  else if (v < -0.143) { f=(v+0.429)/0.286; c0=vec3(220,55,45); c1=vec3(175,55,48); }
  else if (v <  0.143) { f=(v+0.143)/0.286; c0=vec3(175,55,48); c1=vec3(55,58,48);  }
  else if (v <  0.429) { f=(v-0.143)/0.286; c0=vec3(55,58,48);  c1=vec3(38,65,50);  }
  else if (v <  0.571) { f=(v-0.429)/0.142; c0=vec3(38,65,50);  c1=vec3(25,78,52);  }
  else if (v <  0.714) { f=(v-0.571)/0.143; c0=vec3(25,78,52);  c1=vec3(16,72,50);  }
  else                 { f=(v-0.714)/0.286; c0=vec3(16,72,50);  c1=vec3(355,78,48); }
  return lerpOklab_p(c0, c1, smoothstep(0.0, 1.0, clamp(f, 0.0, 1.0)));
}

// ── Preview: 7-preset shape interpolation (mirrors orbRenderer.ts SHAPE_PRESETS) ──
vec4 valenceShape_p(float v) {
  v = clamp(v, -1.0, 1.0);
  // vec4(m, n1, n2, n3) per preset
  vec4 s0, s1;
  float f;
  if      (v < -0.667) { f=(v+1.000)/0.333; s0=vec4(7,1.20,1.25,1.25); s1=vec4(7,1.40,1.35,1.35); }
  else if (v < -0.333) { f=(v+0.667)/0.334; s0=vec4(7,1.40,1.35,1.35); s1=vec4(6,1.80,1.50,1.50); }
  else if (v <  0.000) { f=(v+0.333)/0.333; s0=vec4(6,1.80,1.50,1.50); s1=vec4(6,2.00,2.00,2.00); }
  else if (v <  0.333) { f=(v-0.000)/0.333; s0=vec4(6,2.00,2.00,2.00); s1=vec4(5,1.80,1.50,1.50); }
  else if (v <  0.667) { f=(v-0.333)/0.334; s0=vec4(5,1.80,1.50,1.50); s1=vec4(5,1.40,1.35,1.35); }
  else                 { f=(v-0.667)/0.333; s0=vec4(5,1.40,1.35,1.35); s1=vec4(5,1.25,1.30,1.30); }
  return mix(s0, s1, smoothstep(0.0, 1.0, clamp(f, 0.0, 1.0)));
}

// ── Preview: mouse → valence (left=-1, right=+1, like slider) ──
uniform vec2 u_mouse;
float previewValence_p() {
  return clamp(u_mouse.x / max(u_resolution.x, 1.0), 0.0, 1.0) * 2.0 - 1.0;
}

// Self-referential macros (C99 §6.10.3.4): production u_time=0 → originals; preview u_time>0 → live
#define uTime (uTime + u_time)
#define uResolution max(uResolution, u_resolution)
#define uValence (u_time > 0.0 ? previewValence_p() : uValence)
#define uColor (u_time > 0.0 ? valenceColor_p(previewValence_p()) : uColor)
#define uShapeM (u_time > 0.0 ? valenceShape_p(previewValence_p()).x : uShapeM)
#define uShapeN1 (u_time > 0.0 ? valenceShape_p(previewValence_p()).y : uShapeN1)
#define uShapeN2 (u_time > 0.0 ? valenceShape_p(previewValence_p()).z : uShapeN2)
#define uShapeN3 (u_time > 0.0 ? valenceShape_p(previewValence_p()).w : uShapeN3)

// ─── 3D Simplex Noise (Stefan Gustavson / Ashima Arts) ───

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

// ─── Cosine Palette (Inigo Quilez) ───
// a + b * cos(2π(c·t + d)) — compact spectral color generation

vec3 cosinePalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.2832 * (c * t + d));
}

// ─── Polynomial smooth-min (Inigo Quilez canonical, C2-continuous) ───
// Produces an organic fluid merge between two SDFs. k controls the blend
// radius in the same units as the distances being combined.
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * h * k / 6.0;
}

// ─── Gielis Superformula ───

float superformula(float theta, float m, float n1, float n2, float n3) {
  float a = m * theta * 0.25;
  float t1 = pow(abs(cos(a)), n2);
  float t2 = pow(abs(sin(a)), n3);
  float sum = t1 + t2;
  if (sum < 0.0000001) return 1.0;
  return pow(sum, -1.0 / n1);
}

// ─── Hue Rotation (Rodrigues rotation around (1,1,1) axis in RGB space) ───

vec3 hueRotate(vec3 col, float angle) {
  float c = cos(angle), s = sin(angle);
  vec3 k = vec3(0.57735); // normalized (1,1,1)
  return col * c + cross(k, col) * s + k * dot(k, col) * (1.0 - c);
}

// ─── Phase 3-B.2 Apotheosis: HSV → RGB (thin-film iridescence) ───
vec3 hsv2rgb_api(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// ─── Apple Intelligence 5-color mesh palette ───
// purple(270°) → pink(330°) → blue(240°) → red(0°) → orange(30°)
// Source: jacobamobin/AppleIntelligenceGlowEffect hue stops
vec3 appleIntelligencePalette(float t) {
  // 5 hue stops in degrees → wrap smoothly
  float h;
  float ft = fract(t);
  if      (ft < 0.20) h = mix(270.0, 330.0, ft / 0.20);
  else if (ft < 0.40) h = mix(330.0, 240.0 + 360.0, (ft - 0.20) / 0.20); // wrap through 360
  else if (ft < 0.60) h = mix(240.0, 0.0 + 360.0,   (ft - 0.40) / 0.20);
  else if (ft < 0.80) h = mix(360.0, 30.0 + 360.0,  (ft - 0.60) / 0.20);
  else                h = mix(390.0, 630.0,         (ft - 0.80) / 0.20); // 630 = 270+360 → full loop
  h = mod(h, 360.0) / 360.0;
  return hsv2rgb_api(vec3(h, 0.72, 1.0));
}

// ─── Main ───

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 center = uv - 0.5;
  float dist = length(center);
  float angle = atan(center.y, center.x);

  // ── Phase 3-B.2: responsive orb size norm (0 @160px, 1 @280px) ──
  // Used by: noise octaves, SSS thickness, iridescence strength scaling.
  // Falls back to mid-value 0.5 when uniform is unset (old JS path).
  float orbSizeNorm = clamp((max(uOrbSize, 160.0) - 160.0) / 120.0, 0.0, 1.0);

  // ── Animation parameters ──
  float rotSpeed = mix(0.055, 0.015, (uValence + 1.0) * 0.5);
  float rotation = uTime * rotSpeed;
  float noiseSpeed = mix(0.85, 0.20, (uValence + 1.0) * 0.5);
  // Noise — barely perceptible organic life (Apple: ~1% body variation, clean edges)
  float noiseAmp = 0.003 + (uValence < 0.0 ? abs(uValence) * 0.007 : abs(uValence) * 0.003);

  // ── Physiological Breathing (inhale 4 → hold 1 → exhale 5 → pause 2 beats) ──
  // Phase 3-B.2 Task D: rate + amplitude now REACT to |uValence| via uBreathRate/uBreathAmp.
  //   |v|=0  → rate 0.25 Hz (4s cycle), amp 0.02 (calm)
  //   |v|=1  → rate 0.5  Hz (2s cycle), amp 0.06 (intense)
  // Zero-uniform fallback: old CPU path left uBreathRate=0 → reuse the legacy
  //   valence-adaptive 8..16s period so preview/unit tests stay visually identical.
  float reactiveRate = max(uBreathRate, 1e-4);
  float legacyPeriod = mix(8.0, 16.0, (uValence + 1.0) * 0.5);
  float reactivePeriod = 1.0 / reactiveRate; // seconds per cycle
  float breathPeriod = (uBreathRate > 0.0) ? reactivePeriod : legacyPeriod;
  float breathJitter = snoise(vec3(uTime * 0.03, 500.0, 0.0)) * 0.05; // ±5% organic drift
  float breathPhase = fract(uTime / (breathPeriod * (1.0 + breathJitter)));
  float breathInhale = smoothstep(0.0, 0.333, breathPhase);
  float breathExhale = 1.0 - smoothstep(0.417, 0.833, breathPhase);
  float breathPause = step(0.833, breathPhase);
  float breathCurve = min(breathInhale, breathExhale) * (1.0 - breathPause);
  // Reactive amp: uBreathAmp=0 keeps legacy constant 0.05 p-p for safety.
  float pp = (uBreathAmp > 0.0) ? (uBreathAmp * 2.0) : 0.05;
  float breath = 1.0 + breathCurve * pp - pp * 0.5;

  // ── Noise displacement (3-octave, per-pixel) ──
  // Phase 3-B.2: noise frequency scales with uOrbSize — bigger orb = finer detail preserved.
  float rotAngle = angle + rotation;
  float ca = cos(rotAngle);
  float sa = sin(rotAngle);
  float sizeOct = mix(0.90, 1.25, orbSizeNorm); // 160px→0.9×, 280px→1.25× octave frequency
  float nv1 = snoise(vec3(
    ca * 2.5 * sizeOct + uTime * noiseSpeed,
    sa * 2.5 * sizeOct + uTime * noiseSpeed * 0.7,
    10.0
  ));
  float nv2 = snoise(vec3(
    ca * 5.0 * sizeOct + uTime * noiseSpeed * 1.3 + 100.0,
    sa * 5.0 * sizeOct + uTime * noiseSpeed * 0.9 + 100.0,
    10.0
  ));
  float nv3 = snoise(vec3(
    ca * 10.0 * sizeOct + uTime * noiseSpeed * 1.7 + 200.0,
    sa * 10.0 * sizeOct + uTime * noiseSpeed * 1.1 + 200.0,
    10.0
  ));
  float noiseDisp = (nv1 * 0.55 + nv2 * 0.30 + nv3 * 0.15) * noiseAmp * uGenesis;

  // ── Domain warp: warp the angle before superformula lookup (Inigo Quilez technique) ──
  float warpAmp = mix(0.006, 0.003, (uValence + 1.0) * 0.5);
  // -1.0 → 0.10 (strong chaotic warping), +1.0 → 0.015 (gentle organic flow)
  float warp1 = snoise(vec3(
    ca * 1.8 + uTime * noiseSpeed * 0.4,
    sa * 1.8 + uTime * noiseSpeed * 0.3,
    uTime * 0.05
  ));
  float warp2 = snoise(vec3(
    ca * 3.5 + uTime * noiseSpeed * 0.7 + 50.0,
    sa * 3.5 + uTime * noiseSpeed * 0.5 + 50.0,
    uTime * 0.08 + 100.0
  ));
  float warpedAngle = rotAngle + (warp1 * 0.65 + warp2 * 0.35) * warpAmp * 6.2832 * uGenesis;

  // ── Superformula shape (smooth morph between petal counts) ──
  // Instead of floor(m+0.5) snap → blend two shapes with smoothstep for organic morphing.
  // At integer m: pure shape. Between integers: cross-dissolve (ghostly petal fade).
  float mLow = floor(uShapeM);
  float mHigh = mLow + 1.0;
  float mBlend = smoothstep(0.0, 1.0, fract(uShapeM));
  float sfLow = superformula(warpedAngle, max(mLow, 3.0), uShapeN1, uShapeN2, uShapeN3);
  float sfHigh = superformula(warpedAngle, max(mHigh, 3.0), uShapeN1, uShapeN2, uShapeN3);
  float sf = mix(sfLow, sfHigh, mBlend);
  float baseR = 0.25; // smaller body — Apple: delicate flower floating in space, not filling canvas
  // Phase 3-B.2 Task D: merge-peak pulse (1.0 → 1.08 → 1.0 from CPU) multiplies body scale.
  float mergePulseScale = 1.0 + uMergePulse * 0.08;
  float cleanShapeR = baseR * sf * breath * max(uGenesis, 0.01) * mergePulseScale; // pure superformula (for body contour)
  float shapeR = cleanShapeR * (1.0 + noiseDisp); // with noise (for body)

  // ── Signed Distance Field (Apple Quality: micro-bump removed for clean edges) ──
  float sdf = dist - shapeR;

  // ── Phase 3-B.2 Task D: metaball 2nd-blob merge via polynomial smin ──
  // Gated by uMergeProgress>0 so the rest path compiles out to the original SDF.
  // 2nd blob shrinks toward center as progress → 1 (converge + collapse).
  if (uMergeProgress > 0.0) {
    vec2 blob2Center = uMergeBlob2Pos - 0.5; // UV → centered coords (match `center`)
    float blob2R = baseR * max(uMergeBlob2Scale, 1e-4) * (1.0 + noiseDisp * 0.4);
    float sdf2 = length(center - blob2Center) - blob2R;
    // k blends between 0.3 (soft early merge) and 0.5 (wide organic join at peak).
    float k = mix(0.30, 0.50, clamp(uMergeProgress, 0.0, 1.0));
    float merged = smin(sdf, sdf2, k * baseR);
    sdf = mix(sdf, merged, uMergeProgress);
  }

  // ── Soft edge (fwidth-based resolution-independent AA, valence-adaptive) ──
  float fw = fwidth(sdf);
  float edgeScale = mix(1.2, 1.8, (uValence + 1.0) * 0.5);
  float edge = 1.0 - smoothstep(-fw * edgeScale, fw * edgeScale, sdf);

  // Clean edge from pure superformula (no noise) — for glass rim highlight only.
  // Body interior uses noisy `edge` (organic), but the bright rim must be smooth.
  float cleanSdfEarly = dist - cleanShapeR;
  float cleanFwEarly = fwidth(cleanSdfEarly);
  float cleanEdge = 1.0 - smoothstep(-cleanFwEarly * edgeScale, cleanFwEarly * edgeScale, cleanSdfEarly);

  // ── 3D Normal (sphere approximation for lighting) ──
  float normalZ = sqrt(max(0.001, 1.0 - clamp(dist * dist / (shapeR * shapeR), 0.0, 1.0)));
  vec3 normal = normalize(vec3(center * 2.0, normalZ));

  // ── 2-Point Blinn-Phong Lighting ──
  vec3 lightDir1 = normalize(vec3(-0.4, 0.4, 1.0));   // top-left key light
  vec3 lightDir2 = normalize(vec3(0.3, -0.25, 0.8));   // bottom-right rim light
  vec3 viewDir = vec3(0.0, 0.0, 1.0);

  // Subtle wrap lighting: positive emotions glow gently from within
  float wrapFactor = mix(0.0, 0.12, (uValence + 1.0) * 0.5);
  float diff1 = max((dot(normal, lightDir1) + wrapFactor) / (1.0 + wrapFactor), 0.0);
  float diff2 = max((dot(normal, lightDir2) + wrapFactor) / (1.0 + wrapFactor), 0.0) * 0.3;

  // GGX specular computed after shimmerColor (see below)

  // ── Fresnel Rim Glow ──
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.2);
  float fresnelStr = uIsDark > 0.5 ? 0.75 : 0.60; // strong glass rim

  // ── Subsurface Scattering (fake — increased for glass translucency) ──
  float sss = max(dot(-normal, lightDir1), 0.0) * 0.22;

  // ── Phase 3-B.2 SSS enhancement: thickness-driven back-scatter tint ──
  // Thickness = 1.0 at center (thickest "skin"), 0.0 at rim (thin).
  // Wavelength-dependent scatter: red transmits deepest (human skin physics).
  // Scales with orbSizeNorm so large orbs get more visible SSS, tiny orbs stay clean.
  float thickness = (1.0 - smoothstep(0.0, shapeR * 1.02, dist)) * mix(0.6, 1.0, uThickness);
  float sssFresnel = pow(1.0 - max(dot(normal, lightDir1), 0.0), 2.0);
  // Warm skin tint: R>G>B for subsurface (deeper red penetration)
  vec3 sssSkinTint = vec3(1.0, 0.55, 0.42);
  float sssPlus = thickness * sssFresnel * mix(0.08, 0.18, orbSizeNorm);

  // ── Iridescence (body-wide — visible across entire surface, stronger at rim) ──
  // Phase 3-B.2: view-angle driven wavelength shift (soap-bubble/pearl physics).
  // uIridBandPhase slowly drifts the spectrum so the same viewing angle evolves over time.
  float viewCos = max(dot(normal, viewDir), 0.0);
  float filmThickness = 0.3 + 0.7 * (1.0 - viewCos);
  filmThickness += snoise(vec3(center * 4.0, uTime * 0.15)) * 0.12;
  filmThickness += uIridBandPhase * 0.25; // slow spectral drift (never jarring)
  float iriPhase = uTime * 0.08;
  vec3 iridescent = cosinePalette(
    filmThickness + iriPhase,
    vec3(0.60, 0.50, 0.75),  // bias: wider color range
    vec3(0.45, 0.40, 0.35),  // amplitude: +28% for vivid color swings
    vec3(1.0, 1.0, 1.2),     // frequency: blue cycles slightly faster
    vec3(0.00, 0.15, 0.60)   // phase offset: R→G→B stagger
  );
  // Body-wide mask: 30% everywhere, 100% at rim (was rim-only)
  float iriMaskBody = 0.3 + 0.7 * smoothstep(0.0, 0.7, fresnel);
  float iriStrength = iriMaskBody * mix(0.20, 0.40, (uValence + 1.0) * 0.5);

  // ── Multi-color flowing surface (2-3 colors simultaneously, Apple Siri style) ──
  float nv = (uValence + 1.0) * 0.5;
  float colorFlow1 = snoise(vec3(center * 1.5 + uTime * 0.06, uTime * 0.04));
  float colorFlow2 = snoise(vec3(center * 1.8 - uTime * 0.05, uTime * 0.03 + 50.0));
  float hueShift1 = 0.78 + sin(uTime * 0.05) * 0.35;
  float hueShift2 = -(0.78 + cos(uTime * 0.07) * 0.35);
  vec3 color2 = hueRotate(uColor, hueShift1);
  vec3 color3 = hueRotate(uColor, hueShift2);
  float blend1 = smoothstep(-0.2, 0.5, colorFlow1);
  float blend2 = smoothstep(-0.2, 0.5, colorFlow2);
  vec3 shimmerColor = max(mix(mix(uColor, color2, blend1 * 0.45), color3, blend2 * 0.35), 0.0);

  // ── GGX Specular — WHITE (glass reflects light color, not body color) ──
  vec3 halfDir = normalize(lightDir1 + viewDir);
  float roughness = mix(0.38, 0.20, nv);
  float ggxA = roughness * roughness;
  float ggxA2 = ggxA * ggxA;
  float NdotH = max(dot(normal, halfDir), 0.0);
  float ggxDenom = NdotH * NdotH * (ggxA2 - 1.0) + 1.0;
  float ggxD = ggxA2 / (3.14159 * ggxDenom * ggxDenom);
  float specF = 0.08 + 0.92 * pow(1.0 - max(dot(halfDir, viewDir), 0.0), 5.0);
  vec3 specular = vec3(1.0) * ggxD * specF * 0.65;
  // Secondary specular from rim light
  vec3 halfDir2 = normalize(lightDir2 + viewDir);
  float NdotH2 = max(dot(normal, halfDir2), 0.0);
  float ggxDenom2 = NdotH2 * NdotH2 * (ggxA2 - 1.0) + 1.0;
  float ggxD2 = ggxA2 / (3.14159 * ggxDenom2 * ggxDenom2);
  vec3 specular2 = vec3(1.0) * ggxD2 * specF * 0.45;

  // ── Visible Caustics (wider patterns, 4× intensity, light-tinted) ──
  float cSeed = snoise(vec3(center * 4.0 + uTime * 0.08, uTime * 0.05));
  float cSeed2 = snoise(vec3(center * 6.0 - uTime * 0.06, uTime * 0.04 + 30.0));
  float cPattern = pow(max(0.0, 1.0 - abs(cSeed)), 2.5)
                 + pow(max(0.0, 1.0 - abs(cSeed2)), 3.0) * 0.6;
  float cStr = mix(0.06, 0.18, nv);
  vec3 causticTint = mix(vec3(1.0), shimmerColor, 0.4);
  vec3 causticColor = causticTint * cPattern * cStr;

  // ── Inner Depth Luminance (Apple Quality: -30% intensity) ──
  float depthZone1 = exp(-dist * dist / (shapeR * shapeR * 0.16)) * 0.14;
  float depthZone2 = exp(-dist * dist / (shapeR * shapeR * 0.42)) * 0.08;
  float depthPulse = sin(uTime * 1.2) * 0.09 + 0.91;
  float depthGlow = (depthZone1 * depthPulse + depthZone2 * (1.0 - depthPulse * 0.3));
  float depthStr = mix(0.35, 1.0, (uValence + 1.0) * 0.5);

  // [REMOVED] Energy veins — Apple Quality: clean internal surface
  // [REMOVED] Micro-sparkle — Apple Quality: no point highlights

  // ── Ambient Occlusion (self-shadowing in concavities of superformula) ──
  float ao = smoothstep(0.0, 0.25, normalZ);
  ao = mix(ao, 1.0, 0.65); // subtle — don't crush shadows

  // ── Surface Texture (Apple Quality: barely-visible marble for all valences) ──
  float texNoise = snoise(vec3(center * 15.0, uTime * 0.08));
  float surfaceTex = 1.0 + texNoise * 0.02;

  // [REMOVED] Chromatic dispersion — Apple Quality: iridescence covers spectral rim

  // ── Hope Sparkle (warm light within darkness — even at v=-1, a spark persists) ──
  float hopeIntensity = (1.0 - nv) * (1.0 - nv); // strongest at v=-1, zero at v=+1
  float hopeFlicker = pow(max(0.0, snoise(vec3(center * 3.0, uTime * 0.8))), 8.0);
  float hopePulse = pow(max(0.0, sin(uTime * 0.7 + snoise(vec3(uTime * 0.15, 0.0, 0.0)) * 3.0)), 4.0);
  float hopeGlow = hopeFlicker * hopePulse * hopeIntensity * 0.35;
  vec3 hopeColor = vec3(1.0, 0.85, 0.6) * hopeGlow * edge; // warm amber

  // ── Procedural Environment Reflection (glass/crystal reflects its surroundings) ──
  vec3 reflected = reflect(-viewDir, normal);
  float envAngle = atan(reflected.y, reflected.x) * 0.1591 + 0.5;
  float envHeight = reflected.z * 0.5 + 0.5;
  vec3 envColor = cosinePalette(
    envAngle + envHeight * 0.3 + uTime * 0.02,
    vec3(0.5, 0.5, 0.6), vec3(0.25, 0.20, 0.30),
    vec3(1.0, 1.0, 0.8), vec3(0.0, 0.33, 0.67)
  );
  float envStr = fresnel * mix(0.08, 0.24, nv);

  // ── Phase 3-B.2: Apple Intelligence ALWAYS-SHIMMER mesh gradient (Q8=а) ──
  // Rainbow wave sweeps across orb continuously — purple→pink→blue→red→orange loop.
  // Masked by Fresnel so edges glow most (body interior gets subtler treatment).
  // Driven by uShimmerTime (independent clock → reduced-motion pauses phase at 0).
  // uShimmerStrength=0 fully disables (used by prefers-reduced-motion path).
  float apiNoise = snoise(vec3(
    center * 2.2 + uShimmerTime * 0.08,
    uShimmerTime * 0.05
  )) * 0.5 + 0.5;
  float apiPhase = uShimmerTime * 0.07 + apiNoise * 0.4 + angle * 0.15;
  vec3 apiRainbow = appleIntelligencePalette(apiPhase);
  // Edge-weighted mask: 0.25 body, 1.0 rim (Fresnel-driven)
  float apiMask = 0.25 + 0.75 * smoothstep(0.0, 0.65, fresnel);
  // Intensity: strongest on bright emotional states, subtle on neutral
  float apiIntensity = uShimmerStrength * apiMask * mix(0.30, 0.55, nv);
  // Color breathing: gentle valence bias so "angry" orbs still shimmer warm, "calm" cool
  vec3 apiShimmer = apiRainbow * apiIntensity;

  // ── Compose lit surface ──
  vec3 ambient = shimmerColor * 0.25;
  vec3 diffuse = shimmerColor * (diff1 * 0.62 + diff2 * 0.18);
  vec3 rim = mix(shimmerColor, vec3(1.0), 0.40) * fresnel * fresnelStr;
  vec3 subsurface = shimmerColor * sss + sssSkinTint * sssPlus; // Apotheosis SSS add
  vec3 depthColor = shimmerColor * depthGlow * depthStr;
  vec3 litColor = (ambient + diffuse + specular + specular2 + rim + subsurface
                + iridescent * iriStrength + depthColor + hopeColor
                + envColor * envStr + causticColor
                + apiShimmer)  // Phase 3-B.2: Apple Intelligence mesh gradient (always-on)
                * ao * surfaceTex;

  // ── Inner depth shadow (dark band just inside body edge — glass depth) ──
  float depthShadowZone = smoothstep(shapeR * 0.65, shapeR * 0.90, dist)
                        * smoothstep(shapeR * 1.02, shapeR * 0.92, dist);
  float depthShadow = depthShadowZone * 0.28;
  litColor *= (1.0 - depthShadow);

  // ── Glass Inner Rim Glow (caustique band — light refracting through glass edge) ──
  float rimZone = smoothstep(shapeR * 0.70, shapeR * 0.88, dist)
                * smoothstep(shapeR * 1.01, shapeR * 0.92, dist);
  float glassRimGlow = rimZone * 0.55;
  vec3 rimGlowColor = mix(shimmerColor * 0.9, vec3(1.0), 0.55);
  litColor += rimGlowColor * glassRimGlow * edge;

  // ── Glow / Bloom / Aura (dramatic — orb clearly emits light) ──
  float darkMult = uIsDark > 0.5 ? 1.15 : 1.0;
  float innerGlow = exp(-max(sdf, 0.0) * 14.0) * 0.27 * darkMult; // -40% pulse brightness
  float aura = exp(-dist * 2.8) * 0.18 * darkMult;    // -40% pulse brightness
  float bloom = exp(-dist * 5.0) * 0.07 * darkMult;   // -40% pulse brightness

  // Light theme: brighter aura so premultiplied pixels don't darken light backgrounds
  float auraLightBoost = uIsDark > 0.5 ? 1.0 : 1.3;
  vec3 auraColor = shimmerColor * 1.15 * auraLightBoost;
  // Organic atmosphere edge — noise-driven fade, ALL atmospheric effects clamp here
  float auraEdgeNoise = 0.92 + snoise(vec3(angle * 2.0, uTime * 0.1, 0.0)) * 0.08;
  float atmosphereFade = 1.0 - smoothstep(shapeR * 1.6, shapeR * 2.8 * auraEdgeNoise, dist);
  aura *= atmosphereFade;
  innerGlow *= atmosphereFade;
  bloom *= atmosphereFade;

  // NOTE: aura dimming is ring-local, applied after ring computation (before final composition)

  // ── Volumetric Light Rays (god rays behind orb) ──
  float rayAngle = angle + uTime * 0.03;
  float raySharpHi = mix(4.0, 12.0, nv);  // foggy at negative → sharp at positive
  float raySharpLo = mix(3.0, 8.0, nv);
  float rays = pow(abs(cos(rayAngle * 5.0)), raySharpHi) * 0.6
             + pow(abs(cos(rayAngle * 8.0 + 1.0)), raySharpLo) * 0.3;
  float rayDecay = mix(8.0, 4.0, nv);
  float rayFalloff = exp(-max(sdf, 0.0) * rayDecay);
  float rayNoise = snoise(vec3(rayAngle * 2.0, uTime * 0.2, 5.0)) * 0.3 + 0.7;
  float rayStr = mix(0.04, 0.14, nv) * darkMult; // P5: -35% volumetric rays
  float rayIntensity = rays * rayFalloff * rayNoise * rayStr * atmosphereFade;

  // ── Particles (22 glow spots via uniforms) ──
  float particleGlow = 0.0;
  for (int i = 0; i < 22; i++) {
    vec4 p = uParticles[i];
    if (p.w > 0.01) {
      vec2 pOff = center - (p.xy - 0.5);
      float pDist = length(pOff);
      float pRadius = p.z * 3.0;
      float falloff = max(0.0, 1.0 - pDist / pRadius);
      particleGlow += falloff * falloff * p.w * 0.35;
    }
  }
  particleGlow *= atmosphereFade;

  // ── Touch Ripple (expanding wave from touch point) ──
  float ripple = 0.0;
  if (uTouch.z > 0.0) {
    vec2 touchUV = uTouch.xy - 0.5;
    float touchDist = length(center - touchUV);
    float rippleRadius = uTouch.z * 0.3;
    float rippleWidth = 0.02 + uTouch.z * 0.015;
    float ring = exp(-pow((touchDist - rippleRadius) / rippleWidth, 2.0));
    float rippleFade = exp(-uTouch.z * 2.5);
    ripple = ring * rippleFade * 0.4;
  }

  // ── Shimmer burst (P3 — large valence change flash: desaturate + brighten) ──
  float lum = dot(litColor, vec3(0.299, 0.587, 0.114));
  litColor = mix(litColor, vec3(lum * 1.5 + 0.15), uShimmer * 0.4);

  // ── Luminous Core (bright center — light focusing through glass stack) ──
  float coreGlow = exp(-dist * dist / (shapeR * shapeR * 0.10)) * 0.23;
  vec3 coreColor = mix(shimmerColor * 1.1, vec3(1.0), 0.35);
  litColor += coreColor * coreGlow;

  // ── Apple Health: Glass Transparency (bright center → almost-transparent edge) ──
  float glassDepth = exp(-dist * dist / (shapeR * shapeR * 0.18)) * 0.65 + 0.05;
  float glassEdge = edge * glassDepth;

  // ── Glass Edge Refraction (wide bright band on body contour — Apple glass rim) ──
  // Uses cleanSdfEarly/cleanFwEarly (pure superformula, no noise) — prevents
  // noise micro-bumps from appearing as ugly corners in the bright rim.
  float edgeHighlight = exp(-cleanSdfEarly * cleanSdfEarly / (cleanFwEarly * cleanFwEarly * 20.0)) * 0.92;
  vec3 edgeHLColor = mix(shimmerColor * 1.15, vec3(1.0), 0.40);

  // ── Concentric Ring System (outward wave — rings emanate from body) ──
  // Rings are born at body edge, expand outward following body silhouette,
  // fade as they travel. 4 rings staggered = continuous pulse from center.
  // Like ripples on water, each following the body's superformula contour.
  float ringFw = max(fw * 4.0, 0.008); // wider rings + minimum floor for any DPI

  // Sharp glass rim edge + one-sided soft glow
  #define GLASS_RIM(s, alpha) ((smoothstep(ringFw, 0.0, abs(s)) * 0.65 + exp(-max(s, 0.0) * max(s, 0.0) / (ringFw * ringFw * 16.0)) * 0.35) * (alpha))

  // Inner rings (2 inside body — visible through glass, original behavior)
  float breathBase = breathCurve;
  float ripple0 = 1.0 + breathBase * 0.03;
  float ripple1 = 1.0 + breathBase * 0.026;

  float in1_sdf = dist - cleanShapeR * 0.65 * ripple0;
  float in1 = GLASS_RIM(in1_sdf, 0.40) * edge;
  float in2_sdf = dist - cleanShapeR * 0.35 * ripple1;
  float in2 = GLASS_RIM(in2_sdf, 0.30) * edge;

  float innerRings = in1 + in2;
  vec3 innerRingColor = shimmerColor * 1.2;

  // ── Outer rings: STEADY OUTWARD PULSE (metronome heartbeat) ──
  // Apple principle: body = expression (shape/color/breath adapts to mood)
  //                  rings = heartbeat (constant rhythm, never changes speed)
  // On valence change: rings adapt SHAPE (follow cleanShapeR) not RHYTHM → zero glitch.

  // FIXED pulse speed — metronome, no valence/breath dependency
  float pulseSpeed = 0.15;  // cycles/sec (~6.7s cycle, ring every ~2.2s — calm heartbeat)
  float ringGap = 1.08;     // 8% gap after body edge (visible breathing room)
  float ringTravel = 0.55;  // travel: 1.08 → 1.63 × body (wider sweep, more visible)

  // 3 rings at 33% phase intervals — more impact per ring, more spacing
  float wp1 = fract(uTime * pulseSpeed);
  float wp2 = fract(uTime * pulseSpeed + 0.333);
  float wp3 = fract(uTime * pulseSpeed + 0.667);

  // Position: ease-out cubic — fast emergence near body, decelerates outward
  float ws1 = ringGap + (1.0 - pow(1.0 - wp1, 3.0)) * ringTravel;
  float ws2 = ringGap + (1.0 - pow(1.0 - wp2, 3.0)) * ringTravel;
  float ws3 = ringGap + (1.0 - pow(1.0 - wp3, 3.0)) * ringTravel;

  // Opacity: snap birth (8%) → sustain → graceful fade (40-72%) → gone before next arrives
  float wa1 = smoothstep(0.0, 0.08, wp1) * (1.0 - smoothstep(0.40, 0.72, wp1));
  float wa2 = smoothstep(0.0, 0.08, wp2) * (1.0 - smoothstep(0.40, 0.72, wp2));
  float wa3 = smoothstep(0.0, 0.08, wp3) * (1.0 - smoothstep(0.40, 0.72, wp3));

  // Ring softness: sharp near body (birth) → slightly softer as expands
  float ringSoft1 = ringFw * (1.0 + wp1 * 0.5);
  float ringSoft2 = ringFw * (1.0 + wp2 * 0.5);
  float ringSoft3 = ringFw * (1.0 + wp3 * 0.5);

  // SDF: each ring follows body silhouette at expanding distance
  // 70% sharp edge / 30% bloom glow — luminous halo per ring
  #define GLASS_RIM_W(s, alpha, soft) ((smoothstep(soft, 0.0, abs(s)) * 0.70 + exp(-max(s, 0.0) * max(s, 0.0) / (soft * soft * 10.0)) * 0.30) * (alpha))

  float or1_sdf = dist - cleanShapeR * ws1;
  float ring1 = GLASS_RIM_W(or1_sdf, wa1 * 0.48, ringSoft1);
  float or2_sdf = dist - cleanShapeR * ws2;
  float ring2 = GLASS_RIM_W(or2_sdf, wa2 * 0.45, ringSoft2);
  float or3_sdf = dist - cleanShapeR * ws3;
  float ring3 = GLASS_RIM_W(or3_sdf, wa3 * 0.40, ringSoft3);

  // Ring colors computed post-ACES (see "Post-ACES ring overlay" section below)

  // ── Ring-local aura dimming (only where rings currently ARE, not a static zone) ──
  // Aggressive contrast carving — up to 85% dimming where rings are brightest
  float ringPresence = ring1 + ring2 + ring3;
  float localAuraDim = 1.0 - clamp(ringPresence * 4.0, 0.0, 0.50);
  aura *= localAuraDim;
  innerGlow *= localAuraDim;

  // ── Final Composition (base scene WITHOUT outer rings) ──
  vec3 baseColor = litColor * glassEdge
                 + edgeHLColor * edgeHighlight * cleanEdge
                 + innerRingColor * innerRings
                 + auraColor * innerGlow * (1.0 + uShimmer * 0.8)
                 + auraColor * aura * (1.0 + uShimmer * 0.8)
                 + auraColor * rayIntensity
                 + vec3(1.0) * bloom * 0.25
                 + (shimmerColor * 1.2 + vec3(0.15)) * particleGlow
                 + shimmerColor * ripple * 2.0;
  float finalAlpha = clamp(glassEdge + edgeHighlight * 0.5 + innerRings * 0.6
                  + ring1 + ring2 + ring3
                  + innerGlow + aura + bloom + particleGlow + rayIntensity + ripple, 0.0, 1.0);

  // ── Genesis fade-in (glow appears before body materializes) ──
  float genesisAlpha = smoothstep(0.0, 0.15, uGenesis);
  finalAlpha *= genesisAlpha;

  // ── Vignette (extended to not clip outer rings) ──
  float vignette = 1.0 - smoothstep(0.46, 0.56, dist);
  finalAlpha *= vignette;

  // Kill sub-threshold alpha (prevents dark fringing on any background)
  finalAlpha *= smoothstep(0.0, 0.015, finalAlpha);

  if (uIsDark > 0.5) {
    finalAlpha = min(1.0, finalAlpha * 1.15);
  }

  // ── ACES Filmic Tone Mapping (base scene only — rings bypass) ──
  // Phase 3-B.2: when uHDREnabled=1.0, boost core above 1.0 BEFORE tone-mapping
  // so Task B's bloom pass can threshold bright pixels. Standard path is unchanged.
  float hdrCoreBoost = uHDREnabled * coreGlow * 1.8; // up to +1.8 linear at core
  vec3 hdrBase = baseColor + shimmerColor * hdrCoreBoost;
  float tmA = 2.51; float tmB = 0.03; float tmC = 2.43; float tmD = 0.59; float tmE = 0.14;
  // HDR-ready: upper clamp lifted to 4.0 when HDR enabled → Task B bloom samples >1.0 pixels
  float hdrCeil = mix(1.0, 4.0, uHDREnabled);
  vec3 finalColor = clamp((hdrBase * (tmA * hdrBase + tmB)) / (hdrBase * (tmC * hdrBase + tmD) + tmE), 0.0, hdrCeil);

  // ── Post-ACES ring overlay (additive glow — bypasses tone mapping compression) ──
  // Tone-map shimmerColor to match scene palette, but ring INTENSITY is uncompressed
  vec3 tmShimmer = clamp((shimmerColor * (tmA * shimmerColor + tmB)) / (shimmerColor * (tmC * shimmerColor + tmD) + tmE), 0.0, 1.0);
  vec3 ringGlowColor = mix(tmShimmer * 1.15, vec3(1.0), 0.18);
  float ringSum = ring1 + ring2 + ring3;
  finalColor = clamp(finalColor + ringGlowColor * ringSum, 0.0, 1.0);

  // Premultiplied alpha
  gl_FragColor = vec4(finalColor * finalAlpha, finalAlpha);
}
