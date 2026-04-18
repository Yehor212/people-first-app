/**
 * Bloom Pass 4: Additive composite.
 *
 * Renders the original orb (u_scene) plus the blurred bloom pyramid (u_bloom)
 * scaled by u_intensity. Final blend preserves HDR highlights without
 * clipping using a soft ACES-like tone curve.
 *
 * Intensity is clamped [0, 2] by CPU uniform setter.
 */
precision highp float;

uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform float u_intensity;   // 0..2, default 0.8

varying vec2 v_uv;

// Soft shoulder tone map — prevents bloom-driven blow-out
vec3 softTone(vec3 x) {
  return x / (x + 1.0);
}

void main() {
  vec4 scene = texture2D(u_scene, v_uv);
  vec3 bloom = texture2D(u_bloom, v_uv).rgb;
  vec3 combined = scene.rgb + bloom * u_intensity;
  // Expose bloom halo but keep orb core linear when under threshold
  vec3 mapped = mix(combined, softTone(combined), step(1.0, max(max(combined.r, combined.g), combined.b)));
  gl_FragColor = vec4(mapped, scene.a + bloom.r * u_intensity * 0.4);
}
