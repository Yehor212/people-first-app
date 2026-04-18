/**
 * Bloom Pass 3: Dual-Kawase upsample.
 *
 * 8-tap tent filter reconstructing half-resolution source back to full.
 * Combined with the downsample chain, the multi-mip pyramid produces a
 * convincing Gaussian-like blur in O(1) passes per mip.
 *
 * Reference: blog.frost.kiwi/dual-kawase
 * Texel offset is halved from downsample — classic dual-filter expand.
 */
precision highp float;

uniform sampler2D u_source;
uniform vec2 u_texelSize;

varying vec2 v_uv;

void main() {
  vec2 t = u_texelSize;
  vec4 sum =
      texture2D(u_source, v_uv + vec2(-t.x * 2.0, 0.0)) +
      texture2D(u_source, v_uv + vec2(-t.x,  t.y)) * 2.0 +
      texture2D(u_source, v_uv + vec2( 0.0,  t.y * 2.0)) +
      texture2D(u_source, v_uv + vec2( t.x,  t.y)) * 2.0 +
      texture2D(u_source, v_uv + vec2( t.x * 2.0, 0.0)) +
      texture2D(u_source, v_uv + vec2( t.x, -t.y)) * 2.0 +
      texture2D(u_source, v_uv + vec2( 0.0, -t.y * 2.0)) +
      texture2D(u_source, v_uv + vec2(-t.x, -t.y)) * 2.0;
  gl_FragColor = sum / 12.0;
}
