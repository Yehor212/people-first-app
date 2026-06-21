# Facebook and Telegram Auth Setup

This project has client code for Facebook and Telegram sign-in, but provider
secrets must never be committed, logged, pasted into chat, or bundled into the
client app. Create and store secrets only in the official provider dashboards.

## Public Client Flags

Set these public Vite flags only after the matching provider is configured in
Supabase:

```env
VITE_ENABLE_FACEBOOK_AUTH=true
VITE_FACEBOOK_PUBLIC_ACCESS_READY=false
VITE_ENABLE_TELEGRAM_AUTH=true
```

Local provider defaults in `.env.example` are `true` once a dashboard provider
is configured. Facebook has one extra public-access gate: keep
`VITE_FACEBOOK_PUBLIC_ACCESS_READY=false` until Meta business verification and
App Review are approved, even if developer-role Facebook login works.

GitHub Pages and native CI builds pass these public flags explicitly:

- `VITE_ENABLE_FACEBOOK_AUTH` defaults to `true` because the ZenFlow Facebook app
  is configured.
- `VITE_FACEBOOK_PUBLIC_ACCESS_READY` must stay `false` until Meta approves
  public access for Facebook Login.
- `VITE_ENABLE_TELEGRAM_AUTH` defaults to `true` so Telegram is visible on
  the public entry screen. Set the GitHub repository variable to `false` only
  if the Supabase `custom:telegram` OIDC provider is intentionally disabled.

## Supabase Project

- Project name: `ZenFlow`
- Project ref: `bwgfslmxmueyglpumkbf`
- Native callback used by the app: `com.zenflow.app://login-callback`
- Built-in Facebook provider id used by the app: `facebook`
- Telegram custom provider id used by the app: `custom:telegram`

Add these redirect URLs in Supabase Auth URL configuration:

```text
https://yehor212.github.io/people-first-app/**
https://zenflow.app/**
http://localhost:5173/**
http://127.0.0.1:5173/**
http://localhost:5175/**
http://127.0.0.1:5175/**
com.zenflow.app://login-callback
```

Enable manual identity linking in Supabase Auth settings so
`supabase.auth.linkIdentity()` can attach Facebook or Telegram to an existing
account without replacing that account's sync data.

## Facebook Dashboard

1. Create or open the Facebook Developers app for ZenFlow.
2. Add Facebook Login.
3. Add this valid OAuth redirect URI:

```text
https://api.zenflowapp.online/auth/v1/callback
```

4. In Meta Use Cases > Authentication and Account Creation, make sure both
   `public_profile` and `email` are listed as Ready for testing. Hosted Supabase
   Facebook Auth requests both scopes; if Meta shows an invalid email scope
   error, the Meta app permission is not ready yet.
5. Copy the Facebook App ID and App Secret. Store them in Supabase/secret
   storage as `SUPABASE_AUTH_EXTERNAL_FACEBOOK_CLIENT_ID` and
   `SUPABASE_AUTH_EXTERNAL_FACEBOOK_SECRET`, never in client env.
6. In Supabase Auth Providers, enable Facebook and paste the App ID and Secret.
7. Enable `Allow users without an email` to keep provider behavior consistent
   with Telegram and prevent email-optional identities from being rejected.

Do not paste the Facebook secret into the repo or chat.

## Facebook Public Access

Developer-role Facebook login can succeed before the app is public, but regular
users need Meta approval for public Facebook Login access. Meta currently blocks
that submission until the ZenFlow business portfolio is verified. Use only free
official Meta flows: do not pay for Meta Verified, do not invent legal company
data, and do not upload placeholder documents.

Until Meta business verification and App Review are approved, keep:

```env
VITE_ENABLE_FACEBOOK_AUTH=true
VITE_FACEBOOK_PUBLIC_ACCESS_READY=false
```

That means the provider can remain configured and testable by developers, while
the public app hides the Facebook button instead of sending users into a broken
Meta approval screen. Keep the client OAuth request on Supabase's required
`email public_profile` scope set; if Meta shows an invalid email scope screen,
fix the permission in Meta Use Cases before enabling public access. After Meta
approves public access, set `VITE_FACEBOOK_PUBLIC_ACCESS_READY=true` in the
production build environment and rerun the readiness check.

## Telegram Dashboard

Telegram sign-in uses Telegram's OIDC flow through a Supabase custom provider.
The app client already calls Supabase with provider id `custom:telegram`; no
client-side Telegram secret is needed.

### BotFather

1. Create or open the ZenFlow Telegram bot in BotFather.
2. Replace the placeholder bot avatar before public login checks. The
   preferred free path is the repository script, which calls Telegram Bot API
   `setMyProfilePhoto` with the approved classic ZenFlow logo JPG:
   `docs/release/telegram/assets/zenflow-auth-bot-userpic.jpg`.

   ```bash
   npm --prefix tools/telegram-control run set-bot-ui -- --profile-photo-only --dry-run
   npm --prefix tools/telegram-control run set-bot-ui -- --profile-photo-only
   npm --prefix tools/telegram-control run check:bot-profile-photo
   ```

   The verifier uses Bot API `getUserProfilePhotos` and `getFile` to compare
   the live Telegram avatar with the approved repo JPG. Without
   `TELEGRAM_BOT_TOKEN` it reports `UNVERIFIED` instead of printing or
   guessing secrets.

   If the Bot API profile-photo call is unavailable for the account, use the
   manual fallback: send `/setuserpic` to BotFather, choose `@ZenFlowAuthBot`,
   and upload the same approved JPG asset. Either path removes the old `Z`
   avatar from the Telegram OAuth consent screen.

