# Facebook and Telegram Auth Setup

This project has client code for Facebook and Telegram sign-in, but provider
secrets must never be committed, logged, pasted into chat, or bundled into the
client app. Create and store secrets only in the official provider dashboards.

## Public Client Flags

Set these public Vite flags only after the matching provider is configured in
Supabase:

```env
VITE_ENABLE_FACEBOOK_AUTH=true
VITE_ENABLE_TELEGRAM_AUTH=true
```

Local defaults in `.env.example` are `true` so the approved entry screen
shows every supported social provider. Set a flag to `false` only when the
matching dashboard provider is intentionally unavailable.

GitHub Pages and native CI builds pass these public flags explicitly:

- `VITE_ENABLE_FACEBOOK_AUTH` defaults to `true` because the ZenFlow Facebook app
  is configured.
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

4. Confirm `public_profile` and `email` permissions are enabled.
5. Copy the Facebook App ID and App Secret.
6. In Supabase Auth Providers, enable Facebook and paste the App ID and Secret.
7. Enable `Allow users without an email` to keep provider behavior consistent
   with Telegram and prevent email-optional identities from being rejected.

Do not paste the Facebook secret into the repo or chat.

## Telegram Dashboard

Telegram sign-in uses Telegram's OIDC flow through a Supabase custom provider.
The app client already calls Supabase with provider id `custom:telegram`; no
client-side Telegram secret is needed.

### BotFather

1. Create or open the ZenFlow Telegram bot in BotFather.
2. Open **Bot Settings → Web Login**.
3. Register these Allowed URLs:

```text
https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/callback
https://yehor212.github.io/people-first-app/
https://zenflow.app/
```

4. Copy the **Client ID** and **Client Secret** shown in BotFather.
5. Store them only in Supabase Dashboard or a local secret manager. Do not paste
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
```

Keep `phone` out of the default scopes. Telegram can return a verified phone
number with the `phone` scope, but that is extra personal data and needs an
explicit product/privacy decision before collection.

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
npm run test -- src/lib/__tests__/authProviders.test.ts scripts/__tests__/auth-providers-readiness.test.ts
```

Then perform one real web login and one native callback login, confirming the
returned user has provider `custom:telegram` and a display name or
`preferred_username` even when no email is present.

## Smoke Checklist

- Web/PWA first-run screen shows Google, Facebook, and Telegram when both flags
  are true.
- Settings account section shows the same providers for sign-in.
- Existing signed-in users can link a new provider without losing sync data.
- Telegram users without email show a display name or username and count as
  signed in.
- Android and iOS custom URL callbacks return through
  `com.zenflow.app://login-callback`.
- Supabase/Facebook/Telegram dashboard setup is complete before flipping public
  feature flags in production.

## Primary References

- Supabase Facebook Auth: https://supabase.com/docs/guides/auth/social-login/auth-facebook
- Supabase Custom OAuth/OIDC: https://supabase.com/docs/guides/auth/custom-oauth-providers
- Supabase Redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase Native Deep Linking: https://supabase.com/docs/guides/auth/native-mobile-deep-linking
- Supabase Identity Linking: https://supabase.com/docs/guides/auth/auth-identity-linking
- Capacitor Browser: https://capacitorjs.com/docs/apis/browser
- Telegram Login/OIDC: https://core.telegram.org/bots/telegram-login
