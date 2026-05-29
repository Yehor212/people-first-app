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

Local defaults in `.env.example` stay `false` so unfinished dashboard setup does
not expose broken buttons in normal builds.

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
https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/callback
```

4. Confirm `public_profile` and `email` permissions are enabled.
5. Copy the Facebook App ID and App Secret.
6. In Supabase Auth Providers, enable Facebook and paste the App ID and Secret.

Do not paste the Facebook secret into the repo or chat.

## Telegram Dashboard

1. Create or open the Telegram bot in BotFather.
2. Configure the bot's Web Login / OAuth settings.
3. Use the callback URL shown by Supabase for the `custom:telegram` provider.
4. Store the Telegram Client ID and Client Secret securely.
5. In Supabase custom providers, create:

```text
identifier: custom:telegram
provider type: OIDC
issuer: https://oauth.telegram.org
scopes: openid profile
pkce_enabled: true
email_optional: true
```

Do not paste the Telegram secret into the repo or chat.

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
