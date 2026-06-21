# Apple Sign-In With Supabase

ZenFlow uses Supabase Auth as the backend for Apple sign-in. Keep `VITE_APPLE_PUBLIC_ACCESS_READY=false` until hosted Supabase Auth settings report `external.apple=true`; this hides the public button instead of presenting a dead OAuth path. Do not add Apple
private keys, client secrets, Supabase access tokens, service-role keys, or `.p8`
contents to this repo or to any `VITE_*` variable.

## What Is In The App

- Entry sign-in button: `src/components/auth-screen/AuthScreen.tsx`
- Provider config: `src/lib/authProviders.ts`
- Entry availability: Apple stays visible on every enabled platform so accounts
  created with Apple can sign in again from web, desktop, Android, and iOS.
- App-side preflight: `src/lib/appleAuthAvailability.ts` checks the public
  Supabase Auth settings endpoint before launching Apple OAuth. It blocks only a
  known disabled/missing Apple provider; temporary unknown/network states fall
  through to the normal OAuth flow.
- Native callback scheme: `com.zenflow.app://login-callback`
- Public app URL: `https://yehor212.github.io/people-first-app/`
- V2 phone flow: `https://yehor212.github.io/people-first-app/orb?nav=v2&navLayout=phone`
- Client public Supabase key: prefer `VITE_SUPABASE_PUBLISHABLE_KEY`;
  `VITE_SUPABASE_ANON_KEY` remains a legacy fallback.
- Readiness check: `npm run check:auth-providers`
- Public hosted provider check: `npm run check:apple-auth-public`
- Secretless activation packet: `npm run check:apple-auth-activation`
- Hosted Supabase proof check: `npm run check:apple-auth-live`
- Full Apple Auth gate: `npm run check:apple-auth-complete`
- Apple client secret generator: `npm run generate:apple-client-secret`
- Hosted Supabase apply command: `npm run apply:apple-auth-live`
- Guided hosted activation: `npm run activate:apple-auth-live`

## Apple Developer Setup

1. In Apple Developer, enable **Sign in with Apple** on the app identifier for
   the native bundle, for example `com.zenflow.app`.
2. Create or confirm a Services ID for web/OAuth sign-in, for example
   `com.zenflow.app.web`.
3. On the Services ID, configure the Website URL domain as the Supabase project
   domain, for example `bwgfslmxmueyglpumkbf.supabase.co`.
4. Set the Apple return URL to:
   `https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/callback`.
5. Create a Sign in with Apple key and generate the Apple client secret for the
   Services ID. Store the `.p8` file securely outside the repo.
6. Set a recurring six-month rotation reminder for the Apple client secret.

## Supabase Hosted Dashboard Setup

In Supabase Dashboard, open **Authentication -> Providers -> Apple** and set:

- Enabled: on
- Client IDs: include the web Services ID and native bundle IDs that should log in
- Secret: the generated Apple client secret

Then open **Authentication -> URL Configuration**:

- Site URL: `https://yehor212.github.io/people-first-app/`
- Additional redirect URLs:
  - `https://yehor212.github.io/people-first-app/`
  - `https://yehor212.github.io/people-first-app/orb?nav=v2`
  - `https://yehor212.github.io/people-first-app/orb?nav=v2&navLayout=phone`
  - `https://yehor212.github.io/people-first-app/habits?nav=v2`
  - `https://yehor212.github.io/people-first-app/diary?nav=v2`
  - `https://yehor212.github.io/people-first-app/settings?nav=v2`
  - `capacitor://localhost/`
  - `com.zenflow.app://login-callback`
  - Local development URLs from `supabase/config.toml` when needed

For the app client, configure `VITE_SUPABASE_URL` plus one public browser/mobile
key. Prefer `VITE_SUPABASE_PUBLISHABLE_KEY`; keep `VITE_SUPABASE_ANON_KEY` only
for older deployments that have not migrated yet. `.env.example` placeholders
are documentation only and are ignored by the live readiness checks. In strict
release/handoff mode, `npm run check:auth-providers -- --strict` requires the
modern publishable key and fails if server-only secrets such as
`SUPABASE_SERVICE_ROLE_KEY` are present in loaded local env files or process env.

For local Supabase CLI runs, provide these server-side environment variables in
the local shell or a secret manager, not in client env:

```bash
export SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID="com.zenflow.app.web"
export SUPABASE_AUTH_EXTERNAL_APPLE_SECRET="generated-apple-client-secret"
```

## Apple Client Secret Generation

Apple's OAuth client secret is a signed ES256 JWT. Generate it locally from the
Apple Team ID, Key ID, Services ID, and the private `.p8` signing key when you
need to store or rotate the value in a secret manager. The repo helper does not
read Apple secrets from `.env*` files, does not print the JWT by default, and
never prints the private key.

```bash
export SUPABASE_APPLE_TEAM_ID="TEAMID1234"
export SUPABASE_APPLE_KEY_ID="KEYID12345"
export SUPABASE_APPLE_CLIENT_ID="com.zenflow.app.web"
export SUPABASE_APPLE_PRIVATE_KEY_PATH="$HOME/secure/AuthKey_KEYID12345.p8"

npm run generate:apple-client-secret
export SUPABASE_APPLE_CLIENT_SECRET="$(npm run --silent generate:apple-client-secret -- --print-secret)"
```

The generated JWT defaults to 180 days. Rotate it before expiry and update the
hosted Supabase Apple provider immediately after rotation.

