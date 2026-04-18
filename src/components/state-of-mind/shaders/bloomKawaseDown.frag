/**
 * Bloom Pass 2: Dual-Kawase downsample.
 *
 * 4-tap filter at 0.5-pixel diagonal offsets, averaged with center sample
 * weighted 4x. Written to a half-resolution FBO (cheaper than Gaussian
 * separable pass — 1 draw call vs 2, smoother kernel per pass).
 *
 * Reference: blog.frost.kiwi/dual-kawase
 * Runtime budget: <0.8ms per pass on Mali-G78.
 */
precision highp float;

uniform sampler2D u_source;
uniform vec2 u_texelSize;  // Texel size of source (input) texture

varying vec2 v_uv;

void main() {
  vec4 sum = texture2D(u_source, v_uv) * 4.0;
  sum += texture2D(u_source, v_uv - u_texelSize);
  sum += texture2D(u_source, v_uv + u_texelSize);
  sum += texture2D(u_source, v_uv + vec2(u_texelSize.x, -u_texelSize.y));
  sum += texture2D(u_source, v_uv - vec2(u_texelSize.x, -u_texelSize.y));
  gl_FragColor = sum / 8.0;
}
