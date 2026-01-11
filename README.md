# ZenFlow

Privacy-first wellness tracker with mood check-ins, habits, focus sessions, and gratitude.
Offline-first and designed for quick daily use.

## Tech stack
- Vite + React + TypeScript
- Tailwind CSS + shadcn-ui
- Capacitor (Android/iOS)

## Local development
```sh
npm install
npm run dev
```

## Environment variables
Copy `.env.example` into one of:
- `.env.local` (dev)
- `.env.staging` (staging build)
- `.env.production` (production build)

Required:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional:
- `VITE_VAPID_PUBLIC_KEY`

## Build
```sh
npm run build
```

## Capacitor sync
```sh
npx cap sync
```

## Release docs
- `docs/SMOKE_CHECKLIST.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/STORE_LISTING.md`

## Legal
- Privacy policy: `/public/privacy.html`
- Terms of service: `/public/terms.html`