3. Open **Bot Settings → Web Login**.
4. Register these Allowed URLs:

```text
https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/callback
https://yehor212.github.io/people-first-app/
https://zenflow.app/
```

5. Copy the **Client ID** and **Client Secret** shown in BotFather.
6. Store them only in Supabase Dashboard or a local secret manager. Do not paste
   them into git, app code, screenshots, or chat.

### Supabase Custom Provider

In Supabase Dashboard → Auth → Providers → Custom OAuth Providers, create or
update this provider:

```text
identifier: custom:telegram
name: Telegram
provider type: OIDC / Auto-discovery
issuer: https://oauth.telegram.org
client_id: <BotFather Client ID>
client_secret: <BotFather Client Secret>
scopes: openid profile
pkce_enabled: true
email_optional: true
discovery_url: https://api.zenflowapp.online/functions/v1/telegram-oidc/.well-known/openid-configuration
```

Keep `phone` out of the default scopes. Telegram can return a verified phone
number with the `phone` scope, but that is extra personal data and needs an
explicit product/privacy decision before collection.

### Telegram JWKS Compatibility

As of 2026-06-20, Telegram's official JWKS includes an `ES256K` / `secp256k1`
signing key. Hosted Supabase Auth can fail the Telegram callback while decoding
that key before it completes the user session. ZenFlow keeps Telegram's official
issuer, authorization endpoint, token endpoint, PKCE flow, and client secret in
Supabase, but points Supabase custom provider discovery to the project-owned
compatibility endpoint above. That endpoint publishes the same Telegram OIDC
metadata with a project JWKS URL and removes only the unsupported `ES256K` /
`secp256k1` key from the proxied JWKS.

Deploy the Edge Function before setting `discovery_url`:

```bash
supabase functions deploy telegram-oidc --project-ref bwgfslmxmueyglpumkbf --no-verify-jwt
```

If Supabase Auth adds native support for Telegram's `secp256k1` JWKS, remove the
custom `discovery_url` override and use Telegram's official discovery URL again:

```text
https://oauth.telegram.org/.well-known/openid-configuration
```

### Hosted Supabase Auth Toggles

These hosted settings must be enabled before public Telegram login is considered
ready:

```text
custom_oauth_enabled: true
security_manual_linking_enabled: true
```

Manual linking matters because Settings uses `supabase.auth.linkIdentity()` to
attach Telegram to an existing account without splitting sync data into a second
account.

### Verification

Run these checks after the BotFather client credentials are configured in
Supabase:

```bash
npm run check:auth-providers -- --strict
npm run check:facebook-auth-public
npm run check:telegram-oidc-live
npm run test -- src/lib/__tests__/authProviders.test.ts scripts/__tests__/auth-providers-readiness.test.ts scripts/__tests__/telegram-oidc-proxy.test.ts
```

Then perform one real web login and one native callback login, confirming the
returned user has provider `custom:telegram` and a display name or
`preferred_username` even when no email is present.

If a real Telegram login still fails after the compatibility endpoint is live,
check Supabase Auth logs for the callback request and keep Telegram disabled via
`VITE_ENABLE_TELEGRAM_AUTH=false` until either the provider configuration or the
upstream Supabase Auth parser issue is fixed. Do not loosen token validation,
skip ID token verification, or store Telegram bot tokens in the client.

## Smoke Checklist

- Web/PWA first-run screen shows Google and Telegram by default, keeps Apple
  hidden until hosted Supabase Apple Auth is ready, and shows Facebook only when
  `VITE_FACEBOOK_PUBLIC_ACCESS_READY=true`.
- Settings account section shows the same providers for sign-in.
- Existing signed-in users can link a new provider without losing sync data.
- Telegram users without email show a display name or username and count as
  signed in.
- Telegram OIDC discovery URL points to the deployed `telegram-oidc` Edge
  Function while hosted Supabase Auth cannot decode Telegram's `secp256k1` JWKS.
- Android and iOS custom URL callbacks return through
  `com.zenflow.app://login-callback`.
- Supabase/Facebook/Telegram dashboard setup is complete before flipping public
  feature flags in production.
- Meta business verification and App Review are approved before setting
  `VITE_FACEBOOK_PUBLIC_ACCESS_READY=true`.

## Primary References

- Supabase Facebook Auth: https://supabase.com/docs/guides/auth/social-login/auth-facebook
- Supabase Custom OAuth/OIDC: https://supabase.com/docs/guides/auth/custom-oauth-providers
- Supabase Redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase Native Deep Linking: https://supabase.com/docs/guides/auth/native-mobile-deep-linking
- Supabase Identity Linking: https://supabase.com/docs/guides/auth/auth-identity-linking
- Capacitor Browser: https://capacitorjs.com/docs/apis/browser
- Telegram Login/OIDC: https://core.telegram.org/bots/telegram-login
