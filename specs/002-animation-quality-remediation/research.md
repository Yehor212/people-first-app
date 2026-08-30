# Research: Animation Quality Remediation

## Evidence Boundary

- Audit SHA-256: 4c220f35549268f7f56b0fc05afe92ab9efea45d477595db6814bb449077d6a6.
- Guide SHA-256: 7fec1e025bef3ab4ad7e3db8da72addc6223b4ee87c6a86378856ee6a5edb248.
- Repository base: c779c1171157a563a6bef1bc773528c78eaeb117.
- The audit changed during review. Its stable current delta is only §17, a commit/push playbook. Publication, versioning, rebase, stash, push, PR, and cross-lane instructions are outside current authority.
- Current source and executed checks decide applicability. Old captures, “live-checked” prose, and specialist summaries are not runtime PASS.

## Primary-source decisions

| Decision | Primary documentation | Result |
| --- | --- | --- |
| Reduced motion | [MotionConfig](https://www.motion.dev/docs/react-motion-config) says transform and layout animations are disabled while color and opacity persist. | File gates are valid for reachable opacity/color/box-shadow loops; W23's opposite claim is refuted. |
| Predictive back | [Android 16 behavior changes](https://developer.android.com/about/versions/16/behavior-changes-16) enable system predictive-back animations by default for target SDK 36. | A6 is refuted. Root callback behavior still requires device proof and owner authority. |
| WebView startup | [Optimize WebView startup](https://developer.android.com/develop/ui/views/layout/webapps/optimize-webview-startup) documents main-thread cost and a newer async API requiring a newer AndroidX WebKit than this repository pins. | The extra startup WebView exists, but a background-thread WebView is unsafe and the newer API needs dependency authority. |
| Orientation | [WCAG Orientation](https://www.w3.org/WAI/WCAG22/Understanding/orientation.html) permits locking only when orientation is essential. | B2 portrait lock is refuted absent an essential-use basis. |

## Native classification

| ID | Classification | Current evidence and decision |
| --- | --- | --- |
| A1 | NEEDS_REPRO | MainActivity creates an extra pre-super WebView. Cost and safe removal require exact upgrade/offline startup baselines; never move WebView calls to an arbitrary worker thread. |
| A2 | NEEDS_REPRO | Multiple launch/background colors exist, but the claimed cascade is not proven on the current artifact. |
| A3 | NEEDS_REPRO | Launch icon-lightness attributes differ by qualifier; actual contrast and timing need device screenshots. |
| A4 | NEEDS_REPRO | Capacitor config has no Android background color, but a white frame is not proven and this option cannot cover every shell. |
| A5 | NEEDS_REPRO | Proposed night resources are absent; visible ownership and desired behavior need device evidence. |
| A6 | REFUTED | targetSDK 36 already enables predictive back; Capacitor App owns the dispatcher. Root double-tap exit is a separate decision. |
| A7 | NEEDS_AUTHORITY | Baseline Profiles require new dependencies/modules and measured macrobenchmark scope. |
| A8 | NEEDS_REPRO | Splash assets are generator-owned; blur is not proven for an exact density/device. |
| A9 | REFUTED | Capacitor Core 8 bundles SystemBars and the repository contract requires insetsHandling disabled. |
| A10 | VERIFIED_CURRENT | activity_main contains a vestigial WebView while BridgeActivity creates its own view. It is hygiene-only and deferred behind user-facing/security batches. |
| A11 | REFUTED | androidxWebkitVersion is consumed by installed Capacitor Android Gradle source. |
| A12 | NEEDS_REPRO | values-night/styles.xml is absent, but visible ownership needs startup evidence. |
| A13 | REFUTED | The named colors are supplied by merged Capacitor resources. |
| A14 | VERIFIED_CURRENT | Debug config can resolve to an empty AdMob placeholder. The guide's sample identity violates no-mock policy; implement build-time fail-fast only. |

## Sidebar, diary, and habit classification

| ID | Classification | Current evidence and decision |
| --- | --- | --- |
| S1 | NEEDS_REPRO | Width animation exists; route reachability, reflow, CLS, and visual trajectory need a retained baseline. |
| D1 | NEEDS_REPRO | Timing/spring replacement changes trajectory without a demonstrated current failure. |
| D2 | NEEDS_REPRO | Calendar spring replacement needs a current surface baseline. |
| D3 | NEEDS_REPRO | Tap/hover and pulse changes need reachability, peak-frame, and gate evidence. |
| D4 | NEEDS_REPRO | A nominal token mapping still needs exact current values and reachable proof. |
| H1 | NEEDS_REPRO | height:auto candidates require trace and matched-progress proof before mechanism changes. |
| H2 | NEEDS_REPRO | JS-to-CSS migration can alter trajectory and lifecycle; no baseline exists. |
| H3 | NEEDS_REPRO | Spring replacement is an unproven motion-design change. |
| H4 | NEEDS_AUTHORITY | The guide offers two different hover designs; choosing one is product-defining. |
| H5 | REFUTED | The guide permits leaving the one-shot ring unchanged; no correction is required. |

## Blind-spot classification

| ID | Classification | Current evidence and decision |
| --- | --- | --- |
| B1 | REFUTED | The proposed dir-times-300 formula conflicts with its stated RTL direction and snapshots document direction non-reactively. |
| B2 | REFUTED | Portrait locking lacks a WCAG essential-orientation basis. |
| B3 | NEEDS_REPRO | Lazy-image fade/skeleton changes visible pixels without a slow-load baseline. |
| B4 | NEEDS_REPRO | Font preload policy needs current route/network/cache evidence. |
| B5 | NEEDS_AUTHORITY | SW reload timing changes update semantics and needs an owner decision plus installed-PWA reproduction. |
| B6 | NEEDS_REPRO | Replacing route text with a loader is a visible design change; the flash is not proven. |
| B7 | NEEDS_AUTHORITY | Archiving V1/stats is a product-scope decision. |
| B8 | NEEDS_REPRO | IME behavior requires a real device run. |
| B9 | NEEDS_REPRO | 90/120 Hz behavior requires a real high-refresh device or accepted instrumentation. |
| B10 | NEEDS_AUTHORITY | Widgets are outside the current target and require separate scope. |

## Web classification

| ID | Classification | Current evidence and decision |
| --- | --- | --- |
| W1 | NEEDS_AUTHORITY | Stories is latent in current V2; archive-versus-retain is an owner choice. |
| W2 | NEEDS_AUTHORITY | Breathing is latent and includes accessibility/product questions; no clinical claim is authorized. |
| W3 | VERIFIED_CURRENT | Planning mounts ScheduleTimeline; reachable Schedule components contain indefinite opacity/box-shadow/transform loops without a reactive file gate. Implement gate-only; no CSS migration or duration change. |
| W4 | REFUTED | EntryGate already has a file-level gate. A non-reactive parent snapshot is a separate future reproduction. |
| W5 | NEEDS_REPRO | Each named singleton needs current reachability and false/true control proof. |
| W6 | REFUTED | useTypingDynamics is not mounted in the current user graph. |
| W7 | NEEDS_REPRO | Background-position substitution changes trajectory/layers and needs trace plus video. |
| W8 | NEEDS_REPRO | Aurora paint cost and equivalence are unmeasured. |
| W9 | NEEDS_REPRO | Box-shadow substitution needs peak/trough frames and property traces. |
| W10 | NEEDS_REPRO | Full-screen blur replacement is visible and lacks a current baseline. |
| W11 | VERIFIED_CURRENT | The class appears unreferenced in tracked sources; low-priority hygiene is deferred. |
| W12 | NEEDS_REPRO | Journal layout candidates need reachable interaction traces and visual baselines. |
| W13 | NEEDS_REPRO | Exit mechanism replacement needs matched video. |
| W14 | NEEDS_REPRO | Layout scope removal needs current reorder/delete trace and baseline. |
| W15 | NEEDS_REPRO | Each mapped-list site has separate reachability and reorder semantics. |
| W16 | REFUTED | A global zero-count spring rewrite is not reachability-aware and changes characteristic motion. |
| W17 | REFUTED | Replacing every inline hover is a visual redesign; offered alternatives are non-equivalent. |
| W18 | REFUTED | Approximate curve names do not prove global easing equivalence. |
| W19 | REFUTED | A global duration range conflates loops, entrances, functional drawing, and latent code. |
| W20 | REFUTED | A global delay cap lacks interaction semantics and changes choreography. |
| W21 | NEEDS_REPRO | Named exits need current reachability and a disappearing-versus-exiting reproduction. |
| W22 | NEEDS_AUTHORITY | Choosing instant versus 100 ms is unresolved motion design. |
| W23 | REFUTED | Official current MotionConfig docs say opacity/color continue under reduced motion. |
| W24 | REFUTED | Global grep-zero contracts force unrelated rewrites; ratchets must be reachable-file, baseline-bound, monotonic, and waiver-specific. |

## Additional source-verified finding

### Runtime route privacy — VERIFIED_CURRENT

main.tsx installs the performance guard before auth cleanup. runtimeFlightRecorder currently concatenates pathname and full search; a severe event persists that route in sessionStorage under zenflow-runtime-perf-guard, and the optional in-memory recorder retains it. No network transmission sink was found.

Decision: introduce a leaf allowlist sanitizer and sanitize new capture plus legacy guard-snapshot reads. Preserve only approved navigation keys with approved values; never retain fragments or arbitrary values. This is a local privacy fix, not an auth or storage redesign.

## Chosen implementation decisions

| Decision | Why | Rejected alternatives |
| --- | --- | --- |
| Allowlist safe navigation keys and values | Unknown query data is unsafe by default; callback codes, state, tokens, email, reset markers, and error details must not survive. | Denylists drift; hashing remains linkable; later auth cleanup misses early startup. |
| Sanitize and rewrite legacy snapshots on read | Existing sessions can already contain query values while useful recovery mode/timing fields should survive. | Clearing the whole snapshot loses useful state; migration infrastructure is unnecessary for session scope. |
| Pass one reactive boolean through Schedule | The owner can stop all ambient property classes while leaf defaults preserve direct callers and full-motion values. | MotionConfig misses opacity/color; a new store duplicates policy; CSS migration lacks trajectory proof. |
| Fail closed for empty debug AdMob config | Meets no-mock policy and exposes configuration errors before runtime. | Sample ID is forbidden; silent empty values fail late; a private real ID must not enter Git. |

## Remaining unknowns

- Android startup visuals/timing, back, system bars, upgrade/offline cache, IME, and high-refresh behavior are UNVERIFIED without installed-artifact runs.
- Installed-PWA update/resume, iOS/WKWebView, and Desktop/Tauri runtime parity are UNVERIFIED.
- Assistive-technology and human artistic acceptance are UNVERIFIED; technical checks cannot substitute for them.
- Old audit output artifacts are not accepted as proof for this exact base and worktree.
