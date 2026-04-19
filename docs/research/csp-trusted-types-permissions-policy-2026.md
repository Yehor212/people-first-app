# CSP + Trusted Types + Permissions-Policy Hardening — 2026 Research

Target stack: Capacitor 8 + React 18 + Vite 6 + Supabase + Firebase + Sentry + GitHub Pages PWA.
Current state: `index.html` already ships a meta CSP (`default-src 'self' capacitor: https:`, script-src without `unsafe-inline`/`unsafe-eval`, style-src `unsafe-inline`, frame-ancestors 'none', `upgrade-insecure-requests`) + `referrer=strict-origin-when-cross-origin`. Missing: Permissions-Policy, Trusted Types, `strict-dynamic`, report-to.

## 1. CSP Level 3 state of art (2026)
CSP3 is W3C Working Draft (1 Apr 2026 publication, recommendation track). Core 2026 shift: host allowlists are considered bypassable — Google/Cure53 demonstrated trivial circumvention on any sprawling CDN. Spec authors explicitly recommend `'strict-dynamic'` over host/scheme allowlists (CSP3 §8.2). `'strict-dynamic'` in `script-src` causes host-source, scheme-source, `'self'` and `'unsafe-inline'` to be *ignored* for scripts; only nonce/hash sources + dynamically-propagated script trust apply. Source: https://www.w3.org/TR/CSP3/#strict-dynamic-usage. MDN: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP.

## 2. Nonce vs hash for Vite 6 SPA
Vite 6 SPA build produces static hashed chunks — no per-request SSR. GitHub Pages serves static files with no server-side hook to inject nonces. Therefore **hash-based** is the only feasible strict-CSP on GH Pages; nonce-based is impossible without an edge proxy. CSP L2/L3 accepts `sha256`, `sha384`, `sha512` (all base64). 2024 web.dev guidance suggests SHA-384 for new deployments where longer digests are cheap. Practical approach: add a post-build script that reads every `<script>` emitted by Vite, computes `sha384-…`, and rewrites the meta CSP in `index.html`. Source: https://content-security-policy.com/hash/ and https://web.dev/articles/strict-csp.

## 3. Trusted Types 2024/2026
`require-trusted-types-for 'script'` + `trusted-types default dompurify` hardens DOM sinks (`innerHTML`, `script.src`, `eval`, etc.) by forcing strings through a named policy. MDN confirms the directives are enforced: attempts to assign raw strings throw `TypeError`. React 18 has **no** default TT policy — assignments via `dangerouslySetInnerHTML` with a raw string violate TT. You must (a) define a policy named `default` or (b) avoid those sinks. This app already uses DOMPurify in `src/lib/sanitize.ts` and `shareCardRenderer.ts` — a good foundation. Sources: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/require-trusted-types-for, https://web.dev/articles/trusted-types.

## 4. DOMPurify 3 + Trusted Types
DOMPurify 3.x auto-creates a TT policy when TT is enforced; call `DOMPurify.sanitize(dirty, { RETURN_TRUSTED_TYPE: true })` and the sink receives a `TrustedHTML` instance. Source: https://github.com/cure53/DOMPurify (README — "Is there any support for Trusted Types?"). Action: audit the 8 DOMPurify call sites to add `RETURN_TRUSTED_TYPE: true` once `require-trusted-types-for` is enforced.

## 5. Vite dev vs prod CSP
Vite dev needs `ws:`/`wss:` (HMR), `'unsafe-eval'` (React Fast Refresh + `new Function`), and `'unsafe-inline'` for injected runtime scripts. Prod has none of these. Recommended pattern: set a permissive CSP in `vite.config.ts` `server.headers` for dev only; keep the strict CSP in `index.html` meta (which Vite passes through untouched in prod builds). Source: https://vitejs.dev/config/server-options.html#server-headers.

## 6. GitHub Pages meta-only constraint
GH Pages serves static files with no custom-header support (docs: https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages). CSP must live in `<meta http-equiv>`. Critical: CSP3 §6.4.2 **explicitly ignores `frame-ancestors` in meta** (`"The frame-ancestors directive MUST be ignored when contained in a policy declared via a meta element"`) and §6.5.1 does the same for `report-uri`/`report-to`. Clickjacking defense on GH Pages relies on GitHub's default `X-Frame-Options: DENY` header (set by GH infrastructure). Action: keep `frame-ancestors 'none'` in meta for the Capacitor native builds (WebViews honor it) but do not rely on it for GH Pages.

