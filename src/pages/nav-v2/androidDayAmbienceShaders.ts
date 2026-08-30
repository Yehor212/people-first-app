export const ANDROID_DAY_AMBIENCE_VERTEX_SHADER = `#version 300 es
precision highp float;

const vec2 POSITIONS[3] = vec2[3](
  vec2(-1.0, -1.0),
  vec2(3.0, -1.0),
  vec2(-1.0, 3.0)
);

out vec2 vUv;

void main() {
  vec2 position = POSITIONS[gl_VertexID];
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const READABLE_DYNAMIC_CORRECTION_GLSL = `
uniform vec3 uVeilBackground;
uniform vec3 uVeilCard;

const vec3 READABLE_LUMA = vec3(0.213, 0.715, 0.072);
const float READABLE_SATURATION = 0.94;
const float READABLE_CONTRAST = 0.98;

vec3 applyReadableFilter(vec3 color) {
  float luminance = dot(color, READABLE_LUMA);
  vec3 saturated = mix(vec3(luminance), color, READABLE_SATURATION);
  return (saturated - 0.5) * READABLE_CONTRAST + 0.5;
}

float linearVeilAlpha(float cssY) {
  if (cssY <= 0.48) return mix(0.42, 0.18, cssY / 0.48);
  return mix(0.18, 0.36, (cssY - 0.48) / 0.52);
}

float radialVeilAlpha(vec2 cssUv) {
  vec2 normalized = vec2((cssUv.x - 0.5) / 0.76, (cssUv.y - 0.09) / 0.30);
  float distanceFromCenter = length(normalized);
  return 0.46 * (1.0 - clamp(distanceFromCenter / 0.70, 0.0, 1.0));
}

