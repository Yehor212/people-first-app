# Research: 6 Mobile/Cross-Platform UI Topics

> Date: 2026-04-12
> Stack: Capacitor 8 + React 18 + TypeScript + Tailwind CSS
> Platforms: iOS, Android, Desktop browsers

---

## 1. Recovery Phrase / Seed Phrase System for App Data

### Key Findings

- **BIP39 standard** uses a 2048-word English wordlist to generate 12 or 24-word mnemonic phrases. Originally designed for crypto wallets, the standard is well-tested and language-agnostic. Using it for non-crypto app data is technically valid but introduces unnecessary complexity for most users. BIP39 wallets show 40% lower recovery errors vs non-standardized approaches.
- **Signal's approach**: Uses a 64-character hex recovery key generated entirely on-device. No one (including Signal) can recover data without this key. Zero-knowledge proof technology ensures Signal cannot link backup data to user accounts. Free tier for recent messages, $1.99/mo for full backup.
- **WhatsApp's approach**: End-to-end encrypted cloud backups protected by either a user-chosen password OR a 64-digit encryption key. Simpler UX — user picks what feels comfortable.
- **Simpler alternatives dominate**: Most non-crypto apps use recovery email, phone number, Google/Apple account backup, or cloud sync (iCloud/Google Drive). These cover 95%+ of users without seed phrase friction.
- **Social recovery** (pioneered by Argent wallet, advocated by Vitalik Buterin): Split recovery across trusted contacts or devices (e.g., 2-of-3 shares). Emerging pattern but complex UX.
- **Hybrid pattern**: Encrypt data with a key derived from user PIN/password, store encrypted blob in cloud. Recovery = re-authenticate with cloud provider + know PIN. No seed phrase needed.

### Best Approach for Our Stack

For ZenFlow (mental health/journal app), **avoid BIP39 seed phrases**. Users expect simplicity, not crypto-grade ceremony. Recommended approach:

1. **Primary**: Supabase auth (email/Google/Apple sign-in) with server-side encrypted backup
2. **Offline/E2EE option**: User sets a backup password (not a seed phrase). Derive encryption key via PBKDF2/Argon2. Store encrypted blob in cloud. Display a "recovery key" (shorter than BIP39 — e.g., 6 groups of 4 characters) only if user opts into advanced E2EE mode
3. **Export**: JSON/ZIP export with optional password encryption (already partially implemented)

### Pitfalls to Avoid

- Never show a 24-word seed phrase to non-technical users — abandonment rate is very high
- If using a recovery key, make it copyable, QR-scannable, and email-able to self
- Never store the recovery key on your servers (zero-knowledge)
- Test the "I lost everything" flow: what happens when user has new phone, no backup, no key?

### Sources

