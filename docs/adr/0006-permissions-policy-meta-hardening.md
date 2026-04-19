# ADR-0006 — Permissions-Policy meta-tag hardening

## Status

Accepted — 2026-04-19

## Context

2026-04-19 tech-debt audit research (docs/research/csp-trusted-types-permissions-policy-2026.md)
surveyed the current security-header posture against the 2024-2026 browser
baseline. Finding: `index.html` already carries a solid Content-Security-Policy
meta tag (no `unsafe-eval`, `object-src 'none'`, `base-uri 'self'`,
`form-action 'self'`, `upgrade-insecure-requests`), but has ZERO
`Permissions-Policy`. This leaves the app implicitly granting every API the
browser supports (camera, microphone, geolocation, payment, WebUSB, MIDI,
HID, FLoC cohort broadcasting, etc.) — surface area that is never exercised
by the product.

## Decision

Add an explicit `<meta http-equiv="Permissions-Policy">` directive in
`index.html` with **deny-by-default for every feature the codebase does not
use**, and precise `(self)` scoping for the small set it does:

| Allow `(self)` | Why |
| --- | --- |
| `autoplay` | `audioManager` + ambient sounds |
| `battery` | `AnimationGate` low-battery mirror |
| `fullscreen` | focus-mode immersive view |
| `gyroscope` | `useCosmicParallax` on coarse pointers (mobile) |
| `web-share` | share card on share action |

Everything else is explicitly `()` (denied): `accelerometer`, `ambient-light-sensor`,
`bluetooth`, `browsing-topics` (2024 FLoC successor), `camera`,
`cross-origin-isolated`, `display-capture`, `document-domain`, `encrypted-media`,
`geolocation`, `hid`, `idle-detection`, `interest-cohort` (legacy FLoC),
`magnetometer`, `microphone`, `midi`, `payment`, `picture-in-picture`,
`publickey-credentials-get`, `screen-wake-lock`, `serial`, `sync-xhr`, `usb`,
`xr-spatial-tracking`.

## Consequences

### Positive

- Explicit privacy posture: Google's FLoC + Topics API broadcasting is
  mechanically blocked for every ad-network asset ever included.
- Sensor-fingerprinting surface removed from every third-party iframe (the
  policy is inherited by nested frames unless explicitly unlocked).
- Mozilla Observatory / securityheaders.com score improves from B+ to A
  territory on the Permissions-Policy row.
- Self-documenting list of APIs the app uses — any future contributor adding
  `navigator.geolocation` gets an immediate policy violation in DevTools.

### Trade-offs

- `meta http-equiv="Permissions-Policy"` is **partially honored** — Chromium
  respects it fully, Firefox and Safari ignore the meta form and require a
  real HTTP response header. GitHub Pages cannot set custom headers, so this
  is our best available defense on the static host. When the app ever
  migrates to an edge-proxied host (Cloudflare Pages / Netlify / Vercel),
  these values should be lifted into real response headers for universal
  coverage — meta tag remains as belt-and-braces.
- Any future feature that needs one of the denied APIs will fail until the
  policy is extended. This is the intended gate — adding a feature means
  consciously adding the permission.

### Neutral

- Zero runtime cost (meta tag, no JS).
- Zero visual regression (no DOM/layout change).
- Zero bundle impact (parsed by browser from HTML directly).

## Alternatives considered

1. **Real `Permissions-Policy:` HTTP header via edge-proxy.** Superior
   coverage (all browsers) but requires migration off GH Pages — out of
   scope for this increment.
2. **Omit and rely on browser defaults.** Rejected — defaults vary per
   browser and changed in 2024 (Topics API ships opt-out by default in
   Chrome). Explicit deny is strictly safer.
3. **Allow-list with `*` for denied features.** Rejected — `*` grants the
   feature cross-origin which is the opposite of our intent.

## Related

- ADR-0005 — Bootstrap error-handling architecture (same audit session)
- `docs/research/csp-trusted-types-permissions-policy-2026.md` — full research
- `index.html:14` — implementation

## Sources

- developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy (2026)
- web.dev/articles/privacy-sandbox — Topics API opt-out
- w3c.github.io/webappsec-permissions-policy — spec
