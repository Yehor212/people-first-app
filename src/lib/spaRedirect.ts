/**
 * GitHub Pages SPA redirect decoder.
 *
 * Pairs with `public/404.html`. Any deep route hit on GH Pages (e.g.
 * `/people-first-app/orb?nav=v2`) returns the 404.html shell which encodes
 * the intended path into a single-use query (`/?/orb&nav=v2`). This module
 * runs as a side-effect import at the top of `main.tsx` and rewrites the URL
 * back to its canonical form before React mounts, so `useNavigationV2`
 * reads the correct pathname on first render.
 *
 * Why a module instead of inline `<script>` in index.html: the project's
 * CSP `script-src 'self' capacitor: capacitor-electron:` blocks inline
 * scripts. Module imports satisfy `'self'`.
 *
 * Example: `https://yehor212.github.io/people-first-app/orb?nav=v2`
 *   1. GH Pages 404 → serves `public/404.html`
 *   2. 404.html script redirects → `/people-first-app/?/orb&nav=v2`
 *   3. This module rewrites → `/people-first-app/orb?nav=v2` via replaceState
 *   4. React boots, useNavigationV2 reads canonical pathname.
 *
 * See `docs/plans/phase-3-d-decomposition-strategy.md` for Phase 3-D plan.
 */

(function decodeSpaRedirect() {
  if (typeof window === "undefined") return;
  const l = window.location;
  if (l.search[1] !== "/") return;

  const decoded = l.search
    .slice(1)
    .split("&")
    .map((s) => s.replace(/~and~/g, "&"))
    .join("?");

  window.history.replaceState(
    null,
    "",
    l.pathname.slice(0, -1) + decoded + l.hash,
  );
})();