vec4 correctReadableDynamic(vec4 dynamicScene, vec2 cssUv) {
  if (dynamicScene.a <= 0.000001) {
    return vec4(0.0);
  }

  vec3 filteredDynamic = applyReadableFilter(dynamicScene.rgb / dynamicScene.a);
  float linearAlpha = linearVeilAlpha(cssUv.y);
  float radialAlpha = radialVeilAlpha(cssUv);
  vec3 veilPremultiplied = uVeilBackground * linearAlpha;
  float veilAlpha = linearAlpha;
  veilPremultiplied = uVeilCard * radialAlpha + veilPremultiplied * (1.0 - radialAlpha);
  veilAlpha = radialAlpha + veilAlpha * (1.0 - radialAlpha);

  vec3 treatedDynamic = veilPremultiplied + filteredDynamic * (1.0 - veilAlpha);
  return vec4(clamp(treatedDynamic, 0.0, 1.0) * dynamicScene.a, dynamicScene.a);
}
`;

export const ANDROID_DAY_AMBIENCE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;
uniform vec4 uAmbiencePhases;
uniform float uAspect;
uniform vec3 uWarm;
uniform vec3 uFocus;
uniform vec3 uBody;
uniform vec3 uPrism;
out vec4 outColor;

${READABLE_DYNAMIC_CORRECTION_GLSL}

float softBand(float value, float center, float width) {
  float distanceFromCenter = abs(value - center);
  return 1.0 - smoothstep(width * 0.45, width, distanceFromCenter);
}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  vec2 centered = uv - vec2(0.5, 0.32);
  centered.x *= uAspect;

  float curtainPhase = uAmbiencePhases.x;
  float curtainMask = 1.0 - smoothstep(0.28, 0.93, length(centered * vec2(0.78, 1.02)));
  float curtain = 0.0;
  if (curtainMask > 0.0) {
    float curtainShift = mix(-0.012, 0.014, curtainPhase);
    float curtainAxis = uv.x + uv.y * 0.19 + curtainShift;
    curtain = softBand(curtainAxis, 0.31, 0.10) * 0.66;
    curtain += softBand(curtainAxis, 0.55, 0.075) * 0.48;
    curtain += softBand(curtainAxis, 0.76, 0.055) * 0.32;
    curtain *= curtainMask * mix(0.46, 0.72, curtainPhase);
  }

  float showerPhase = uAmbiencePhases.y;
  float showerMask = 1.0 - smoothstep(0.31, 0.91, length((uv - vec2(0.48, 0.22)) * vec2(0.82, 1.18)));
  float shower = 0.0;
  if (showerMask > 0.0) {
    float showerAxis = uv.x + uv.y * mix(0.235, 0.265, showerPhase);
    shower = softBand(showerAxis, mix(0.57, 0.62, showerPhase), 0.135);
    float showerLines = 1.0 - smoothstep(0.022, 0.085, abs(fract(showerAxis * 12.8) - 0.5));
    shower = (shower * 0.82 + showerLines * 0.18) * showerMask;
    shower *= mix(0.42, 0.78, showerPhase);
  }

  float prismPhase = uAmbiencePhases.z;
  float prismAxis = uv.y + uv.x * mix(0.175, 0.235, prismPhase);
  float prismCenter = mix(0.245, 0.205, prismPhase);
  float prismDistance = abs(prismAxis - prismCenter);
  float prism = 0.0;
  if (prismDistance < 0.105) {
    prism = 1.0 - smoothstep(0.105 * 0.45, 0.105, prismDistance);
    float prismMask = 1.0 - smoothstep(0.12, 0.72, abs(uv.x - 0.5));
    prism *= prismMask * mix(0.34, 0.72, prismPhase);
  }

  float causticPhase = uAmbiencePhases.w;
  vec2 causticCenter = vec2(mix(0.47, 0.54, causticPhase), mix(0.30, 0.27, causticPhase));
  vec2 causticPoint = (uv - causticCenter) * vec2(uAspect * 0.72, 1.0);
  float ringDistance = length(causticPoint);
  float causticMask = 1.0 - smoothstep(0.26, 0.74, ringDistance);
  float caustics = 0.0;
  if (causticMask > 0.0) {
    float rings = 0.5 + 0.5 * cos(ringDistance * 118.0);
    rings = smoothstep(0.66, 0.96, rings);
    float diagonal = smoothstep(0.80, 0.98, 0.5 + 0.5 * cos((uv.x + uv.y * 0.42) * 77.0));
    caustics = mix(rings, diagonal, 0.34) * causticMask * mix(0.42, 0.78, causticPhase);
  }

  vec3 curtainColor = mix(uWarm, uBody, clamp(uv.x * 0.86, 0.0, 1.0));
  vec3 showerColor = mix(uWarm, uFocus, clamp(uv.y * 0.72, 0.0, 1.0));
  vec3 prismColor = mix(uPrism, uBody, clamp(uv.x, 0.0, 1.0));
  vec3 causticColor = mix(uFocus, uBody, 0.58);

  vec3 premultiplied = vec3(0.0);
  float alpha = 0.0;
  float curtainAlpha = curtain * 0.15;
  premultiplied += curtainColor * curtainAlpha;
  alpha = max(alpha, curtainAlpha);
  float showerAlpha = shower * 0.13;
  premultiplied += showerColor * showerAlpha;
  alpha = max(alpha, showerAlpha);
  float prismAlpha = prism * 0.12;
  premultiplied += prismColor * prismAlpha;
  alpha = max(alpha, prismAlpha);
  float causticAlpha = caustics * 0.07;
  premultiplied += causticColor * causticAlpha;
  alpha = clamp(alpha + causticAlpha * 0.45, 0.0, 0.24);

  premultiplied = clamp(premultiplied, 0.0, 1.0);
  outColor = correctReadableDynamic(vec4(premultiplied, alpha), uv);
}
`;

