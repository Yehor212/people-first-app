# Platform Evidence: Wave 1 Candidate

**Candidate**: current Wave 1 working tree on
`codex/002-product-regression-recovery`; final staged identity pending
**Data boundary**: build/smoke tooling only; no account, production journal,
credential, migration, or external write

| Platform / surface | Fresh result | Assurance boundary / remaining proof |
| --- | --- | --- |
| Web/Vite production bundle | `npm run build` exit `0`; 3,224 modules, service worker generated, 55 precache entries | Buildability only; authenticated recovery UI remains `UNVERIFIED` |
| Web phone/desktop | Strict local Chrome smoke exit `0`; readiness `14/14`, no console/network/response failure | Unauthenticated production-equivalent routes only |
| PWA/offline | `2 PASS`, `2 SKIP` | Installed update/background replay and authenticated journal state remain `UNVERIFIED` |
| Android shared assets | `npm run build:android`, `npm run cap:sync:android`, and native duplicate checks exit `0` | Shared/build-time contract only |
| Android native build | `./gradlew assembleDebug`: `BUILD SUCCESSFUL`, 428 tasks | No emulator/physical biometric, process death, Back, TalkBack, display/font scale, or 48 dp measurement |
| iOS shared assets | `npm run cap:sync:ios` and native duplicate checks exit `0` | Shared/build-time contract only |
| iOS simulator build | `xcodebuild ... CODE_SIGNING_ALLOWED=NO build`: `** BUILD SUCCEEDED **` | Compile/link only; no simulator interaction, WKWebView lifecycle, Keychain/biometric, VoiceOver, or Dynamic Type proof |
| Desktop source contracts | `npm run desktop:check`: source contract `115` passed | Overall command exit `1`: Windows linker `link.exe`/MSVC is unavailable on macOS |
| Windows/Tauri package/runtime | `UNVERIFIED` | Requires exact-candidate Windows toolchain and runtime smoke; the macOS failure is not converted to PASS |
| Supabase/PostgreSQL | Migration source plus static contract tests only | Authorized non-production apply, generated types, RLS/Storage, contention, old/new-client coexistence, timing, and recovery drill remain `UNVERIFIED` |
| Shared accessibility contracts | Focus, Escape/Back ownership, one live region, inert background, 48 px targets, RTL/copy tests passed | TalkBack, VoiceOver, native font scale, qualified accessibility review, and human acceptance remain `UNVERIFIED` |
| Store/release | Not executed | Exact-head CI, review, merge, store artifacts, public deploy, and cache-busted public runtime remain `UNVERIFIED` |

Wave 2/3 cross-target capability receipts are intentionally absent from PR 1.
No row treats a web build, native compile, static test, or agent review as
physical-device, Windows-runtime, accessibility-human, or release proof.