The activation packet decodes only the JWT payload expiry (`exp`) when
`SUPABASE_APPLE_CLIENT_SECRET` is present. It does not print the JWT and does not
verify the signature; the check exists to catch expired or near-expiring secrets
before applying hosted Apple Auth. A secret expiring within 14 days is treated as
not ready and should be rotated first.

## Supabase Hosted Apply Command

For the safest owner handoff, run `npm run activate:apple-auth-live` on the local
machine. It prompts for missing Supabase and Apple values locally, masks typed
inputs, sets the explicit apply confirmation in memory, and then calls the same
Management API apply flow below. After a successful apply, it immediately runs
the public Auth settings check and hosted Management API check with the same
in-memory values. It does not print the Supabase access token, Apple client
secret, or signing-key values. When asked for
`SUPABASE_APPLE_SECRET_SOURCE`, choose `client-secret` to paste an existing
Apple OAuth client secret, or `signing-key` to generate the secret locally from
Apple Team ID, Key ID, Services ID, and a private `.p8` key path.

The hosted apply command uses the Supabase Management API to set Apple Auth and
merge the required redirect URLs without printing tokens or Apple secrets. It also
preserves existing hosted Apple additional client IDs and appends new native bundle
IDs without duplicates. It is a dry run unless
`ZENFLOW_APPLE_AUTH_APPLY_CONFIRM=true` is present.

Provide values from Apple Developer and Supabase in the shell or a secret
manager, not in `.env*` files and not in `VITE_*` variables. If
`SUPABASE_APPLE_CLIENT_SECRET` is missing, the apply command can generate it in
memory from the Apple signing-key inputs and send only the generated JWT to the
Supabase Management API request.

```bash
export SUPABASE_ACCESS_TOKEN="supabase-management-api-token"
export SUPABASE_PROJECT_REF="bwgfslmxmueyglpumkbf"

export SUPABASE_APPLE_TEAM_ID="TEAMID1234"
export SUPABASE_APPLE_KEY_ID="KEYID12345"
export SUPABASE_APPLE_CLIENT_ID="com.zenflow.app.web"
export SUPABASE_APPLE_PRIVATE_KEY_PATH="$HOME/secure/AuthKey_KEYID12345.p8"
export SUPABASE_APPLE_ADDITIONAL_CLIENT_IDS="com.zenflow.app"

npm run apply:apple-auth-live
ZENFLOW_APPLE_AUTH_APPLY_CONFIRM=true npm run apply:apple-auth-live

# Guided local prompt flow for the same hosted apply step.
# Choose client-secret or signing-key when prompted.
npm run activate:apple-auth-live
```

The guided activation command runs public and hosted verification automatically
after a successful apply. If you use the standalone `apply:apple-auth-live`
command, run `npm run check:apple-auth-live` with
`SUPABASE_EXPECTED_APPLE_CLIENT_ID` and, when native bundle IDs are configured,
`SUPABASE_EXPECTED_APPLE_ADDITIONAL_CLIENT_IDS` to verify the hosted state.

## Apple User Profile Behavior

Supabase's Apple OAuth flow may not provide a full name. ZenFlow keeps account
labels tied to the user's email when available, but the in-app display name stays
friendly (\`Friend\`) until the user enters a name in onboarding or settings. Do
not use Apple private-relay email addresses as greeting/display-name text.

## Verification

Run the local readiness checks and activation packet:

```bash
npm run check:auth-providers
npm run check:apple-auth-activation
npm run check:apple-auth-public
npm test -- src/lib/__tests__/appleAuthAvailability.test.ts src/components/auth-screen/__tests__/useAuthHandlers.apple.test.tsx
npm test -- src/lib/__tests__/authProviders.test.ts
```

`check:apple-auth-activation` prints the exact Apple/Supabase callback, redirect,
and missing secret-env names needed to activate hosted Apple Auth without printing
secret values.

`check:apple-auth-public` calls the public Supabase Auth settings endpoint and
verifies that Apple is exposed to users without printing the public client key.
It does not prove the full redirect allow-list; use the management-level check
below for that.

After the Apple provider is configured in the hosted Supabase dashboard, verify
the live backend state without printing secrets:

```bash
export SUPABASE_ACCESS_TOKEN="supabase-management-api-token"
export SUPABASE_PROJECT_REF="bwgfslmxmueyglpumkbf"
export SUPABASE_EXPECTED_APPLE_CLIENT_ID="com.zenflow.app.web"
export SUPABASE_EXPECTED_APPLE_ADDITIONAL_CLIENT_IDS="com.zenflow.app"
npm run check:apple-auth-live
```

If those env vars are missing, the command reports `UNVERIFIED`. In release or
handoff gates, set `ZENFLOW_APPLE_AUTH_LIVE_REQUIRED=true` so missing live proof
exits non-zero.

After hosted dashboard setup, verify with a real login on:

- iOS Safari or iOS Capacitor build for App Store compliance
- Android Capacitor build through the OAuth browser flow
- Public GitHub Pages URL with a cache-buster after deployment

For release or handoff, use `npm run check:apple-auth-complete`. It must pass
before Apple sign-in can be called complete for users.

## References

- Supabase Login with Apple: https://supabase.com/docs/guides/auth/social-login/auth-apple
- Supabase Redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase Native Mobile Deep Linking: https://supabase.com/docs/guides/auth/native-mobile-deep-linking
- Supabase Management API Auth Config: https://supabase.com/docs/reference/api/v1-update-auth-service-config
- Apple Creating a Client Secret: https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret
- Apple Sign in Environment Setup: https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple
