
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

// ─── Main ───

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 center = uv - 0.5;
  float dist = length(center);
  float angle = atan(center.y, center.x);

  // ── Animation parameters ──
  float rotSpeed = mix(0.055, 0.015, (uValence + 1.0) * 0.5);
  float rotation = uTime * rotSpeed;
  float noiseSpeed = mix(0.85, 0.20, (uValence + 1.0) * 0.5);
  // Noise — barely perceptible organic life (Apple: ~1% body variation, clean edges)
  float noiseAmp = 0.003 + (uValence < 0.0 ? abs(uValence) * 0.007 : abs(uValence) * 0.003);

  // ── Physiological Breathing (inhale 4 → hold 1 → exhale 5 → pause 2 beats) ──
  // Valence-adaptive period: anxious breathes fast, calm breathes slow
  float breathPeriod = mix(8.0, 16.0, (uValence + 1.0) * 0.5);
  float breathJitter = snoise(vec3(uTime * 0.03, 500.0, 0.0)) * 0.05; // ±5% organic drift
  float breathPhase = fract(uTime / (breathPeriod * (1.0 + breathJitter)));
  float breathInhale = smoothstep(0.0, 0.333, breathPhase);
  float breathExhale = 1.0 - smoothstep(0.417, 0.833, breathPhase);
  float breathPause = step(0.833, breathPhase);
  float breathCurve = min(breathInhale, breathExhale) * (1.0 - breathPause);
  float breath = 1.0 + breathCurve * 0.05 - 0.025;

  // ── Noise displacement (3-octave, per-pixel) ──
  float rotAngle = angle + rotation;
  float ca = cos(rotAngle);
  float sa = sin(rotAngle);
  float nv1 = snoise(vec3(
    ca * 2.5 + uTime * noiseSpeed,
    sa * 2.5 + uTime * noiseSpeed * 0.7,
    10.0
  ));
  float nv2 = snoise(vec3(
    ca * 5.0 + uTime * noiseSpeed * 1.3 + 100.0,
    sa * 5.0 + uTime * noiseSpeed * 0.9 + 100.0,
    10.0
  ));
  float nv3 = snoise(vec3(
    ca * 10.0 + uTime * noiseSpeed * 1.7 + 200.0,
    sa * 10.0 + uTime * noiseSpeed * 1.1 + 200.0,
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

  // ── Superformula shape ──
  float mRound = floor(uShapeM + 0.5);
  float sf = superformula(warpedAngle, mRound, uShapeN1, uShapeN2, uShapeN3);
  float baseR = 0.25; // smaller body — Apple: delicate flower floating in space, not filling canvas
  float cleanShapeR = baseR * sf * breath * max(uGenesis, 0.01); // pure superformula (for rings)
  float shapeR = cleanShapeR * (1.0 + noiseDisp); // with noise (for body)

  // ── Signed Distance Field (Apple Quality: micro-bump removed for clean edges) ──
  float sdf = dist - shapeR;

  // ── Soft edge (fwidth-based resolution-independent AA, valence-adaptive) ──
  float fw = fwidth(sdf);
  float edgeScale = mix(1.2, 1.8, (uValence + 1.0) * 0.5);
  float edge = 1.0 - smoothstep(-fw * edgeScale, fw * edgeScale, sdf);

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

  // ── Iridescence (body-wide — visible across entire surface, stronger at rim) ──
  float filmThickness = 0.3 + 0.7 * (1.0 - max(dot(normal, viewDir), 0.0));
  filmThickness += snoise(vec3(center * 4.0, uTime * 0.15)) * 0.12;
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
  float roughness = mix(0.38, 0.14, nv);
  float ggxA = roughness * roughness;
  float ggxA2 = ggxA * ggxA;
  float NdotH = max(dot(normal, halfDir), 0.0);
  float ggxDenom = NdotH * NdotH * (ggxA2 - 1.0) + 1.0;
  float ggxD = ggxA2 / (3.14159 * ggxDenom * ggxDenom);
  float specF = 0.08 + 0.92 * pow(1.0 - max(dot(halfDir, viewDir), 0.0), 5.0);
  vec3 specular = vec3(1.0) * ggxD * specF * 0.80;
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
  float depthPulse = sin(uTime * 1.2) * 0.25 + 0.75;
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

  // ── Compose lit surface ──
  vec3 ambient = shimmerColor * 0.25;
  vec3 diffuse = shimmerColor * (diff1 * 0.62 + diff2 * 0.18);
  vec3 rim = mix(shimmerColor, vec3(1.0), 0.40) * fresnel * fresnelStr;
  vec3 subsurface = shimmerColor * sss;
  vec3 depthColor = shimmerColor * depthGlow * depthStr;
  vec3 litColor = (ambient + diffuse + specular + specular2 + rim + subsurface
                + iridescent * iriStrength + depthColor + hopeColor
                + envColor * envStr + causticColor)
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
  float innerGlow = exp(-max(sdf, 0.0) * 14.0) * 0.45 * darkMult; // wider + 50% brighter
  float aura = exp(-dist * 2.8) * 0.30 * darkMult;    // slower decay + 67% brighter
  float bloom = exp(-dist * 5.0) * 0.12 * darkMult;   // wider + 85% brighter

  vec3 auraColor = shimmerColor * 1.15; // brighter aura
  // Organic aura edge — noise-driven fade, extended range
  float auraEdgeNoise = 0.92 + snoise(vec3(angle * 2.0, uTime * 0.1, 0.0)) * 0.08;
  float auraClamp = 1.0 - smoothstep(shapeR * 1.8, shapeR * 3.0 * auraEdgeNoise, dist);
  aura *= auraClamp;
  innerGlow *= auraClamp;

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
  float rayIntensity = rays * rayFalloff * rayNoise * rayStr;

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
  float coreGlow = exp(-dist * dist / (shapeR * shapeR * 0.06)) * 0.55;
  vec3 coreColor = mix(shimmerColor * 1.1, vec3(1.0), 0.55);
  litColor += coreColor * coreGlow;

  // ── Apple Health: Glass Transparency (bright center → almost-transparent edge) ──
  float glassDepth = exp(-dist * dist / (shapeR * shapeR * 0.18)) * 0.65 + 0.05;
  float glassEdge = edge * glassDepth;

  // ── Glass Edge Refraction (wide bright band on body contour — Apple glass rim) ──
  float edgeHighlight = exp(-sdf * sdf / (fw * fw * 20.0)) * 0.92;
  vec3 edgeHLColor = mix(shimmerColor * 1.15, vec3(1.0), 0.40);

  // ── Concentric Ring System (crisp glass rim highlights) ──
  float ringFw = fw * 2.0; // resolution-adaptive ring sharpness (tighter for crisp edges)
  float breathBase = breathCurve;

  // Sharp glass rim edge + one-sided soft glow
  #define GLASS_RIM(s, alpha) ((smoothstep(ringFw, 0.0, abs(s)) * 0.65 + exp(-max(s, 0.0) * max(s, 0.0) / (ringFw * ringFw * 16.0)) * 0.35) * (alpha))

  // Inner rings (2 inside body — visible through glass)
  float ripple0 = 1.0 + breathBase * 0.03;
  float ripple1 = 1.0 + breathBase * 0.026;

  float in1_sdf = dist - cleanShapeR * 0.65 * ripple0;
  float in1 = GLASS_RIM(in1_sdf, 0.40) * edge;
  float in2_sdf = dist - cleanShapeR * 0.35 * ripple1;
  float in2 = GLASS_RIM(in2_sdf, 0.30) * edge;

  float innerRings = in1 + in2;
  vec3 innerRingColor = shimmerColor * 1.2;

  // Outer rings (4 outside body)
  float rip1 = 1.0 + breathBase * 0.028;
  float rip2 = 1.0 + breathBase * 0.024;
  float rip3 = 1.0 + breathBase * 0.020;
  float rip4 = 1.0 + breathBase * 0.016;

  float or1_sdf = dist - cleanShapeR * 1.12 * rip1;
  float ring1 = GLASS_RIM(or1_sdf, 0.55);
  float or2_sdf = dist - cleanShapeR * 1.28 * rip2;
  float ring2 = GLASS_RIM(or2_sdf, 0.45);
  float or3_sdf = dist - cleanShapeR * 1.44 * rip3;
  float ring3 = GLASS_RIM(or3_sdf, 0.35);
  float or4_sdf = dist - cleanShapeR * 1.55 * rip4;
  float ring4 = GLASS_RIM(or4_sdf, 0.25);

  vec3 ring1Color = shimmerColor * 0.90;
  vec3 ring2Color = mix(shimmerColor, vec3(1.0), 0.08) * 0.82;
  vec3 ring3Color = mix(shimmerColor, vec3(1.0), 0.15) * 0.72;
  vec3 ring4Color = mix(shimmerColor, vec3(1.0), 0.22) * 0.60;

  // ── Final Composition (glass body + ring highlights) ──
  vec3 finalColor = litColor * glassEdge
                  + edgeHLColor * edgeHighlight * edge
                  + innerRingColor * innerRings
                  + ring1Color * ring1 + ring2Color * ring2 + ring3Color * ring3
                  + ring4Color * ring4
                  + auraColor * innerGlow * (1.0 + uShimmer * 0.8)
                  + auraColor * aura * (1.0 + uShimmer * 0.8)
                  + auraColor * rayIntensity
                  + vec3(1.0) * bloom * 0.25
                  + (shimmerColor * 1.2 + vec3(0.15)) * particleGlow
                  + shimmerColor * ripple * 2.0;
  float finalAlpha = clamp(glassEdge + edgeHighlight * 0.5 + innerRings * 0.6
                  + ring1 + ring2 + ring3 + ring4
                  + innerGlow + aura + bloom + particleGlow + rayIntensity + ripple, 0.0, 1.0);

  // ── Genesis fade-in (glow appears before body materializes) ──
  float genesisAlpha = smoothstep(0.0, 0.15, uGenesis);
  finalAlpha *= genesisAlpha;

  // ── Vignette (fade to transparent at canvas edges — eliminates square artifact) ──
  float vignette = 1.0 - smoothstep(0.48, 0.56, dist); // wider — space for rings + aura
  finalAlpha *= vignette;

  if (uIsDark > 0.5) {
    finalAlpha = min(1.0, finalAlpha * 1.15);
  }

  // ── ACES Filmic Tone Mapping (cinematic color — highlights preserve hue, don't burn white) ──
  float tmA = 2.51; float tmB = 0.03; float tmC = 2.43; float tmD = 0.59; float tmE = 0.14;
  finalColor = clamp((finalColor * (tmA * finalColor + tmB)) / (finalColor * (tmC * finalColor + tmD) + tmE), 0.0, 1.0);

  // Premultiplied alpha
  gl_FragColor = vec4(finalColor * finalAlpha, finalAlpha);
}
