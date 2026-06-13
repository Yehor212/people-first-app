---
name: teamlead
description: "Orchestrate code changes: fix, add, refactor, improve, update, modify, implement, create, remove, change, optimize, enhance, migrate, build, design, style, debug, resolve, handle, configure, setup, integrate, connect, extend, extract, move, rename, delete, replace, convert, transform, upgrade, downgrade, install, uninstall, enable, disable, toggle, switch, adjust, tune, correct, repair, patch, hotfix, restore, recover, clean, format, lint, test, verify, validate, check, review, audit, scan, inspect, analyze, investigate, diagnose, troubleshoot"
user-invocable: true
---

# Team Lead Orchestration

Before writing code, consider what user may have forgotten:

- Cross-platform (Android back handler, safe-area, webkit prefix)
- Accessibility (aria-label, touch 44px, reduced-motion)
- i18n (8 languages: en, uk, es, de, fr, ja, ar, he. RTL for ar/he)
- Tests (run exact current command output; never rely on historical counts)
- State integrity (Zustand + Dexie + Supabase sync)
- Security (no secrets, no XSS, no injection)
- Performance (bundle, 60 FPS orb, lazy loading)
- Offline-first (SW, offline queue, sync)

Specialized builders in .claude/agents/:

- frontend-builder.md — React, Tailwind, Radix, Framer Motion, Gamification (NOT journal)
- journal-builder.md — Journal/Diary module (src/features/journal/)
- backend-builder.md — Supabase, edge functions, RLS, triggers, AI Coach
- shader-specialist.md — GLSL, orb, WebGL, superformula SDF, canvas
- pwa-native-specialist.md — SW, offline, Capacitor, plugins, ads, push
- test-engineer.md — Vitest tests, coverage, regression tests
- design-advisor.md — styles, palettes (READ-ONLY, consult user first)
- performance-agent.md — bundle, 60fps, re-renders (READ-ONLY)

Guardians (all READ-ONLY):

- platform-guardian.md, a11y-i18n-guardian.md (11 checks), state-async-guardian.md, security-quality-guardian.md

Verifier: verifier.md — 17 checks, runs automatically on Stop via agent hook.

Ruflo extensions (use when task warrants it):

- /sparc-methodology — SPARC phases for complex architecture (Spec→Pseudo→Arch→Refine→Complete)
- /swarm-orchestration — parallel multi-agent research with mesh/hierarchical topology
- /verification-quality — truth scoring (0.0-1.0) with auto-rollback at 0.95 threshold

ZERO VISUAL REGRESSION: Never change styles/layout/colors/animations without explicit user approval.
