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

## Git workflow
- Single-branch workflow: work only on `main` unless a different branch is explicitly requested.
- Before push: sync `main`, keep the worktree intentional, and run `npm run ci:preflight`.
- Do not spread one task across multiple long-lived feature branches by default.

## Environment variables
Copy `.env.example` into one of:
- `.env.local` (dev)
- `.env.staging` (staging build)
- `.env.production` (production build)

Required:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` preferred, or legacy `VITE_SUPABASE_ANON_KEY` fallback

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

## ⚡ Quick Setup: Supabase Database

**Required for multi-device sync!**

Preferred path:
```sh
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

If you use the Supabase SQL Editor manually, do not stop at the first 2 historical migrations. The current repo state expects the full migration chain, including later security/performance fixes.

Minimum migrations to be aware of:
- `supabase/migrations/20260113_challenges_badges.sql`
- `supabase/migrations/20260114_tasks_quests.sql`
- `supabase/migrations/20260204_optimize_rls_policies.sql`
- `supabase/migrations/20260222_optimize_journal_rls.sql`

📖 **Full guide:** See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

## Release docs
- `docs/SMOKE_CHECKLIST.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/STORE_LISTING.md`

## Legal
- Privacy policy: `/public/privacy.html`
- Terms of service: `/public/terms.html`