- [Signal Secure Backups — Official Blog](https://signal.org/blog/introducing-secure-backups/)
- [Signal Support — Secure Backups](https://support.signal.org/hc/en-us/articles/9708267671322-Signal-Secure-Backups)
- [WhatsApp E2EE Backup Protocol — Security Analysis (PDF)](https://eprint.iacr.org/2023/843.pdf)
- [Recovery Methods in Wallets — Dynamic.xyz](https://www.dynamic.xyz/blog/recovery-methods-in-wallets-an-overview)
- [Seed Phrase Security Ranked — Techitez](https://techitez.org/cryptocurrency/seed-phrase-security-ranked/)
- [BIP39 Word List — Datarecovery.com](https://datarecovery.com/rd/what-is-the-bip39-word-list-and-how-does-it-work/)

---

## 2. Safe Area Standardization (iOS Notch, Android Cutout, Home Indicator)

### Key Findings

- **`env(safe-area-inset-*)` has 96.78% browser support** and is the standard approach. Four values: `top`, `bottom`, `left`, `right`. Must set `viewport-fit=cover` in the viewport meta tag for these to have non-zero values.
- **Best pattern**: `padding-top: max(16px, env(safe-area-inset-top))` — combines baseline spacing with safe area. Apply only to fixed headers, sticky footers, and full-screen overlays. Do NOT add insets everywhere.
- **Android 16+ (API 36) enforces edge-to-edge** — apps can no longer opt out. Capacitor 8 handles this, but the `@capacitor/status-bar` plugin's overlay options no longer work on Android 16+. Use the newer `@capacitor/system-bars` plugin instead.
- **`@capacitor-community/safe-area` plugin** patches safe area CSS variables for older Chromium (<140) on Android. Essential for broad device support.
- **Tailwind plugin `tailwindcss-safe-area`** provides utility classes: `pt-safe`, `pb-safe`, `px-safe`, `pl-safe`, `pr-safe` plus `m-safe-*` variants. Alternatively, extend Tailwind with custom `@layer utilities`.
- **Cap-go `tailwind-capacitor`** plugin also provides safe area utilities specifically designed for Capacitor apps.

### Best Approach for Our Stack

1. Ensure `<meta name="viewport" content="..., viewport-fit=cover">` is set in `index.html`
2. Install `tailwindcss-safe-area` plugin for utility classes
3. Apply `pt-safe` to main app header/status bar area
4. Apply `pb-safe` to bottom navigation (`BottomTabs.tsx`) and fixed-bottom elements
5. Use `max()` function pattern for areas needing both baseline + safe area padding
6. Install `@capacitor-community/safe-area` for Android <140 Chromium fallback
7. Migrate from `@capacitor/status-bar` to `@capacitor/system-bars` for Android 16+ compatibility

### Pitfalls to Avoid

- Forgetting `viewport-fit=cover` — without it, all `env(safe-area-inset-*)` values are 0
- Adding safe area insets to every element — causes oversized spacing on non-notched devices
- Using `@capacitor/status-bar` overlay config on Android 16+ — it silently fails
- Not testing landscape mode — left/right insets matter on phones with notch in landscape
- The `transform` CSS property creates a new containing block — fixed elements inside transformed parents need `createPortal` (already documented in project modal rules)

### Sources

- [MDN — env() CSS function](https://developer.mozilla.org/en-US/docs/Web/CSS/env)
- [CSS-Tricks — The Notch and CSS](https://css-tricks.com/the-notch-and-css/)
- [Capacitor System Bars Plugin](https://capacitorjs.com/docs/apis/system-bars)
- [Capacitor Status Bar Plugin](https://capacitorjs.com/docs/apis/status-bar)
- [@capacitor-community/safe-area GitHub](https://github.com/capacitor-community/safe-area)
- [tailwindcss-safe-area GitHub](https://github.com/mvllow/tailwindcss-safe-area)
- [Medium — env() Safe Area Insets in CSS with React and Tailwind](https://medium.com/@developerr.ayush/understanding-env-safe-area-insets-in-css-from-basics-to-react-and-tailwind-a0b65811a8ab)
- [Cap-go tailwind-capacitor safe areas](https://github.com/Cap-go/tailwind-capacitor/blob/main/docs/safe-areas.md)

---

## 3. Keyboard Handling on Mobile (Virtual Keyboard)

### Key Findings

- **`interactive-widget=resizes-content`** in the viewport meta tag is the modern solution. Forces Android Chrome (108+) and Firefox (132+) to resize the layout viewport when the keyboard opens, making `dvh` units and `bottom: 0` fixed elements work correctly. NOT supported on iOS Safari (WebKit ignores it).
- **iOS Safari behavior**: Keyboard overlays the page. The layout viewport does NOT resize. `window.innerHeight` stays the same. iOS auto-scrolls the focused input into view. Fixed elements at `bottom: 0` get hidden behind the keyboard.
- **Android behavior**: Keyboard pushes content up by default. `window.innerHeight` decreases. Fixed `bottom: 0` elements naturally sit above the keyboard.
- **`visualViewport` API**: `window.visualViewport.height` and `resize` event give actual visible area. Works on both iOS and Android. Use this for JavaScript-based solutions.
- **Capacitor Keyboard plugin**: `resize: "none"` prevents webview resize (you handle it manually). `resize: "body"` (default on iOS) resizes body. `resize: "native"` (default on Android) uses native resize. Events: `keyboardWillShow`, `keyboardDidShow`, `keyboardWillHide`, `keyboardDidHide` with `keyboardHeight`.
- **`inputmode` attribute**: Use `inputmode="numeric"` for PIN/code inputs, `inputmode="email"` for email fields, `inputmode="url"` for URLs. Reduces virtual keyboard switching friction.
- **Known bug**: Capacitor Keyboard v6 `adjustPan` doesn't fire events on Android SDK <30. Use `adjustResize` for broader compatibility.
- **CSS `dvh` unit**: Dynamic viewport height accounts for browser chrome but NOT the virtual keyboard (by design). Combine with `interactive-widget=resizes-content` to make dvh keyboard-aware.

### Best Approach for Our Stack

1. Add `interactive-widget=resizes-content` to viewport meta tag in `index.html`
2. Use Capacitor Keyboard plugin with `resize: "none"` for manual control
3. Create a `useKeyboardHeight` hook that listens to both Capacitor keyboard events AND `visualViewport` resize
4. For the journal editor: use the keyboard height to set CSS variable `--keyboard-height` and adjust layout
5. Use `inputmode` attributes on all form inputs
6. For iOS: use `visualViewport` API to detect keyboard and scroll/pad content
7. For Android: rely on `interactive-widget=resizes-content` + dvh

### Pitfalls to Avoid

- Using `100vh` for full-height layouts on mobile — breaks on both iOS (address bar) and Android (keyboard)
- Assuming `dvh` handles the keyboard — it does NOT unless `interactive-widget=resizes-content` is set
- Using `adjustPan` in Capacitor config — broken on older Android SDKs
- Not testing with hardware keyboards — they don't trigger virtual keyboard events
- iOS `position: fixed` + `bottom: 0` is unreliable when keyboard is open — use `absolute` positioning within a flex container instead
- Forgetting that `interactive-widget` is Chrome/Firefox only — iOS Safari needs a separate solution

### Sources

- [HTMHell — interactive-widget viewport meta tag](https://www.htmhell.dev/adventcalendar/2024/4/)
- [Chrome Blog — Viewport Resize Behavior](https://developer.chrome.com/blog/viewport-resize-behavior)
- [DEV.to — Fix mobile keyboard overlap with VisualViewport](https://dev.to/franciscomoretti/fix-mobile-keyboard-overlap-with-visualviewport-3a4a)
- [MDN — VirtualKeyboard API](https://developer.mozilla.org/en-US/docs/Web/API/VirtualKeyboard_API)
- [Capacitor Keyboard Plugin API](https://capacitorjs.com/docs/apis/keyboard)
- [Ionic Blog — Keyboard improvements](https://ionic.io/blog/keyboard-improvements-for-ionic-apps)
- [OpenSourceBeat — CSS dvh's Mobile Keyboard Blind Spot](https://opensourcebeat.com/article/why-css-dvh-ignores-the-mobile-keyboard-and-how-to-fix-it/)
- [Bram.us — VirtualKeyboard API](https://www.bram.us/2021/09/13/prevent-items-from-being-hidden-underneath-the-virtual-keyboard-by-means-of-the-virtualkeyboard-api/)
- [GitHub — Capacitor Keyboard adjustPan issue #2158](https://github.com/ionic-team/capacitor-plugins/issues/2158)

---

## 4. Editor Flexbox Decomposition (Rich Text Editor Layout)

### Key Findings

- **Canonical mobile editor layout** is a 3-part flex column:
  ```
  Container (h-dvh flex flex-col)
  ├── Header (flex-shrink-0) — fixed height, back button, title, actions
  ├── Editor (flex-1 overflow-y-auto) — scrollable content area
  └── Toolbar (flex-shrink-0) — formatting buttons, sits above keyboard
  ```
- **TipTap/ProseMirror** is the recommended rich text editor for React in 2025. Headless architecture means full control over layout and styling. The `@tiptap/react` package provides `useEditor` hook and `EditorContent` component.
- **Toolbar above keyboard**: On Android with `interactive-widget=resizes-content`, a toolbar at the bottom of the flex column naturally sits above the keyboard. On iOS, you must use `visualViewport` to calculate keyboard height and position the toolbar.
- **The key CSS pattern**:
  ```css
  .editor-container {
    display: flex;
    flex-direction: column;
    height: 100dvh; /* or calc(100dvh - var(--keyboard-height, 0px)) on iOS */
  }
  .editor-content {
    flex: 1;
    overflow-y: auto;
    min-height: 0; /* critical: prevents flex child from overflowing */
  }
  ```
- **`min-height: 0`** on the flex-1 editor area is critical — without it, the content can overflow the flex container instead of scrolling.
- **Scroll behavior**: When editor content grows beyond viewport, the editor area scrolls independently. The cursor should auto-scroll into view (ProseMirror handles this natively via `scrollIntoView`).
- **BubbleMenu and FloatingMenu** in TipTap both debounce resize/scroll events, which helps with keyboard animations.

### Best Approach for Our Stack

1. Structure journal editor as flex column: Header + EditorContent (flex-1) + Toolbar
2. Use TipTap with `@tiptap/react` for the editor (if upgrading from current editor)
3. Set container to `h-dvh flex flex-col` (Tailwind)
4. Editor area: `flex-1 overflow-y-auto min-h-0`
5. Toolbar: `flex-shrink-0` with safe-area bottom padding
6. On iOS: use `useKeyboardHeight` hook to subtract keyboard height from container
7. On Android: rely on `interactive-widget=resizes-content` viewport setting
8. Use `will-change: transform` sparingly — it breaks `position: fixed` children

### Pitfalls to Avoid

- Missing `min-h-0` (or `min-height: 0`) on the flex-1 editor — content overflows instead of scrolling
- Using `position: fixed` for the toolbar — breaks inside flex containers and when keyboard is open on iOS
- Not handling the keyboard animation — toolbar jumps instead of smoothly following keyboard
- Forgetting `overflow-y-auto` on the editor — long content pushes toolbar off-screen
- `100vh` instead of `100dvh` — address bar on mobile makes content taller than viewport

### Sources

- [TipTap Editor — React Installation](https://tiptap.dev/docs/editor/getting-started/install/react)
- [Liveblocks — Rich Text Editor Framework Comparison 2025](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025)
- [CSS-Tricks — Complete Guide to Flexbox](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)
- [DEV.to — Fix mobile keyboard overlap with VisualViewport](https://dev.to/franciscomoretti/fix-mobile-keyboard-overlap-with-visualviewport-3a4a)
- [Freshman.tech — Mobile App Layout with CSS Flexbox](https://freshman.tech/flexbox-mobile-app/)
- [MobileSpoon — 10 Usability Rules for Keyboard in Mobile Apps](https://www.mobilespoon.net/2018/12/10-usability-rules-keyboard-mobile-app.html)

---

## 5. iPad Split Screen / Multitasking Support

### Key Findings

- **iPadOS 26 (June 2025) REMOVED Split View and Slide Over** and replaced them with a Mac-style windowing system using traffic-light controls and window tiling. iPadOS 26.1 re-added basic Slide Over. iPadOS 26.2 further improved it. This is a seismic shift for iPad app layout.
- **New windowing model**: Apps can be freely resized to any width, not just 1/3, 1/2, 2/3 splits. Window tiling (snap to half/quarter) is available via traffic-light button long-press.
- **For web apps in Capacitor**: The viewport width changes dynamically as windows are resized. Standard responsive CSS works — no special iPad detection needed.
- **iPad CSS viewport widths** (full-screen, pre-iPadOS 26 reference):
  - iPad mini: 768 x 1024 CSS px
  - iPad Air / iPad 10: 810 x 1080 CSS px (or 820 x 1180)
  - iPad Pro 11": 834 x 1194 CSS px
  - iPad Pro 12.9": 1024 x 1366 CSS px
- **Legacy split view widths** (iPadOS 15-18, still relevant for older devices):
  - 1/3 split on 12.9" Pro: ~320-375 CSS px (phone-like)
  - 1/2 split on 12.9" Pro: ~507-512 CSS px
  - 2/3 split on 12.9" Pro: ~694-700 CSS px
- **Content-driven breakpoints are essential**: Do NOT target specific iPad models. Test at widths: 320, 375, 414, 512, 700, 768, 834, 1024. If your layout works at these widths, it works for all iPad multitasking modes.
- **No reliable API to detect "iPad multitasking mode"** — just respond to viewport width changes. CSS `@media (min-width: ...)` handles everything.

### Best Approach for Our Stack

1. Use content-driven Tailwind breakpoints: `sm:` (640px), `md:` (768px), `lg:` (1024px)
2. Ensure the app looks good at ALL widths from 320px to 1400px+
3. At narrow widths (<640px): single-column phone layout
4. At medium widths (640-1023px): optional two-column, larger touch targets
5. At wide widths (1024px+): full desktop layout with sidebar
6. Test by manually resizing browser window to iPad split-view widths
7. Use `resize` observer or CSS container queries for component-level responsiveness
8. Do NOT add iPad-specific media queries based on device dimensions

### Pitfalls to Avoid

- Targeting specific iPad models with CSS media queries — these overlap with desktop breakpoints
- Assuming fixed split ratios (1/3, 1/2, 2/3) — iPadOS 26+ allows free-form resizing
- Not testing at ~320px width — a tiled iPad window can be very narrow
- Using `window.innerWidth` for layout decisions instead of CSS media queries / container queries
- Forgetting that iPad Safari renders web content at desktop scale (unlike iPhone Safari)

### Sources

- [MacRumors — iPadOS 26 Removes Split View and Slide Over](https://www.macrumors.com/2025/06/10/ipados-26-no-split-view-slide-over/)
- [9to5Mac — iPadOS 26 removes Split View and Slide Over](https://9to5mac.com/2025/06/09/psa-ipados-26-removes-split-view-and-slide-over-multitasking-features/)
- [AppleInsider — New iPad App Windows in iPadOS 26](https://appleinsider.com/inside/ipados-26/tips/whats-new-with-ipad-app-windows-in-ipados-26-and-how-they-work)
- [Screen Size Checker — iPad Viewport Sizes 2026](https://screensizechecker.com/devices/ipad-viewport-sizes)
- [BrowserStack — Responsive Design Breakpoints 2025](https://www.browserstack.com/guide/responsive-design-breakpoints)
- [Apple Developer — Adopting Multitasking on iPad](https://developer.apple.com/library/archive/documentation/WindowsViews/Conceptual/AdoptingMultitaskingOniPad/index.html)

---

## 6. Periodic PIN Reinforcement (Security UX)

### Key Findings

- **Industry standards for timeout/re-auth**:
  - NIST: re-authenticate every 12 hours, terminate after 30 min inactivity
  - OWASP: 2-5 min idle timeout for high-risk (financial), 15-30 min for low-risk
  - Android Developer docs: 15-minute biometric timeout, require additional auth before sensitive actions
- **Bitwarden model**: Configurable vault timeout (1 min, 5 min, 15 min, 30 min, 1 hr, 4 hr, on restart, never). Timeout action: Lock (biometric/PIN to reopen) or Log out (full re-auth). PIN unlock option available as alternative to master password.
- **1Password model**: Configurable "require account password" interval. Auto-lock on exit. Biometric unlock with periodic full password re-auth. More granular than Bitwarden.
- **Risk-based approach**: Not all actions need the same level of auth. Pattern from banking apps:
  - View-only actions: no re-auth needed
  - Editing profile/settings: quick biometric check
  - Exporting data / deleting account: full password re-auth
  - Financial transactions: PIN + biometric
- **Biometric + PIN fallback is mandatory**: Not all devices support biometrics. Not all users can use biometrics (accessibility). PIN must always be available as fallback. Banks use this pattern: FaceID/TouchID first, PIN if biometric fails, password as last resort.
- **UX research**: 88% of users won't return after a bad UX encounter. Over-aggressive re-auth is a top complaint. The sweet spot: lock on app background (>5 min), biometric unlock (instant), full password re-auth every 14 days or on new device.

### Best Approach for Our Stack

For ZenFlow (journal/mental health app — medium sensitivity):

1. **App lock**: Optional, user-enabled. PIN (4-6 digits) or biometric
2. **Lock trigger**: When app goes to background for >5 minutes (configurable: 1/5/15/30 min, immediately)
3. **Unlock**: Biometric first (if available), PIN fallback
4. **Full re-auth**: Every 14 days or on new device login, require full password
5. **Sensitive actions**: Export data, delete account, change password — require PIN/biometric regardless of session state
6. **Implementation**: Use Capacitor `App` plugin's `appStateChange` event to detect background. Store lock timestamp in memory (not IndexedDB for security). On resume, check elapsed time.
7. **No server-side session timeout** for offline-first app — handle entirely client-side

### Pitfalls to Avoid

- Making PIN lock mandatory — it is a journal app, not a bank. Let users opt in.
- Too-short default timeout — 1 minute is annoying. 5 minutes is the sweet spot default.
- Not offering "lock immediately" option for users who want maximum security
- SMS-based recovery — vulnerable to SIM swapping. Use email or account password instead.
- Storing PIN in plain text — hash with PBKDF2 + device-specific salt
- Not clearing sensitive data from memory on lock — journal entries should be cleared from Zustand on lock
- Forgetting accessibility: some users cannot use biometrics. PIN must always work.

### Sources

- [Descope — Session Timeout Best Practices](https://www.descope.com/learn/post/session-timeout-best-practices)
- [Android Developers — Secure User Authentication](https://developer.android.com/security/fraud-prevention/authentication)
- [Auth0 — Balance UX and Security](https://auth0.com/blog/balance-user-experience-and-security-to-retain-customers/)
- [Bitwarden — Vault Timeout](https://bitwarden.com/help/vault-timeout/)
- [Bitwarden — Unlock with PIN](https://bitwarden.com/help/unlock-with-pin/)
- [1Password — Auto-lock Settings](https://support.1password.com/unlock-auto-lock/)
- [Orbix Studio — Biometric Authentication UX Design Guide](https://www.orbix.studio/blogs/biometric-authentication-app-design)
- [Authgear — Login & Signup UX 2025 Guide](https://www.authgear.com/post/login-signup-ux-guide)

---

## Cross-Topic Summary: Priority Implementation Order

| Priority | Topic                      | Effort | Impact                                     |
| -------- | -------------------------- | ------ | ------------------------------------------ |
| 1        | Safe Area Standardization  | Low    | High — affects every screen                |
| 2        | Keyboard Handling          | Medium | High — journal editor UX                   |
| 3        | Editor Flex Decomposition  | Medium | High — core journal feature                |
| 4        | iPad Multitasking          | Low    | Medium — responsive already, needs testing |
| 5        | Periodic PIN Reinforcement | Medium | Medium — security feature                  |
| 6        | Recovery Phrase System     | High   | Low — Supabase auth covers most cases      |

### Quick Wins (implement first)

1. Add `viewport-fit=cover` and `interactive-widget=resizes-content` to viewport meta tag
2. Install `tailwindcss-safe-area` plugin
3. Add `pt-safe` / `pb-safe` to header and bottom nav
4. Create `useKeyboardHeight` hook using Capacitor Keyboard + visualViewport
5. Restructure journal editor as flex column with `min-h-0` on editor area