const CUBIC_BEZIER_GLSL = `
float cubicCoordinate(float t, float p1, float p2) {
  float inverse = 1.0 - t;
  return 3.0 * inverse * inverse * t * p1 + 3.0 * inverse * t * t * p2 + t * t * t;
}

float cubicDerivative(float t, float p1, float p2) {
  float inverse = 1.0 - t;
  return 3.0 * inverse * inverse * p1 + 6.0 * inverse * t * (p2 - p1) + 3.0 * t * t * (1.0 - p2);
}

float cubicBezier(float x, vec2 control1, vec2 control2) {
  float t = clamp(x, 0.0, 1.0);
  for (int iteration = 0; iteration < 4; iteration++) {
    float derivative = cubicDerivative(t, control1.x, control2.x);
    if (abs(derivative) < 0.0001) break;
    t = clamp(t - (cubicCoordinate(t, control1.x, control2.x) - x) / derivative, 0.0, 1.0);
  }
  return cubicCoordinate(t, control1.y, control2.y);
}

float easeInOut(float x) {
  return cubicBezier(x, vec2(0.42, 0.0), vec2(0.58, 1.0));
}
`;

export const ANDROID_DAY_PARTICLE_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aGeometry;
layout(location = 2) in vec4 aMotion;

uniform float uTime;
uniform vec2 uViewport;

out vec2 vLocalPx;
out vec2 vCssUv;
out float vOpacity;
out float vSize;
flat out int vKind;

${CUBIC_BEZIER_GLSL}

void photonMotion(float phase, float drift, out vec2 delta, out float scale, out float opacity) {
  if (phase < 0.42) {
    float progress = easeInOut(phase / 0.42);
    delta = mix(vec2(0.0), vec2(drift, -drift), progress);
    scale = mix(0.72, 1.22, progress);
    opacity = mix(0.34, 1.0, progress);
  } else if (phase < 0.72) {
    float progress = easeInOut((phase - 0.42) / 0.30);
    delta = mix(vec2(drift, -drift), vec2(-6.0, -14.0), progress);
    scale = mix(1.22, 0.92, progress);
    opacity = mix(1.0, 0.72, progress);
  } else {
    float progress = easeInOut((phase - 0.72) / 0.28);
    delta = mix(vec2(-6.0, -14.0), vec2(0.0), progress);
    scale = mix(0.92, 0.72, progress);
    opacity = mix(0.72, 0.34, progress);
  }
}

void moteMotion(float phase, out vec2 delta, out float scale, out float opacity) {
  if (phase < 0.5) {
    float progress = phase / 0.5;
    delta = mix(vec2(0.0), vec2(12.0, -24.0), progress);
    scale = mix(1.0, 1.1, progress);
  } else {
    float progress = (phase - 0.5) / 0.5;
    delta = mix(vec2(12.0, -24.0), vec2(-8.0, -48.0), progress);
    scale = mix(1.1, 0.9, progress);
  }
  if (phase < 0.1) opacity = phase / 0.1;
  else if (phase <= 0.9) opacity = 1.0;
  else opacity = (1.0 - phase) / 0.1;
}

