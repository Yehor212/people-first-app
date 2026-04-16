/**
 * PostCSS configuration — ZenFlow
 *
 * Plugin order (strict):
 *   1. tailwindcss                         — expands @tailwind/@apply/variants FIRST
 *   2. @csstools/postcss-oklab-function    — converts oklch()/oklab() → rgb() fallback + preserves original
 *   3. autoprefixer                        — vendor prefixes LAST
 *
 * Why `preserve: true`:
 *   Emits BOTH the rgb() fallback (older browsers) AND the original oklch()
 *   in cascade. Modern browsers use the wider gamut; older ones use rgb().
 *   Phase 0-A canary token validates this behaviour end-to-end.
 *
 * Why `subProperties: true`:
 *   Also converts oklch()/oklab() used inside gradients, shadows, and filter functions.
 *
 * Docs: https://github.com/csstools/postcss-plugins/tree/main/plugins/postcss-oklab-function
 */
export default {
  plugins: {
    tailwindcss: {},
    "@csstools/postcss-oklab-function": {
      preserve: true,
      subProperties: true,
    },
    autoprefixer: {},
  },
};