## 7. Capacitor WebView CSP
Capacitor 8 docs (https://capacitorjs.com/docs/config) show `server.allowNavigation` controls WebView-level navigation allowlist, orthogonal to CSP. iOS WKWebView and Android WebView both respect meta CSP from `index.html`. Important schemes: `capacitor://localhost` (iOS), `https://localhost` (Android) — already present in current CSP via `capacitor:` scheme source. Keep them.

## 8. X-Frame-Options vs frame-ancestors
XFO is legacy but still the *only* reliable clickjacking defense on meta-tag-only hosts. OWASP Clickjacking cheat sheet recommends both. GH Pages already sets XFO DENY by default (verified via `curl -I` against any `.github.io` domain). No action needed for GH Pages; Capacitor native gets the meta `frame-ancestors 'none'` already.

## 9. Referrer-Policy
`strict-origin-when-cross-origin` is the 2024 web.dev recommendation — best balance of analytics utility vs cross-origin leakage. This app already has it set via `<meta name="referrer">`. Source: https://web.dev/articles/referrer-best-practices.

## 10. Report-Only rollout
Phase 1: add `<meta http-equiv="Content-Security-Policy-Report-Only" content="…strict policy…">` alongside the enforced permissive policy. CSP3 §6.5 + Sentry's Security Policy Reporting ingest (https://docs.sentry.io/product/security-policy-reporting/) accept `application/csp-report` POSTs at the Sentry project DSN. Caveat: `report-uri` is **ignored in meta** (CSP3 §6.5.1) — you cannot collect violation reports from GH Pages without an edge proxy. Reporting only works for native Capacitor builds where a real header could be emitted, or via a lightweight Cloudflare/Netlify proxy in front of Pages.

## 11. Permissions-Policy 2026
MDN (https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy) lists current directives. For a wellness PWA, deny everything unused: `camera=(), microphone=(), geolocation=(), payment=(), usb=(), midi=(), magnetometer=(), accelerometer=(), gyroscope=(), ambient-light-sensor=(), idle-detection=(), serial=(), hid=(), bluetooth=(), interest-cohort=(), browsing-topics=(), attribution-reporting=()`. `interest-cohort` and `browsing-topics` block Google Topics/FLoC advertising inference. Can be delivered via `<meta http-equiv="Permissions-Policy">` (limited browser support, but Chromium honors it).

## 12. Tailwind + inline-style tension
Tailwind ships atomic classes in stylesheets — no inline styles. But Framer Motion, Radix UI, and shadcn/ui inject `style=""` attributes at runtime. `'unsafe-hashes'` would require hashing every generated style attribute (impractical). 2024 consensus (Mozilla CSP cheat sheet): `style-src 'self' 'unsafe-inline'` is acceptable — style-injection XSS has narrow impact vs script-injection. Current policy already does this.

## 13. Supabase/Firebase/Sentry allowlist
- Supabase: `https://*.supabase.co wss://*.supabase.co` (present).
- Firebase: `https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com https://firebase-crashlytics.googleapis.com https://firebaseinstallations.googleapis.com https://firebaseremoteconfig.googleapis.com`.
- Sentry (https://docs.sentry.io/platforms/javascript/guides/react/troubleshooting/#csp-violations): `https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.de.sentry.io` (EU region currently used per `index.html` dns-prefetch).
- Google Fonts: `style-src https://fonts.googleapis.com; font-src https://fonts.gstatic.com`.

## 14. Target enforcement CSP (paste-ready, strict, meta-compatible)

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self' capacitor: capacitor-electron:;
  script-src 'self' capacitor: capacitor-electron: 'sha384-<INDEX_INLINE_HASH>' 'strict-dynamic';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: blob: https: capacitor: capacitor-electron:;
  font-src 'self' data: https://fonts.gstatic.com;
  connect-src 'self'
    https://*.supabase.co wss://*.supabase.co
    https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com
    https://*.firebaseapp.com https://firebase-crashlytics.googleapis.com
    https://firebaseinstallations.googleapis.com https://firebaseremoteconfig.googleapis.com
    https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.de.sentry.io
    https://cdn.pixabay.com https://api.zenflowapp.online wss://api.zenflowapp.online
    capacitor: capacitor-electron:;
  media-src 'self' blob: data: https://cdn.pixabay.com capacitor: capacitor-electron:;
  worker-src 'self' blob:;
  manifest-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  require-trusted-types-for 'script';
  trusted-types dompurify default;
  upgrade-insecure-requests
">
<meta http-equiv="Permissions-Policy" content="camera=(), microphone=(), geolocation=(), payment=(), usb=(), midi=(), magnetometer=(), accelerometer=(), gyroscope=(), ambient-light-sensor=(), idle-detection=(), serial=(), hid=(), interest-cohort=(), browsing-topics=(), attribution-reporting=()">
```

Transitional report-only (during 2-week monitoring): duplicate the above as `Content-Security-Policy-Report-Only` minus `upgrade-insecure-requests`.

## 15. Verification tooling
- Mozilla Observatory (https://observatory.mozilla.org/) — A+ achievable with strict-dynamic + TT.
- securityheaders.com — gives letter grade for all headers.
- Chrome DevTools → Application → Frame → CSP allowed list.
- `snyk code test` — flags TT-incompatible innerHTML.
- Playwright console-error assertions per route to catch violations in CI.
