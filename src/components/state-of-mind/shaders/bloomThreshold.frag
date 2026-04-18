/**
 * Bloom Pass 1: HDR threshold extraction.
 *
 * Scans the main orb render texture and keeps only pixels whose luminance
 * exceeds u_threshold (default 1.0 — the HDR cutoff). Below-threshold pixels
 * are set to black. Output feeds the Dual-Kawase downsample chain.
 *
 * Luminance uses Rec.709 (perceptual, same as sRGB → Y).
 * Soft knee (smoothstep) avoids hard ringing around the cutoff.
 */
precision highp float;

uniform sampler2D u_source;
uniform float u_threshold;    // HDR cutoff, default 1.0
uniform vec2 u_texelSize;     // 1/width, 1/height

varying vec2 v_uv;

void main() {
  vec4 c = texture2D(u_source, v_uv);
  float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  // Soft knee — 0.25 units below threshold starts ramping
  float knee = 0.25;
  float contribution = smoothstep(u_threshold - knee, u_threshold + knee, luma);
  gl_FragColor = vec4(c.rgb * contribution, contribution);
}