void main() {
  float duration = aMotion.x;
  float phase = mod(max(0.0, uTime - aMotion.y), duration) / duration;
  vKind = int(aMotion.w + 0.5);

  vec2 delta;
  float scale;
  float opacity;
  if (vKind < 5) {
    photonMotion(phase, aMotion.z, delta, scale, opacity);
    opacity *= aGeometry.w;
  } else {
    moteMotion(phase, delta, scale, opacity);
  }

  float halfExtent = vKind < 5 ? max(34.0, aGeometry.z * 2.1) : max(20.0, aGeometry.z + 18.0);
  halfExtent *= scale;
  vec2 center = aGeometry.xy * 0.01 * uViewport + delta;
  vLocalPx = aCorner * halfExtent;
  vOpacity = clamp(opacity, 0.0, 1.0);
  vSize = aGeometry.z * scale;
  vec2 pixel = center + vLocalPx;
  vCssUv = pixel / uViewport;
  vec2 clip = vec2(pixel.x / uViewport.x * 2.0 - 1.0, 1.0 - pixel.y / uViewport.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
}
`;

export const ANDROID_DAY_PARTICLE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vLocalPx;
in vec2 vCssUv;
in float vOpacity;
in float vSize;
flat in int vKind;

uniform float uDpr;
uniform vec3 uBody;
uniform vec3 uEnergy;
uniform vec3 uFocus;
uniform vec3 uMind;
uniform vec3 uRelease;
uniform vec3 uTrace;
uniform vec4 uMote;

out vec4 outColor;

${READABLE_DYNAMIC_CORRECTION_GLSL}

vec4 over(vec4 below, vec4 above) {
  return above + below * (1.0 - above.a);
}

vec4 layer(vec3 color, float alpha) {
  float bounded = clamp(alpha, 0.0, 1.0);
  return vec4(color * bounded, bounded);
}

float gaussian(float distanceValue, float sigma) {
  float ratio = distanceValue / max(sigma, 0.001);
  return exp(-0.5 * ratio * ratio);
}

void photonPalette(int tone, out vec3 mainColor, out float mainAlpha, out vec3 secondaryColor,
  out float glowAlpha, out float secondaryAlpha) {
  if (tone == 0) {
    mainColor = uFocus; mainAlpha = 0.88; secondaryColor = uBody; glowAlpha = 0.66; secondaryAlpha = 0.40;
  } else if (tone == 1) {
    mainColor = vec3(1.0, 0.80, 0.52); mainAlpha = 0.95; secondaryColor = uEnergy; glowAlpha = 0.76; secondaryAlpha = 0.46;
  } else if (tone == 2) {
    mainColor = uBody; mainAlpha = 0.92; secondaryColor = uFocus; glowAlpha = 0.74; secondaryAlpha = 0.36;
  } else if (tone == 3) {
    mainColor = uMind; mainAlpha = 0.78; secondaryColor = uFocus; glowAlpha = 0.58; secondaryAlpha = 0.30;
  } else {
    mainColor = uRelease; mainAlpha = 0.74; secondaryColor = uEnergy; glowAlpha = 0.56; secondaryAlpha = 0.32;
  }
}

void main() {
  float distanceValue = length(vLocalPx);
  float antialiasWidth = max(fwidth(distanceValue), 1.0 / max(uDpr, 1.0));
  vec4 result = vec4(0.0);

  if (vKind < 5) {
    vec3 mainColor;
    vec3 secondaryColor;
    float mainAlpha;
    float glowAlpha;
    float secondaryAlpha;
    photonPalette(vKind, mainColor, mainAlpha, secondaryColor, glowAlpha, secondaryAlpha);
    result = over(result, layer(secondaryColor, gaussian(distanceValue, 12.0) * secondaryAlpha * 0.42));
    result = over(result, layer(mainColor, gaussian(distanceValue, 4.5) * glowAlpha * 0.58));
    float horizontal = (1.0 - smoothstep(0.45, 0.8, abs(vLocalPx.y))) *
      (1.0 - smoothstep(vSize * 1.7, vSize * 2.1, abs(vLocalPx.x)));
    float vertical = (1.0 - smoothstep(0.45, 0.8, abs(vLocalPx.x))) *
      (1.0 - smoothstep(vSize * 1.7, vSize * 2.1, abs(vLocalPx.y)));
    result = over(result, layer(mainColor, horizontal * 0.28 + vertical * 0.20));
    float body = 1.0 - smoothstep(vSize * 0.5 - antialiasWidth, vSize * 0.5 + antialiasWidth, distanceValue);
    result = over(result, layer(mainColor, body * mainAlpha));
  } else {
    result = over(result, layer(uBody, gaussian(distanceValue, 8.5) * 0.18));
    result = over(result, layer(uTrace, gaussian(distanceValue, 3.2) * 0.24));
    float body = 1.0 - smoothstep(vSize * 0.5 - antialiasWidth, vSize * 0.5 + antialiasWidth, distanceValue);
    result = over(result, layer(uMote.rgb, body * uMote.a));
  }

  result *= vOpacity;
  outColor = correctReadableDynamic(result, vCssUv);
}
`;

export const ANDROID_DAY_THREAD_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aGeometry;
layout(location = 2) in vec4 aMotion;

uniform float uTime;
uniform vec2 uViewport;

out vec2 vLocalPx;
out vec2 vCssUv;
out float vLength;
out float vLineWidth;
out float vOpacity;

${CUBIC_BEZIER_GLSL}

void threadMotion(float phase, out float rotationDelta, out vec2 scale, out float opacityFactor) {
  if (phase < 0.48) {
    float progress = easeInOut(phase / 0.48);
    rotationDelta = mix(-0.8, 0.9, progress);
    scale = mix(vec2(0.94, 0.88), vec2(1.03, 1.08), progress);
    opacityFactor = mix(0.48, 1.0, progress);
  } else if (phase < 0.78) {
    float progress = easeInOut((phase - 0.48) / 0.30);
    rotationDelta = mix(0.9, -0.25, progress);
    scale = mix(vec2(1.03, 1.08), vec2(0.99, 0.98), progress);
    opacityFactor = mix(1.0, 0.62, progress);
  } else {
    float progress = easeInOut((phase - 0.78) / 0.22);
    rotationDelta = mix(-0.25, -0.8, progress);
    scale = mix(vec2(0.99, 0.98), vec2(0.94, 0.88), progress);
    opacityFactor = mix(0.62, 0.48, progress);
  }
}

void main() {
  float phase = mod(max(0.0, uTime - aMotion.z), aMotion.y) / aMotion.y;
  float rotationDelta;
  vec2 scale;
  float opacityFactor;
  threadMotion(phase, rotationDelta, scale, opacityFactor);

  float lengthPx = aGeometry.z * 0.01 * uViewport.y;
  float halfExtent = aGeometry.w * 2.0 + 14.0;
  float localX = aCorner.x * halfExtent * scale.x;
  float localY = mix(-14.0, lengthPx + 14.0, aCorner.y) * scale.y;
  float angle = radians(aMotion.w + rotationDelta);
  float cosine = cos(angle);
  float sine = sin(angle);
  vec2 rotated = vec2(cosine * localX - sine * localY, sine * localX + cosine * localY);
  vec2 anchor = aGeometry.xy * 0.01 * uViewport;
  vec2 pixel = anchor + rotated;

  vLocalPx = vec2(localX / scale.x, localY / scale.y);
  vLength = lengthPx;
  vLineWidth = aGeometry.w * scale.x;
  vOpacity = aMotion.x * opacityFactor;
  vCssUv = pixel / uViewport;
  vec2 clip = vec2(pixel.x / uViewport.x * 2.0 - 1.0, 1.0 - pixel.y / uViewport.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
}
`;

export const ANDROID_DAY_THREAD_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vLocalPx;
in vec2 vCssUv;
in float vLength;
in float vLineWidth;
in float vOpacity;

uniform vec4 uThread;
uniform vec3 uBody;
uniform vec3 uWarm;

out vec4 outColor;

${READABLE_DYNAMIC_CORRECTION_GLSL}

vec4 over(vec4 below, vec4 above) {
  return above + below * (1.0 - above.a);
}

vec4 layer(vec3 color, float alpha) {
  float bounded = clamp(alpha, 0.0, 1.0);
  return vec4(color * bounded, bounded);
}

float gradientAlpha(float position) {
  if (position < 0.22) return mix(0.0, uThread.a, position / 0.22);
  if (position < 0.48) return mix(uThread.a, 0.30, (position - 0.22) / 0.26);
  if (position < 0.78) return mix(0.30, 0.0, (position - 0.48) / 0.30);
  return 0.0;
}

void main() {
  float position = vLocalPx.y / max(vLength, 1.0);
  float line = 1.0 - smoothstep(vLineWidth * 0.5, vLineWidth * 0.5 + 0.7, abs(vLocalPx.x));
  vec3 lineColor = position < 0.48
    ? mix(uThread.rgb, uBody, clamp((position - 0.22) / 0.26, 0.0, 1.0))
    : uBody;
  vec4 result = layer(lineColor, line * gradientAlpha(position));

  float glowX = exp(-0.5 * pow(vLocalPx.x / 7.0, 2.0));
  float glowY = smoothstep(0.34, 0.38, position) * (1.0 - smoothstep(0.66, 0.70, position));
  result = over(result, layer(uWarm, glowX * glowY * 0.24));
  result *= clamp(vOpacity, 0.0, 1.0);
  outColor = correctReadableDynamic(result, vCssUv);
}
`;
