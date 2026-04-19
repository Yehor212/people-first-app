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
