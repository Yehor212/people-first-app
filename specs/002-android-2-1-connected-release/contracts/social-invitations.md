# Social Discovery and Invitation Contract

> **PRE-RECOVERY / SUPERSEDED SCOPE:** challenge-only ranking is no longer the requested product boundary. The current S1 plan includes separately gated public profiles/search, global and challenge rankings, invitations/manual/link/QR, age state, UGC/moderation and child safety. Nothing is implementation-authorized.

## User placement and ownership

ZenFlow keeps five primary V2 destinations. The ordinary social path is:

```text
Habits
  -> Friends & Challenges (secondary 48dp action)
    -> Challenges | Friends (sibling hub views)
      -> selected challenge details
        -> personal progress
        -> participant leaderboard
        -> invite code / Copy / Share / QR display
```

An eligible habit may also expose `Challenge friends`, opening challenge creation with that exact habit. A verified invitation may open a confirmation preview directly, but a deep link is not the only discoverability path. `V2ProgressionModalLayer` remains the modal owner; the social implementation must not add a competing portal or sixth tab.

Back order is deterministic:

```text
scanner or confirmation preview -> invite view -> challenge details or hub -> Habits
challenge details -> social hub -> Habits
social hub -> Habits
```

Visible Back/Close, Escape where keyboard input exists, and Android Back produce the same one-layer unwind and never activate the first action in a dialog. Focus returns to the invoking element when it still exists.

## Untrusted transport schemas

The canonical link origin is an allowlisted HTTPS origin. Custom-scheme links may be read only as a legacy compatibility input and must normalize through the same parser; they are not the canonical share output.

```json
{
  "version": 1,
  "type": "friend",
  "origin": "https://<allowlisted-zenflow-origin>",
  "code": "<opaque-bounded-code>"
}
```

```json
{
  "version": 1,
  "type": "challenge",
  "origin": "https://<allowlisted-zenflow-origin>",
  "code": "<opaque-bounded-code>"
}
```

The examples define shape, not deployable values. The allowlisted production host and exact code grammar are bound in reviewed configuration and tests before implementation. The envelope must not contain an auth/session token, raw user ID, email, profile field, friend graph, habit name/icon/history, participant list, mood/journal/focus content, arbitrary redirect or executable content.

Parser limits are fixed before lookup: one known version, exact type, exact allowed origin, bounded total URL/envelope bytes, bounded code length/alphabet, no duplicate fields and no passthrough keys. Cross-type, unknown-version, hostile-origin, malformed encoding and oversize input return a typed invalid state and perform zero storage/network mutation.

## Resolution and redemption

Manual entry, App/Universal Link, Copy/Share URL and scanned QR all use the same sequence:

```text
decode (zero writes)
  -> authenticated server resolve
    -> canonical minimal preview + opaque redemption revision
      -> explicit Add Friend or Join Challenge
        -> server compare-and-set redemption
          -> canonical local/sync projection
```

The resolver derives the actor from the authenticated session and enforces RLS, expiry, revocation, issuer membership, self/duplicate checks, blocked/removed relationships, challenge existence/status/capacity and rate limits. The preview contains only the minimum current server facts needed to decide. It never trusts embedded challenge metadata.

The redemption call consumes the exact preview revision or returns a typed conflict. Decode, resolve, cancelled preview, scanner cancellation and offline/unauthenticated input create no friend/challenge record. In particular, manual `ZEN-*` input must never create `Friend Challenge`, an inferred seven-day duration, a generic icon or unknown creator.

## UI states and copy boundary

Every invitation surface has localized states for idle, resolving, preview, confirming, success, invalid, expired, revoked, self, already connected/member, blocked, rate-limited, offline, signed out, unavailable and retryable server error. Copy describes the next action and recovery; it does not imply that scanning added a person or joined a challenge.

The QR itself is static, high contrast, has the required quiet zone and is not covered by animation, badges or gradients. The same screen exposes selectable text plus Copy and Share. The scanner is opened only by an explicit action and has Cancel/manual-entry recovery. Camera frames and decoded payloads are never logged, synchronized, backed up or retained as analytics.

## Platform contract

| Platform | Required path | Scanner boundary |
|---|---|---|
| Web/Vite | HTTPS link, Copy, Share when supported, manual input and confirmation | Camera enhancement only in a secure context with explicit permission; manual path always remains |
| Installed PWA | Same as Web with update/offline recovery and standalone return | Permission/lifecycle must be tested independently; no installed claim from browser tab proof |
| Android/Capacitor | Verified App Link, Copy/Share, manual input, explicit confirmation and Android Back | Prefer permissionless Google Code Scanner only after exact dependency/license/Play-services approval; test denial/cancel/background/no-services |
| iOS/WKWebView | Universal Link plus Copy/Share/manual confirmation | Associated-domain entitlement and camera lifecycle remain separate proof; custom scheme is fallback only |
| Desktop/Tauri | HTTPS/clipboard/manual confirmation | Scanner may be intentionally N/A; display/manual entry remain complete |

No generator/scanner production dependency or server RPC is authorized by this contract. Adoption requires an exact source/revision/license/size/platform review and explicit approval under repository policy.

## Eight-locale and accessibility acceptance

The complete locale set is `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, `he`. Each exercises the full Habits → hub → details → leaderboard → invite → unwind path at 200% text. `ar` and `he` additionally verify logical alignment, bidi isolation for codes/ranks/numbers and mirrored directional icons. Interactive targets are at least 48dp for the Android-first surface. The participant list remains a named keyboard-scrollable region; QR meaning is available as text; success/error is announced without moving focus unexpectedly.

## Rejection and evidence criteria

Reject implementation if it:

- adds a sixth primary destination or hides the ordinary entry behind Settings/deep links;
- encodes current domain/profile/history data in the invitation;
- writes before explicit confirmed redemption;
- creates placeholder records when the server is unavailable;
- combines friend and challenge intent into one ambiguous type;
- makes camera/scanning the only path;
- claims verified App/Universal Links, camera, server truth, physical-device behavior or human acceptance without exact evidence.

Required evidence is a RED→GREEN parser/resolver/component suite, all-eight component and signed-in journey matrix, Android App Link verification for the candidate signing identity, installed-platform scanner/cancellation tests when adopted, server RLS/rate-limit/revocation proof, and separate human accessibility/craft status.
